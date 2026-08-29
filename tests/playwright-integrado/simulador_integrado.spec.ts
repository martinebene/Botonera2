/**
 * Prueba E2E integrada del Simulador Web contra el stack real de FastAPI.
 *
 * Demuestra:
 * 1. La SPA /simulador/ se sirve correctamente desde el stack integrado junto con /moderacion/.
 * 2. Conexión y sincronización SSE en tiempo real (adopta SIN_PREPARAR y PREPARANDO).
 * 3. Emisión de pulsaciones directas a POST /api/v1/entradas/tecla sin atravesar device-bridge.
 * 4. Registro fiel en el log tanto de aceptaciones (status 200, aceptada=true)
 *    como de rechazos funcionales de FastAPI (status 200, aceptada=false).
 * 5. Efecto inmediato en el estado institucional (quórum y presencia en Moderación).
 * 6. Concurrencia entre tarjetas dev01..dev12 y vaciado del log en memoria.
 */

import { expect, test } from '@playwright/test'
import { ProcesoStackIntegrado, URL_STACK } from './infraestructura'

test.describe('Simulador Web Integrado (WP-034)', () => {
  test('interactúa con FastAPI real, refleja sincronización SSE y reporta respuestas en el log', async ({
    browser,
  }) => {
    const stack = new ProcesoStackIntegrado()
    await stack.iniciar()

    const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const moderacion = await contexto.newPage()
    const simulador = await contexto.newPage()

    try {
      // 1. Cargar ambas aplicaciones desde el mismo origen del stack integrado
      await moderacion.goto(`${URL_STACK}/moderacion/`)
      await simulador.goto(`${URL_STACK}/simulador/`)

      // 2. Verificar estado inicial SIN_PREPARAR en el simulador vía SSE
      await expect(simulador.getByTestId('indicador-conexion-conectado')).toBeVisible()
      await expect(simulador.getByTestId('indicador-estado-global')).toHaveText('SIN_PREPARAR')

      // 3. Enviar pulsación en SIN_PREPARAR: el backend debe rechazarla funcionalmente
      // (En SIN_PREPARAR ninguna tecla produce efecto de negocio)
      await simulador.getByTestId('btn-dev01-9').click()

      // El log refleja la respuesta real de FastAPI (status 200, rechazada)
      const entradaRechazada = simulador.getByTestId('entrada-log-dev01-9')
      await expect(entradaRechazada).toBeVisible()
      await expect(entradaRechazada).toContainText('dev01')
      await expect(entradaRechazada).toContainText('HTTP 200')
      await expect(entradaRechazada).toContainText('RECHAZADA')

      // 4. Iniciar preparación desde Moderación
      await expect(moderacion.getByTestId('btn-preparar-sala')).toBeVisible()
      await moderacion.getByTestId('btn-preparar-sala').click()
      await expect(moderacion.getByTestId('vista-preparando')).toBeVisible()

      // 5. El simulador recibe la transición a PREPARANDO en tiempo real vía SSE
      await expect(simulador.getByTestId('indicador-estado-global')).toHaveText('PREPARANDO')

      // 6. Enviar pulsación de presencia (tecla 9) en PREPARANDO: debe ser ACEPTADA por FastAPI
      await simulador.getByTestId('btn-dev01-9').click()

      // Comprobar que el log muestra la aceptación funcional
      await expect(simulador.getByTestId('log-resultado-aceptada')).toBeVisible()
      const entradaAceptada = simulador.locator('[data-testid^="entrada-log-dev01-9"]').last()
      await expect(entradaAceptada).toContainText('ACEPTADA')
      await expect(entradaAceptada).toContainText('PRESENCIA_ACTUALIZADA')

      // El quórum se actualiza inmediatamente en el panel del simulador
      await expect(simulador.getByTestId('indicador-quorum')).toContainText('1 presentes')

      // 7. Enviar tecla de voto (tecla 1) en PREPARANDO: no hay votación, debe ser RECHAZADA
      await simulador.getByTestId('btn-dev01-1').click()
      const entradaVotoRechazado = simulador.getByTestId('entrada-log-dev01-1')
      await expect(entradaVotoRechazado).toBeVisible()
      await expect(entradaVotoRechazado).toContainText('RECHAZADA')
      await expect(entradaVotoRechazado).toContainText('TECLA_NO_HABILITADA')

      // 8. Concurrencia entre dispositivos: enviar presencia en dev02 y dev03
      await simulador.getByTestId('btn-dev02-9').click()
      await simulador.getByTestId('btn-dev03-9').click()

      await expect(simulador.getByTestId('indicador-quorum')).toContainText('3 presentes')

      // 9. Vaciado del log de pulsaciones
      await simulador.getByTestId('btn-limpiar-log').click()
      await expect(simulador.getByTestId('contador-entradas-log')).toHaveText('0 eventos')
      await expect(simulador.getByTestId('log-vacio')).toBeVisible()
    } finally {
      await contexto.close()
      await stack.detener()
    }
  })
})
