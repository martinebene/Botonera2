/** Recorrido público determinista de WP-025 en Full HD y 1366×768. */

import { expect, test, type Page } from '@playwright/test'

function crearConcejales(cantidad: number) {
  return Array.from({ length: cantidad }, (_, indice) => {
    const banca = indice + 1
    return {
      nombre: `Nombre${banca}`,
      apellido: `Apellido${banca}`,
      bloque: banca % 2 === 0 ? 'Bloque Azul' : 'Bloque Verde',
      banca,
      ruta_imagen: `assets/bancas/banca-${String(banca).padStart(2, '0')}.png`,
      presente: banca !== 2,
      test_activo: banca === 3,
      test_expira_en: banca === 3 ? '2026-08-27T10:00:05Z' : null,
    }
  })
}

function crearEstado(parcial: Record<string, unknown> = {}) {
  return {
    revision: 0,
    generado_en: '2026-08-27T10:00:00Z',
    estado_global: 'SIN_PREPARAR',
    preparacion: null,
    sesion: null,
    filas_bancas: null,
    concejales: [],
    quorum: null,
    votacion: null,
    palabra: null,
    ...parcial,
  }
}

/**
 * Instala un backend público controlado. Las únicas operaciones visibles para
 * la aplicación siguen siendo GET snapshot y EventSource de EstadoRecinto.
 */
async function instalarBackendPublico(page: Page, estadoInicial: Record<string, unknown>) {
  await page.addInitScript((inicial) => {
    type EstadoPrueba = Record<string, unknown> & { revision: number }
    type EventoPrueba = { type: string; data?: string }
    type ControlRecinto = {
      publicar: (estado: EstadoPrueba) => void
      cortarYRecuperar: (estado: EstadoPrueba) => void
    }

    let estadoActual = inicial as EstadoPrueba
    const fuentes: FuentePublicaPrueba[] = []

    function publicar(estado: EstadoPrueba): void {
      estadoActual = estado
      const data = JSON.stringify(estadoActual)
      for (const fuente of fuentes) {
        if (fuente.cerrada) continue
        for (const escuchar of fuente.escuchas.estado ?? []) {
          escuchar({ type: 'estado', data })
        }
      }
    }

    class FuentePublicaPrueba {
      cerrada = false
      onopen: ((evento: EventoPrueba) => void) | null = null
      onerror: ((evento: EventoPrueba) => void) | null = null
      onmessage: ((evento: EventoPrueba) => void) | null = null
      escuchas: Record<string, ((evento: EventoPrueba) => void)[]> = {}

      constructor(readonly url: string) {
        fuentes.push(this)
        setTimeout(() => {
          if (this.cerrada) return
          this.onopen?.({ type: 'open' })
          const data = JSON.stringify(estadoActual)
          for (const escuchar of this.escuchas.estado ?? []) {
            escuchar({ type: 'estado', data })
          }
        }, 10)
      }

      addEventListener(tipo: string, escuchar: (evento: EventoPrueba) => void): void {
        this.escuchas[tipo] = this.escuchas[tipo] ?? []
        this.escuchas[tipo]?.push(escuchar)
      }

      removeEventListener(tipo: string, escuchar: (evento: EventoPrueba) => void): void {
        this.escuchas[tipo] = (this.escuchas[tipo] ?? []).filter(
          (registrado) => registrado !== escuchar,
        )
      }

      close(): void {
        this.cerrada = true
      }
    }

    // @ts-expect-error Sustitución determinista de EventSource para el E2E.
    window.EventSource = FuentePublicaPrueba

    const ventana = window as Window & { __controlRecinto?: ControlRecinto }
    ventana.__controlRecinto = {
      publicar,
      cortarYRecuperar: (estado) => {
        estadoActual = estado
        const fuenteActiva = [...fuentes].reverse().find((fuente) => !fuente.cerrada)
        fuenteActiva?.onerror?.({ type: 'error' })
      },
    }

    const fetchOriginal = window.fetch.bind(window)
    window.fetch = async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
      const url =
        typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url
      if (url.includes('/api/v1/estado/recinto')) {
        return new Response(JSON.stringify(estadoActual), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return fetchOriginal(entrada, opciones)
    }
  }, estadoInicial)
}

async function publicar(page: Page, estado: Record<string, unknown>) {
  await page.evaluate((nuevoEstado) => {
    const ventana = window as Window & {
      __controlRecinto?: { publicar: (valor: Record<string, unknown>) => void }
    }
    ventana.__controlRecinto?.publicar(nuevoEstado)
  }, estado)
}

async function cortarYRecuperar(page: Page, estado: Record<string, unknown>) {
  await page.evaluate((nuevoEstado) => {
    const ventana = window as Window & {
      __controlRecinto?: { cortarYRecuperar: (valor: Record<string, unknown>) => void }
    }
    ventana.__controlRecinto?.cortarYRecuperar(nuevoEstado)
  }, estado)
}

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
]) {
  test(`recorre estado, bancas, palabra y reconexión en ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await instalarBackendPublico(page, crearEstado())
    await page.goto('http://localhost:3001')

    await expect(page.getByTestId('estado-sin-preparar')).toContainText('Sala sin preparar')
    await expect(page.getByTestId('estado-conexion')).toContainText('En línea')

    const preparando = crearEstado({
      revision: 1,
      estado_global: 'PREPARANDO',
      preparacion: {
        fecha_hora_inicio: '2026-08-27T10:00:00Z',
        numero_sesion: 59,
        presidencia: 'Ana Presidencia',
        secretaria_legislativa: 'Luis Secretaría',
      },
      filas_bancas: [5, 7],
      concejales: crearConcejales(12),
      quorum: { cantidad_presentes: 6, requerido: 7, alcanzado: false },
    })
    await publicar(page, preparando)

    await expect(page.getByTestId('estado-global-visible')).toContainText('preparación')
    await expect(page.getByTestId('estado-quorum')).toHaveText('Sin quórum')
    await expect(page.locator('[data-banca="2"] [data-testid="estado-presencia"]')).toHaveText(
      'Ausente',
    )
    await expect(page.locator('[data-banca="3"] [data-testid="estado-test"]')).toHaveText(
      'Test activo',
    )
    await expect(
      page.getByTestId('fila-fisica-1').getByTestId('banca-publica').first(),
    ).toHaveAttribute('data-banca', '1')

    const sesion = crearEstado({
      revision: 2,
      estado_global: 'SESION_ABIERTA',
      sesion: {
        fecha_hora_inicio_preparacion: '2026-08-27T10:00:00Z',
        fecha_hora_apertura: '2026-08-27T10:15:00Z',
        numero_sesion: 59,
        presidencia: 'Ana Presidencia',
        secretaria_legislativa: 'Luis Secretaría',
      },
      filas_bancas: [3, 4, 5],
      concejales: crearConcejales(12),
      quorum: { cantidad_presentes: 8, requerido: 7, alcanzado: true },
      palabra: {
        orador: { nombre: 'Nombre4', apellido: 'Apellido4', banca: 4 },
        cola: [
          { nombre: 'Nombre7', apellido: 'Apellido7', banca: 7 },
          { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1 },
        ],
      },
      votacion: {
        id: 'votacion-e2e',
        numero_votacion: 2,
        tipo: 'Despacho',
        tema: 'Coexistencia palabra-votación',
        tipo_mayoria: 'SIMPLE',
        factor: 0,
        base: 'VOTOS_COMPUTABLES',
        estado_recepcion: 'EN_CURSO',
        resultado: null,
        fecha_hora_apertura: '2026-08-27T10:20:00Z',
        fecha_hora_cierre: null,
        cuenta_regresiva_hasta: '2026-08-27T10:20:04Z',
        resultado_visible_hasta: null,
        votos_individuales: null,
        conteos: null,
        voto_presidencial: null,
      },
    })
    await publicar(page, sesion)

    await expect(page.getByTestId('titulo-contexto')).toContainText('59')
    await expect(page.getByTestId('autoridades')).toContainText('Ana Presidencia')
    await expect(page.getByTestId('autoridades')).toContainText('Luis Secretaría')
    await expect(page.getByTestId('estado-quorum')).toHaveText('Quórum alcanzado')
    await expect(page.getByTestId('orador-actual')).toContainText('Nombre4 Apellido4')
    await expect(page.locator('[data-banca="4"] [data-testid="estado-orador"]')).toBeVisible()
    await expect(page.getByTestId('cola-palabra').locator('li')).toHaveCount(2)
    await expect(page.getByTestId('cola-palabra').locator('li').nth(0)).toContainText(
      'Nombre7 Apellido7',
    )
    await expect(page.getByTestId('cola-palabra').locator('li').nth(1)).toContainText(
      'Nombre1 Apellido1',
    )

    const cajas = await Promise.all([
      page.locator('.escenario-bancas').boundingBox(),
      page.locator('.paneles-publicos').boundingBox(),
    ])
    expect(cajas[0]).not.toBeNull()
    expect(cajas[1]).not.toBeNull()
    expect(cajas[0]!.x + cajas[0]!.width).toBeLessThanOrEqual(cajas[1]!.x)
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    ).toBe(true)

    const reinicio = crearEstado({ revision: 0, estado_global: 'SIN_PREPARAR' })
    await cortarYRecuperar(page, reinicio)
    await expect(page.getByTestId('estado-conexion')).toContainText('desactualizada')
    await expect(page.getByTestId('orador-actual')).toContainText('Nombre4 Apellido4')
    await expect(page.getByTestId('estado-sin-preparar')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('estado-conexion')).toContainText('En línea')
    await expect(page.getByTestId('grilla-bancas')).toHaveCount(0)
  })
}
