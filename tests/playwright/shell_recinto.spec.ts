/** Recorrido público determinista de WP-026 en Full HD y 1366×768. */

import { expect, test, type Page } from '@playwright/test'

const HORA_RELOJ_E2E = new Date('2026-08-28T10:00:00Z')

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

function crearVotacion(parcial: Record<string, unknown> = {}) {
  return {
    id: 'votacion-e2e',
    numero_votacion: 2,
    tipo: 'Despacho',
    tema: 'Coexistencia palabra-votación',
    tipo_mayoria: 'SIMPLE',
    factor: 0,
    base: 'VOTOS_COMPUTABLES',
    estado_recepcion: 'EN_CURSO',
    resultado: null,
    fecha_hora_apertura: HORA_RELOJ_E2E.toISOString(),
    fecha_hora_cierre: null,
    cuenta_regresiva_hasta: null,
    resultado_visible_hasta: null,
    votos_individuales: null,
    conteos: null,
    voto_presidencial: null,
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
    // Playwright reemplaza Date y los timers del navegador. Así se recorren
    // los deadlines del contrato sin esperas reales ni carreras de CI.
    await page.clock.install({ time: new Date('2026-08-28T09:59:00Z') })
    await instalarBackendPublico(page, crearEstado())
    await page.goto('http://localhost:3001/recinto/')
    // El EventSource de prueba abre con un setTimeout(10). También se lo hace
    // avanzar de forma controlada, una vez montado el shell que lo construye,
    // antes de fijar el instante institucional.
    await page.getByTestId('estado-conexion').waitFor()
    await page.clock.runFor(20)
    await page.clock.pauseAt(HORA_RELOJ_E2E)

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
      concejales: crearConcejales(12)
        .filter((concejal) => concejal.banca !== 4)
        .reverse(),
      quorum: { cantidad_presentes: 6, requerido: 7, alcanzado: false },
    })
    await publicar(page, preparando)

    await expect(page.getByTestId('estado-global-visible')).toContainText('preparación')
    await expect(page.getByTestId('cabecera-fecha-hora')).toBeVisible()
    await expect(page.getByTestId('cabecera-sesion')).toContainText('Preparando')
    await expect(page.getByTestId('cabecera-tiempo-sesion')).toHaveCount(0)
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

    const filaInferior = page.getByTestId('fila-fisica-1')
    const filaSuperior = page.getByTestId('fila-fisica-2')
    const cajaBancaUno = await filaInferior.locator('[data-banca="1"]').boundingBox()
    const cajaBancaSeis = await filaSuperior.locator('[data-banca="6"]').boundingBox()
    expect(cajaBancaUno).not.toBeNull()
    expect(cajaBancaSeis).not.toBeNull()
    expect(cajaBancaUno!.y).toBeGreaterThan(cajaBancaSeis!.y)

    for (const [fila, numeros] of [
      [filaInferior, [1, 2, 3, 4, 5]],
      [filaSuperior, [6, 7, 8, 9, 10, 11, 12]],
    ] as const) {
      const cajas = await Promise.all(
        numeros.map((numero) => fila.locator(`[data-banca="${numero}"]`).boundingBox()),
      )
      expect(cajas.every((caja) => caja !== null)).toBe(true)
      for (let indice = 1; indice < cajas.length; indice += 1) {
        expect(cajas[indice - 1]!.x + cajas[indice - 1]!.width).toBeLessThanOrEqual(
          cajas[indice]!.x + 1,
        )
      }
    }

    await expect(filaInferior.locator('[data-banca="4"]')).toContainText('sin datos públicos')
    await expect(filaInferior.locator('[data-banca="5"]')).toContainText('Nombre5')
    const bancaUnoPublica = filaInferior.locator('[data-banca="1"]')
    await expect(bancaUnoPublica.locator('[data-testid="numero-banca"]')).toHaveText('Banca 1')
    await expect(bancaUnoPublica.locator('.identidad-concejal strong')).toContainText(
      'Nombre1 Apellido1',
    )
    await expect(bancaUnoPublica.locator('.identidad-concejal small')).toBeVisible()
    await expect(bancaUnoPublica.locator('[data-testid="estado-presencia"]')).toHaveText('Presente')
    const ausencia = await page.locator('[data-banca="2"]').evaluate((banca) => ({
      opacidad: Number.parseFloat(getComputedStyle(banca).opacity),
      filtroFoto: getComputedStyle(
        banca.querySelector('[data-testid="imagen-concejal"]') as HTMLElement,
      ).filter,
    }))
    expect(ausencia.opacidad).toBeLessThan(1)
    expect(ausencia.filtroFoto).not.toBe('none')
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    ).toBe(true)

    const sesion = crearEstado({
      revision: 2,
      estado_global: 'SESION_ABIERTA',
      sesion: {
        fecha_hora_inicio_preparacion: '2026-08-27T10:00:00Z',
        fecha_hora_apertura: '2026-08-28T09:45:00Z',
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
          ...Array.from({ length: 30 }, (_, indice) => ({
            nombre: `Pedido${indice + 3}`,
            apellido: 'En espera',
            banca: (indice % 12) + 1,
          })),
        ],
      },
      votacion: null,
    })
    await publicar(page, sesion)

    await expect(page.getByTestId('titulo-contexto')).toContainText('59')
    await expect(page.getByTestId('cabecera-sesion')).toContainText('59')
    await expect(page.getByTestId('cabecera-tiempo-sesion')).toContainText('00:15:00')
    await expect(page.getByTestId('autoridades')).toContainText('Ana Presidencia')
    await expect(page.getByTestId('autoridades')).toContainText('Luis Secretaría')
    await expect(page.getByTestId('estado-quorum')).toHaveText('Quórum alcanzado')
    await expect(page.locator('[data-banca="4"] [data-testid="estado-orador"]')).toBeVisible()
    await expect(page.getByTestId('panel-palabra')).not.toContainText('Nombre4 Apellido4')
    await expect(page.getByTestId('cola-palabra').locator('li')).toHaveCount(32)
    await expect(page.getByTestId('cola-palabra').locator('li').nth(0)).toContainText(
      'Nombre7 Apellido7',
    )
    await expect(page.getByTestId('cola-palabra').locator('li').nth(1)).toContainText(
      'Nombre1 Apellido1',
    )
    const scrollCola = await page.getByTestId('cola-palabra').evaluate((cola) => ({
      altoVisible: cola.clientHeight,
      altoContenido: cola.scrollHeight,
    }))
    expect(scrollCola.altoContenido).toBeGreaterThan(scrollCola.altoVisible)

    const horaAntes = await page.getByTestId('cabecera-fecha-hora').textContent()
    await page.clock.runFor(1000)
    await expect(page.getByTestId('cabecera-tiempo-sesion')).toContainText('00:15:01')
    expect(await page.getByTestId('cabecera-fecha-hora').textContent()).not.toBe(horaAntes)

    const cajaCabecera = await page.getByTestId('cabecera-recinto').boundingBox()
    const cajaFranja = await page.getByTestId('franja-contexto-publico').boundingBox()
    const cajaQuorum = await page.getByTestId('panel-quorum').boundingBox()
    expect(cajaCabecera).not.toBeNull()
    expect(cajaFranja).not.toBeNull()
    expect(cajaQuorum).not.toBeNull()
    expect(cajaCabecera!.height).toBeLessThan(80)
    expect(cajaFranja!.height).toBeLessThan(150)
    expect(cajaQuorum!.height).toBeLessThan(80)

    const cajaBancasSesion = await page.getByTestId('area-bancas-publica').boundingBox()
    const cajaPalabraSesion = await page.getByTestId('columna-palabra-publica').boundingBox()
    expect(cajaBancasSesion).not.toBeNull()
    expect(cajaPalabraSesion).not.toBeNull()
    expect(cajaBancasSesion!.x + cajaBancasSesion!.width).toBeLessThanOrEqual(cajaPalabraSesion!.x)

    // La votación nueva reemplaza la sesión sin votación. Aun si el mock
    // incluyera datos prohibidos, EN_CURSO no revela voto ni conteos en DOM.
    const ahoraCountdown = await page.evaluate(() => Date.now())
    const enCurso = {
      ...sesion,
      revision: 3,
      generado_en: new Date(ahoraCountdown).toISOString(),
      votacion: crearVotacion({
        tema: 'Expediente público con countdown',
        fecha_hora_apertura: new Date(ahoraCountdown).toISOString(),
        cuenta_regresiva_hasta: new Date(ahoraCountdown + 1200).toISOString(),
        votos_individuales: [
          { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
        ],
        conteos: { positivos: 99, negativos: 0, abstenciones: 0, total: 99 },
      }),
    }
    await publicar(page, enCurso)

    await expect(page.getByTestId('estado-votacion')).toHaveText('En curso')
    await expect(page.getByTestId('tema-votacion')).toContainText('Expediente público')
    await expect(page.getByTestId('countdown-votacion')).toBeVisible()
    await expect(page.getByTestId('panel-quorum')).toBeVisible()
    await expect(page.getByTestId('panel-palabra')).not.toContainText('Nombre4 Apellido4')
    await expect(page.getByTestId('voto-banca')).toHaveCount(0)
    await expect(page.getByTestId('conteos-votacion')).toHaveCount(0)
    await expect(page.getByText('Positivo', { exact: true })).toHaveCount(0)

    const cajaCountdown = await page.getByTestId('countdown-votacion').boundingBox()
    const cajaPalabraCountdown = await page.getByTestId('columna-palabra-publica').boundingBox()
    expect(cajaCountdown).not.toBeNull()
    expect(cajaPalabraCountdown).not.toBeNull()
    expect(cajaCountdown!.x + cajaCountdown!.width).toBeLessThanOrEqual(cajaPalabraCountdown!.x)

    await page.clock.runFor(1500)
    await expect(page.getByTestId('countdown-votacion')).toHaveCount(0)
    await expect(page.getByTestId('estado-votacion')).toHaveText('En curso')
    await expect(page.getByTestId('voto-banca')).toHaveCount(0)

    const temaLargo =
      'Tratamiento extenso del expediente institucional con una descripción deliberadamente larga para validar la degradación controlada del texto público'
    const ahoraAprobada = await page.evaluate(() => Date.now())
    const aprobada = {
      ...sesion,
      revision: 4,
      generado_en: new Date(ahoraAprobada).toISOString(),
      votacion: crearVotacion({
        tema: temaLargo,
        estado_recepcion: 'CERRADA',
        resultado: 'APROBADA',
        fecha_hora_cierre: new Date(ahoraAprobada).toISOString(),
        cuenta_regresiva_hasta: null,
        resultado_visible_hasta: new Date(ahoraAprobada + 1400).toISOString(),
        votos_individuales: [
          { nombre: 'Nombre3', apellido: 'Apellido3', banca: 3, valor: 'ABSTENCION' },
          { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
          { nombre: 'Nombre2', apellido: 'Apellido2', banca: 2, valor: 'NEGATIVO' },
        ],
        conteos: { positivos: 8, negativos: 2, abstenciones: 1, total: 11 },
      }),
    }
    await publicar(page, aprobada)

    await expect(page.getByTestId('estado-votacion')).toHaveText('Aprobada')
    await expect(page.getByTestId('tema-votacion')).toHaveAttribute('title', temaLargo)
    await expect(page.locator('[data-banca="1"] [data-testid="voto-banca"]')).toHaveText('Positivo')
    await expect(page.locator('[data-banca="2"] [data-testid="voto-banca"]')).toHaveText('Negativo')
    await expect(page.locator('[data-banca="3"] [data-testid="voto-banca"]')).toHaveText(
      'Abstención',
    )
    await expect(page.locator('[data-banca="4"] [data-testid="voto-banca"]')).toHaveCount(0)
    await expect(page.getByTestId('conteos-votacion')).toContainText('Positivos8')
    await expect(page.getByTestId('conteos-votacion')).toContainText('Total11')
    await page.clock.runFor(1750)
    await expect(page.getByTestId('votacion-publica')).toHaveCount(0)
    await expect(page.getByTestId('voto-banca')).toHaveCount(0)

    const empatada = {
      ...sesion,
      revision: 5,
      generado_en: new Date(await page.evaluate(() => Date.now())).toISOString(),
      votacion: crearVotacion({
        id: 'votacion-empate',
        numero_votacion: 3,
        tema: 'Votación simple empatada',
        estado_recepcion: 'CERRADA',
        resultado: 'EMPATADA',
        resultado_visible_hasta: null,
        votos_individuales: [
          { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
          { nombre: 'Nombre2', apellido: 'Apellido2', banca: 2, valor: 'NEGATIVO' },
        ],
        conteos: { positivos: 1, negativos: 1, abstenciones: 0, total: 2 },
      }),
    }
    await publicar(page, empatada)
    await expect(page.getByTestId('estado-votacion')).toHaveText('Empatada')
    await expect(page.getByTestId('espera-desempate')).toContainText('Presidencia')
    await page.clock.runFor(1500)
    await expect(page.getByTestId('estado-votacion')).toHaveText('Empatada')
    await expect(page.getByTestId('voto-banca')).toHaveCount(2)

    const ahoraDesempate = await page.evaluate(() => Date.now())
    await publicar(page, {
      ...empatada,
      revision: 6,
      generado_en: new Date(ahoraDesempate).toISOString(),
      votacion: crearVotacion({
        id: 'votacion-empate',
        numero_votacion: 3,
        tema: 'Votación simple desempatada',
        estado_recepcion: 'CERRADA',
        resultado: 'RECHAZADA',
        resultado_visible_hasta: new Date(ahoraDesempate + 1800).toISOString(),
        votos_individuales: [
          { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
          { nombre: 'Nombre2', apellido: 'Apellido2', banca: 2, valor: 'NEGATIVO' },
        ],
        conteos: { positivos: 1, negativos: 1, abstenciones: 0, total: 2 },
        voto_presidencial: { presidencia: 'Ana Presidencia', sentido: 'NEGATIVO' },
      }),
    })
    await expect(page.getByTestId('estado-votacion')).toHaveText('Rechazada')
    await expect(page.getByTestId('voto-presidencial')).toContainText('Ana Presidencia')
    await expect(page.getByTestId('voto-presidencial')).toContainText('Negativo')
    await expect(page.getByTestId('voto-banca')).toHaveCount(2)
    await expect(page.getByTestId('conteos-votacion')).toContainText('Total2')

    const ahoraInconclusa = await page.evaluate(() => Date.now())
    const inconclusa = {
      ...sesion,
      revision: 7,
      generado_en: new Date(ahoraInconclusa).toISOString(),
      votacion: crearVotacion({
        id: 'votacion-inconclusa',
        numero_votacion: 4,
        tema: 'Votación inconclusa con recepción parcial',
        estado_recepcion: 'CERRADA',
        resultado: 'INCONCLUSA',
        resultado_visible_hasta: new Date(ahoraInconclusa + 1800).toISOString(),
        votos_individuales: [
          { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
        ],
        conteos: { positivos: 1, negativos: 0, abstenciones: 0, total: 1 },
      }),
    }
    await publicar(page, inconclusa)
    await expect(page.getByTestId('estado-votacion')).toHaveText('Inconclusa')
    await expect(page.getByTestId('voto-banca')).toHaveCount(1)
    await expect(page.locator('[data-banca="4"] [data-testid="voto-banca"]')).toHaveCount(0)
    await expect(page.locator('[data-banca="4"] [data-testid="estado-orador"]')).toBeVisible()
    await expect(page.getByTestId('panel-palabra')).not.toContainText('Nombre4 Apellido4')

    const cajas = await Promise.all([
      page.getByTestId('area-bancas-publica').boundingBox(),
      page.getByTestId('columna-palabra-publica').boundingBox(),
    ])
    expect(cajas[0]).not.toBeNull()
    expect(cajas[1]).not.toBeNull()
    expect(cajas[0]!.x + cajas[0]!.width).toBeLessThanOrEqual(cajas[1]!.x)
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    ).toBe(true)

    const reinicio = crearEstado({ revision: 0, estado_global: 'SIN_PREPARAR' })
    // La reconexión pertenece a WP-025 y sí necesita que el backoff vuelva a
    // avanzar naturalmente después de completar las fronteras de WP-026.
    await page.clock.resume()
    await cortarYRecuperar(page, reinicio)
    await expect(page.getByTestId('estado-conexion')).toContainText('desactualizada')
    await expect(page.locator('[data-banca="4"] [data-testid="estado-orador"]')).toBeVisible()
    await expect(page.getByTestId('estado-sin-preparar')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('estado-conexion')).toContainText('En línea')
    await expect(page.getByTestId('grilla-bancas')).toHaveCount(0)
  })
}
