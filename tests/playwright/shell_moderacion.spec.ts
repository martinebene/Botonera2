/**
 * Pruebas Playwright para el Shell y la UI de Moderación de Botonera2 (WP-021 y WP-022).
 *
 * Cobertura de pruebas E2E deterministas (H3, N1):
 * 1. Contrato de Shell 2×2 completo en 1920×1080 y 1366×768:
 *    - Cabecera operacional permanente.
 *    - Cuatro cuadrantes simultáneos (Q1 Sesión, Q2 Orden del Día, Q3 Recinto, Q4 Eventos).
 *    - Cuatro títulos visibles y bounding boxes válidos.
 *    - Alineación precisa por filas y columnas sin solapamientos horizontales ni verticales.
 *    - Ausencia de desborde global en la ventana.
 * 2. Estado SIN_PREPARAR (1920×1080 y 1366×768):
 *    - Vista de sala sin preparar con botón 'Preparar sala'.
 *    - Ausencia de falso quórum 0/0 (M2).
 * 3. Estado PREPARANDO (1920×1080 y 1366×768):
 *    - Inputs de número de sesión y autoridades institucionales.
 *    - Botones de guardar preparación, abrir sesión y cancelar preparación.
 *    - 12 bancas en recinto con fotos, nombres, presencia y señal de test activo.
 *    - Indicador de quórum con cálculo de faltantes asistenciales.
 * 4. Estado SESION_ABIERTA y Diálogo de Advertencia de Cierre (1920×1080 y 1366×768):
 *    - Número de sesión inmutable y resumen de quórum en Q1 (M1).
 *    - Edición de autoridades en sesión.
 *    - Apertura de diálogo modal de confirmación ante orador/cola de palabra activa (H4).
 *    - Accesibilidad del diálogo (role="dialog", aria-modal="true") y cancelación segura.
 * 5. Aislamiento de scroll interno:
 *    - Demostración de que el crecimiento de contenido en contenedores internos genera scroll local
 *      sin deformar ni aumentar las alturas exteriores de los paneles hermanos ni producir scroll global.
 */

import { test, expect, type Page } from '@playwright/test'

function crearConcejalesFixture(cantidad = 12) {
  return Array.from({ length: cantidad }, (_, i) => {
    const banca = i + 1
    const pad = String(banca).padStart(2, '0')
    return {
      banca,
      dni: `300000${pad}`,
      nombre: `Concejal${pad}`,
      apellido: `Apellido${pad}`,
      nombre_mostrar: `C. Apellido${pad}`,
      bloque: banca % 2 === 0 ? 'Frente de Todos' : 'Juntos por el Cambio',
      ruta_imagen: `assets/bancas/banca-${pad}.png`,
      dispositivo_votacion: `dev${pad}`,
      presente: banca <= 8,
      test_activo: banca === 1,
      test_expira_en: banca === 1 ? '2026-08-25T10:00:05Z' : null,
    }
  })
}

function crearEstadoFixture(parcial: Record<string, unknown> = {}) {
  return {
    revision: 1,
    generado_en: '2026-08-25T10:00:00Z',
    estado_global: 'SIN_PREPARAR',
    preparacion: null,
    sesion: null,
    votacion: null,
    palabra: {
      orador: null,
      cola: [],
    },
    quorum: null,
    configuracion: {
      filas_bancas: [3, 4, 5],
    },
    concejales: crearConcejalesFixture(12),
    capacidades: {
      preparar_sala: { habilitada: true, motivos: [] },
      actualizar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cancelar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      abrir_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      actualizar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cerrar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      iniciar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cancelar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cerrar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      desempatar: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      solicitar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cancelar_solicitud_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      otorgar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      quitar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      subir_orden_dia: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      seleccionar_expediente: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cerrar_expediente: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      registrar_evento_manual: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
    },
    ...parcial,
  }
}

async function configurarRutasMock(page: Page, estado: Record<string, unknown>) {
  const estadoJson = JSON.stringify(estado)

  await page.addInitScript((jsonStr) => {
    // 1. Mock de EventSource para streaming SSE determinista
    class MockEventSource {
      url: string
      readyState = 1
      listeners: Record<string, ((e: unknown) => void)[]> = {}
      onopen: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onmessage: ((e: unknown) => void) | null = null

      constructor(url: string) {
        this.url = url
        setTimeout(() => {
          if (this.onopen) this.onopen({ type: 'open' })
          const handlers = this.listeners['estado'] || []
          for (const handler of handlers) {
            handler({ type: 'estado', data: jsonStr })
          }
        }, 10)
      }

      addEventListener(tipo: string, handler: (e: unknown) => void) {
        this.listeners[tipo] = this.listeners[tipo] || []
        this.listeners[tipo].push(handler)
      }

      removeEventListener(tipo: string, handler: (e: unknown) => void) {
        if (!this.listeners[tipo]) return
        this.listeners[tipo] = this.listeners[tipo].filter((h) => h !== handler)
      }

      close() {
        this.readyState = 2
      }
    }

    // @ts-expect-error Mock inyectado en el runtime del navegador
    window.EventSource = MockEventSource

    // 2. Mock de fetch para snapshots REST inmediatos (MN-3: sin ramas muertas)
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

      if (url.includes('/api/v1/estado/moderacion')) {
        return new Response(jsonStr, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return originalFetch(input, init)
    }
  }, estadoJson)
}

function obtenerPaneles(page: Page) {
  return {
    sesion: page.locator('[data-testid="panel-sesion-votacion"]'),
    ordenDia: page.locator('[data-testid="panel-orden-del-dia"]'),
    recinto: page.locator('[data-testid="panel-recinto-palabra"]'),
    eventos: page.locator('[data-testid="panel-eventos"]'),
  }
}

/**
 * Valida de forma exhaustiva el contrato geométrico 2×2 del shell de Moderación (N1):
 * - Cabecera visible
 * - Cuatro cuadrantes con sus títulos institucionales correspondientes
 * - Bounding boxes no nulos
 * - Fila superior: Q1 a la izquierda de Q2 con igual coordenada Y (aprox)
 * - Fila inferior: Q3 a la izquierda de Q4 con igual coordenada Y (aprox)
 * - Columnas: Q1 alineado verticalmente con Q3; Q2 alineado con Q4
 * - Fila inferior debajo de la fila superior (sin solapamiento vertical)
 * - Ausencia de solapamiento horizontal entre paneles
 * - Ausencia de scroll global indebido en la ventana
 */
async function verificarGeometriaShellCompleto(
  page: Page,
  viewport: { width: number; height: number },
) {
  // 1. Cabecera operacional permanente visible
  const cabecera = page.locator('[data-testid="cabecera-moderacion"]')
  await expect(cabecera).toBeVisible()

  // 2. Los cuatro cuadrantes simultáneamente visibles con sus cuatro títulos institucionales
  const paneles = obtenerPaneles(page)
  await expect(paneles.sesion).toBeVisible()
  await expect(paneles.ordenDia).toBeVisible()
  await expect(paneles.recinto).toBeVisible()
  await expect(paneles.eventos).toBeVisible()

  await expect(paneles.sesion).toContainText('Sesión y votación')
  await expect(paneles.ordenDia).toContainText('Orden del Día')
  await expect(paneles.recinto).toContainText('Recinto y palabra')
  await expect(paneles.eventos).toContainText('Eventos')

  // 3. Medición geométrica precisa
  const boxQ1 = await paneles.sesion.boundingBox()
  const boxQ2 = await paneles.ordenDia.boundingBox()
  const boxQ3 = await paneles.recinto.boundingBox()
  const boxQ4 = await paneles.eventos.boundingBox()

  expect(boxQ1).not.toBeNull()
  expect(boxQ2).not.toBeNull()
  expect(boxQ3).not.toBeNull()
  expect(boxQ4).not.toBeNull()

  if (boxQ1 && boxQ2 && boxQ3 && boxQ4) {
    // Fila superior: Q1 a la izquierda de Q2 y aproximadamente a la misma altura Y
    expect(Math.abs(boxQ1.y - boxQ2.y)).toBeLessThanOrEqual(6)
    expect(boxQ1.x + boxQ1.width).toBeLessThanOrEqual(boxQ2.x + 2)

    // Fila inferior: Q3 a la izquierda de Q4 y aproximadamente a la misma altura Y
    expect(Math.abs(boxQ3.y - boxQ4.y)).toBeLessThanOrEqual(6)
    expect(boxQ3.x + boxQ3.width).toBeLessThanOrEqual(boxQ4.x + 2)

    // Columnas: Q1 alineado aprox con Q3 en coordenada X y ancho
    expect(Math.abs(boxQ1.x - boxQ3.x)).toBeLessThanOrEqual(6)
    expect(Math.abs(boxQ1.width - boxQ3.width)).toBeLessThanOrEqual(6)

    // Columnas: Q2 alineado aprox con Q4 en coordenada X y ancho
    expect(Math.abs(boxQ2.x - boxQ4.x)).toBeLessThanOrEqual(6)
    expect(Math.abs(boxQ2.width - boxQ4.width)).toBeLessThanOrEqual(6)

    // Fila inferior situada debajo de la fila superior (sin solapamiento vertical)
    expect(boxQ1.y + boxQ1.height).toBeLessThanOrEqual(boxQ3.y + 2)
    expect(boxQ2.y + boxQ2.height).toBeLessThanOrEqual(boxQ4.y + 2)
  }

  // 4. Ausencia de overflow global en la ventana
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
  const scrollH = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(scrollW).toBeLessThanOrEqual(viewport.width + 2)
  expect(scrollH).toBeLessThanOrEqual(viewport.height + 2)
}

test.describe('UI de Moderación - Estados Institucionales y Contrato de Shell (WP-022)', () => {
  // ===========================================================================
  // 1. ESTADO SIN_PREPARAR (1920×1080 y 1366×768)
  // ===========================================================================
  test('Estado SIN_PREPARAR: verifica contrato 2×2, sala sin preparar y ausencia de falso quórum 0/0 (1920×1080 y 1366×768)', async ({
    page,
  }) => {
    const estado = crearEstadoFixture({
      estado_global: 'SIN_PREPARAR',
      quorum: null,
    })
    await configurarRutasMock(page, estado)

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page
        .locator('[data-testid="cabecera-moderacion"]')
        .waitFor({ state: 'visible', timeout: 30000 })

      // Verificamos el contrato geométrico 2×2 completo del shell (N1)
      await verificarGeometriaShellCompleto(page, viewport)

      // Verificamos estado en cabecera
      await expect(page.locator('[data-testid="estado-global"]')).toContainText('Sin preparar')

      // Cuadrante 1: Sesión y votación
      const vistaSinPreparar = page.locator('[data-testid="vista-sin-preparar"]')
      await expect(vistaSinPreparar).toBeVisible()
      await expect(vistaSinPreparar).toContainText('Sala sin preparar')
      await expect(page.locator('[data-testid="btn-preparar-sala"]')).toBeVisible()
      await expect(page.locator('[data-testid="vista-preparando"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="vista-sesion-abierta"]')).toHaveCount(0)

      // Cuadrante 3: Recinto y palabra (M2: sin falso quórum 0/0)
      await expect(page.locator('[data-testid="indicador-quorum"]')).toHaveCount(0)
      await expect(page.locator('text=0 de 0 presentes')).toHaveCount(0)
    }
  })

  // ===========================================================================
  // 2. ESTADO PREPARANDO (1920×1080 y 1366×768)
  // ===========================================================================
  test('Estado PREPARANDO: verifica contrato 2×2, inputs de preparación, quórum con faltantes y 12 bancas (1920×1080 y 1366×768)', async ({
    page,
  }) => {
    const estado = crearEstadoFixture({
      estado_global: 'PREPARANDO',
      preparacion: {
        fecha_hora_inicio: '2026-08-25T10:00:00Z',
        numero_sesion: 42,
        presidencia: 'Dr. René Favaloro',
        secretaria_legislativa: 'Lic. Alicia Moreau',
      },
      quorum: {
        cantidad_presentes: 5,
        requerido: 7,
        alcanzado: false,
      },
      capacidades: {
        preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        actualizar_preparacion: { habilitada: true, motivos: [] },
        cancelar_preparacion: { habilitada: true, motivos: [] },
        abrir_sesion: { habilitada: false, motivos: ['QUORUM_INSUFICIENTE'] },
        actualizar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        cerrar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        iniciar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        cancelar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        cerrar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        desempatar: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        solicitar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        cancelar_solicitud_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        otorgar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        quitar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        subir_orden_dia: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        seleccionar_expediente: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        cerrar_expediente: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        registrar_evento_manual: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      },
    })
    await configurarRutasMock(page, estado)

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page
        .locator('[data-testid="cabecera-moderacion"]')
        .waitFor({ state: 'visible', timeout: 30000 })

      // Verificamos el contrato geométrico 2×2 completo del shell (N1)
      await verificarGeometriaShellCompleto(page, viewport)

      // Cuadrante 1: Controles de preparación
      const vistaPreparando = page.locator('[data-testid="vista-preparando"]')
      await expect(vistaPreparando).toBeVisible()
      await expect(page.locator('[data-testid="input-numero-sesion"]')).toHaveValue('42')
      await expect(page.locator('[data-testid="input-presidencia"]')).toHaveValue(
        'Dr. René Favaloro',
      )
      await expect(page.locator('[data-testid="input-secretaria"]')).toHaveValue(
        'Lic. Alicia Moreau',
      )
      await expect(page.locator('[data-testid="btn-guardar-preparacion"]')).toBeVisible()
      await expect(page.locator('[data-testid="btn-abrir-sesion"]')).toBeDisabled()
      await expect(page.locator('[data-testid="btn-cancelar-preparacion"]')).toBeVisible()

      // Motivo visible de quórum insuficiente para abrir sesión
      await expect(page.locator('[data-testid="motivos-abrir-sesion"]')).toContainText(
        'Quórum insuficiente',
      )

      // Cuadrante 3: Quórum con faltantes asistenciales
      const indicadorQuorum = page.locator('[data-testid="indicador-quorum"]')
      await expect(indicadorQuorum).toBeVisible()
      await expect(indicadorQuorum).toContainText('Falta quórum')
      await expect(indicadorQuorum).toContainText('5 de 12 presentes')
      await expect(page.locator('[data-testid="quorum-faltantes"]')).toContainText(
        'Faltan 2 presentes',
      )

      // 12 Bancas renderizadas
      const bancas = page.locator('[data-testid="banca-concejal"]')
      await expect(bancas).toHaveCount(12)

      // Banca 1 con test activo visible
      await expect(page.locator('[data-testid="badge-test-activo"]')).toBeVisible()
    }
  })

  // ===========================================================================
  // 3. ESTADO SESION_ABIERTA Y DIÁLOGO DE ADVERTENCIA DE CIERRE (1920×1080 y 1366×768)
  // ===========================================================================
  test('Estado SESION_ABIERTA: verifica contrato 2×2, número inmutable, quórum en Q1 y diálogo modal accesible (1920×1080 y 1366×768)', async ({
    page,
  }) => {
    const estado = crearEstadoFixture({
      estado_global: 'SESION_ABIERTA',
      sesion: {
        fecha_hora_inicio_preparacion: '2026-08-25T10:00:00Z',
        fecha_hora_apertura: '2026-08-25T10:30:00Z',
        numero_sesion: 8,
        presidencia: 'Dra. María Elena Walsh',
        secretaria_legislativa: 'Lic. Juan Gómez',
      },
      quorum: {
        cantidad_presentes: 9,
        requerido: 7,
        alcanzado: true,
      },
      palabra: {
        orador: { dni: '30000001', nombre: 'Carlos', apellido: 'Pérez', banca: 2 },
        cola: [{ dni: '30000003', nombre: 'Diana', apellido: 'López', banca: 4 }],
      },
      capacidades: {
        preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        actualizar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        cancelar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        abrir_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        actualizar_sesion: { habilitada: true, motivos: [] },
        cerrar_sesion: { habilitada: true, motivos: [] },
        iniciar_votacion: { habilitada: true, motivos: [] },
        cancelar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        cerrar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        desempatar: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        solicitar_palabra: { habilitada: true, motivos: [] },
        cancelar_solicitud_palabra: { habilitada: true, motivos: [] },
        otorgar_palabra: { habilitada: true, motivos: [] },
        quitar_palabra: { habilitada: true, motivos: [] },
        subir_orden_dia: { habilitada: true, motivos: [] },
        seleccionar_expediente: { habilitada: true, motivos: [] },
        cerrar_expediente: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
        registrar_evento_manual: { habilitada: true, motivos: [] },
      },
    })
    await configurarRutasMock(page, estado)

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page
        .locator('[data-testid="cabecera-moderacion"]')
        .waitFor({ state: 'visible', timeout: 30000 })

      // Verificamos el contrato geométrico 2×2 completo del shell (N1)
      await verificarGeometriaShellCompleto(page, viewport)

      // Cuadrante 1: Número inmutable y Quórum en Q1 (M1)
      await expect(page.locator('[data-testid="vista-sesion-abierta"]')).toBeVisible()
      await expect(page.locator('[data-testid="numero-sesion-inmutable"]')).toContainText(
        'Sesión Nº 8',
      )
      const quorumResumen = page.locator('[data-testid="quorum-resumen-sesion"]')
      await expect(quorumResumen).toBeVisible()
      await expect(quorumResumen).toContainText('9 / 7 presentes')
      await expect(quorumResumen).toContainText('Quórum legal')

      // Autoridades actualizables
      await expect(page.locator('[data-testid="input-presidencia-sesion"]')).toHaveValue(
        'Dra. María Elena Walsh',
      )
      await expect(page.locator('[data-testid="input-secretaria-sesion"]')).toHaveValue(
        'Lic. Juan Gómez',
      )
      await expect(page.locator('[data-testid="btn-actualizar-autoridades"]')).toBeVisible()

      // Intentar cerrar la sesión teniendo un orador activo -> debe abrir el diálogo modal (H4)
      const botonCerrar = page.locator('[data-testid="btn-cerrar-sesion"]')
      await expect(botonCerrar).toBeVisible()
      await botonCerrar.click()

      // Diálogo modal abierto con semántica accesible
      const modal = page.locator('[data-testid="dialogo-confirmacion-cierre"]')
      await expect(modal).toBeVisible()
      await expect(modal).toHaveAttribute('role', 'dialog')
      await expect(modal).toHaveAttribute('aria-modal', 'true')
      await expect(modal).toContainText('Carlos Pérez')
      await expect(modal).toContainText('1 solicitud pendiente en la cola')

      // El botón 'Cancelar y conservar sesión' debe ser clickeable y cerrar el modal
      const botonCancelar = page.locator('[data-testid="btn-cancelar-cierre"]')
      await expect(botonCancelar).toBeVisible()
      await botonCancelar.click()

      // Al cancelar, el modal se oculta y la sesión continúa abierta
      await expect(modal).toHaveCount(0)
      await expect(page.locator('[data-testid="vista-sesion-abierta"]')).toBeVisible()
    }
  })

  // ===========================================================================
  // 4. AISLAMIENTO DE SCROLL INTERNO EN PANELES (1920×1080 y 1366×768)
  // ===========================================================================
  test('Aislamiento de scroll: el crecimiento de contenido interno no modifica alturas exteriores ni la grilla 2×2 (1920×1080 y 1366×768)', async ({
    page,
  }) => {
    const estado = crearEstadoFixture({
      estado_global: 'SESION_ABIERTA',
      sesion: {
        fecha_hora_inicio_preparacion: '2026-08-25T10:00:00Z',
        fecha_hora_apertura: '2026-08-25T10:30:00Z',
        numero_sesion: 1,
        presidencia: 'Dra. A',
        secretaria_legislativa: 'Lic. B',
      },
      quorum: { cantidad_presentes: 8, requerido: 7, alcanzado: true },
    })
    await configurarRutasMock(page, estado)

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page
        .locator('[data-testid="cabecera-moderacion"]')
        .waitFor({ state: 'visible', timeout: 30000 })

      const paneles = obtenerPaneles(page)

      // 1. Obtenemos las dimensiones exteriores iniciales de los 4 cuadrantes
      const boxQ1Ini = await paneles.sesion.boundingBox()
      const boxQ2Ini = await paneles.ordenDia.boundingBox()
      const boxQ3Ini = await paneles.recinto.boundingBox()
      const boxQ4Ini = await paneles.eventos.boundingBox()

      expect(boxQ1Ini).not.toBeNull()
      expect(boxQ2Ini).not.toBeNull()
      expect(boxQ3Ini).not.toBeNull()
      expect(boxQ4Ini).not.toBeNull()

      // 2. Inyectamos 100 elementos de prueba en el contenedor scrollable interno de Eventos (Q4)
      const scrollInternoGenerado = await page.evaluate(() => {
        const contenedorScrollQ4 = document.querySelector(
          '[data-testid="panel-eventos"] .overflow-y-auto',
        )
        if (!contenedorScrollQ4) return false

        for (let i = 0; i < 100; i++) {
          const item = document.createElement('div')
          item.textContent = `Evento auditado de prueba con texto largo #${i}`
          item.style.padding = '16px'
          item.style.borderBottom = '1px solid #334155'
          contenedorScrollQ4.appendChild(item)
        }

        // Comprobamos que el contenedor interno ahora requiere scroll vertical
        return contenedorScrollQ4.scrollHeight > contenedorScrollQ4.clientHeight
      })

      expect(scrollInternoGenerado).toBe(true)

      // 3. Volvemos a medir las dimensiones exteriores de los 4 cuadrantes
      const boxQ1Fin = await paneles.sesion.boundingBox()
      const boxQ2Fin = await paneles.ordenDia.boundingBox()
      const boxQ3Fin = await paneles.recinto.boundingBox()
      const boxQ4Fin = await paneles.eventos.boundingBox()

      expect(boxQ1Fin).not.toBeNull()
      expect(boxQ2Fin).not.toBeNull()
      expect(boxQ3Fin).not.toBeNull()
      expect(boxQ4Fin).not.toBeNull()

      if (
        boxQ1Ini &&
        boxQ2Ini &&
        boxQ3Ini &&
        boxQ4Ini &&
        boxQ1Fin &&
        boxQ2Fin &&
        boxQ3Fin &&
        boxQ4Fin
      ) {
        // La altura exterior del panel con scroll (Q4) NO aumentó arbitrariamente
        expect(Math.abs(boxQ4Fin.height - boxQ4Ini.height)).toBeLessThanOrEqual(2)

        // Las alturas de los paneles hermanos (Q1, Q2, Q3) permanecen inalteradas
        expect(Math.abs(boxQ1Fin.height - boxQ1Ini.height)).toBeLessThanOrEqual(2)
        expect(Math.abs(boxQ2Fin.height - boxQ2Ini.height)).toBeLessThanOrEqual(2)
        expect(Math.abs(boxQ3Fin.height - boxQ3Ini.height)).toBeLessThanOrEqual(2)

        // La geometría 2×2 se preserva intacta sin solapamientos
        expect(boxQ1Fin.x + boxQ1Fin.width).toBeLessThanOrEqual(boxQ2Fin.x + 2)
        expect(boxQ3Fin.x + boxQ3Fin.width).toBeLessThanOrEqual(boxQ4Fin.x + 2)
        expect(boxQ1Fin.y + boxQ1Fin.height).toBeLessThanOrEqual(boxQ3Fin.y + 2)
        expect(boxQ2Fin.y + boxQ2Fin.height).toBeLessThanOrEqual(boxQ4Fin.y + 2)
      }

      // 4. El scroll global de la ventana NO debe desbordar
      const scrollH = await page.evaluate(() => document.documentElement.scrollHeight)
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollH).toBeLessThanOrEqual(viewport.height + 2)
      expect(scrollW).toBeLessThanOrEqual(viewport.width + 2)
    }
  })
})
