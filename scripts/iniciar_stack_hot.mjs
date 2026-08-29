/**
 * Lanzador y servidor proxy del stack interactivo de desarrollo con hot reload.
 *
 * Este script coordina en primer plano:
 * 1. El backend FastAPI real con recarga automática (Uvicorn autoreload).
 * 2. El servidor de desarrollo de Moderación (Nuxt/Vite con HMR).
 * 3. El servidor de desarrollo de la Pantalla del Recinto (Nuxt/Vite con HMR).
 * 4. El servidor de desarrollo del Simulador de dispositivos (Nuxt/Vite con HMR).
 * 5. Una superficie HTTP y WebSocket de mismo origen que unifica todos los servicios
 *    en un único puerto loopback (por defecto 8000), compatible con túneles SSH.
 */

import { execFileSync, spawn } from 'node:child_process'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const HOST_PREDETERMINADO = '127.0.0.1'
export const PUERTO_EXTERNO_PREDETERMINADO = 8000
export const PUERTO_BACKEND_PREDETERMINADO = 8001
export const PUERTO_MODERACION_PREDETERMINADO = 8002
export const PUERTO_RECINTO_PREDETERMINADO = 8003
export const PUERTO_SIMULADOR_PREDETERMINADO = 8004
export const TIEMPO_ESPERA_APAGADO_MS = 5000
export const TIMEOUT_INICIO_MS = 60000

const DIRECTORIO_ACTUAL = path.dirname(fileURLToPath(import.meta.url))
export const RAIZ_REPOSITORIO = path.resolve(DIRECTORIO_ACTUAL, '..')

/**
 * Determina si una dirección IP o nombre de host pertenece exclusivamente a loopback.
 *
 * El stack de desarrollo no debe exponerse a interfaces públicas o compartidas.
 * Se aceptan 127.0.0.1, localhost, ::1 o cualquier dirección del bloque 127.0.0.0/8.
 */
export function esHostLoopback(host) {
  if (!host || typeof host !== 'string') return false
  const hostLimpio = host.trim().toLowerCase()
  if (hostLimpio === 'localhost' || hostLimpio === '::1') return true
  if (/^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/.test(hostLimpio)) return true
  return false
}

/**
 * Valida que el host sea loopback y arroja un error descriptivo si no lo es.
 */
export function validarHost(host) {
  if (!esHostLoopback(host)) {
    throw new Error(
      `El host '${host}' no es seguro para el stack de desarrollo. ` +
        'Debe ser una interfaz loopback local (ej. 127.0.0.1 o localhost) para evitar ' +
        'exponer servicios internos a la red.',
    )
  }
}

/**
 * Obtiene la rama Git activa de forma síncrona y segura.
 */
export function obtenerRamaActual(raiz = RAIZ_REPOSITORIO) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: raiz,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()
  } catch (error) {
    throw new Error(`No se pudo determinar la rama Git actual: ${error.message}`)
  }
}

/**
 * Comprueba que el checkout esté en la rama principal 'main'.
 *
 * El modo canónico de dev:stack:hot está reservado exclusivamente para el checkout
 * coordinador de main. Para pruebas automatizadas o smoke del propio Work Package,
 * se permite la excepción explícita --allow-non-main.
 */
export function verificarRamaMain(opciones = {}, raiz = RAIZ_REPOSITORIO) {
  const rama = obtenerRamaActual(raiz)
  const esMain = rama === 'main'

  if (!esMain && !opciones.permitirRamaNoMain) {
    throw new Error(
      `El comando canónico \`dev:stack:hot\` está destinado exclusivamente al checkout coordinador de la rama \`main\`.\n` +
        `La rama actual es '${rama}'.\n\n` +
        `Para el flujo habitual de desarrollo interactivo sobre main:\n` +
        `  1. Cambiá al checkout de main: git checkout main\n` +
        `  2. Actualizá con los últimos cambios: git pull --ff-only origin main\n` +
        `  3. Iniciá el stack: pnpm dev:stack:hot\n\n` +
        `Si estás validando el candidato mediante pruebas o smoke dentro de una rama de desarrollo, utilizá:\n` +
        `  --allow-non-main`,
    )
  }

  return { rama, esMain, permitida: esMain || Boolean(opciones.permitirRamaNoMain) }
}

/**
 * Comprueba si un puerto TCP está ocupado intentando conectar a él.
 */
export function puertoEnUso(puerto, host = HOST_PREDETERMINADO) {
  return new Promise((resolver) => {
    const socket = net.connect({ port: puerto, host })
    socket.once('connect', () => {
      socket.destroy()
      resolver(true)
    })
    socket.once('error', () => {
      resolver(false)
    })
    socket.setTimeout(400, () => {
      socket.destroy()
      resolver(false)
    })
  })
}

/**
 * Encuentra un puerto libre en el host especificado. Si el deseado está libre,
 * lo retorna; de lo contrario asigna un puerto efímero disponible.
 */
export async function obtenerPuertoLibre(puertoDeseado, host = HOST_PREDETERMINADO) {
  const ocupado = await puertoEnUso(puertoDeseado, host)
  if (!ocupado) return puertoDeseado

  return new Promise((resolver, rechazar) => {
    const servidor = net.createServer()
    servidor.listen(0, host, () => {
      const direccion = servidor.address()
      const puertoAsignado = typeof direccion === 'object' && direccion ? direccion.port : null
      servidor.close(() => {
        if (puertoAsignado) resolver(puertoAsignado)
        else rechazar(new Error('No se pudo obtener un puerto efímero libre.'))
      })
    })
    servidor.on('error', rechazar)
  })
}

/**
 * Genera la página HTML de inicio que resume los accesos directos al entorno interactivo.
 */
export function generarIndiceHtml() {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Botonera2 · entorno interactivo (hot reload)</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; background: #0f172a; color: #f8fafc; }
      h1 { color: #38bdf8; font-size: 1.5rem; margin-bottom: 0.5rem; }
      p { color: #94a3b8; margin-top: 0; }
      ul { list-style: none; padding: 0; display: grid; gap: 0.75rem; max-width: 450px; margin-top: 1.5rem; }
      li a { display: block; padding: 0.75rem 1rem; background: #1e293b; color: #f1f5f9; text-decoration: none; border-radius: 0.5rem; border: 1px solid #334155; font-weight: 500; }
      li a:hover { background: #334155; border-color: #38bdf8; color: #38bdf8; }
      .badge { display: inline-block; font-size: 0.75rem; background: #0284c7; color: white; padding: 0.15rem 0.5rem; border-radius: 0.25rem; margin-left: 0.5rem; }
    </style>
  </head>
  <body>
    <h1>Botonera2 · Entorno interactivo de desarrollo</h1>
    <p>Modo interactivo con Hot Module Replacement (HMR) y recarga automática del backend.</p>
    <ul>
      <li><a href="/moderacion/">Moderación <span class="badge">HMR</span></a></li>
      <li><a href="/recinto/">Pantalla del Recinto <span class="badge">HMR</span></a></li>
      <li><a href="/simulador/">Simulador de dispositivos <span class="badge">HMR</span></a></li>
      <li><a href="/docs">Documentación de API (Swagger)</a></li>
      <li><a href="/api/v1/health">Estado de salud del backend (/api/v1/health)</a></li>
    </ul>
  </body>
</html>`
}

/**
 * Resuelve a qué puerto interno debe dirigirse una URL según las subrutas del monorepo.
 */
export function resolverPuertoDestino(urlRelativa, puertos) {
  if (!urlRelativa) return null

  // Frontends Nuxt con prefijo propio
  if (urlRelativa.startsWith('/moderacion/') || urlRelativa === '/moderacion') {
    return puertos.puertoModeracion
  }
  if (urlRelativa.startsWith('/recinto/') || urlRelativa === '/recinto') {
    return puertos.puertoRecinto
  }
  if (urlRelativa.startsWith('/simulador/') || urlRelativa === '/simulador') {
    return puertos.puertoSimulador
  }

  // Rutas del backend institucional FastAPI
  if (
    urlRelativa.startsWith('/api/') ||
    urlRelativa === '/docs' ||
    urlRelativa.startsWith('/docs/') ||
    urlRelativa === '/redoc' ||
    urlRelativa.startsWith('/redoc/') ||
    urlRelativa === '/openapi.json'
  ) {
    return puertos.puertoBackend
  }

  return null
}

/**
 * Crea el servidor proxy inverso de mismo origen para HTTP y WebSocket.
 *
 * Preserva:
 * - Streaming continuo para Server-Sent Events (SSE) sin buffering ni compresión intermedia.
 * - Conexiones bidireccionales WebSocket para Vite HMR (Moderación, Recinto y Simulador).
 * - Mismo origen (/moderacion/, /recinto/, /simulador/, /api/v1/, /docs) en un único puerto.
 */
export function crearServidorProxy(opciones) {
  const { host, puertoExterno, puertoBackend, puertoModeracion, puertoRecinto, puertoSimulador } =
    opciones
  const puertos = { puertoBackend, puertoModeracion, puertoRecinto, puertoSimulador }

  const servidor = http.createServer((solicitud, respuesta) => {
    const urlOriginal = solicitud.url || '/'

    // Redirecciones pedagógicas si el operador escribe la URL sin barra final
    if (urlOriginal === '/moderacion') {
      respuesta.writeHead(302, { Location: '/moderacion/' })
      respuesta.end()
      return
    }
    if (urlOriginal === '/recinto') {
      respuesta.writeHead(302, { Location: '/recinto/' })
      respuesta.end()
      return
    }
    if (urlOriginal === '/simulador') {
      respuesta.writeHead(302, { Location: '/simulador/' })
      respuesta.end()
      return
    }

    // Raíz: índice interactivo de navegación
    if (urlOriginal === '/') {
      respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      respuesta.end(generarIndiceHtml())
      return
    }

    const puertoDestino = resolverPuertoDestino(urlOriginal, puertos)
    if (!puertoDestino) {
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      respuesta.end(`Ruta no encontrada en el stack de desarrollo: ${urlOriginal}`)
      return
    }

    const cabecerasReenvio = { ...solicitud.headers }
    cabecerasReenvio.host = `${host}:${puertoDestino}`
    cabecerasReenvio['x-forwarded-host'] = solicitud.headers.host || `${host}:${puertoExterno}`
    cabecerasReenvio['x-forwarded-proto'] = 'http'

    const peticionDestino = http.request(
      {
        hostname: host,
        port: puertoDestino,
        path: urlOriginal,
        method: solicitud.method,
        headers: cabecerasReenvio,
      },
      (respuestaDestino) => {
        const esSse = Boolean(
          respuestaDestino.headers['content-type']?.includes('text/event-stream'),
        )

        if (esSse) {
          // Desactivar buffering para SSE para que los eventos lleguen de inmediato
          solicitud.socket.setNoDelay(true)
          respuesta.setHeader('Cache-Control', 'no-cache, no-transform')
          respuesta.setHeader('Connection', 'keep-alive')
          respuesta.setHeader('X-Accel-Buffering', 'no')
        }

        respuesta.writeHead(respuestaDestino.statusCode || 500, respuestaDestino.headers)
        respuestaDestino.pipe(respuesta)
      },
    )

    peticionDestino.on('error', (error) => {
      if (!respuesta.headersSent) {
        respuesta.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
        respuesta.end(
          `Error de conexión con el servicio interno en puerto ${puertoDestino}: ${error.message}`,
        )
      }
    })

    solicitud.pipe(peticionDestino)
  })

  // Manejo de actualización de protocolo a WebSocket (Vite HMR)
  servidor.on('upgrade', (solicitud, socketCliente, cabeceraInicial) => {
    const urlOriginal = solicitud.url || '/'
    const puertoDestino = resolverPuertoDestino(urlOriginal, puertos)

    if (!puertoDestino) {
      socketCliente.destroy()
      return
    }

    const socketServicio = net.connect(puertoDestino, host, () => {
      // Reenviar solicitud HTTP de Upgrade con sus cabeceras originales
      socketServicio.write(`${solicitud.method} ${solicitud.url} HTTP/${solicitud.httpVersion}\r\n`)
      for (let i = 0; i < solicitud.rawHeaders.length; i += 2) {
        const clave = solicitud.rawHeaders[i]
        const valor = solicitud.rawHeaders[i + 1]
        socketServicio.write(`${clave}: ${valor}\r\n`)
      }
      socketServicio.write('\r\n')
      if (cabeceraInicial && cabeceraInicial.length > 0) {
        socketServicio.write(cabeceraInicial)
      }

      // Canal bidireccional directo entre el navegador y el servidor Vite
      socketServicio.pipe(socketCliente)
      socketCliente.pipe(socketServicio)
    })

    socketServicio.on('error', () => {
      socketCliente.destroy()
    })
    socketCliente.on('error', () => {
      socketServicio.destroy()
    })
  })

  return servidor
}

/**
 * Espera a que un servicio HTTP esté listo respondiendo con código exitoso.
 */
export async function esperarServicio(url, tiempoLimiteMs = TIMEOUT_INICIO_MS) {
  const instanteLimite = Date.now() + tiempoLimiteMs
  while (Date.now() < instanteLimite) {
    try {
      const respuesta = await fetch(url)
      if (respuesta.ok) return true
    } catch {
      // Continuar esperando
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/**
 * Inicia los 4 procesos hijos coordinados y gestiona sus ciclos de vida.
 */
export function lanzarProcesosHijos(configuracion) {
  const { host, puertoBackend, puertoModeracion, puertoRecinto, puertoSimulador, raiz } =
    configuracion

  const comandoPnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const comandoUv = process.platform === 'win32' ? 'uv.exe' : 'uv'

  const procesos = []

  // 1. Backend FastAPI en Uvicorn con autoreload
  const procesoBackend = spawn(
    comandoUv,
    [
      'run',
      '--package',
      'botonera2-backend',
      'uvicorn',
      'botonera2_backend.main:app',
      '--host',
      host,
      '--port',
      String(puertoBackend),
      '--reload',
      '--reload-dir',
      'apps/backend/src',
      '--reload-dir',
      'config',
    ],
    {
      cwd: raiz,
      detached: process.platform !== 'win32',
      stdio: 'pipe',
    },
  )
  procesos.push({ nombre: 'FastAPI Backend', proceso: procesoBackend })

  // 2. Moderación (Nuxt / Vite HMR)
  const procesoModeracion = spawn(
    comandoPnpm,
    [
      '--filter',
      '@botonera2/moderacion',
      'exec',
      'nuxt',
      'dev',
      '--port',
      String(puertoModeracion),
      '--host',
      host,
      '--no-fork',
    ],
    {
      cwd: raiz,
      detached: process.platform !== 'win32',
      stdio: 'pipe',
    },
  )
  procesos.push({ nombre: 'Moderación (Nuxt)', proceso: procesoModeracion })

  // 3. Recinto (Nuxt / Vite HMR)
  const procesoRecinto = spawn(
    comandoPnpm,
    [
      '--filter',
      '@botonera2/recinto',
      'exec',
      'nuxt',
      'dev',
      '--port',
      String(puertoRecinto),
      '--host',
      host,
      '--no-fork',
    ],
    {
      cwd: raiz,
      detached: process.platform !== 'win32',
      stdio: 'pipe',
    },
  )
  procesos.push({ nombre: 'Recinto (Nuxt)', proceso: procesoRecinto })

  // 4. Simulador (Nuxt / Vite HMR)
  const procesoSimulador = spawn(
    comandoPnpm,
    [
      '--filter',
      '@botonera2/simulador',
      'exec',
      'nuxt',
      'dev',
      '--port',
      String(puertoSimulador),
      '--host',
      host,
      '--no-fork',
    ],
    {
      cwd: raiz,
      detached: process.platform !== 'win32',
      stdio: 'pipe',
    },
  )
  procesos.push({ nombre: 'Simulador (Nuxt)', proceso: procesoSimulador })

  return procesos
}

/**
 * Detiene ordenadamente los procesos hijos con SIGTERM y posterior SIGKILL si no responden.
 *
 * En POSIX utiliza el grupo de procesos (-pid) para alcanzar tanto al lanzador (uv/pnpm)
 * como a los procesos reales de Node y Python, impidiendo que queden listeners huérfanos.
 */
export async function detenerProcesosHijos(procesos, tiempoEsperaMs = TIEMPO_ESPERA_APAGADO_MS) {
  const promesas = procesos.map(({ nombre, proceso }) => {
    return new Promise((resolver) => {
      if (proceso.exitCode !== null || proceso.killed) {
        resolver()
        return
      }

      let terminado = false
      const alSalir = () => {
        if (!terminado) {
          terminado = true
          resolver()
        }
      }

      proceso.once('exit', alSalir)

      try {
        if (process.platform === 'win32' || !proceso.pid) {
          proceso.kill('SIGTERM')
        } else {
          process.kill(-proceso.pid, 'SIGTERM')
        }
      } catch {
        // Puede haber salido espontáneamente
      }

      setTimeout(() => {
        if (!terminado) {
          terminado = true
          try {
            if (process.platform === 'win32' || !proceso.pid) {
              proceso.kill('SIGKILL')
            } else {
              process.kill(-proceso.pid, 'SIGKILL')
            }
          } catch {
            // Ya no existe
          }
          resolver()
        }
      }, tiempoEsperaMs)
    })
  })

  await Promise.all(promesas)
}

/**
 * Analiza los argumentos CLI pasados al script.
 */
export function parsearArgumentos(argumentos = process.argv.slice(2)) {
  const opciones = {
    host: HOST_PREDETERMINADO,
    puertoExterno: PUERTO_EXTERNO_PREDETERMINADO,
    puertoBackend: PUERTO_BACKEND_PREDETERMINADO,
    puertoModeracion: PUERTO_MODERACION_PREDETERMINADO,
    puertoRecinto: PUERTO_RECINTO_PREDETERMINADO,
    puertoSimulador: PUERTO_SIMULADOR_PREDETERMINADO,
    permitirRamaNoMain: false,
    ayuda: false,
  }

  for (let i = 0; i < argumentos.length; i++) {
    const arg = argumentos[i]
    if (arg === '--help' || arg === '-h') {
      opciones.ayuda = true
    } else if (arg === '--host') {
      opciones.host = argumentos[++i]
    } else if (arg.startsWith('--host=')) {
      opciones.host = arg.slice(7)
    } else if (arg === '--port' || arg === '-p') {
      opciones.puertoExterno = Number.parseInt(argumentos[++i], 10)
    } else if (arg.startsWith('--port=')) {
      opciones.puertoExterno = Number.parseInt(arg.slice(7), 10)
    } else if (arg === '--backend-port') {
      opciones.puertoBackend = Number.parseInt(argumentos[++i], 10)
    } else if (arg.startsWith('--backend-port=')) {
      opciones.puertoBackend = Number.parseInt(arg.slice(15), 10)
    } else if (arg === '--moderacion-port') {
      opciones.puertoModeracion = Number.parseInt(argumentos[++i], 10)
    } else if (arg.startsWith('--moderacion-port=')) {
      opciones.puertoModeracion = Number.parseInt(arg.slice(18), 10)
    } else if (arg === '--recinto-port') {
      opciones.puertoRecinto = Number.parseInt(argumentos[++i], 10)
    } else if (arg.startsWith('--recinto-port=')) {
      opciones.puertoRecinto = Number.parseInt(arg.slice(15), 10)
    } else if (arg === '--simulador-port') {
      opciones.puertoSimulador = Number.parseInt(argumentos[++i], 10)
    } else if (arg.startsWith('--simulador-port=')) {
      opciones.puertoSimulador = Number.parseInt(arg.slice(17), 10)
    } else if (arg === '--allow-non-main' || arg === '--permitir-rama-no-main') {
      opciones.permitirRamaNoMain = true
    }
  }

  return opciones
}

/**
 * Imprime el mensaje de ayuda en consola.
 */
export function mostrarAyuda() {
  console.log(`
Uso: pnpm dev:stack:hot [OPCIONES]

Levanta el stack de desarrollo interactivo de Botonera2 con HMR y autoreload:
  - FastAPI real con recarga automática por cambios en apps/backend/src o config/
  - Servidores Nuxt/Vite en desarrollo con Hot Module Replacement (HMR) para Moderación, Recinto y Simulador
  - Superficie HTTP y WebSocket unificada bajo el mismo origen en una única interfaz loopback

Opciones:
  -p, --port <puerto>          Puerto público externo de escucha (predeterminado: ${PUERTO_EXTERNO_PREDETERMINADO})
  --host <host>                Interfaz loopback de escucha (predeterminado: ${HOST_PREDETERMINADO})
  --backend-port <puerto>      Puerto interno auxiliar para FastAPI (predeterminado: ${PUERTO_BACKEND_PREDETERMINADO})
  --moderacion-port <puerto>   Puerto interno auxiliar para Moderación (predeterminado: ${PUERTO_MODERACION_PREDETERMINADO})
  --recinto-port <puerto>      Puerto interno auxiliar para Recinto (predeterminado: ${PUERTO_RECINTO_PREDETERMINADO})
  --simulador-port <puerto>    Puerto interno auxiliar para Simulador (predeterminado: ${PUERTO_SIMULADOR_PREDETERMINADO})
  --allow-non-main             Permite ejecutar en una rama distinta de main (solo para tests/smoke del WP)
  -h, --help                   Muestra esta ayuda y finaliza
`)
}

/**
 * Punto de entrada principal que orquesta el stack interactivo completo.
 */
export async function main(argumentos = process.argv.slice(2)) {
  const opciones = parsearArgumentos(argumentos)

  if (opciones.ayuda) {
    mostrarAyuda()
    return 0
  }

  // 1. Verificación de seguridad de host (solo loopback)
  validarHost(opciones.host)

  // 2. Verificación de rama Git
  const resultadoRama = verificarRamaMain(opciones, RAIZ_REPOSITORIO)
  if (!resultadoRama.esMain) {
    console.warn(
      `\n⚠️  ADVERTENCIA: Se especificó --allow-non-main. Se permite la ejecución en la rama '${resultadoRama.rama}'.`,
    )
    console.warn(
      '   Esta excepción es exclusivamente para pruebas o smoke de validación del propio WP.\n',
    )
  }

  // 3. Comprobación y diagnóstico del puerto externo
  if (await puertoEnUso(opciones.puertoExterno, opciones.host)) {
    console.error(
      `Error: El puerto externo ${opciones.puertoExterno} ya está en uso en ${opciones.host}.\n` +
        `Cerrá el proceso que retiene el puerto o especificá uno distinto mediante --port <puerto>.`,
    )
    return 1
  }

  // 4. Asignación y comprobación de puertos auxiliares internos
  const puertoBackend = await obtenerPuertoLibre(opciones.puertoBackend, opciones.host)
  const puertoModeracion = await obtenerPuertoLibre(opciones.puertoModeracion, opciones.host)
  const puertoRecinto = await obtenerPuertoLibre(opciones.puertoRecinto, opciones.host)
  const puertoSimulador = await obtenerPuertoLibre(opciones.puertoSimulador, opciones.host)

  console.log('Iniciando servicios interactivos de Botonera2...')
  console.log(`- Host loopback:       ${opciones.host}`)
  console.log(`- Puerto externo:      ${opciones.puertoExterno}`)
  console.log(`- Puerto FastAPI:      ${puertoBackend} (interno)`)
  console.log(`- Puerto Moderación:   ${puertoModeracion} (interno)`)
  console.log(`- Puerto Recinto:      ${puertoRecinto} (interno)`)
  console.log(`- Puerto Simulador:    ${puertoSimulador} (interno)`)

  // 5. Lanzar los 4 procesos hijos
  const procesos = lanzarProcesosHijos({
    host: opciones.host,
    puertoBackend,
    puertoModeracion,
    puertoRecinto,
    puertoSimulador,
    raiz: RAIZ_REPOSITORIO,
  })

  let apagando = false

  const apagarStack = async (codigoSalida = 0) => {
    if (apagando) return
    apagando = true
    console.log('\nDeteniendo el stack de desarrollo y liberando puertos...')
    try {
      servidorProxy.closeAllConnections?.()
      servidorProxy.close()
    } catch {
      // Ignorar fallo al cerrar
    }
    await detenerProcesosHijos(procesos)
    console.log('Stack de desarrollo detenido limpiamente.')
    process.exit(codigoSalida)
  }

  // Manejo de señales del sistema operativo para limpieza impecable
  process.on('SIGINT', () => apagarStack(0))
  process.on('SIGTERM', () => apagarStack(0))
  process.on('SIGHUP', () => apagarStack(0))

  // Supervisión de caídas inesperadas de componentes esenciales
  for (const { nombre, proceso } of procesos) {
    proceso.on('exit', (codigo, senal) => {
      if (!apagando) {
        console.error(
          `\n❌ [ERROR] El componente '${nombre}' terminó inesperadamente (código: ${codigo}, señal: ${senal}).`,
        )
        console.error('El stack no puede continuar con componentes esenciales caídos.')
        apagarStack(1)
      }
    })
  }

  // 6. Iniciar servidor proxy
  const servidorProxy = crearServidorProxy({
    host: opciones.host,
    puertoExterno: opciones.puertoExterno,
    puertoBackend,
    puertoModeracion,
    puertoRecinto,
    puertoSimulador,
  })

  await new Promise((resolver, rechazar) => {
    servidorProxy.listen(opciones.puertoExterno, opciones.host, () => resolver())
    servidorProxy.on('error', rechazar)
  })

  // 7. Esperar a que los 4 servicios alcancen readiness
  console.log('Esperando inicialización de los servidores...')
  const backendListo = esperarServicio(
    `http://${opciones.host}:${puertoBackend}/api/v1/health`,
    TIMEOUT_INICIO_MS,
  )
  const moderacionLista = esperarServicio(
    `http://${opciones.host}:${puertoModeracion}/moderacion/`,
    TIMEOUT_INICIO_MS,
  )
  const recintoListo = esperarServicio(
    `http://${opciones.host}:${puertoRecinto}/recinto/`,
    TIMEOUT_INICIO_MS,
  )
  const simuladorListo = esperarServicio(
    `http://${opciones.host}:${puertoSimulador}/simulador/`,
    TIMEOUT_INICIO_MS,
  )

  const resultados = await Promise.all([
    backendListo,
    moderacionLista,
    recintoListo,
    simuladorListo,
  ])
  if (!resultados.every(Boolean)) {
    console.error('❌ Uno o más componentes no alcanzaron estado saludable a tiempo.')
    await apagarStack(1)
    return 1
  }

  // 8. Notificar al operador que el stack está 100% operativo
  const urlBase = `http://${opciones.host}:${opciones.puertoExterno}`
  console.log('\n' + '='.repeat(68))
  console.log('  Botonera2 · Stack interactivo de desarrollo (hot reload) listo')
  console.log('='.repeat(68))
  console.log(`Superficie externa (mismo origen):  ${urlBase}/`)
  console.log(`  ├── Moderación (HMR):            ${urlBase}/moderacion/`)
  console.log(`  ├── Pantalla del Recinto (HMR):  ${urlBase}/recinto/`)
  console.log(`  ├── Simulador (HMR):             ${urlBase}/simulador/`)
  console.log(`  ├── Documentación API (Swagger): ${urlBase}/docs`)
  console.log(`  └── Verificación de salud:       ${urlBase}/api/v1/health\n`)
  console.log('Túnel SSH desde Windows (ejemplo con puerto 18080):')
  console.log(`  ssh -N -L 18080:${opciones.host}:${opciones.puertoExterno} agent-dev`)
  console.log(`  -> Luego abrir: http://127.0.0.1:18080/moderacion/\n`)
  console.log('Flujo tras integrar cambios en main:')
  console.log('  1. Con este stack corriendo, ejecutá en otra terminal:')
  console.log('     git pull --ff-only origin main')
  console.log('  2. Los watchers detectarán los cambios y los frontends se')
  console.log('     actualizarán por HMR sin reiniciar ni reconstruir.')
  console.log('  3. Si cambió código Python del backend, FastAPI se reiniciará')
  console.log('     automáticamente (el estado en memoria volverá a SIN_PREPARAR).\n')
  console.log('Presioná Ctrl+C para detener todos los servicios y liberar los puertos.')
  console.log('='.repeat(68) + '\n')

  return 0
}

// Ejecutar automáticamente si es llamado de forma directa
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(`\nError fatal al ejecutar dev:stack:hot: ${error.message}`)
    process.exit(1)
  })
}
