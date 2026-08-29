/**
 * Prueba E2E integrada del Simulador Web contra el stack real de FastAPI (WP-034 §17).
 *
 * Demuestra contra FastAPI real:
 * 1. Snapshot real inicial (/simulador/ se sirve desde el stack integrado y adopta SIN_PREPARAR).
 * 2. Rechazo funcional real en SIN_PREPARAR (tecla 9 rechazada con ESTADO_GLOBAL_INVALIDO).
 * 3. Transición a PREPARANDO en tiempo real vía SSE.
 * 4. Tecla 8 y efecto real de test (observado en Moderación como indicador de test en Banca 1).
 * 5. Tecla 9 y efecto real de presencia en dev01 (actualiza quórum y presencia en Moderación).
 * 6. Pulsaciones concurrentes desde múltiples dispositivos (dev02 y dev03 en paralelo).
 * 7. Completitud de quórum y apertura de sesión reglamentaria desde Moderación.
 * 8. Tecla 7 y efecto real de solicitud de palabra (observado en cola de palabra de Moderación).
 * 9. Votación activa real abierta desde Moderación y emisión de votos desde tres dispositivos:
 *    - dev01 emite 1 (Afirmativo);
 *    - dev02 emite 2 (Abstención);
 *    - dev03 emite 3 (Negativo);
 *    - verificación de respuestas aceptadas en el log y conteo de votos recibidos en Moderación.
 * 10. Rechazo funcional adicional por voto ordinario ya emitido (dev01 emite nuevamente 1).
 * 11. Vaciado del log en memoria y cleanup completo sin procesos ni listeners huérfanos.
 */

import { expect, test } from '@playwright/test'
import { ProcesoStackIntegrado, PUERTO_STACK, URL_STACK, puertoOcupado } from './infraestructura'

test.describe.serial('WP-034 · Simulador Web Integrado sobre stack real', () => {
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

  test('recorre snapshot, test, presencia, concurrencia, palabra, votación 1/2/3 y rechazos contra FastAPI real', async ({
    browser,
  }) => {
    const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const moderacion = await contexto.newPage()
    const simulador = await contexto.newPage()

    try {
      // 1. Cargar ambas aplicaciones desde el mismo origen del stack integrado
      await Promise.all([
        moderacion.goto(`${URL_STACK}/moderacion/`),
        simulador.goto(`${URL_STACK}/simulador/`),
      ])

      // -----------------------------------------------------------------------
      // Paso 1 · Snapshot inicial real en SIN_PREPARAR
      // -----------------------------------------------------------------------
      await expect(moderacion.getByTestId('vista-sin-preparar')).toBeVisible()
      await expect(simulador.getByTestId('indicador-conexion-conectado')).toBeVisible()
      await expect(simulador.getByTestId('indicador-estado-global')).toHaveText('SIN_PREPARAR')
      await expect(simulador.getByTestId('indicador-revision')).toHaveText('r0')
      await expect(simulador.getByTestId('indicador-sesion')).toHaveText('Sin preparar')
      await expect(simulador.getByTestId('indicador-quorum')).toHaveText('Sin datos')

      // -----------------------------------------------------------------------
      // Paso 2 · Rechazo funcional real en SIN_PREPARAR
      // (En SIN_PREPARAR ninguna tecla produce efecto de negocio)
      // -----------------------------------------------------------------------
      await simulador.getByTestId('btn-dev01-9').click()

      const entradaRechazada = simulador.getByTestId('entrada-log-dev01-9')
      await expect(entradaRechazada).toBeVisible()
      await expect(entradaRechazada).toContainText('dev01')
      await expect(entradaRechazada).toContainText('Pres. / Aus.')
      await expect(entradaRechazada).toContainText('HTTP 200')
      await expect(entradaRechazada).toContainText('RECHAZADA')
      await expect(entradaRechazada).toContainText('SIN_PREPARAR')

      // -----------------------------------------------------------------------
      // Paso 3 · Transición a PREPARANDO y tecla 8 (test visual)
      // -----------------------------------------------------------------------
      await expect(moderacion.getByTestId('btn-preparar-sala')).toBeVisible()
      await moderacion.getByTestId('btn-preparar-sala').click()
      await expect(moderacion.getByTestId('vista-preparando')).toBeVisible()

      // El simulador recibe la transición a PREPARANDO en tiempo real vía SSE
      await expect(simulador.getByTestId('indicador-estado-global')).toHaveText('PREPARANDO')
      await expect(simulador.getByTestId('indicador-quorum')).toContainText('0 presentes')

      // Tecla 8 en dev01: coordinar pulsación en simulador con observación del test en Moderación
      // (El test visual dura 600 ms; coordinamos la pulsación y la observación en paralelo)
      await Promise.all([
        simulador.getByTestId('btn-dev01-8').click(),
        expect(moderacion.locator('[data-banca="1"] [data-testid="indicador-test"]')).toBeVisible(),
      ])

      // Verificar que el log del simulador registró la aceptación de la tecla 8
      const entradaTest = simulador.locator('[data-testid^="entrada-log-dev01-8"]').last()
      await expect(entradaTest).toBeVisible()
      await expect(entradaTest).toContainText('dev01')
      await expect(entradaTest).toContainText('Test')
      await expect(entradaTest).toContainText('ACEPTADA')
      await expect(entradaTest).toContainText('TEST_ACTIVADO')

      // -----------------------------------------------------------------------
      // Paso 4 · Tecla 9 (presencia) en dev01 y concurrencia entre dispositivos
      // -----------------------------------------------------------------------
      await simulador.getByTestId('btn-dev01-9').click()

      const entradaPresencia = simulador.locator('[data-testid^="entrada-log-dev01-9"]').last()
      await expect(entradaPresencia).toContainText('ACEPTADA')
      await expect(entradaPresencia).toContainText('PRESENCIA_ACTUALIZADA')

      // El quórum se actualiza inmediatamente en el panel del simulador y en Moderación
      await expect(simulador.getByTestId('indicador-quorum')).toContainText('1 presentes')

      // Pulsaciones cercanas/concurrentes desde dos dispositivos conservando estado coherente
      await Promise.all([
        simulador.getByTestId('btn-dev02-9').dispatchEvent('click'),
        simulador.getByTestId('btn-dev03-9').dispatchEvent('click'),
      ])

      await expect(simulador.getByTestId('indicador-quorum')).toContainText('3 presentes')

      // Completar quórum (se requieren 7 presentes) pulsando dev04 a dev07
      await simulador.getByTestId('btn-dev04-9').click()
      await simulador.getByTestId('btn-dev05-9').click()
      await simulador.getByTestId('btn-dev06-9').click()
      await simulador.getByTestId('btn-dev07-9').click()

      await expect(simulador.getByTestId('indicador-quorum')).toContainText('7 presentes')
      await expect(simulador.getByTestId('indicador-quorum')).toContainText('Quórum alcanzado')
      await expect(moderacion.getByTestId('quorum-completo')).toBeVisible()

      // -----------------------------------------------------------------------
      // Paso 5 · Apertura reglamentaria de sesión desde Moderación
      // -----------------------------------------------------------------------
      await moderacion.getByTestId('input-numero-sesion').fill('34')
      await moderacion.getByTestId('input-presidencia').fill('Presidencia Ficticia WP-034')
      await moderacion.getByTestId('input-secretaria').fill('Secretaría Ficticia WP-034')
      await moderacion.getByTestId('btn-guardar-preparacion').click()
      await expect(moderacion.getByTestId('btn-abrir-sesion')).toBeEnabled()
      await moderacion.getByTestId('btn-abrir-sesion').click()
      await expect(moderacion.getByTestId('vista-sesion-abierta')).toBeVisible()

      // El simulador recibe la apertura de sesión vía SSE
      await expect(simulador.getByTestId('indicador-estado-global')).toHaveText('SESION_ABIERTA')
      await expect(simulador.getByTestId('indicador-sesion')).toContainText('34')

      // -----------------------------------------------------------------------
      // Paso 6 · Tecla 7 y efecto real de solicitud de palabra
      // -----------------------------------------------------------------------
      await simulador.getByTestId('btn-dev01-7').click()

      const entradaPalabra = simulador.locator('[data-testid^="entrada-log-dev01-7"]').last()
      await expect(entradaPalabra).toBeVisible()
      await expect(entradaPalabra).toContainText('dev01')
      await expect(entradaPalabra).toContainText('Palabra')
      await expect(entradaPalabra).toContainText('ACEPTADA')
      await expect(entradaPalabra).toContainText('PEDIDO_PALABRA_REGISTRADO')

      // Observar el efecto real en la cola de oradores de Moderación (dev01 es Banca 1)
      await expect(moderacion.getByTestId('cola-palabra')).toContainText('Banca 1')

      // -----------------------------------------------------------------------
      // Paso 7 · Apertura de votación real y emisión de 1, 2 y 3 desde dispositivos distintos
      // -----------------------------------------------------------------------
      await moderacion.getByTestId('input-numero-votacion').fill('1')
      await moderacion.getByTestId('select-tipo-votacion').selectOption({ label: 'Otro' })
      await moderacion.getByTestId('input-tema-votacion').fill('Votación Real Simulador WP-034')
      await moderacion.getByTestId('btn-abrir-votacion').click()

      // Si existe diálogo de confirmación por palabra activa (CA-062), confirmar apertura
      if (await moderacion.getByTestId('dialogo-confirmacion-apertura').isVisible()) {
        await moderacion.getByTestId('btn-confirmar-apertura').click()
      }
      await expect(moderacion.getByTestId('estado-votacion')).toHaveText('EN_CURSO')

      // El simulador refleja la votación activa vía SSE
      await expect(simulador.getByTestId('indicador-votacion')).toContainText(
        'Votación N° 1 (EN_CURSO)',
      )

      // Emisión de votos desde tres dispositivos distintos:
      // dev01 emite 1 (Afirmativo)
      await simulador.getByTestId('btn-dev01-1').click()
      const entradaVoto1 = simulador.locator('[data-testid^="entrada-log-dev01-1"]').last()
      await expect(entradaVoto1).toContainText('ACEPTADA')
      await expect(entradaVoto1).toContainText('VOTO_REGISTRADO')

      // dev02 emite 2 (Abstención)
      await simulador.getByTestId('btn-dev02-2').click()
      const entradaVoto2 = simulador.locator('[data-testid^="entrada-log-dev02-2"]').last()
      await expect(entradaVoto2).toContainText('ACEPTADA')
      await expect(entradaVoto2).toContainText('VOTO_REGISTRADO')

      // dev03 emite 3 (Negativo)
      await simulador.getByTestId('btn-dev03-3').click()
      const entradaVoto3 = simulador.locator('[data-testid^="entrada-log-dev03-3"]').last()
      await expect(entradaVoto3).toContainText('ACEPTADA')
      await expect(entradaVoto3).toContainText('VOTO_REGISTRADO')

      // Efecto observable real en el backend: Moderación contabiliza exactamente 3 votos recibidos
      await expect(moderacion.getByTestId('cantidad-votos-recibidos')).toHaveText('3')

      // -----------------------------------------------------------------------
      // Paso 8 · Rechazo funcional por voto ordinario ya emitido (irreversibilidad)
      // -----------------------------------------------------------------------
      await simulador.getByTestId('btn-dev01-1').click()
      const entradaVotoDuplicado = simulador.locator('[data-testid^="entrada-log-dev01-1"]').last()
      await expect(entradaVotoDuplicado).toContainText('RECHAZADA')
      await expect(entradaVotoDuplicado).toContainText('VOTO_YA_EMITIDO')

      // El conteo en Moderación permanece inmutable en 3
      await expect(moderacion.getByTestId('cantidad-votos-recibidos')).toHaveText('3')

      // -----------------------------------------------------------------------
      // Paso 9 · Vaciado del log de pulsaciones en memoria
      // -----------------------------------------------------------------------
      await simulador.getByTestId('btn-limpiar-log').click()
      await expect(simulador.getByTestId('contador-entradas-log')).toHaveText('0 eventos')
      await expect(simulador.getByTestId('log-vacio')).toBeVisible()
    } finally {
      await contexto.close()
    }
  })
})
