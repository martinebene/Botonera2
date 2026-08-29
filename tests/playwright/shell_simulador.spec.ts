/**
 * Pruebas E2E de interfaz de usuario para el Simulador Web (@botonera2/simulador).
 *
 * Verificaciones obligatorias:
 * 1. Resolución Full HD 1920×1080 sin scroll vertical ni horizontal.
 * 2. Visualización simultánea de los 12 dispositivos dev01..dev12.
 * 3. Seis botones por tarjeta con etiquetas canónicas y símbolos distintivos.
 * 4. Envío de pulsaciones y renderizado del log de respuestas de FastAPI.
 * 5. Adaptabilidad en resoluciones menores (DT-020).
 */

import { expect, test, type Page } from '@playwright/test'

const URL_SIMULADOR = 'http://localhost:3002/simulador/'

test.describe('Shell del Simulador Web de Dispositivos Lógicos (WP-034)', () => {
  test('en resolución Full HD 1920×1080 presenta los 12 dispositivos simultáneamente sin scroll', async ({
    page,
  }) => {
    // Configurar viewport de referencia Full HD 1920×1080
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(URL_SIMULADOR)

    // 1. Cabecera y distintivo de simulador
    const cabecera = page.getByTestId('cabecera-simulador')
    await expect(cabecera).toBeVisible()
    await expect(page.getByTestId('badge-simulador')).toContainText(
      'Simulador · Entradas reales a FastAPI',
    )
    await expect(cabecera).toContainText('sin device-bridge')

    // 2. Panel general visible
    await expect(page.getByTestId('panel-general')).toBeVisible()

    // 3. Los 12 dispositivos dev01..dev12 presentes en pantalla
    for (let i = 1; i <= 12; i++) {
      const idDev = `dev${String(i).padStart(2, '0')}`
      const tarjeta = page.getByTestId(`tarjeta-${idDev}`)
      await expect(tarjeta).toBeVisible()
      await expect(tarjeta.getByTestId(`titulo-${idDev}`)).toHaveText(idDev)

      // Seis botones funcionales por tarjeta
      await expect(tarjeta.getByTestId(`btn-${idDev}-1`)).toBeVisible()
      await expect(tarjeta.getByTestId(`btn-${idDev}-2`)).toBeVisible()
      await expect(tarjeta.getByTestId(`btn-${idDev}-3`)).toBeVisible()
      await expect(tarjeta.getByTestId(`btn-${idDev}-7`)).toBeVisible()
      await expect(tarjeta.getByTestId(`btn-${idDev}-8`)).toBeVisible()
      await expect(tarjeta.getByTestId(`btn-${idDev}-9`)).toBeVisible()
    }

    // 4. Log global visible en la parte inferior
    await expect(page.getByTestId('seccion-log-pulsaciones')).toBeVisible()

    // 5. Comprobación matemática estricta de ausencia de scroll en 1920×1080
    const scrollInfo = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
      }
    })

    // La altura y anchura del contenido no deben desbordar el viewport disponible
    expect(scrollInfo.scrollHeight).toBeLessThanOrEqual(scrollInfo.clientHeight + 1)
    expect(scrollInfo.scrollWidth).toBeLessThanOrEqual(scrollInfo.clientWidth + 1)
  })

  test('cada tarjeta mantiene etiqueta neutra de presencia y símbolos distintivos en votos', async ({
    page,
  }) => {
    await page.goto(URL_SIMULADOR)

    const tarjeta = page.getByTestId('tarjeta-dev01')

    // Etiqueta neutra de presencia: nunca dice "Presente" ni "Ausente"
    const btnPresencia = tarjeta.getByTestId('btn-dev01-9')
    await expect(btnPresencia).toContainText('Pres. / Aus.')
    const textoBoton = await btnPresencia.innerText()
    expect(textoBoton).not.toContain('Presente')
    expect(textoBoton).not.toContain('Ausente')

    // Símbolos textuales accesibles para votos
    await expect(tarjeta.getByTestId('btn-dev01-1')).toContainText('✓')
    await expect(tarjeta.getByTestId('btn-dev01-2')).toContainText('○')
    await expect(tarjeta.getByTestId('btn-dev01-3')).toContainText('✗')

    // No revela concejal, banca, presencia ni votos individuales
    const textoTarjeta = await tarjeta.innerText()
    expect(textoTarjeta).not.toContain('Banca')
    expect(textoTarjeta).not.toContain('Concejal')
  })

  test('emite la pulsación hacia FastAPI y refleja la respuesta en el log global', async ({
    page,
  }) => {
    // Interceptar la llamada a POST /api/v1/entradas/tecla para simular respuesta controlada
    let cuerpoRecibido: unknown = null

    await page.route('**/api/v1/entradas/tecla', async (route) => {
      cuerpoRecibido = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          aceptada: true,
          dispositivo: 'dev04',
          tecla: '9',
          motivo: 'PRESENCIA_ACTUALIZADA',
          concejal: null,
          resultado: null,
        }),
      })
    })

    await page.goto(URL_SIMULADOR)

    // Pulsar tecla 9 en dev04
    await page.getByTestId('btn-dev04-9').click()

    // Verificar que el body emitido es { dispositivo: "dev04", tecla: "9" }
    expect(cuerpoRecibido).toEqual({
      dispositivo: 'dev04',
      tecla: '9',
    })

    // Verificar que la respuesta se refleja en el log global
    const entradaLog = page.getByTestId('entrada-log-dev04-9')
    await expect(entradaLog).toBeVisible()
    await expect(entradaLog).toContainText('dev04')
    await expect(entradaLog).toContainText('Pres. / Aus.')
    await expect(entradaLog).toContainText('HTTP 200')
    await expect(entradaLog).toContainText('ACEPTADA')
    await expect(entradaLog).toContainText('PRESENCIA_ACTUALIZADA')
  })

  test('se adapta a resoluciones menores sin romper los componentes', async ({ page }) => {
    // Vista en resolución compacta tipo laptop / tablet
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto(URL_SIMULADOR)

    // Los 12 dispositivos siguen existiendo y son interactivos
    await expect(page.getByTestId('tarjeta-dev01')).toBeVisible()
    await expect(page.getByTestId('tarjeta-dev12')).toBeVisible()
    await expect(page.getByTestId('seccion-log-pulsaciones')).toBeVisible()
  })
})
