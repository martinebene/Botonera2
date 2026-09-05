/**
 * Paridad sonora real entre la Pantalla del Recinto y Apoyo Técnico (WP-071).
 *
 * ## Qué agrega esta prueba a las de Vitest
 *
 * Las pruebas unitarias fijan la **decisión**: qué debe sonar, cuándo y cuándo no. Lo que
 * sólo puede comprobarse contra el stack real y un navegador real es lo otro:
 *
 * 1. que Apoyo Técnico reciba de verdad la proyección pública del Recinto por SSE, sin que
 *    nadie fabrique payloads;
 * 2. que el archivo WAV exista bajo el prefijo `/tecnico/` y el navegador lo descargue,
 *    porque los sonidos están versionados una sola vez en la aplicación del Recinto y
 *    Apoyo Técnico los publica desde ahí en tiempo de construcción;
 * 3. que la reproducción ocurra **sin ninguna interacción humana** sobre la pantalla, que
 *    es la condición operativa real de los dos puestos;
 * 4. que abrir el puesto técnico en mitad de una sesión ya avanzada no reproduzca nada,
 *    que es el peor defecto posible de este WP.
 *
 * El hecho que dispara el sonido llega desde el device-bridge simulado, no desde un clic en
 * ninguna de las dos pantallas: así queda demostrado que ninguna de las dos necesitó un
 * gesto del usuario para poder sonar.
 */

import { expect, test, type Page } from '@playwright/test'
import { ProcesoStackIntegrado, URL_STACK, puertoOcupado, pulsarSecuencia } from './infraestructura'

/** Registro de una reproducción observada dentro de la ventana real. */
interface ReproduccionObservada {
  src: string
  volume: number
  resultado: 'pendiente' | 'cumplida' | 'rechazada'
}

declare global {
  interface Window {
    reproduccionesObservadas?: ReproduccionObservada[]
    pausasObservadas?: number
  }
}

/**
 * Envuelve `play` y `pause` en el prototipo antes de que cargue la aplicación.
 *
 * Envolver y no sustituir es deliberado: la reproducción ocurre de verdad y se registra si
 * la promesa se cumplió o la rechazó la política de autoplay. `pause` se cuenta porque su
 * ausencia demuestra que un sonido nuevo no interrumpe al anterior.
 */
async function instalarEspiaAudio(pagina: Page): Promise<void> {
  await pagina.addInitScript(() => {
    window.reproduccionesObservadas = []
    window.pausasObservadas = 0

    const prototipo = HTMLAudioElement.prototype
    const reproducirOriginal = prototipo.play
    const pausarOriginal = prototipo.pause

    prototipo.play = function reproducirEspiado(this: HTMLAudioElement) {
      const registro: ReproduccionObservada = {
        src: this.src,
        volume: this.volume,
        resultado: 'pendiente',
      }
      window.reproduccionesObservadas?.push(registro)
      const resultado = reproducirOriginal.call(this)
      resultado.then(
        () => {
          registro.resultado = 'cumplida'
        },
        () => {
          registro.resultado = 'rechazada'
        },
      )
      return resultado
    }

    prototipo.pause = function pausarEspiado(this: HTMLAudioElement) {
      window.pausasObservadas = (window.pausasObservadas ?? 0) + 1
      return pausarOriginal.call(this)
    }
  })
}

/** Lee las reproducciones observadas hasta el momento. */
function leerReproducciones(pagina: Page): Promise<ReproduccionObservada[]> {
  return pagina.evaluate(() => window.reproduccionesObservadas ?? [])
}

/** El nombre de archivo identifica el evento sin depender del prefijo de cada aplicación. */
function archivos(reproducciones: ReproduccionObservada[]): string[] {
  return reproducciones.map((reproduccion) => reproduccion.src.split('/').pop() ?? '')
}

/** Espera a que la pantalla acumule al menos la cantidad de reproducciones indicada. */
async function esperarReproducciones(pagina: Page, cantidad: number): Promise<void> {
  await expect
    .poll(async () => (await leerReproducciones(pagina)).length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(cantidad)
}

test.describe.serial('WP-071 · Apoyo Técnico suena igual que el Recinto', () => {
  const stack = new ProcesoStackIntegrado()

  test.beforeAll(async () => {
    await stack.iniciar()
  })
  test.afterAll(async () => {
    await stack.detener()
    expect(await puertoOcupado()).toBe(false)
  })

  test.afterEach(async ({}, informacion) => {
    if (informacion.status !== informacion.expectedStatus) {
      await informacion.attach('stdout-stderr-stack.txt', {
        body: stack.obtenerSalida(),
        contentType: 'text/plain',
      })
    }
  })

  test('reproduce los mismos eventos que el Recinto y no reproduce historia', async ({
    browser,
  }) => {
    const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const moderacion = await contexto.newPage()
    const recinto = await contexto.newPage()
    const tecnico = await contexto.newPage()

    try {
      // ---------------------------------------------------------------------
      // 1. Se genera historia antes de abrir las pantallas que sonorizan.
      // ---------------------------------------------------------------------
      await moderacion.goto(`${URL_STACK}/moderacion/`)
      await moderacion.getByTestId('btn-preparar-sala').click()
      await moderacion.getByTestId('vista-preparando').waitFor()
      await pulsarSecuencia(['1-9', '2-9', '3-9', '4-9', '5-9', '6-9', '7-9'])
      await moderacion.getByTestId('input-numero-sesion').fill('71')
      await moderacion.getByTestId('input-presidencia').fill('Presidencia WP-071')
      await moderacion.getByTestId('input-secretaria').fill('Secretaría WP-071')
      await moderacion.getByTestId('btn-guardar-preparacion').click()
      await moderacion.getByTestId('btn-abrir-sesion').click()
      await moderacion.getByTestId('vista-sesion-abierta').waitFor()

      // ---------------------------------------------------------------------
      // 2. Recién ahora se abren Recinto y Técnico, con el espía ya instalado.
      // ---------------------------------------------------------------------
      await Promise.all([instalarEspiaAudio(recinto), instalarEspiaAudio(tecnico)])
      await Promise.all([
        recinto.goto(`${URL_STACK}/recinto/`),
        tecnico.goto(`${URL_STACK}/tecnico/`),
      ])
      await expect(tecnico.getByTestId('estado-conexion')).toHaveText('Conectado')
      await expect(recinto.getByTestId('franja-votacion-quorum')).toBeVisible()

      // El primer snapshot describe una preparación, siete presencias y una sesión abierta.
      // Ninguna de las dos pantallas puede reproducir nada de eso.
      expect(await leerReproducciones(recinto)).toEqual([])
      expect(await leerReproducciones(tecnico)).toEqual([])

      // ---------------------------------------------------------------------
      // 3. Un hecho nuevo, originado en el device-bridge y no en un clic.
      // ---------------------------------------------------------------------
      await pulsarSecuencia(['1-9'])

      await esperarReproducciones(recinto, 1)
      await esperarReproducciones(tecnico, 1)

      const primeraRecinto = await leerReproducciones(recinto)
      const primeraTecnico = await leerReproducciones(tecnico)

      // Paridad literal: el mismo archivo, en las dos pantallas, por el mismo hecho.
      expect(archivos(primeraTecnico)).toEqual(['concejal-ausente.wav'])
      expect(archivos(primeraTecnico)).toEqual(archivos(primeraRecinto))

      // Cada aplicación lo sirve bajo su propio prefijo, desde el mismo archivo versionado.
      expect(primeraTecnico[0]?.src).toContain('/tecnico/assets/sonidos/')
      expect(primeraRecinto[0]?.src).toContain('/recinto/assets/sonidos/')

      // Mismo volumen configurado en las dos superficies: una sola sección `[sonidos]`.
      expect(primeraTecnico[0]?.volume).toBeCloseTo(primeraRecinto[0]?.volume ?? -1, 5)

      // La reproducción ocurrió de verdad, sin que nadie tocara ninguna de las pantallas:
      // el archivo existe bajo `/tecnico/` y la política de autoplay lo permitió.
      await expect
        .poll(async () => (await leerReproducciones(tecnico))[0]?.resultado, { timeout: 10_000 })
        .toBe('cumplida')

      // ---------------------------------------------------------------------
      // 4. Un hecho del plano técnico también suena en las dos pantallas.
      // ---------------------------------------------------------------------
      await tecnico.getByTestId('btn-transmision-instantanea').click()

      await esperarReproducciones(recinto, 2)
      await esperarReproducciones(tecnico, 2)

      expect(archivos(await leerReproducciones(tecnico))).toEqual([
        'concejal-ausente.wav',
        'transmision-iniciada.wav',
      ])
      expect(archivos(await leerReproducciones(tecnico))).toEqual(
        archivos(await leerReproducciones(recinto)),
      )

      // Ningún sonido interrumpió al anterior: la superposición está preservada.
      expect(await tecnico.evaluate(() => window.pausasObservadas ?? 0)).toBe(0)

      // ---------------------------------------------------------------------
      // 5. No apareció ningún control de audio visible en el puesto técnico.
      // ---------------------------------------------------------------------
      expect(await tecnico.locator('audio, video').count()).toBe(0)
      await expect(tecnico.getByRole('button', { name: /sonido|audio|volumen/i })).toHaveCount(0)

      // ---------------------------------------------------------------------
      // 6. Recargar el puesto técnico no vuelve a reproducir lo ya ocurrido.
      // ---------------------------------------------------------------------
      await tecnico.reload()
      await expect(tecnico.getByTestId('estado-conexion')).toHaveText('Conectado')
      expect(await leerReproducciones(tecnico)).toEqual([])
    } finally {
      await contexto.close()
    }
  })
})
