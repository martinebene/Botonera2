/**
 * Pruebas Playwright para el Shell y la UI de Moderación de Botonera2 (WP-021 a WP-023).
 *
 * Cobertura de pruebas E2E deterministas (H3, N1, WP-036):
 * 1. Contrato de Shell 2×2 completo en 1920×1080 y 1366×768:
 *    - Cabecera compacta permanente, sin el distintivo BOTONERA2.
 *    - Cuatro cuadrantes simultáneos (Q1 Sesión, Q2 Orden del Día, Q3 Recinto, Q4 Eventos).
 *    - Cuatro títulos visibles y bounding boxes válidos.
 *    - Alineación precisa por filas y columnas sin solapamientos horizontales ni verticales.
 *    - Ausencia de scroll de página en ambas resoluciones.
 * 2. Estado SIN_PREPARAR (1920×1080 y 1366×768):
 *    - Vista de sala sin preparar con botón 'Preparar sala'.
 *    - Ausencia de todo indicador de quórum mientras el backend no lo proyecta.
 * 3. Estado PREPARANDO (1920×1080 y 1366×768):
 *    - Inputs de número de sesión y autoridades institucionales.
 *    - Botones de guardar preparación, abrir sesión y cancelar preparación.
 *    - 12 bancas en recinto con fotos, nombres, presencia y señal de test activo.
 *    - Quórum y autoridades ya cargadas visibles en la cabecera, y no repetidos en los cuadrantes.
 * 4. Estado SESION_ABIERTA y Diálogo de Advertencia de Cierre (1920×1080 y 1366×768):
 *    - Número de sesión inmutable y ausencia de resumen de quórum en Q1.
 *    - Quórum, autoridades, reloj local y tiempo de sesión en cabecera.
 *    - Edición de autoridades mediante modal, sin inputs permanentes en Q1.
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
      iniciar_remapeo: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      confirmar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
      cancelar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
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

/**
 * Instala un backend controlado que publica snapshots completos después de cada comando.
 * La prueba de WP-023 puede así recorrer transiciones autoritativas sin calcular resultados
 * en el frontend ni depender de un backend real dentro del test de interfaz.
 */
async function configurarCicloVotacionMock(page: Page, estadoInicial: Record<string, unknown>) {
  await page.addInitScript((inicial) => {
    type EstadoPrueba = Record<string, unknown> & {
      revision: number
      votacion: Record<string, unknown> | null
      capacidades: Record<string, { habilitada: boolean; motivos: string[] }>
    }

    let estadoActual = inicial as EstadoPrueba
    const fuentes: MockEventSourceVotacion[] = []

    function publicar(nuevoEstado: EstadoPrueba): void {
      estadoActual = nuevoEstado
      const data = JSON.stringify(estadoActual)
      for (const fuente of fuentes) {
        for (const handler of fuente.listeners.estado ?? []) {
          handler({ type: 'estado', data })
        }
      }
    }

    class MockEventSourceVotacion {
      readyState = 1
      listeners: Record<string, ((evento: { type: string; data: string }) => void)[]> = {}
      onopen: ((evento: { type: string }) => void) | null = null
      onerror: ((evento: { type: string }) => void) | null = null
      onmessage: ((evento: { type: string; data: string }) => void) | null = null

      constructor(readonly url: string) {
        fuentes.push(this)
        setTimeout(() => {
          this.onopen?.({ type: 'open' })
          const data = JSON.stringify(estadoActual)
          for (const handler of this.listeners.estado ?? []) handler({ type: 'estado', data })
        }, 5)
      }

      addEventListener(
        tipo: string,
        handler: (evento: { type: string; data: string }) => void,
      ): void {
        this.listeners[tipo] = this.listeners[tipo] ?? []
        this.listeners[tipo]?.push(handler)
      }

      removeEventListener(
        tipo: string,
        handler: (evento: { type: string; data: string }) => void,
      ): void {
        this.listeners[tipo] = (this.listeners[tipo] ?? []).filter(
          (registrado) => registrado !== handler,
        )
      }

      close(): void {
        this.readyState = 2
      }
    }

    // @ts-expect-error EventSource controlado para este recorrido de navegador.
    window.EventSource = MockEventSourceVotacion

    const ventanaPrueba = window as Window & { cerrarComoEmpatada?: () => void }
    ventanaPrueba.cerrarComoEmpatada = () => {
      if (!estadoActual.votacion) return
      publicar({
        ...estadoActual,
        revision: estadoActual.revision + 1,
        votacion: {
          ...estadoActual.votacion,
          estado_recepcion: 'CERRADA',
          resultado: 'EMPATADA',
          fecha_hora_cierre: '2026-08-26T10:00:10Z',
          fecha_hora_resultado: '2026-08-26T10:00:10Z',
          cantidad_votos_recibidos: 8,
          votos_individuales_revelados: true,
          votos_individuales: [
            {
              dni: '30000001',
              nombre: 'Concejal01',
              apellido: 'Apellido01',
              banca: 1,
              valor: 'POSITIVO',
            },
          ],
          conteos: { positivos: 4, negativos: 4, abstenciones: 0, total: 8 },
        },
        capacidades: {
          ...estadoActual.capacidades,
          abrir_votacion: { habilitada: false, motivos: ['VOTACION_PENDIENTE'] },
          finalizar_votacion: { habilitada: false, motivos: ['VOTACION_NO_EN_CURSO'] },
          desempatar: { habilitada: true, motivos: [] },
        },
      })
    }

    const fetchOriginal = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const metodo = init?.method?.toUpperCase() ?? 'GET'

      if (url.includes('/api/v1/estado/moderacion')) {
        return new Response(JSON.stringify(estadoActual), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/api/v1/votaciones') && metodo === 'POST') {
        const solicitud = JSON.parse(String(init?.body)) as {
          numero_votacion: number
          tipo: string
          tema: string
          tipo_mayoria: string
          factor?: number
          base: string
        }
        const votacion = {
          id: 'votacion-e2e',
          numero_votacion: solicitud.numero_votacion,
          tipo: solicitud.tipo,
          tema: solicitud.tema,
          tipo_mayoria: solicitud.tipo_mayoria,
          factor: solicitud.factor ?? 0,
          base: solicitud.base,
          estado_recepcion: 'EN_CURSO',
          resultado: null,
          fecha_hora_apertura: '2026-08-26T10:00:00Z',
          fecha_hora_cierre: null,
          fecha_hora_resultado: null,
          motivo_finalizacion_manual: null,
          cantidad_votos_recibidos: 0,
          revelado_individual_desde: '2026-08-26T10:00:04Z',
          votos_individuales_revelados: false,
          votos_individuales: null,
          conteos: null,
          voto_presidencial: null,
        }
        publicar({
          ...estadoActual,
          revision: estadoActual.revision + 1,
          votacion,
          capacidades: {
            ...estadoActual.capacidades,
            abrir_votacion: { habilitada: false, motivos: ['VOTACION_PENDIENTE'] },
            finalizar_votacion: { habilitada: true, motivos: [] },
          },
        })
        return new Response(JSON.stringify(votacion), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/desempate') && metodo === 'POST' && estadoActual.votacion) {
        publicar({
          ...estadoActual,
          revision: estadoActual.revision + 1,
          votacion: {
            ...estadoActual.votacion,
            resultado: 'APROBADA',
            fecha_hora_resultado: '2026-08-26T10:00:15Z',
            voto_presidencial: { presidencia: 'Dra. Presidencia', sentido: 'POSITIVO' },
          },
          capacidades: {
            ...estadoActual.capacidades,
            abrir_votacion: { habilitada: true, motivos: [] },
            desempatar: { habilitada: false, motivos: ['VOTACION_NO_EMPATADA'] },
          },
        })
        return new Response(null, { status: 204 })
      }

      return fetchOriginal(input, init)
    }
  }, estadoInicial)
}

/**
 * Instala un backend determinista para el recorrido específico de WP-040.
 *
 * Tanto la carga como el descarte publican un snapshot completo por el EventSource
 * simulado. El componente nunca recibe instrucciones para ocultar o crear puntos por
 * su cuenta: la prueba reproduce la misma autoridad backend que existe en producción.
 */
async function configurarOrdenDelDiaMock(page: Page, estadoInicial: Record<string, unknown>) {
  await page.addInitScript((inicial) => {
    type PuntoOrdenPrueba = {
      nro_votacion: number
      tipo: string
      tema: string
      tipo_mayoria: 'SIMPLE' | 'ESPECIAL'
      factor: number
      base: 'VOTOS_COMPUTABLES' | 'PRESENTES' | 'CUERPO'
    }
    type EstadoOrdenPrueba = Record<string, unknown> & {
      revision: number
      orden_del_dia: PuntoOrdenPrueba[]
    }

    let estadoActual = inicial as EstadoOrdenPrueba
    const fuentes: MockEventSourceOrden[] = []

    function publicar(puntos: PuntoOrdenPrueba[]): void {
      estadoActual = {
        ...estadoActual,
        revision: estadoActual.revision + 1,
        orden_del_dia: puntos,
      }
      const data = JSON.stringify(estadoActual)
      for (const fuente of fuentes) {
        for (const handler of fuente.listeners.estado ?? []) {
          handler({ type: 'estado', data })
        }
      }
    }

    function crearPuntos(cantidad: number): PuntoOrdenPrueba[] {
      return Array.from({ length: cantidad }, (_, indice) => {
        const numero = indice + 1
        if (numero % 3 === 0) {
          return {
            nro_votacion: numero,
            tipo: 'Moción',
            tema: `Tema especial ${numero} con información suficiente para comprobar densidad`,
            tipo_mayoria: 'ESPECIAL',
            factor: 0.66,
            base: 'CUERPO',
          }
        }
        return {
          nro_votacion: numero,
          tipo: 'Proyecto',
          tema: `Tema ordinario ${numero} del Orden del Día`,
          tipo_mayoria: 'SIMPLE',
          factor: 0,
          base: 'VOTOS_COMPUTABLES',
        }
      })
    }

    class MockEventSourceOrden {
      readyState = 1
      listeners: Record<string, ((evento: { type: string; data: string }) => void)[]> = {}
      onopen: ((evento: { type: string }) => void) | null = null
      onerror: ((evento: { type: string }) => void) | null = null
      onmessage: ((evento: { type: string; data: string }) => void) | null = null

      constructor(readonly url: string) {
        fuentes.push(this)
        setTimeout(() => {
          this.onopen?.({ type: 'open' })
          const data = JSON.stringify(estadoActual)
          for (const handler of this.listeners.estado ?? []) handler({ type: 'estado', data })
        }, 5)
      }

      addEventListener(
        tipo: string,
        handler: (evento: { type: string; data: string }) => void,
      ): void {
        this.listeners[tipo] = this.listeners[tipo] ?? []
        this.listeners[tipo]?.push(handler)
      }

      removeEventListener(
        tipo: string,
        handler: (evento: { type: string; data: string }) => void,
      ): void {
        this.listeners[tipo] = (this.listeners[tipo] ?? []).filter(
          (registrado) => registrado !== handler,
        )
      }

      close(): void {
        this.readyState = 2
      }
    }

    // @ts-expect-error EventSource controlado para el recorrido de WP-040.
    window.EventSource = MockEventSourceOrden

    const ventanaPrueba = window as Window & { publicarOrdenDelDiaLargo?: () => void }
    ventanaPrueba.publicarOrdenDelDiaLargo = () => publicar(crearPuntos(24))

    const fetchOriginal = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const metodo = init?.method?.toUpperCase() ?? 'GET'

      if (url.includes('/api/v1/estado/moderacion')) {
        return new Response(JSON.stringify(estadoActual), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/api/v1/orden-del-dia') && metodo === 'POST') {
        const puntos = crearPuntos(2)
        publicar(puntos)
        return new Response(JSON.stringify({ puntos }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/api/v1/orden-del-dia') && metodo === 'DELETE') {
        publicar([])
        return new Response(null, { status: 204 })
      }

      return fetchOriginal(input, init)
    }
  }, estadoInicial)
}

/**
 * Simula el ciclo coordinado de WP-024 conservando una única fuente de estado.
 * Cada comando publica luego un snapshot completo: la página no conoce ni
 * calcula por su cuenta el avance de palabra, los eventos o el remapeo físico.
 */
async function configurarCicloPalabraRemapeoMock(
  page: Page,
  estadoInicial: Record<string, unknown>,
) {
  await page.addInitScript((inicial) => {
    type CapacidadPrueba = { habilitada: boolean; motivos: string[] }
    type PersonaPalabra = {
      dni: string
      nombre: string
      apellido: string
      banca: number
    }
    type RemapeoPrueba = {
      remapeo_id: string
      dispositivo: string
      estado: string
      fingerprint_anterior: string | null
      candidato: string | null
      diagnostico: string | null
    }
    type EstadoPrueba = Record<string, unknown> & {
      revision: number
      palabra: { orador: PersonaPalabra | null; cola: PersonaPalabra[] }
      eventos_recientes: Record<string, unknown>[]
      remapeo: RemapeoPrueba | null
      capacidades: Record<string, CapacidadPrueba>
    }

    let estadoActual = inicial as EstadoPrueba
    const fuentes: MockEventSourceWp024[] = []
    const conteos = { quitar: 0, otorgar: 0, iniciar: 0, confirmar: 0 }
    let ultimaConfirmacion: { remapeoId: string; persistencia: string } | null = null

    function publicar(cambios: Partial<EstadoPrueba>): void {
      estadoActual = {
        ...estadoActual,
        ...cambios,
        revision: estadoActual.revision + 1,
      }
      const data = JSON.stringify(estadoActual)
      for (const fuente of fuentes) {
        for (const handler of fuente.listeners.estado ?? []) {
          handler({ type: 'estado', data })
        }
      }
    }

    class MockEventSourceWp024 {
      readyState = 1
      listeners: Record<string, ((evento: { type: string; data: string }) => void)[]> = {}
      onopen: ((evento: { type: string }) => void) | null = null
      onerror: ((evento: { type: string }) => void) | null = null
      onmessage: ((evento: { type: string; data: string }) => void) | null = null

      constructor(readonly url: string) {
        fuentes.push(this)
        setTimeout(() => {
          this.onopen?.({ type: 'open' })
          const data = JSON.stringify(estadoActual)
          for (const handler of this.listeners.estado ?? []) handler({ type: 'estado', data })
        }, 5)
      }

      addEventListener(
        tipo: string,
        handler: (evento: { type: string; data: string }) => void,
      ): void {
        this.listeners[tipo] = this.listeners[tipo] ?? []
        this.listeners[tipo]?.push(handler)
      }

      removeEventListener(
        tipo: string,
        handler: (evento: { type: string; data: string }) => void,
      ): void {
        this.listeners[tipo] = (this.listeners[tipo] ?? []).filter(
          (registrado) => registrado !== handler,
        )
      }

      close(): void {
        this.readyState = 2
      }
    }

    // @ts-expect-error EventSource determinista para el recorrido de WP-024.
    window.EventSource = MockEventSourceWp024

    const ventanaPrueba = window as Window & {
      capturarCandidatoRemapeo?: () => void
      obtenerControlWp024?: () => {
        conteos: typeof conteos
        ultimaConfirmacion: typeof ultimaConfirmacion
      }
    }
    ventanaPrueba.capturarCandidatoRemapeo = () => {
      if (!estadoActual.remapeo) return
      publicar({
        remapeo: {
          ...estadoActual.remapeo,
          estado: 'CANDIDATO',
          candidato: 'lin|vendor=9001|product=9001|phys=usb-9|name=Reemplazo',
          diagnostico: 'Teclado USB de reemplazo',
        },
        capacidades: {
          ...estadoActual.capacidades,
          confirmar_remapeo: { habilitada: true, motivos: [] },
        },
      })
    }
    ventanaPrueba.obtenerControlWp024 = () => ({ conteos, ultimaConfirmacion })

    const fetchOriginal = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const metodo = init?.method?.toUpperCase() ?? 'GET'

      if (url.includes('/api/v1/estado/moderacion')) {
        return new Response(JSON.stringify(estadoActual), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/api/v1/palabra') && metodo === 'DELETE') {
        conteos.quitar += 1
        await new Promise((resolver) => setTimeout(resolver, 30))
        publicar({ palabra: { ...estadoActual.palabra, orador: null } })
        return new Response(null, { status: 204 })
      }

      if (url.endsWith('/api/v1/palabra') && metodo === 'POST') {
        conteos.otorgar += 1
        await new Promise((resolver) => setTimeout(resolver, 30))
        const [siguiente, ...restantes] = estadoActual.palabra.cola
        publicar({
          palabra: {
            orador: siguiente ?? null,
            cola: restantes,
          },
        })
        return new Response(null, { status: 204 })
      }

      if (url.endsWith('/api/v1/remapeos') && metodo === 'POST') {
        conteos.iniciar += 1
        const solicitud = JSON.parse(String(init?.body)) as { dispositivo: string }
        await new Promise((resolver) => setTimeout(resolver, 30))
        const remapeo: RemapeoPrueba = {
          remapeo_id: 'remapeo-e2e-wp024',
          dispositivo: solicitud.dispositivo,
          estado: 'CAPTURANDO',
          fingerprint_anterior: 'lin|vendor=1001|product=1001|phys=usb-1|name=Anterior',
          candidato: null,
          diagnostico: null,
        }
        publicar({
          remapeo,
          capacidades: {
            ...estadoActual.capacidades,
            iniciar_remapeo: { habilitada: false, motivos: ['REMAPEO_YA_ACTIVO'] },
            confirmar_remapeo: { habilitada: false, motivos: ['REMAPEO_SIN_CANDIDATO'] },
            cancelar_remapeo: { habilitada: true, motivos: [] },
          },
        })
        return new Response(JSON.stringify(remapeo), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/confirmacion') && metodo === 'POST' && estadoActual.remapeo) {
        conteos.confirmar += 1
        const solicitud = JSON.parse(String(init?.body)) as { persistencia: string }
        ultimaConfirmacion = {
          remapeoId: estadoActual.remapeo.remapeo_id,
          persistencia: solicitud.persistencia,
        }
        publicar({
          remapeo: { ...estadoActual.remapeo, estado: 'CONFIRMANDO' },
          capacidades: {
            ...estadoActual.capacidades,
            confirmar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
            cancelar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
          },
        })
        await new Promise((resolver) => setTimeout(resolver, 30))
        publicar({
          remapeo: null,
          capacidades: {
            ...estadoActual.capacidades,
            iniciar_remapeo: { habilitada: true, motivos: [] },
            confirmar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
            cancelar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
          },
        })
        return new Response(null, { status: 204 })
      }

      return fetchOriginal(input, init)
    }
  }, estadoInicial)
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
  // 1. Cabecera compacta permanente visible, con `Moderación` como única identidad (WP-036)
  const cabecera = page.locator('[data-testid="cabecera-moderacion"]')
  await expect(cabecera).toBeVisible()
  await expect(cabecera).toContainText('Moderación')
  await expect(cabecera).not.toContainText('BOTONERA2')
  await expect(cabecera).not.toContainText('Botonera2')
  await expect(cabecera).not.toContainText('Revisión')

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

  // 4. Ausencia de scroll de página: la grilla 2×2 completa entra en el viewport (CA 11 y 12)
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
  const scrollH = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(scrollW).toBeLessThanOrEqual(viewport.width + 2)
  expect(scrollH).toBeLessThanOrEqual(viewport.height + 2)

  // El documento tampoco debe poder desplazarse: ningún elemento del shell excede el viewport.
  const desplazamiento = await page.evaluate(() => {
    window.scrollTo(0, 10_000)
    return { x: window.scrollX, y: window.scrollY }
  })
  expect(desplazamiento.y).toBe(0)
  expect(desplazamiento.x).toBe(0)
}

/**
 * Verifica la frontera específica de WP-037 con medidas reales del DOM.
 *
 * No alcanza con buscar una clase Tailwind: el cuerpo debe tener overflow no
 * desplazable y, al mismo tiempo, todo su contenido debe entrar sin recorte. La
 * comparación entre scrollHeight y clientHeight detecta justamente un `hidden`
 * usado para esconder controles que en realidad quedaron fuera del cuadrante.
 */
async function verificarQ1SinScroll(page: Page): Promise<void> {
  const cuerpo = page.locator('[data-testid="panel-sesion-votacion"] [data-testid="cuerpo-panel"]')
  await expect(cuerpo).toBeVisible()
  const medicion = await cuerpo.evaluate((elemento) => {
    const estilo = getComputedStyle(elemento)
    return {
      overflowY: estilo.overflowY,
      altoVisible: elemento.clientHeight,
      altoContenido: elemento.scrollHeight,
      desplazamiento: elemento.scrollTop,
    }
  })

  expect(['auto', 'scroll']).not.toContain(medicion.overflowY)
  expect(medicion.altoContenido).toBeLessThanOrEqual(medicion.altoVisible + 1)
  expect(medicion.desplazamiento).toBe(0)
}

/**
 * Comprueba que el estado vacío de Q2 no crea una zona desplazable innecesaria.
 * Se mide el DOM real porque declarar `overflow-hidden` no alcanza si el contenido
 * quedó recortado: `scrollHeight` también debe entrar dentro del alto disponible.
 */
async function verificarOrdenVacioSinScroll(page: Page): Promise<void> {
  const cuerpo = page.locator('[data-testid="panel-orden-del-dia"] [data-testid="cuerpo-panel"]')
  await expect(cuerpo).toBeVisible()
  const medicion = await cuerpo.evaluate((elemento) => {
    const estilo = getComputedStyle(elemento)
    return {
      overflowY: estilo.overflowY,
      altoVisible: elemento.clientHeight,
      altoContenido: elemento.scrollHeight,
      desplazamiento: elemento.scrollTop,
    }
  })

  expect(['auto', 'scroll']).not.toContain(medicion.overflowY)
  expect(medicion.altoContenido).toBeLessThanOrEqual(medicion.altoVisible + 1)
  expect(medicion.desplazamiento).toBe(0)
}

function crearCapacidadesSesionCompacta() {
  return {
    preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
    actualizar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
    cancelar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
    abrir_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
    actualizar_sesion: { habilitada: true, motivos: [] },
    cerrar_sesion: { habilitada: true, motivos: [] },
    cargar_orden_del_dia: { habilitada: true, motivos: [] },
    descartar_orden_del_dia: { habilitada: true, motivos: [] },
    abrir_votacion: { habilitada: true, motivos: [] },
    finalizar_votacion: { habilitada: false, motivos: ['VOTACION_NO_EN_CURSO'] },
    desempatar: { habilitada: false, motivos: ['VOTACION_NO_EMPATADA'] },
    otorgar_palabra: { habilitada: true, motivos: [] },
    quitar_palabra: { habilitada: true, motivos: [] },
  }
}

function crearEstadoSesionCompacta(parcial: Record<string, unknown> = {}) {
  return crearEstadoFixture({
    estado_global: 'SESION_ABIERTA',
    sesion: {
      fecha_hora_inicio_preparacion: '2026-08-29T09:30:00Z',
      fecha_hora_apertura: '2026-08-29T09:45:00Z',
      numero_sesion: 42,
      presidencia: 'Dra. Presidencia',
      secretaria_legislativa: 'Lic. Secretaría',
    },
    configuracion: {
      quorum: 7,
      filas_bancas: [3, 4, 5],
      tipos_votacion: ['Proyecto', 'Moción'],
      duracion_test_segundos: 3,
      revelado_votos_moderacion_segundos: 4,
      cuenta_regresiva_recinto_segundos: 3,
      resultado_publico_recinto_segundos: 6,
    },
    quorum: { cantidad_presentes: 8, requerido: 7, alcanzado: true },
    palabra: { orador: null, cola: [] },
    orden_del_dia: [],
    eventos_recientes: [],
    capacidades: crearCapacidadesSesionCompacta(),
    ...parcial,
  })
}

function crearVotacionCompacta(parcial: Record<string, unknown> = {}) {
  return {
    id: 'votacion-wp037',
    numero_votacion: 12,
    tipo: 'Proyecto',
    tema: 'Tratamiento de presupuesto anual',
    tipo_mayoria: 'SIMPLE',
    factor: 0,
    base: 'VOTOS_COMPUTABLES',
    estado_recepcion: 'EN_CURSO',
    resultado: null,
    fecha_hora_apertura: '2026-08-29T10:00:00Z',
    fecha_hora_cierre: null,
    fecha_hora_resultado: null,
    motivo_finalizacion_manual: null,
    cantidad_votos_recibidos: 8,
    revelado_individual_desde: '2026-08-29T10:00:04Z',
    votos_individuales_revelados: true,
    votos_individuales: [
      {
        dni: '30000001',
        nombre: 'No debe',
        apellido: 'renderizarse',
        banca: 1,
        valor: 'POSITIVO',
      },
    ],
    conteos: { positivos: 4, negativos: 3, abstenciones: 1, total: 8 },
    voto_presidencial: null,
    ...parcial,
  }
}

test.describe('UI de Moderación - Estados Institucionales y Contrato de Shell (WP-022)', () => {
  // ===========================================================================
  // 1. ESTADO SIN_PREPARAR (1920×1080 y 1366×768)
  // ===========================================================================
  test('Estado SIN_PREPARAR: verifica contrato 2×2, sala sin preparar y ausencia total de indicadores de quórum (1920×1080 y 1366×768)', async ({
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
      await page.goto('/moderacion/')
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

      // WP-036: sin contexto de quórum no se muestra ningún indicador, tampoco en cabecera
      await expect(page.locator('[data-testid="cabecera-quorum"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="indicador-quorum"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="quorum-resumen-sesion"]')).toHaveCount(0)
      await expect(page.locator('text=0 de 0 presentes')).toHaveCount(0)

      // Sin sesión abierta tampoco hay tiempo transcurrido, pero el reloj local sí está presente
      await expect(page.locator('[data-testid="cabecera-tiempo-sesion"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="cabecera-fecha-hora"]')).toHaveText(
        /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/,
      )
    }
  })

  // ===========================================================================
  // 2. ESTADO PREPARANDO (1920×1080 y 1366×768)
  // ===========================================================================
  test('Estado PREPARANDO: verifica contrato 2×2, inputs de preparación, quórum y autoridades en cabecera y 12 bancas (1920×1080 y 1366×768)', async ({
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
      await page.goto('/moderacion/')
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

      // WP-036: el quórum es global y se muestra únicamente en la cabecera
      const quorumCabecera = page.locator('[data-testid="cabecera-quorum"]')
      await expect(quorumCabecera).toBeVisible()
      await expect(quorumCabecera).toContainText('Sin quórum 5/12 · mín 7')
      await expect(page.locator('[data-testid="indicador-quorum"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="quorum-faltantes"]')).toHaveCount(0)

      // WP-036: las autoridades ya cargadas se ven en cabecera desde PREPARANDO
      await expect(page.locator('[data-testid="cabecera-presidencia"]')).toContainText(
        'Dr. René Favaloro',
      )
      await expect(page.locator('[data-testid="cabecera-secretaria"]')).toContainText(
        'Lic. Alicia Moreau',
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
  test('Estado SESION_ABIERTA: verifica contrato 2×2, número inmutable, datos globales en cabecera y diálogo modal accesible (1920×1080 y 1366×768)', async ({
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
      await page.goto('/moderacion/')
      await page
        .locator('[data-testid="cabecera-moderacion"]')
        .waitFor({ state: 'visible', timeout: 30000 })

      // Verificamos el contrato geométrico 2×2 completo del shell (N1)
      await verificarGeometriaShellCompleto(page, viewport)

      // Cuadrante 1: número inmutable y, tras WP-036, ningún resumen global de quórum
      await expect(page.locator('[data-testid="vista-sesion-abierta"]')).toBeVisible()
      await expect(page.locator('[data-testid="numero-sesion-inmutable"]')).toContainText(
        'Sesión Nº 8',
      )
      await expect(page.locator('[data-testid="quorum-resumen-sesion"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="badge-quorum-resumen-sesion"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="indicador-quorum"]')).toHaveCount(0)

      // Cabecera: única sede del quórum y de las autoridades vigentes
      await expect(page.locator('[data-testid="cabecera-quorum"]')).toContainText(
        'Quórum 9/12 · mín 7',
      )
      await expect(page.locator('[data-testid="cabecera-presidencia"]')).toContainText(
        'Dra. María Elena Walsh',
      )
      await expect(page.locator('[data-testid="cabecera-secretaria"]')).toContainText(
        'Lic. Juan Gómez',
      )

      // Cabecera: reloj local y tiempo transcurrido desde la apertura formal de la sesión
      await expect(page.locator('[data-testid="cabecera-fecha-hora"]')).toHaveText(
        /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/,
      )
      await expect(page.locator('[data-testid="cabecera-tiempo-sesion"]')).toHaveText(
        /Sesión\s+\d{2,}:\d{2}:\d{2}/,
      )

      // WP-037: Q1 no conserva inputs permanentes; la edición se abre en un modal.
      await expect(page.locator('[data-testid="input-presidencia-sesion"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="input-secretaria-sesion"]')).toHaveCount(0)
      await page.locator('[data-testid="btn-editar-autoridades"]').click()
      const modalAutoridades = page.locator('[data-testid="dialogo-edicion-autoridades"]')
      await expect(modalAutoridades).toBeVisible()
      await expect(page.locator('[data-testid="input-presidencia-modal"]')).toHaveValue(
        'Dra. María Elena Walsh',
      )
      await expect(page.locator('[data-testid="input-secretaria-modal"]')).toHaveValue(
        'Lic. Juan Gómez',
      )
      await page.locator('[data-testid="btn-cancelar-autoridades"]').click()
      await expect(modalAutoridades).toHaveCount(0)

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
      await page.goto('/moderacion/')
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

test.describe('WP-036 - Cabecera compacta y redistribución del shell', () => {
  /** Estado con sesión abierta, quórum alcanzado y autoridades cargadas. */
  function crearEstadoSesionAbierta() {
    return crearEstadoFixture({
      estado_global: 'SESION_ABIERTA',
      sesion: {
        fecha_hora_inicio_preparacion: '2026-08-25T10:00:00Z',
        fecha_hora_apertura: '2026-08-25T10:30:00Z',
        numero_sesion: 8,
        presidencia: 'Dra. María Elena Walsh',
        secretaria_legislativa: 'Lic. Juan Gómez',
      },
      quorum: { cantidad_presentes: 9, requerido: 7, alcanzado: true },
    })
  }

  test('el reloj local de la cabecera avanza sin intervención ni recarga', async ({ page }) => {
    await configurarRutasMock(page, crearEstadoSesionAbierta())
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/moderacion/')

    const reloj = page.locator('[data-testid="cabecera-fecha-hora"]')
    await expect(reloj).toBeVisible()

    // El primer valor sirve de referencia: al segundo siguiente el reloj debe haber cambiado.
    const primerValor = await reloj.textContent()
    expect(primerValor).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)
    await expect(reloj).not.toHaveText(primerValor ?? '')

    // El tiempo de sesión se deriva de la misma marca autoritativa y también avanza.
    const tiempoSesion = page.locator('[data-testid="cabecera-tiempo-sesion"]')
    const primerTiempo = await tiempoSesion.textContent()
    await expect(tiempoSesion).not.toHaveText(primerTiempo ?? '')
  })

  test('la grilla 2×2 escala con el viewport en lugar de depender de alturas fijas', async ({
    page,
  }) => {
    await configurarRutasMock(page, crearEstadoSesionAbierta())

    const alturas: Record<string, number> = {}

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/moderacion/')
      await page
        .locator('[data-testid="cabecera-moderacion"]')
        .waitFor({ state: 'visible', timeout: 30000 })

      await verificarGeometriaShellCompleto(page, viewport)

      const cajaQ1 = await obtenerPaneles(page).sesion.boundingBox()
      const cajaCabecera = await page.locator('[data-testid="cabecera-moderacion"]').boundingBox()
      expect(cajaQ1).not.toBeNull()
      expect(cajaCabecera).not.toBeNull()

      if (cajaQ1 && cajaCabecera) {
        alturas[`${viewport.height}`] = cajaQ1.height

        // La cabecera compacta no debe consumir más del 10 % de la altura del viewport.
        expect(cajaCabecera.height).toBeLessThanOrEqual(viewport.height * 0.1)

        // Cada fila de la grilla ocupa una fracción sustancial del alto restante:
        // eso sólo es posible si el shell reparte el espacio en unidades fraccionarias.
        expect(cajaQ1.height).toBeGreaterThan(viewport.height * 0.35)
      }
    }

    // Si el layout dependiera de alturas absolutas en píxeles, el cuadrante mediría igual
    // en ambas resoluciones. Debe crecer junto con el viewport.
    expect(alturas['1080']).toBeGreaterThan(alturas['768'] + 50)
  })
})

test.describe('WP-037 - Q1 compacto sin scroll interno', () => {
  const escenarios = [
    {
      nombre: 'SIN_PREPARAR',
      estado: crearEstadoFixture({ estado_global: 'SIN_PREPARAR', quorum: null }),
      selectorVisible: '[data-testid="btn-preparar-sala"]',
    },
    {
      nombre: 'PREPARANDO',
      estado: crearEstadoFixture({
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-29T09:30:00Z',
          numero_sesion: 42,
          presidencia: 'Dra. Presidencia',
          secretaria_legislativa: 'Lic. Secretaría',
        },
        quorum: { cantidad_presentes: 8, requerido: 7, alcanzado: true },
        capacidades: {
          ...crearEstadoFixture().capacidades,
          preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
          actualizar_preparacion: { habilitada: true, motivos: [] },
          cancelar_preparacion: { habilitada: true, motivos: [] },
          abrir_sesion: { habilitada: true, motivos: [] },
        },
      }),
      selectorVisible: '[data-testid="btn-abrir-sesion"]',
    },
    {
      nombre: 'SESION_ABIERTA lista para votar',
      estado: crearEstadoSesionCompacta(),
      selectorVisible: '[data-testid="formulario-votacion"]',
    },
    {
      nombre: 'votación EN_CURSO',
      estado: crearEstadoSesionCompacta({
        votacion: crearVotacionCompacta(),
        capacidades: {
          ...crearCapacidadesSesionCompacta(),
          abrir_votacion: { habilitada: false, motivos: ['VOTACION_PENDIENTE'] },
          finalizar_votacion: { habilitada: true, motivos: [] },
        },
      }),
      selectorVisible: '[data-testid="btn-finalizar-votacion"]',
    },
    {
      nombre: 'resultado cerrado con conteos',
      estado: crearEstadoSesionCompacta({
        votacion: crearVotacionCompacta({
          estado_recepcion: 'CERRADA',
          resultado: 'APROBADA',
          fecha_hora_cierre: '2026-08-29T10:00:10Z',
          fecha_hora_resultado: '2026-08-29T10:00:10Z',
        }),
      }),
      selectorVisible: '[data-testid="conteos-votacion"]',
    },
    {
      nombre: 'empate pendiente',
      estado: crearEstadoSesionCompacta({
        votacion: crearVotacionCompacta({
          estado_recepcion: 'CERRADA',
          resultado: 'EMPATADA',
          fecha_hora_cierre: '2026-08-29T10:00:10Z',
          fecha_hora_resultado: '2026-08-29T10:00:10Z',
          conteos: { positivos: 4, negativos: 4, abstenciones: 0, total: 8 },
        }),
        capacidades: {
          ...crearCapacidadesSesionCompacta(),
          abrir_votacion: { habilitada: false, motivos: ['VOTACION_PENDIENTE'] },
          desempatar: { habilitada: true, motivos: [] },
        },
      }),
      selectorVisible: '[data-testid="controles-desempate"]',
    },
  ]

  for (const escenario of escenarios) {
    test(`${escenario.nombre}: el contenido real entra completo a 1366×768`, async ({ page }) => {
      await configurarRutasMock(page, escenario.estado)
      await page.setViewportSize({ width: 1366, height: 768 })
      await page.goto('/moderacion/')

      await expect(page.locator(escenario.selectorVisible)).toBeVisible()
      await verificarQ1SinScroll(page)
      await expect(page.locator('[data-testid="votos-individuales"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="panel-sesion-votacion"]')).not.toContainText(
        'No debe renderizarse',
      )
    })
  }

  test('el modal de autoridades no deforma Q1 ni el shell a 1366×768', async ({ page }) => {
    await configurarRutasMock(page, crearEstadoSesionCompacta())
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/moderacion/')

    const panel = page.locator('[data-testid="panel-sesion-votacion"]')
    const cajaAntes = await panel.boundingBox()
    await verificarQ1SinScroll(page)

    await page.locator('[data-testid="btn-editar-autoridades"]').click()
    const modal = page.locator('[data-testid="dialogo-edicion-autoridades"]')
    await expect(modal).toBeVisible()
    await expect(modal).toHaveAttribute('role', 'dialog')
    await expect(page.locator('[data-testid="input-presidencia-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-secretaria-modal"]')).toBeVisible()

    const cajaDurante = await panel.boundingBox()
    expect(cajaAntes).not.toBeNull()
    expect(cajaDurante).not.toBeNull()
    if (cajaAntes && cajaDurante) {
      expect(Math.abs(cajaDurante.height - cajaAntes.height)).toBeLessThanOrEqual(1)
      expect(Math.abs(cajaDurante.width - cajaAntes.width)).toBeLessThanOrEqual(1)
    }
    await verificarQ1SinScroll(page)
  })

  test('resultado y siguiente formulario entran completos a 1920×1080', async ({ page }) => {
    await configurarRutasMock(
      page,
      crearEstadoSesionCompacta({
        votacion: crearVotacionCompacta({
          estado_recepcion: 'CERRADA',
          resultado: 'RECHAZADA',
          fecha_hora_cierre: '2026-08-29T10:00:10Z',
          fecha_hora_resultado: '2026-08-29T10:00:10Z',
        }),
      }),
    )
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/moderacion/')

    await expect(page.locator('[data-testid="conteos-votacion"]')).toBeVisible()
    await expect(page.locator('[data-testid="formulario-votacion"]')).toBeVisible()
    await verificarQ1SinScroll(page)
    await verificarGeometriaShellCompleto(page, { width: 1920, height: 1080 })
  })
})

test.describe('WP-040 - Dos estados del Orden del Día', () => {
  test('recorre carga, puntos, precarga Q1, descarte y retorno autoritativo a 1366×768', async ({
    page,
  }) => {
    await configurarOrdenDelDiaMock(page, crearEstadoSesionCompacta())
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/moderacion/')

    const panel = page.locator('[data-testid="panel-orden-del-dia"]')
    const entrada = panel.locator('[data-testid="input-archivo-orden-dia"]')
    await expect(entrada).toBeVisible()
    await expect(panel.locator('[data-testid="btn-cargar-orden-dia"]')).toBeVisible()
    await expect(panel.locator('[data-testid="btn-quitar-orden-dia"]')).toHaveCount(0)
    await expect(panel).not.toContainText('Orden del Día opcional')
    await verificarOrdenVacioSinScroll(page)

    await entrada.setInputFiles({
      name: 'orden-sesion-42.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'nro_votacion,tipo,tema,tipo_mayoria,factor,base\n1,Proyecto,Tema,SIMPLE,0,VOTOS_COMPUTABLES',
      ),
    })
    await expect(panel).toContainText('Seleccionado: orden-sesion-42.csv')
    await panel.locator('[data-testid="btn-cargar-orden-dia"]').click()

    await expect(panel.locator('[data-testid="punto-orden-dia"]')).toHaveCount(2)
    await expect(panel.locator('[data-testid="input-archivo-orden-dia"]')).toHaveCount(0)
    await expect(panel).not.toContainText('Reemplazar')
    await expect(panel.locator('[data-testid="btn-quitar-orden-dia"]')).toHaveCount(1)

    // La tarjeta continúa copiando sus datos al borrador editable de Q1.
    await panel.locator('[data-testid="punto-orden-dia"]').first().click()
    await expect(page.locator('[data-testid="input-numero-votacion"]')).toHaveValue('1')
    await expect(page.locator('[data-testid="select-tipo-votacion"]')).toHaveValue('Proyecto')
    await expect(page.locator('[data-testid="input-tema-votacion"]')).toHaveValue(
      'Tema ordinario 1 del Orden del Día',
    )
    await expect(panel.locator('[data-testid="punto-orden-dia"]')).toHaveCount(2)

    await panel.locator('[data-testid="btn-quitar-orden-dia"]').click()
    await expect(panel.locator('[data-testid="punto-orden-dia"]')).toHaveCount(0)
    await expect(panel.locator('[data-testid="input-archivo-orden-dia"]')).toBeVisible()
    await expect(panel.locator('[data-testid="btn-quitar-orden-dia"]')).toHaveCount(0)
    await verificarOrdenVacioSinScroll(page)
    await verificarGeometriaShellCompleto(page, { width: 1366, height: 768 })
  })

  test('confina un listado largo y conserva accesible Quitar en 1366×768 y 1920×1080', async ({
    page,
  }) => {
    await configurarOrdenDelDiaMock(page, crearEstadoSesionCompacta())

    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/moderacion/')
      await page.evaluate(() => {
        ;(window as Window & { publicarOrdenDelDiaLargo?: () => void }).publicarOrdenDelDiaLargo?.()
      })

      const panel = page.locator('[data-testid="panel-orden-del-dia"]')
      const cuerpo = panel.locator('[data-testid="cuerpo-panel"]')
      const lista = panel.locator('[data-testid="lista-orden-dia"]')
      const botonQuitar = panel.locator('[data-testid="btn-quitar-orden-dia"]')
      await expect(panel.locator('[data-testid="punto-orden-dia"]')).toHaveCount(24)
      await expect(botonQuitar).toBeVisible()

      const medicion = await lista.evaluate((elemento) => ({
        altoVisible: elemento.clientHeight,
        altoContenido: elemento.scrollHeight,
        overflowY: getComputedStyle(elemento).overflowY,
      }))
      expect(['auto', 'scroll']).toContain(medicion.overflowY)
      expect(medicion.altoContenido).toBeGreaterThan(medicion.altoVisible)

      const medicionExterior = await cuerpo.evaluate((elemento) => ({
        altoVisible: elemento.clientHeight,
        altoContenido: elemento.scrollHeight,
        overflowY: getComputedStyle(elemento).overflowY,
      }))
      expect(['auto', 'scroll']).not.toContain(medicionExterior.overflowY)
      expect(medicionExterior.altoContenido).toBeLessThanOrEqual(medicionExterior.altoVisible + 1)

      const cajaPanel = await panel.boundingBox()
      const cajaBoton = await botonQuitar.boundingBox()
      expect(cajaPanel).not.toBeNull()
      expect(cajaBoton).not.toBeNull()
      expect(cajaBoton!.y).toBeGreaterThanOrEqual(cajaPanel!.y)
      expect(cajaBoton!.y + cajaBoton!.height).toBeLessThanOrEqual(cajaPanel!.y + cajaPanel!.height)
      await verificarGeometriaShellCompleto(page, viewport)
    }
  })
})

test.describe('WP-023 - Recorrido de votación y Orden del Día', () => {
  test('selecciona un punto, confirma CA-062 y adopta EN_CURSO, EMPATADA y desempate desde SSE', async ({
    page,
  }) => {
    const capacidades = {
      preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      actualizar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cancelar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      abrir_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      actualizar_sesion: { habilitada: true, motivos: [] },
      cerrar_sesion: { habilitada: true, motivos: [] },
      cargar_orden_del_dia: { habilitada: true, motivos: [] },
      descartar_orden_del_dia: { habilitada: true, motivos: [] },
      abrir_votacion: { habilitada: true, motivos: [] },
      finalizar_votacion: { habilitada: false, motivos: ['VOTACION_NO_EN_CURSO'] },
      desempatar: { habilitada: false, motivos: ['VOTACION_NO_EMPATADA'] },
      otorgar_palabra: { habilitada: true, motivos: [] },
      quitar_palabra: { habilitada: true, motivos: [] },
    }
    const estado = crearEstadoFixture({
      estado_global: 'SESION_ABIERTA',
      sesion: {
        fecha_hora_inicio_preparacion: '2026-08-26T09:30:00Z',
        fecha_hora_apertura: '2026-08-26T09:45:00Z',
        numero_sesion: 42,
        presidencia: 'Dra. Presidencia',
        secretaria_legislativa: 'Sr. Secretaría',
      },
      configuracion: {
        quorum: 7,
        filas_bancas: [3, 4, 5],
        tipos_votacion: ['Proyecto', 'Moción'],
        duracion_test_segundos: 3,
        revelado_votos_moderacion_segundos: 4,
        cuenta_regresiva_recinto_segundos: 3,
        resultado_publico_recinto_segundos: 6,
      },
      quorum: { cantidad_presentes: 8, requerido: 7, alcanzado: true },
      palabra: {
        orador: { dni: '30000001', nombre: 'Ada', apellido: 'Lovelace', banca: 1 },
        cola: [{ dni: '30000002', nombre: 'Grace', apellido: 'Hopper', banca: 2 }],
      },
      orden_del_dia: [
        {
          nro_votacion: 12,
          tipo: 'Proyecto',
          tema: 'Presupuesto anual',
          tipo_mayoria: 'SIMPLE',
          factor: 0,
          base: 'VOTOS_COMPUTABLES',
        },
      ],
      eventos_recientes: [],
      auditoria: {
        activa: true,
        disponible: true,
        fallado: false,
        cerrado: false,
        motivo: null,
      },
      capacidades,
    })
    await configurarCicloVotacionMock(page, estado)
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/moderacion/')
    await expect(page.locator('[data-testid="formulario-votacion"]')).toBeVisible()

    // Q2 copia el punto como borrador editable en Q1, sin consumirlo.
    await page.locator('[data-testid="punto-orden-dia"]').click()
    await expect(page.locator('[data-testid="input-numero-votacion"]')).toHaveValue('12')
    await expect(page.locator('[data-testid="select-tipo-votacion"]')).toHaveValue('Proyecto')
    await expect(page.locator('[data-testid="input-tema-votacion"]')).toHaveValue(
      'Presupuesto anual',
    )
    await page.locator('[data-testid="input-tema-votacion"]').fill('Presupuesto editado')
    await expect(page.locator('[data-testid="punto-orden-dia"]')).toHaveCount(1)

    // CA-062: cancelar no envía; confirmar conserva orador y cola.
    await page.locator('[data-testid="btn-abrir-votacion"]').click()
    const dialogo = page.locator('[data-testid="dialogo-confirmacion-apertura"]')
    await expect(dialogo).toBeVisible()
    await expect(dialogo).toContainText('Ada Lovelace')
    await page.locator('[data-testid="btn-cancelar-apertura"]').click()
    await expect(dialogo).toHaveCount(0)
    await expect(page.locator('[data-testid="vista-votacion-proyectada"]')).toHaveCount(0)

    await page.locator('[data-testid="btn-abrir-votacion"]').click()
    await page.locator('[data-testid="btn-confirmar-apertura"]').click()
    const vista = page.locator('[data-testid="vista-votacion-proyectada"]')
    await expect(vista).toBeVisible()
    await expect(vista).toContainText('Presupuesto editado')
    await expect(page.locator('[data-testid="estado-votacion"]')).toContainText('EN_CURSO')
    await expect(page.locator('[data-testid="votos-ocultos"]')).toBeVisible()
    await expect(page.locator('[data-testid="palabra-durante-votacion"]')).toContainText(
      'Ada Lovelace',
    )
    await expect(page.locator('[data-testid="orador-actual-texto"]')).toContainText('Ada Lovelace')

    // El backend controlado simula el cierre normal empatado y lo publica como snapshot completo.
    await page.evaluate(() => {
      ;(window as Window & { cerrarComoEmpatada?: () => void }).cerrarComoEmpatada?.()
    })
    await expect(page.locator('[data-testid="estado-votacion"]')).toContainText('EMPATADA')
    await expect(page.locator('[data-testid="conteos-votacion"]')).toContainText('4')
    await expect(page.locator('[data-testid="votos-individuales"]')).toHaveCount(0)
    await expect(vista).not.toContainText('Concejal01')
    const controles = page.locator('[data-testid="controles-desempate"]')
    await expect(controles).toContainText('Dra. Presidencia')
    await expect(controles).not.toContainText('ABSTENCION')

    await page.locator('[data-testid="btn-desempate-positivo"]').click()
    await expect(page.locator('[data-testid="estado-votacion"]')).toContainText('APROBADA')
    await expect(controles).toHaveCount(0)
    await expect(page.locator('[data-testid="formulario-votacion"]')).toBeVisible()
  })
})

test.describe('WP-024 - Palabra, eventos y remapeo autoritativos', () => {
  test('recorre CA-061, filtros de eventos y confirmación física en ambas resoluciones', async ({
    page,
  }) => {
    const capacidades = {
      preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      actualizar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cancelar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      abrir_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      actualizar_sesion: { habilitada: true, motivos: [] },
      cerrar_sesion: { habilitada: true, motivos: [] },
      cargar_orden_del_dia: { habilitada: true, motivos: [] },
      descartar_orden_del_dia: { habilitada: true, motivos: [] },
      abrir_votacion: { habilitada: true, motivos: [] },
      finalizar_votacion: { habilitada: false, motivos: ['VOTACION_NO_EN_CURSO'] },
      desempatar: { habilitada: false, motivos: ['VOTACION_NO_EMPATADA'] },
      otorgar_palabra: { habilitada: true, motivos: [] },
      quitar_palabra: { habilitada: true, motivos: [] },
      iniciar_remapeo: { habilitada: true, motivos: [] },
      confirmar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
      cancelar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
    }
    const estado = crearEstadoFixture({
      estado_global: 'SESION_ABIERTA',
      sesion: {
        fecha_hora_inicio_preparacion: '2026-08-27T09:00:00Z',
        fecha_hora_apertura: '2026-08-27T09:30:00Z',
        numero_sesion: 24,
        presidencia: 'Dra. Presidencia',
        secretaria_legislativa: 'Sr. Secretaría',
      },
      quorum: { cantidad_presentes: 8, requerido: 7, alcanzado: true },
      palabra: {
        orador: {
          dni: '30000001',
          nombre: 'Concejal01',
          apellido: 'Apellido01',
          banca: 1,
        },
        cola: [
          {
            dni: '30000002',
            nombre: 'Concejal02',
            apellido: 'Apellido02',
            banca: 2,
          },
          {
            dni: '30000003',
            nombre: 'Concejal03',
            apellido: 'Apellido03',
            banca: 3,
          },
        ],
      },
      eventos_recientes: [
        {
          seq: 201,
          timestamp: '2026-08-27T10:00:01',
          nivel: 'L1',
          etiqueta: 'SISTEMA',
          codigo_evento: 'EVENTO_TECNICO',
          mensaje: 'Detalle técnico persistido',
        },
        {
          seq: 202,
          timestamp: '2026-08-27T10:00:02',
          nivel: 'L2',
          etiqueta: 'OPERACION',
          codigo_evento: 'EVENTO_INTERMEDIO',
          mensaje: 'Detalle operativo persistido',
        },
        {
          seq: 203,
          timestamp: '2026-08-27T10:00:03',
          nivel: 'L3',
          etiqueta: 'PALABRA',
          codigo_evento: 'EVENTO_PRINCIPAL',
          mensaje: 'Hecho institucional persistido',
        },
      ],
      auditoria: {
        activa: true,
        disponible: true,
        fallado: false,
        cerrado: false,
        motivo: null,
      },
      remapeo: null,
      capacidades,
    })
    await configurarCicloPalabraRemapeoMock(page, estado)

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/moderacion/')
      await expect(page.locator('[data-testid="gestion-palabra"]')).toBeVisible()
      await verificarGeometriaShellCompleto(page, viewport)

      // La cola completa conserva FIFO y quitar no promueve implícitamente.
      await expect(page.locator('[data-testid="orador-actual-texto"]')).toContainText(
        'Concejal01 Apellido01',
      )
      await expect(page.locator('[data-testid="pedido-palabra-1"]')).toContainText(
        'Concejal02 Apellido02',
      )
      await expect(page.locator('[data-testid="pedido-palabra-2"]')).toContainText(
        'Concejal03 Apellido03',
      )
      await page.locator('[data-testid="btn-quitar-palabra"]').evaluate((boton) => {
        ;(boton as HTMLButtonElement).click()
        ;(boton as HTMLButtonElement).click()
      })
      await expect(page.locator('[data-testid="orador-actual-texto"]')).toContainText(
        'Sin orador activo',
      )
      await expect(page.locator('[data-testid="badge-cola-palabra"]')).toContainText('2 en cola')

      await page.locator('[data-testid="btn-otorgar-palabra"]').evaluate((boton) => {
        ;(boton as HTMLButtonElement).click()
        ;(boton as HTMLButtonElement).click()
      })
      await expect(page.locator('[data-testid="orador-actual-texto"]')).toContainText(
        'Concejal02 Apellido02',
      )
      await expect(page.locator('[data-testid="badge-cola-palabra"]')).toContainText('1 en cola')

      // L3 es inicial; L2 y L1 incluyen acumulativamente los niveles inferiores.
      await expect(page.locator('[data-testid="evento-reciente"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="panel-eventos"]')).toContainText('EVENTO_PRINCIPAL')
      await page.locator('[data-testid="filtro-eventos"]').selectOption('L2')
      await expect(page.locator('[data-testid="evento-reciente"]')).toHaveCount(2)
      await page.locator('[data-testid="filtro-eventos"]').selectOption('L1')
      await expect(page.locator('[data-testid="evento-reciente"]')).toHaveCount(3)
      // WP-041: el orden visual es descendente, así que el evento más nuevo encabeza.
      await expect(page.locator('[data-testid="nivel-evento"]')).toHaveText(['L3', 'L2', 'L1'])

      // El objetivo se elige desde banca/persona/devXX; luego manda el snapshot.
      await page.locator('[data-testid="selector-banca-remapeo"]').selectOption('dev03')
      await expect(page.locator('[data-testid="resumen-inicio-remapeo"]')).toContainText('Banca 3')
      await page.locator('[data-testid="btn-iniciar-remapeo"]').evaluate((boton) => {
        ;(boton as HTMLButtonElement).click()
        ;(boton as HTMLButtonElement).click()
      })
      await expect(page.locator('[data-testid="estado-remapeo"]')).toHaveText('CAPTURANDO')
      await expect(page.locator('[data-testid="dispositivo-remapeo"]')).toHaveText('dev03')

      await page.evaluate(() => {
        ;(window as Window & { capturarCandidatoRemapeo?: () => void }).capturarCandidatoRemapeo?.()
      })
      await expect(page.locator('[data-testid="estado-remapeo"]')).toHaveText('CANDIDATO')
      await expect(page.locator('[data-testid="fingerprint-candidato"]')).toContainText(
        'vendor=9001',
      )
      await expect(page.locator('[data-testid="diagnostico-remapeo"]')).toContainText(
        'Teclado USB de reemplazo',
      )
      await expect(page.locator('[data-testid="btn-confirmar-remapeo"]')).toBeDisabled()
      await page.locator('[data-testid="persistencia-temporal"]').check()
      await expect(page.locator('[data-testid="resumen-confirmacion-remapeo"]')).toContainText(
        'TEMPORAL',
      )
      await page.locator('[data-testid="btn-confirmar-remapeo"]').evaluate((boton) => {
        ;(boton as HTMLButtonElement).click()
        ;(boton as HTMLButtonElement).click()
      })
      await expect(page.locator('[data-testid="remapeo-activo"]')).toHaveCount(0)

      const control = await page.evaluate(() =>
        (
          window as Window & {
            obtenerControlWp024?: () => {
              conteos: { quitar: number; otorgar: number; iniciar: number; confirmar: number }
              ultimaConfirmacion: { remapeoId: string; persistencia: string } | null
            }
          }
        ).obtenerControlWp024?.(),
      )
      expect(control?.conteos).toEqual({ quitar: 1, otorgar: 1, iniciar: 1, confirmar: 1 })
      expect(control?.ultimaConfirmacion).toEqual({
        remapeoId: 'remapeo-e2e-wp024',
        persistencia: 'TEMPORAL',
      })
      await verificarGeometriaShellCompleto(page, viewport)
    }
  })
})

/**
 * WP-041 - Eventos recientes con nivel fijo y evento más nuevo primero.
 *
 * Este recorrido comprueba sobre el navegador real (no sobre clases CSS) que:
 *
 * 1. una cantidad suficiente de eventos produce scroll interno real en Q4;
 * 2. el selector de nivel sigue visible antes y después de desplazar la lista;
 * 3. los eventos se ordenan por `seq` descendente;
 * 4. la llegada de un evento nuevo devuelve la lista al inicio;
 * 5. el selector continúa siendo operable después del scroll;
 * 6. el shell no genera scroll de página a 1366×768;
 * 7. el comportamiento se verifica también a 1920×1080.
 */
test.describe('WP-041 - Eventos con selector fijo y evento más nuevo primero', () => {
  /**
   * Backend simulado que publica snapshots completos por SSE y expone
   * `window.publicarEventoNuevo` para provocar la llegada de actividad nueva
   * sin depender de tiempos ni de un backend real.
   */
  async function configurarBackendEventosMock(page: Page, estadoInicial: Record<string, unknown>) {
    await page.addInitScript((inicial) => {
      type EstadoPrueba = Record<string, unknown> & {
        revision: number
        eventos_recientes: Record<string, unknown>[]
      }

      let estadoActual = inicial as EstadoPrueba
      const fuentes: MockEventSourceEventos[] = []

      function publicar(nuevoEstado: EstadoPrueba): void {
        estadoActual = nuevoEstado
        const data = JSON.stringify(estadoActual)
        for (const fuente of fuentes) {
          for (const handler of fuente.listeners.estado ?? []) handler({ type: 'estado', data })
        }
      }

      class MockEventSourceEventos {
        readyState = 1
        listeners: Record<string, ((evento: { type: string; data: string }) => void)[]> = {}
        onopen: ((evento: { type: string }) => void) | null = null
        onerror: ((evento: { type: string }) => void) | null = null
        onmessage: ((evento: { type: string; data: string }) => void) | null = null

        constructor(readonly url: string) {
          fuentes.push(this)
          setTimeout(() => {
            this.onopen?.({ type: 'open' })
            const data = JSON.stringify(estadoActual)
            for (const handler of this.listeners.estado ?? []) handler({ type: 'estado', data })
          }, 5)
        }

        addEventListener(
          tipo: string,
          handler: (evento: { type: string; data: string }) => void,
        ): void {
          this.listeners[tipo] = this.listeners[tipo] ?? []
          this.listeners[tipo].push(handler)
        }

        removeEventListener(
          tipo: string,
          handler: (evento: { type: string; data: string }) => void,
        ): void {
          this.listeners[tipo] = (this.listeners[tipo] ?? []).filter(
            (registrado) => registrado !== handler,
          )
        }

        close(): void {
          this.readyState = 2
        }
      }

      // @ts-expect-error Mock inyectado en el runtime del navegador
      window.EventSource = MockEventSourceEventos

      const fetchOriginal = window.fetch.bind(window)
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url.includes('/api/v1/estado/moderacion')) {
          return new Response(JSON.stringify(estadoActual), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return fetchOriginal(input, init)
      }

      // El backend simulado agrega un evento con seq mayor y republica la baseline
      // completa, tal como haría el backend real ante actividad institucional.
      ;(window as Window & { publicarEventoNuevo?: (seq: number) => void }).publicarEventoNuevo = (
        seq: number,
      ) => {
        publicar({
          ...estadoActual,
          revision: estadoActual.revision + 1,
          eventos_recientes: [
            ...estadoActual.eventos_recientes,
            {
              seq,
              timestamp: '2026-08-27T11:00:00',
              nivel: 'L3',
              etiqueta: 'SESION',
              codigo_evento: `EVENTO_NUEVO_${seq}`,
              mensaje: `Actividad institucional número ${seq}`,
            },
          ],
        })
      }
    }, estadoInicial)
  }

  test('ordena descendente, mantiene el selector fijo y vuelve al inicio ante un evento nuevo (1920×1080 y 1366×768)', async ({
    page,
  }) => {
    // Cantidad deliberadamente alta: garantiza desbordamiento real del cuadrante.
    const eventos = Array.from({ length: 60 }, (_, indice) => {
      const seq = indice + 1
      return {
        seq,
        timestamp: `2026-08-27T10:${String(indice).padStart(2, '0')}:00`,
        nivel: 'L3',
        etiqueta: 'SESION',
        codigo_evento: `EVENTO_BASE_${seq}`,
        mensaje: `Hecho institucional registrado número ${seq}`,
      }
    })

    const estado = crearEstadoFixture({
      estado_global: 'SESION_ABIERTA',
      sesion: {
        fecha_hora_inicio_preparacion: '2026-08-27T09:00:00Z',
        fecha_hora_apertura: '2026-08-27T09:30:00Z',
        numero_sesion: 41,
        presidencia: 'Dra. Presidencia',
        secretaria_legislativa: 'Sr. Secretaría',
      },
      quorum: { cantidad_presentes: 8, requerido: 7, alcanzado: true },
      // El backend proyecta la baseline en orden ascendente de seq (doc 05, §14).
      eventos_recientes: eventos,
      auditoria: {
        activa: true,
        disponible: true,
        fallado: false,
        cerrado: false,
        motivo: null,
      },
      remapeo: null,
    })

    await configurarBackendEventosMock(page, estado)

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/moderacion/')
      // El shell recién monta los cuadrantes cuando adopta el primer snapshot;
      // el margen amplio cubre el arranque en frío del servidor de desarrollo.
      await page
        .locator('[data-testid="cabecera-moderacion"]')
        .waitFor({ state: 'visible', timeout: 30000 })
      await page
        .locator('[data-testid="panel-eventos"]')
        .waitFor({ state: 'visible', timeout: 30000 })

      const lista = page.locator('[data-testid="lista-eventos"]')
      const selector = page.locator('[data-testid="filtro-eventos"]')
      await expect(lista).toBeVisible()
      await expect(page.locator('[data-testid="evento-reciente"]')).toHaveCount(60)

      // 1. Scroll interno real: el contenido desborda el contenedor del listado.
      const desbordaAlInicio = await lista.evaluate(
        (elemento) => elemento.scrollHeight > elemento.clientHeight,
      )
      expect(desbordaAlInicio).toBe(true)

      // 2. El selector está en la cabecera del panel, fuera del área scrolleable.
      await expect(selector).toBeVisible()
      const selectorDentroDeLista = await lista.evaluate(
        (elemento) => elemento.querySelector('[data-testid="filtro-eventos"]') !== null,
      )
      expect(selectorDentroDeLista).toBe(false)
      const cajaSelectorInicial = await selector.boundingBox()

      // 3. Orden descendente: el evento más nuevo encabeza el listado.
      await expect(page.locator('[data-testid="evento-reciente"]').first()).toContainText(
        'EVENTO_BASE_60',
      )
      await expect(page.locator('[data-testid="evento-reciente"]').last()).toContainText(
        'EVENTO_BASE_1',
      )

      // 4. El operador desplaza la lista hacia eventos anteriores.
      await lista.evaluate((elemento) => {
        elemento.scrollTop = elemento.scrollHeight
      })
      const scrollDesplazado = await lista.evaluate((elemento) => elemento.scrollTop)
      expect(scrollDesplazado).toBeGreaterThan(0)

      // 5. El selector no se desplazó con la lista: sigue visible y en su lugar.
      await expect(selector).toBeVisible()
      const cajaSelectorDesplazado = await selector.boundingBox()
      expect(cajaSelectorInicial).not.toBeNull()
      expect(cajaSelectorDesplazado).not.toBeNull()
      if (cajaSelectorInicial && cajaSelectorDesplazado) {
        expect(Math.abs(cajaSelectorInicial.y - cajaSelectorDesplazado.y)).toBeLessThanOrEqual(1)
      }

      // 6. Llega un evento nuevo: la lista vuelve al inicio y lo deja visible.
      await page.evaluate(() => {
        ;(window as Window & { publicarEventoNuevo?: (seq: number) => void }).publicarEventoNuevo?.(
          61,
        )
      })
      await expect(page.locator('[data-testid="evento-reciente"]')).toHaveCount(61)
      await expect(page.locator('[data-testid="evento-reciente"]').first()).toContainText(
        'EVENTO_NUEVO_61',
      )
      await expect.poll(async () => await lista.evaluate((elemento) => elemento.scrollTop)).toBe(0)

      // 7. El selector sigue operable después del scroll y del evento nuevo.
      await selector.selectOption('L1')
      await expect(page.locator('[data-testid="evento-reciente"]')).toHaveCount(61)
      await selector.selectOption('L3')
      await expect(selector).toHaveValue('L3')

      // 8. Contrato de shell intacto: sin scroll de página en ninguna resolución.
      await verificarGeometriaShellCompleto(page, viewport)
    }
  })
})
