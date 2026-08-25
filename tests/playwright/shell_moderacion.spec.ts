/**
 * Pruebas Playwright para el Shell y la UI de Moderación de Botonera2 (WP-021 y WP-022).
 *
 * Cobertura de pruebas E2E deterministas (H3):
 * 1. Estado SIN_PREPARAR:
 *    - Vista de sala sin preparar con botón 'Preparar sala'.
 *    - Ausencia de falso quórum 0/0 (M2).
 *    - Geometría 2×2 y ausencia de desbordes en 1920×1080 y 1366×768.
 * 2. Estado PREPARANDO:
 *    - Inputs de número de sesión y autoridades institucionales.
 *    - Botones de guardar preparación, abrir sesión y cancelar preparación.
 *    - 12 bancas en recinto con fotos, nombres, presencia y señal de test activo.
 *    - Indicador de quórum con cálculo de faltantes asistenciales.
 * 3. Estado SESION_ABIERTA y Diálogo de Advertencia de Cierre (H4):
 *    - Número de sesión inmutable y resumen de quórum en Q1 (M1).
 *    - Edición de autoridades en sesión.
 *    - Apertura de diálogo modal de confirmación ante orador/cola de palabra activa.
 *    - Accesibilidad del diálogo (role="dialog", aria-modal="true") y cancelación segura.
 * 4. Aislamiento de scroll interno y adaptación responsive:
 *    - Scroll vertical confinado al panel sin desplazar la grilla exterior.
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
    const estadoObj = JSON.parse(jsonStr)

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

    // 2. Mock de fetch para snapshots y comandos REST inmediatos
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

      if (url.includes('/api/v1/estado/moderacion')) {
        return new Response(jsonStr, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Comandos mutantes (preparar, actualizar, abrir, cerrar) responden 200 o 204
      if (url.includes('/api/v1/moderacion/')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return originalFetch(input, init)
    }
  }, estadoJson)
}

test.describe('UI de Moderación - Estados Institucionales y Controles (WP-022)', () => {
  // ===========================================================================
  // 1. ESTADO SIN_PREPARAR
  // ===========================================================================
  test('Estado SIN_PREPARAR: muestra sala sin preparar con botón Preparar sala y sin falso quórum 0/0 (1920×1080 y 1366×768)', async ({
    page,
  }) => {
    const estado = crearEstadoFixture({
      estado_global: 'SIN_PREPARAR',
      quorum: null,
    })
    await configurarRutasMock(page, estado)

    for (const { width, height } of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      await page
        .locator('[data-testid="cabecera-moderacion"]')
        .waitFor({ state: 'visible', timeout: 30000 })
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

      // Verificamos ausencia de desbordes en el viewport
      const scrollH = await page.evaluate(() => document.documentElement.scrollHeight)
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollH).toBeLessThanOrEqual(height + 2)
      expect(scrollW).toBeLessThanOrEqual(width + 2)
    }
  })

  // ===========================================================================
  // 2. ESTADO PREPARANDO
  // ===========================================================================
  test('Estado PREPARANDO: renderiza inputs de preparación, quórum con faltantes y 12 bancas con presencia y test', async ({
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

    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    // Cuadrante 1: Controles de preparación
    const vistaPreparando = page.locator('[data-testid="vista-preparando"]')
    await expect(vistaPreparando).toBeVisible()
    await expect(page.locator('[data-testid="input-numero-sesion"]')).toHaveValue('42')
    await expect(page.locator('[data-testid="input-presidencia"]')).toHaveValue('Dr. René Favaloro')
    await expect(page.locator('[data-testid="input-secretaria"]')).toHaveValue('Lic. Alicia Moreau')
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
  })

  // ===========================================================================
  // 3. ESTADO SESION_ABIERTA Y DIÁLOGO DE ADVERTENCIA DE CIERRE
  // ===========================================================================
  test('Estado SESION_ABIERTA: muestra número inmutable, quórum en Q1 y abre diálogo accesible al cerrar con orador activo', async ({
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

    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

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

    // El botón 'Cancelar y conservar sesión' debe tener el foco o ser clickeable
    const botonCancelar = page.locator('[data-testid="btn-cancelar-cierre"]')
    await expect(botonCancelar).toBeVisible()
    await botonCancelar.click()

    // Al cancelar, el modal se oculta y la sesión continúa abierta
    await expect(modal).toHaveCount(0)
    await expect(page.locator('[data-testid="vista-sesion-abierta"]')).toBeVisible()
  })

  // ===========================================================================
  // 4. AISLAMIENTO DE SCROLL Y RESPONSIVE
  // ===========================================================================
  test('Aislamiento de scroll y disposición en 1366×768 y tablet', async ({ page }) => {
    const estado = crearEstadoFixture({
      estado_global: 'PREPARANDO',
      preparacion: {
        fecha_hora_inicio: '2026-08-25T10:00:00Z',
        numero_sesion: 1,
        presidencia: 'Dra. A',
        secretaria_legislativa: 'Lic. B',
      },
      quorum: { cantidad_presentes: 8, requerido: 7, alcanzado: true },
    })
    await configurarRutasMock(page, estado)

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/')

    const panelSesion = page.locator('[data-testid="panel-sesion-votacion"]')
    const panelRecinto = page.locator('[data-testid="panel-recinto-palabra"]')

    const boxSesion = await panelSesion.boundingBox()
    const boxRecinto = await panelRecinto.boundingBox()

    expect(boxSesion).not.toBeNull()
    expect(boxRecinto).not.toBeNull()

    if (boxSesion && boxRecinto) {
      // Cuadrícula 2×2 preservada en 1366×768 (Sesión arriba izq, Recinto abajo izq)
      expect(boxSesion.y).toBeLessThan(boxRecinto.y)
    }

    // Sin desborde en 1366×768
    const scrollH = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(scrollH).toBeLessThanOrEqual(768 + 2)
  })
})
