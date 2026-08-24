import { describe, expect, it, vi } from 'vitest'
import { ClienteModeracion, ClienteRecinto } from '../src'
import { crearMockEstadoModeracion, crearMockEstadoRecinto } from './helpers/datos_prueba'
import { MockEventSource } from './helpers/mock_event_source'

describe('Caso crítico: Reinicio (Restart) del backend y nueva baseline', () => {
  it('acepta revisión 0 como nueva baseline tras caída del backend desde revisión 142', async () => {
    let llamadasFetch = 0

    // Estado antes de caer: revision 142, SESION_ABIERTA
    const estadoPrevio = crearMockEstadoModeracion(142, 'SESION_ABIERTA')

    // Estado tras reinicio del backend: revision 0, SIN_PREPARAR
    const estadoReinicio = crearMockEstadoModeracion(0, 'SIN_PREPARAR')

    // Estado siguiente en la nueva vida del proceso: revision 1, PREPARANDO
    const estadoSiguiente = crearMockEstadoModeracion(1, 'PREPARANDO')

    const mockFetch = vi.fn().mockImplementation(() => {
      llamadasFetch++
      if (llamadasFetch === 1) {
        return Promise.resolve(new Response(JSON.stringify(estadoPrevio), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify(estadoReinicio), { status: 200 }))
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

    const historialEstados: Array<{ revision: number; estadoGlobal: string }> = []

    const suscripcion = cliente.suscribirEstado({
      alEstado: (e) =>
        historialEstados.push({
          revision: e.revision,
          estadoGlobal: e.estado_global,
        }),
    })

    // 1. Conexión inicial: adopta baseline previa revision 142
    await vi.waitFor(() => {
      expect(instanciasEs.length).toBe(1)
      expect(historialEstados).toHaveLength(1)
      expect(historialEstados[0]).toEqual({
        revision: 142,
        estadoGlobal: 'SESION_ABIERTA',
      })
    })

    instanciasEs[0].simularApertura()

    // 2. Ocurre caída del backend: el stream SSE se interrumpe
    instanciasEs[0].simularError()

    // 3. El cliente debe ejecutar recovery por snapshot REST
    // y aceptar revision 0 como NUEVA baseline sin descartarla por ser 0 < 142
    await vi.waitFor(() => {
      expect(instanciasEs.length).toBe(2)
      expect(historialEstados).toHaveLength(2)
      expect(historialEstados[1]).toEqual({
        revision: 0,
        estadoGlobal: 'SIN_PREPARAR',
      })
    })

    instanciasEs[1].simularApertura()

    // 4. El nuevo stream continúa desde la nueva baseline (revision 1)
    instanciasEs[1].simularEvento('estado', estadoSiguiente)

    expect(historialEstados).toHaveLength(3)
    expect(historialEstados[2]).toEqual({
      revision: 1,
      estadoGlobal: 'PREPARANDO',
    })

    suscripcion.cancelar()
  })

  it('permite a ClienteRecinto adoptar nueva baseline tras reinicio del servidor', async () => {
    let llamadasFetch = 0
    const previoRecinto = crearMockEstadoRecinto(88, 'SESION_ABIERTA')
    const reinicioRecinto = crearMockEstadoRecinto(0, 'SIN_PREPARAR')
    const siguienteRecinto = crearMockEstadoRecinto(1, 'PREPARANDO')

    const mockFetch = vi.fn().mockImplementation(() => {
      llamadasFetch++
      if (llamadasFetch === 1) {
        return Promise.resolve(new Response(JSON.stringify(previoRecinto), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify(reinicioRecinto), { status: 200 }))
    })

    const instanciasEs: MockEventSource[] = []
    const fabricaEs = vi.fn().mockImplementation((url: string) => {
      const es = new MockEventSource(url)
      instanciasEs.push(es)
      return es
    })

    const cliente = new ClienteRecinto({
      fetch: mockFetch,
      fabricaEventSource: fabricaEs,
      backoff: {
        temporizador: vi.fn().mockResolvedValue(undefined),
      },
    })

    const revisiones: number[] = []
    const suscripcion = cliente.suscribirEstado({
      alEstado: (e) => revisiones.push(e.revision),
    })

    await vi.waitFor(() => expect(instanciasEs.length).toBe(1))
    expect(revisiones).toEqual([88])

    // Corte y recovery
    instanciasEs[0].simularError()

    await vi.waitFor(() => expect(instanciasEs.length).toBe(2))
    expect(revisiones).toEqual([88, 0])

    // Avanza en nuevo stream
    instanciasEs[1].simularEvento('estado', siguienteRecinto)
    expect(revisiones).toEqual([88, 0, 1])

    suscripcion.cancelar()
  })
})
