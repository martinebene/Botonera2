import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promises as archivos } from 'node:fs'
import { createConnection } from 'node:net'
import { resolve } from 'node:path'

const RAIZ_REPOSITORIO = resolve(__dirname, '../..')
const HOST_STACK = '127.0.0.1'
export const PUERTO_STACK = 18027
export const URL_STACK = `http://${HOST_STACK}:${PUERTO_STACK}`
const ESPERA_INICIO_MILISEGUNDOS = 30_000
const ESPERA_APAGADO_MILISEGUNDOS = 8_000

function esperar(milisegundos: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, milisegundos))
}

/** Comprueba el listener TCP sin asumir que un HTTP saludable es el único ocupante posible. */
export function puertoOcupado(): Promise<boolean> {
  return new Promise((resolver) => {
    const socket = createConnection({ host: HOST_STACK, port: PUERTO_STACK })
    socket.once('connect', () => {
      socket.destroy()
      resolver(true)
    })
    socket.once('error', () => resolver(false))
    socket.setTimeout(500, () => {
      socket.destroy()
      resolver(false)
    })
  })
}

async function esperarCondicion(
  condicion: () => Promise<boolean>,
  limiteMilisegundos: number,
): Promise<boolean> {
  const instanteLimite = Date.now() + limiteMilisegundos
  while (Date.now() < instanteLimite) {
    if (await condicion()) return true
    await esperar(100)
  }
  return false
}

/**
 * Administra únicamente el proceso de stack que creó la propia prueba.
 *
 * Nunca busca ni mata procesos por nombre. En POSIX crea un grupo aislado para
 * que una señal alcance al comando `uv` y al Python que éste ejecuta; en Windows
 * conserva el apagado directo compatible con `ChildProcess.kill()`.
 */
export class ProcesoStackIntegrado {
  private proceso: ChildProcessWithoutNullStreams | null = null
  private salida = ''

  obtenerSalida(): string {
    return this.salida
  }

  async iniciar(): Promise<void> {
    if (this.proceso !== null)
      throw new Error('El stack integrado ya fue iniciado por esta prueba.')
    if (await puertoOcupado()) {
      throw new Error(`El puerto ${PUERTO_STACK} ya estaba ocupado antes de iniciar el E2E.`)
    }

    this.salida = ''
    this.proceso = spawn(
      'uv',
      [
        'run',
        '--package',
        'botonera2-backend',
        'python',
        'scripts/iniciar_stack_desarrollo.py',
        '--host',
        HOST_STACK,
        '--port',
        String(PUERTO_STACK),
      ],
      {
        cwd: RAIZ_REPOSITORIO,
        detached: process.platform !== 'win32',
        stdio: 'pipe',
      },
    )
    this.proceso.stdout.on('data', (fragmento: Buffer) => {
      this.salida += fragmento.toString()
    })
    this.proceso.stderr.on('data', (fragmento: Buffer) => {
      this.salida += fragmento.toString()
    })

    const saludable = await esperarCondicion(async () => {
      if (this.proceso?.exitCode !== null) return false
      try {
        const respuesta = await fetch(`${URL_STACK}/api/v1/health`)
        return respuesta.ok
      } catch {
        return false
      }
    }, ESPERA_INICIO_MILISEGUNDOS)

    if (!saludable) {
      const diagnostico = this.salida
      await this.detener()
      throw new Error(`El stack no quedó saludable. Salida capturada:\n${diagnostico}`)
    }
  }

  async detener(): Promise<void> {
    const proceso = this.proceso
    if (proceso === null) return

    if (proceso.exitCode === null && proceso.pid !== undefined) {
      if (process.platform === 'win32') proceso.kill('SIGTERM')
      else process.kill(-proceso.pid, 'SIGTERM')
    }

    const finalizo = await esperarCondicion(
      async () => proceso.exitCode !== null,
      ESPERA_APAGADO_MILISEGUNDOS,
    )
    if (!finalizo && proceso.pid !== undefined) {
      // La escalada afecta solo al grupo creado arriba y evita dejar un Uvicorn
      // huérfano si una conexión SSE retiene el apagado amable.
      if (process.platform === 'win32') proceso.kill('SIGKILL')
      else process.kill(-proceso.pid, 'SIGKILL')
      await esperarCondicion(async () => proceso.exitCode !== null, 2_000)
    }

    this.proceso = null
    const liberado = await esperarCondicion(async () => !(await puertoOcupado()), 3_000)
    if (!liberado)
      throw new Error(`El proceso propio terminó pero no liberó el puerto ${PUERTO_STACK}.`)
  }
}

/** Envía una pulsación por la CLI real y conserva stdout/stderr para diagnosticar discrepancias. */
export async function pulsar(entrada: string): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(
      'uv',
      ['run', 'python', 'tools/device-simulator/simulador.py', entrada, '--url', URL_STACK],
      { cwd: RAIZ_REPOSITORIO, stdio: 'pipe' },
    )
    let salida = ''
    proceso.stdout.on('data', (fragmento: Buffer) => (salida += fragmento.toString()))
    proceso.stderr.on('data', (fragmento: Buffer) => (salida += fragmento.toString()))
    proceso.once('error', rechazar)
    proceso.once('close', (codigo) => {
      if (codigo === 0) resolver(salida)
      else rechazar(new Error(`El simulador falló para ${entrada} (código ${codigo}).\n${salida}`))
    })
  })
}

/** Ejecuta una secuencia explícita manteniendo toda entrada física dentro de la CLI versionada. */
export async function pulsarSecuencia(entradas: readonly string[]): Promise<void> {
  for (const entrada of entradas) await pulsar(entrada)
}

export const RUTA_LOGS = resolve(RAIZ_REPOSITORIO, 'logs')

/** Lista los CSV institucionales actuales; `logs/` puede no existir en un checkout limpio. */
export async function listarCsvAuditoria(): Promise<string[]> {
  try {
    // Auditoría agrupa por fecha local; `recursive` permite que la prueba no
    // replique esa convención de nombres ni dependa del día de ejecución.
    return (await archivos.readdir(RUTA_LOGS, { recursive: true }))
      .filter((nombre) => nombre.endsWith('.csv'))
      .sort()
      .map((nombre) => resolve(RUTA_LOGS, nombre))
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export async function tamanosArchivos(rutas: readonly string[]): Promise<Map<string, number>> {
  const pares = await Promise.all(
    rutas.map(async (ruta) => [ruta, (await archivos.stat(ruta)).size] as const),
  )
  return new Map(pares)
}

export async function leerAuditoria(rutas: readonly string[]): Promise<string> {
  return (await Promise.all(rutas.map((ruta) => archivos.readFile(ruta, 'utf8')))).join('\n')
}
