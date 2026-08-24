import { describe, expect, it, vi } from 'vitest'
import {
  ClienteModeracion,
  ClienteRecinto,
  ErrorProtocolo,
  ErrorTransporte,
  SincronizadorEstado,
} from '../src'
import { crearMockEstadoModeracion, crearMockEstadoRecinto } from './helpers/datos_prueba'
import { MockEventSource } from './helpers/mock_event_source'

describe('Sincronizador reactivo y protocolo SSE', () => {
  it('obtiene el snapshot inicial REST antes de abrir la conexión EventSource', async () => {
    const ordenLlamadas: string[] = []
    const estadoInicial = crearMockEstadoModeracion(10)

    const mockFetch = vi.fn().mockImplementation(() => {
      ordenLlamadas.push('FETCH_SNAPSHOT')
      return Promise.resolve(new Response(JSON.stringify(estadoInicial), { status: 200 }))
    })

    let mockEs: MockEventSource | null = null
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      ordenLlamadas.push('CREAR_EVENT_SOURCE')
      mockEs = new MockEventSource(url)
      return mockEs
    })

    const cliente = new ClienteModeracion({
      baseUrl: 'http://api.test',
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
    })

    const estadosRecibidos: number[] = []
    const suscripcion = cliente.suscribirEstado({
      alEstado: (estado) => estadosRecibidos.push(estado.revision),
    })

    // Permitimos que la promesa del fetch se resuelva
    await vi.waitFor(() => {
      expect(estadosRecibidos).toEqual([10])
    })

    expect(ordenLlamadas).toEqual(['FETCH_SNAPSHOT', 'CREAR_EVENT_SOURCE'])
    expect(fabricaEs).toHaveBeenCalledWith('http://api.test/api/v1/estado/moderacion/stream')

    suscripcion.cancelar()
  })

  it('procesa el primer evento SSE como estado completo y avanza revisión ante mutación intermedia', async () => {
    // Escenario de carrera: Snapshot rev 10 -> mutación -> primer SSE rev 11
    const snapshotRev10 = crearMockEstadoModeracion(10)
    const sseRev11 = crearMockEstadoModeracion(11)

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(snapshotRev10), { status: 200 }))

    let instanciaEs: MockEventSource | null = null
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      instanciaEs = new MockEventSource(url)
      return instanciaEs
    })

    const cliente = new ClienteModeracion({
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
    })

    const revisionesRecibidas: number[] = []
    const suscripcion = cliente.suscribirEstado({
      alEstado: (e) => revisionesRecibidas.push(e.revision),
    })

    await vi.waitFor(() => {
      expect(revisionesRecibidas).toEqual([10])
      expect(instanciaEs).not.toBeNull()
    })

    instanciaEs!.simularApertura()
    instanciaEs!.simularEvento('estado', sseRev11)

    expect(revisionesRecibidas).toEqual([10, 11])

    suscripcion.cancelar()
  })

  it('descarta revisiones anteriores y acepta revisiones iguales o saltos dentro de la baseline', async () => {
    const snapshot = crearMockEstadoModeracion(10)
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(snapshot), { status: 200 }))

    let instanciaEs: MockEventSource | null = null
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      instanciaEs = new MockEventSource(url)
      return instanciaEs
    })

    const cliente = new ClienteModeracion({
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
    })

    const revisiones: number[] = []
    const suscripcion = cliente.suscribirEstado({
      alEstado: (e) => revisiones.push(e.revision),
    })

    await vi.waitFor(() => expect(instanciaEs).not.toBeNull())

    // 1. Revision menor (rev 9): debe descartarse
    instanciaEs!.simularEvento('estado', crearMockEstadoModeracion(9))
    expect(revisiones).toEqual([10])

    // 2. Revision igual (rev 10): tratada idempotentemente
    instanciaEs!.simularEvento('estado', crearMockEstadoModeracion(10))
    expect(revisiones).toEqual([10, 10])

    // 3. Salto de revisión (rev 15 sin pasar por 11, 12, 13, 14): válido y aceptado
    instanciaEs!.simularEvento('estado', crearMockEstadoModeracion(15))
    expect(revisiones).toEqual([10, 10, 15])

    suscripcion.cancelar()
  })

  it('cierra el EventSource fallado inmediatamente ante error SSE y ejecuta recovery con snapshot', async () => {
    let llamadasFetch = 0
    const mockFetch = vi.fn().mockImplementation(() => {
      llamadasFetch++
      const rev = llamadasFetch === 1 ? 10 : 12
      return Promise.resolve(
        new Response(JSON.stringify(crearMockEstadoModeracion(rev)), { status: 200 }),
      )
    })

    const instanciasEs: MockEventSource[] = []
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      const es = new MockEventSource(url)
      instanciasEs.push(es)
      return es
    })

    const temporizadorInmediato = vi.fn().mockResolvedValue(undefined)

    const cliente = new ClienteModeracion({
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
      backoff: {
        temporizador: temporizadorInmediato,
      },
    })

    const revisiones: number[] = []
    const errores: unknown[] = []
    const cambiosConexion: boolean[] = []

    const suscripcion = cliente.suscribirEstado({
      alEstado: (e) => revisiones.push(e.revision),
      alError: (err) => errores.push(err),
      alCambiarConexion: (c) => cambiosConexion.push(c),
    })

    await vi.waitFor(() => {
      expect(instanciasEs.length).toBe(1)
      expect(revisiones).toEqual([10])
    })

    instanciasEs[0].simularApertura()
    expect(cambiosConexion).toContain(true)

    // Simulamos fallo del stream
    instanciasEs[0].simularError()

    // Verificamos que se cerró inmediatamente la primera instancia
    expect(instanciasEs[0].cerrado).toBe(true)

    // Debe haberse disparado el recovery: fetch snapshot nuevo -> nuevo EventSource
    await vi.waitFor(() => {
      expect(instanciasEs.length).toBe(2)
      expect(revisiones).toEqual([10, 12])
    })

    expect(temporizadorInmediato).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(2)

    suscripcion.cancelar()
    expect(instanciasEs[1].cerrado).toBe(true)
  })

  it('fuerza recuperación segura ante evento SSE con JSON corrupto o malformado', async () => {
    let llamadasFetch = 0
    const mockFetch = vi.fn().mockImplementation(() => {
      llamadasFetch++
      return Promise.resolve(
        new Response(JSON.stringify(crearMockEstadoModeracion(llamadasFetch * 10)), {
          status: 200,
        }),
      )
    })

    const instanciasEs: MockEventSource[] = []
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      const es = new MockEventSource(url)
      instanciasEs.push(es)
      return es
    })

    const cliente = new ClienteModeracion({
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
      backoff: {
        temporizador: vi.fn().mockResolvedValue(undefined),
      },
    })

    const revisiones: number[] = []
    const errores: unknown[] = []

    const suscripcion = cliente.suscribirEstado({
      alEstado: (e) => revisiones.push(e.revision),
      alError: (err) => errores.push(err),
    })

    await vi.waitFor(() => expect(instanciasEs.length).toBe(1))

    // Enviamos JSON malformado
    instanciasEs[0].simularEvento('estado', '{ corrupt json ...')

    // La instancia corrupta debe cerrarse y reportarse ErrorProtocolo
    expect(instanciasEs[0].cerrado).toBe(true)

    await vi.waitFor(() => {
      expect(instanciasEs.length).toBe(2)
      expect(revisiones).toEqual([10, 20])
    })

    expect(errores.some((e) => e instanceof ErrorProtocolo)).toBe(true)

    suscripcion.cancelar()
  })

  it('soporta cancelación (dispose) durante conexión activa', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(crearMockEstadoModeracion(1)), { status: 200 }),
      )

    let instanciaEs: MockEventSource | null = null
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      instanciaEs = new MockEventSource(url)
      return instanciaEs
    })

    const cliente = new ClienteModeracion({
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
    })

    const suscripcion = cliente.suscribirEstado({
      alEstado: vi.fn(),
    })

    await vi.waitFor(() => expect(instanciaEs).not.toBeNull())

    expect(suscripcion.activa).toBe(true)
    suscripcion.cancelar()

    expect(suscripcion.activa).toBe(false)
    expect(instanciaEs!.cerrado).toBe(true)

    // Cancelar repetidamente es idempotente y seguro
    expect(() => suscripcion.cancelar()).not.toThrow()
  })

  it('soporta cancelación (dispose) durante espera de backoff y durante snapshot de recuperación', async () => {
    let resolverTimer: (() => void) | undefined
    const temporizadorPausado = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolverTimer = resolve
      })
    })

    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(crearMockEstadoModeracion(1)), { status: 200 }),
      )

    let instanciaEs: MockEventSource | null = null
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      instanciaEs = new MockEventSource(url)
      return instanciaEs
    })

    const cliente = new ClienteModeracion({
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
      backoff: { temporizador: temporizadorPausado },
    })

    const suscripcion = cliente.suscribirEstado({ alEstado: vi.fn() })

    await vi.waitFor(() => expect(instanciaEs).not.toBeNull())

    // Provocamos error en SSE para entrar en backoff
    instanciaEs!.simularError()

    await vi.waitFor(() => expect(temporizadorPausado).toHaveBeenCalled())

    // Cancelamos durante el backoff
    suscripcion.cancelar()
    expect(suscripcion.activa).toBe(false)

    // Si el timer se resolviera más tarde, no debe continuar
    if (resolverTimer) {
      ;(resolverTimer as () => void)()
    }
    expect(fabricaEs).toHaveBeenCalledTimes(1)
  })

  it('no emite callbacks al consumidor después de la cancelación', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(crearMockEstadoModeracion(1)), { status: 200 }),
      )

    let instanciaEs: MockEventSource | null = null
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      instanciaEs = new MockEventSource(url)
      return instanciaEs
    })

    const cliente = new ClienteModeracion({
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
    })

    const alEstado = vi.fn()
    const suscripcion = cliente.suscribirEstado({ alEstado })

    await vi.waitFor(() => expect(alEstado).toHaveBeenCalledTimes(1))

    suscripcion.cancelar()

    // Intentamos emitir un evento posterior
    instanciaEs!.simularEvento('estado', crearMockEstadoModeracion(2))
    expect(alEstado).toHaveBeenCalledTimes(1)
  })

  it('protege el ciclo interno ante excepciones en el callback del consumidor', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(crearMockEstadoModeracion(1)), { status: 200 }),
      )

    let instanciaEs: MockEventSource | null = null
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      instanciaEs = new MockEventSource(url)
      return instanciaEs
    })

    const cliente = new ClienteModeracion({
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
    })

    const callbackConError = vi.fn().mockImplementation(() => {
      throw new Error('Fallo voluntario en UI')
    })

    const alError = vi.fn()
    const suscripcion = cliente.suscribirEstado({
      alEstado: callbackConError,
      alError,
    })

    await vi.waitFor(() => expect(instanciaEs).not.toBeNull())

    // El error en alEstado debe notificarse a alError sin quebrar la instancia
    expect(alError).toHaveBeenCalled()
    expect(suscripcion.activa).toBe(true)

    suscripcion.cancelar()
  })
})
