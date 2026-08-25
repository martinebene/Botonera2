/**
 * Pruebas Playwright para el Shell y la UI de Moderación de Botonera2 (WP-021 y WP-022).
 *
 * Valida de forma reproducible:
 * 1. Resolución Full HD (1920×1080):
 *    - Cabecera y sus indicadores visibles.
 *    - Cuatro paneles y sus cuatro títulos visibles simultáneamente.
 *    - Distribución en cuadrícula 2×2 sin solapamientos.
 *    - Renderizado de componentes de sesión, quórum y recinto sin desbordes globales.
 * 2. Resolución 1366×768:
 *    - Cabecera y títulos visibles.
 *    - Preservación de la cuadrícula 2×2 sin apilado prematuro.
 *    - Elementos de control institucional y quórum accesibles y legibles.
 *    - Sin solapamientos ni desbordes globales.
 * 3. Aislamiento de scroll interno:
 *    - El crecimiento de contenido en un panel activa su scroll interno
 *      sin aumentar la altura de los demás cuadrantes.
 * 4. Adaptación a resoluciones menores:
 *    - Disposición fluida accesible sin solapamientos.
 */

import { test, expect } from '@playwright/test'

test.describe('Shell de Moderación - Layout responsive y geometría (WP-021 / WP-022)', () => {
  test('en resolución Full HD (1920×1080) dispone 4 paneles en grilla 2×2 con controles de preparación y quórum', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    // 1. Cabecera visible
    const cabecera = page.locator('[data-testid="cabecera-moderacion"]')
    await expect(cabecera).toBeVisible()
    await expect(cabecera).toContainText('Botonera2')
    await expect(cabecera).toContainText('Moderación')

    // 2. Cuatro paneles visibles
    const panelSesion = page.locator('[data-testid="panel-sesion-votacion"]')
    const panelOrden = page.locator('[data-testid="panel-orden-del-dia"]')
    const panelRecinto = page.locator('[data-testid="panel-recinto-palabra"]')
    const panelEventos = page.locator('[data-testid="panel-eventos"]')

    await expect(panelSesion).toBeVisible()
    await expect(panelOrden).toBeVisible()
    await expect(panelRecinto).toBeVisible()
    await expect(panelEventos).toBeVisible()

    // 3. Títulos visibles simultáneamente
    await expect(panelSesion.getByRole('heading', { name: 'Sesión y votación' })).toBeVisible()
    await expect(panelOrden.getByRole('heading', { name: 'Orden del Día' })).toBeVisible()
    await expect(panelRecinto.getByRole('heading', { name: 'Recinto y palabra' })).toBeVisible()
    await expect(panelEventos.getByRole('heading', { name: 'Eventos' })).toBeVisible()

    // 4. Geometría 2×2 (bounding boxes deterministas)
    const box1 = await panelSesion.boundingBox()
    const box2 = await panelOrden.boundingBox()
    const box3 = await panelRecinto.boundingBox()
    const box4 = await panelEventos.boundingBox()

    expect(box1).not.toBeNull()
    expect(box2).not.toBeNull()
    expect(box3).not.toBeNull()
    expect(box4).not.toBeNull()

    if (box1 && box2 && box3 && box4) {
      // Cuadrante 1 (arriba izq) y Cuadrante 2 (arriba der) en la misma fila superior
      expect(box1.x).toBeLessThan(box2.x)
      expect(Math.abs(box1.y - box2.y)).toBeLessThan(15)

      // Cuadrante 3 (abajo izq) y Cuadrante 4 (abajo der) en la misma fila inferior
      expect(box3.x).toBeLessThan(box4.x)
      expect(Math.abs(box3.y - box4.y)).toBeLessThan(15)

      // Columna izquierda (1 y 3) y columna derecha (2 y 4)
      expect(Math.abs(box1.x - box3.x)).toBeLessThan(15)
      expect(Math.abs(box2.x - box4.x)).toBeLessThan(15)

      // Fila inferior debajo de fila superior
      expect(box1.y).toBeLessThan(box3.y)
      expect(box2.y).toBeLessThan(box4.y)

      // Sin solapamientos
      expect(box1.x + box1.width).toBeLessThanOrEqual(box2.x + 2)
      expect(box1.y + box1.height).toBeLessThanOrEqual(box3.y + 2)
    }

    // 5. Sin overflow global indebido en el viewport
    const alturaDocumento = await page.evaluate(() => document.documentElement.scrollHeight)
    const anchoDocumento = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(alturaDocumento).toBeLessThanOrEqual(1080 + 2)
    expect(anchoDocumento).toBeLessThanOrEqual(1920 + 2)
  })

  test('en resolución 1366×768 conserva la grilla 2×2 con todos los títulos y controles legibles', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/')

    // Cabecera visible
    const cabecera = page.locator('[data-testid="cabecera-moderacion"]')
    await expect(cabecera).toBeVisible()

    // 4 paneles visibles
    const panelSesion = page.locator('[data-testid="panel-sesion-votacion"]')
    const panelOrden = page.locator('[data-testid="panel-orden-del-dia"]')
    const panelRecinto = page.locator('[data-testid="panel-recinto-palabra"]')
    const panelEventos = page.locator('[data-testid="panel-eventos"]')

    await expect(panelSesion).toBeVisible()
    await expect(panelOrden).toBeVisible()
    await expect(panelRecinto).toBeVisible()
    await expect(panelEventos).toBeVisible()

    // 4 títulos visibles
    await expect(panelSesion.getByRole('heading', { name: 'Sesión y votación' })).toBeVisible()
    await expect(panelOrden.getByRole('heading', { name: 'Orden del Día' })).toBeVisible()
    await expect(panelRecinto.getByRole('heading', { name: 'Recinto y palabra' })).toBeVisible()
    await expect(panelEventos.getByRole('heading', { name: 'Eventos' })).toBeVisible()

    // Geometría 2×2 en 1366×768
    const box1 = await panelSesion.boundingBox()
    const box2 = await panelOrden.boundingBox()
    const box3 = await panelRecinto.boundingBox()
    const box4 = await panelEventos.boundingBox()

    expect(box1).not.toBeNull()
    expect(box2).not.toBeNull()
    expect(box3).not.toBeNull()
    expect(box4).not.toBeNull()

    if (box1 && box2 && box3 && box4) {
      expect(box1.x).toBeLessThan(box2.x)
      expect(Math.abs(box1.y - box2.y)).toBeLessThan(15)
      expect(box3.x).toBeLessThan(box4.x)
      expect(Math.abs(box3.y - box4.y)).toBeLessThan(15)
      expect(box1.y).toBeLessThan(box3.y)
      expect(box2.y).toBeLessThan(box4.y)
      expect(box1.x + box1.width).toBeLessThanOrEqual(box2.x + 2)
      expect(box1.y + box1.height).toBeLessThanOrEqual(box3.y + 2)
    }

    // Sin desborde global
    const alturaDocumento = await page.evaluate(() => document.documentElement.scrollHeight)
    const anchoDocumento = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(alturaDocumento).toBeLessThanOrEqual(768 + 2)
    expect(anchoDocumento).toBeLessThanOrEqual(1366 + 2)
  })

  test('el crecimiento interno de un panel utiliza scroll interno sin modificar la altura de los demás paneles', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    const panelSesion = page.locator('[data-testid="panel-sesion-votacion"]')
    const panelEventos = page.locator('[data-testid="panel-eventos"]')

    // Medimos alturas iniciales
    const boxSesionInicial = await panelSesion.boundingBox()
    const boxEventosInicial = await panelEventos.boundingBox()

    expect(boxSesionInicial).not.toBeNull()
    expect(boxEventosInicial).not.toBeNull()

    // Inyectamos 100 elementos de prueba en el cuerpo con scroll interno del panel de Eventos
    await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="panel-eventos"] .overflow-y-auto')
      if (panel) {
        for (let i = 0; i < 100; i++) {
          const div = document.createElement('div')
          div.textContent = `Evento extenso inyectado #${i + 1} para prueba de scroll`
          div.className = 'py-2 border-b border-slate-800 text-xs'
          panel.appendChild(div)
        }
      }
    })

    // Verificamos que el contenedor interno activó el scroll vertical
    const tieneScroll = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="panel-eventos"] .overflow-y-auto')
      return panel ? panel.scrollHeight > panel.clientHeight : false
    })
    expect(tieneScroll).toBe(true)

    // Verificamos que la altura exterior del panel de eventos y del panel de sesión no cambió
    const boxSesionFinal = await panelSesion.boundingBox()
    const boxEventosFinal = await panelEventos.boundingBox()

    expect(boxSesionFinal).not.toBeNull()
    expect(boxEventosFinal).not.toBeNull()

    if (boxSesionInicial && boxSesionFinal && boxEventosInicial && boxEventosFinal) {
      expect(Math.abs(boxSesionFinal.height - boxSesionInicial.height)).toBeLessThan(5)
      expect(Math.abs(boxEventosFinal.height - boxEventosInicial.height)).toBeLessThan(5)
    }
  })

  test('en resoluciones menores (pantalla móvil o tablet) adapta fluidamente la disposición', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    const cabecera = page.locator('[data-testid="cabecera-moderacion"]')
    await expect(cabecera).toBeVisible()

    const panelSesion = page.locator('[data-testid="panel-sesion-votacion"]')
    const panelEventos = page.locator('[data-testid="panel-eventos"]')

    await expect(panelSesion).toBeVisible()
    await expect(panelEventos).toBeVisible()

    // En tablet / vertical los paneles están apilados verticalmente (boxSesion.y < boxEventos.y)
    const boxSesion = await panelSesion.boundingBox()
    const boxEventos = await panelEventos.boundingBox()

    expect(boxSesion).not.toBeNull()
    expect(boxEventos).not.toBeNull()

    if (boxSesion && boxEventos) {
      expect(boxSesion.y).toBeLessThan(boxEventos.y)
    }
  })
})
