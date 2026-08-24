import { describe, expect, it, vi } from 'vitest'
import {
  ClienteModeracion,
  ClienteRecinto,
  ErrorCancelacion,
  ErrorHttp,
  ErrorProtocolo,
  ErrorTransporte,
} from '../src'
import { ClienteRest } from '../src/rest'
import { crearMockEstadoModeracion, crearMockEstadoRecinto } from './helpers/datos_prueba'

describe('ClienteRest y capa HTTP', () => {
  it('ejecuta GET exitoso devolviendo JSON tipado', async () => {
    const estadoMock = crearMockEstadoModeracion(10)
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(estadoMock), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const cliente = new ClienteModeracion({
      baseUrl: 'http://api.test',
      fetch: mockFetch,
    })

    const resultado = await cliente.obtenerEstado()
    expect(resultado.revision).toBe(10)
    expect(resultado.estado_global).toBe('PREPARANDO')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://api.test/api/v1/estado/moderacion',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('obtiene snapshot de Recinto exitosamente', async () => {
    const estadoMock = crearMockEstadoRecinto(5)
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(estadoMock), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const cliente = new ClienteRecinto({
      baseUrl: 'http://api.test',
      fetch: mockFetch,
    })

    const resultado = await cliente.obtenerEstado()
    expect(resultado.revision).toBe(5)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://api.test/api/v1/estado/recinto',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('ejecuta comando sin body con respuesta 204 No Content', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    const cliente = new ClienteModeracion({
      baseUrl: 'http://api.test',
      fetch: mockFetch,
    })

    await expect(cliente.prepararSala()).resolves.toBeUndefined()
    expect(mockFetch).toHaveBeenCalledWith(
      'http://api.test/api/v1/preparacion',
      expect.objectContaining({
        method: 'POST',
        body: undefined,
      }),
    )
  })

  it('ejecuta comandos PATCH y POST con cuerpo JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    const cliente = new ClienteModeracion({
      baseUrl: 'http://api.test',
      fetch: mockFetch,
    })

    await cliente.actualizarPreparacion({
      numero_sesion: 42,
      presidencia: 'Dra. Test',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://api.test/api/v1/preparacion',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          numero_sesion: 42,
          presidencia: 'Dra. Test',
        }),
      }),
    )
  })

  it('ejecuta apertura de votación con respuesta 201 y cuerpo JSON', async () => {
    const respuestaVotacion = {
      id: 'vot-123',
      numero_votacion: 1,
      tipo: 'General',
      tema: 'Presupuesto',
      tipo_mayoria: 'SIMPLE' as const,
      factor: 0,
      base: 'VOTOS_COMPUTABLES' as const,
      estado: 'EN_CURSO' as const,
      fecha_hora_apertura: '2026-08-24T10:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(respuestaVotacion), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const cliente = new ClienteModeracion({
      baseUrl: 'http://api.test',
      fetch: mockFetch,
    })

    const resultado = await cliente.abrirVotacion({
      numero_votacion: 1,
      tipo: 'General',
      tema: 'Presupuesto',
      tipo_mayoria: 'SIMPLE',
      base: 'VOTOS_COMPUTABLES',
    })

    expect(resultado.id).toBe('vot-123')
    expect(resultado.estado).toBe('EN_CURSO')
  })

  it('carga Orden del Día mediante multipart/form-data sin fijar Content-Type manual', async () => {
    const respuestaMock = {
      puntos: [
        {
          nro_votacion: 1,
          tipo: 'Despacho',
          tema: 'Tema 1',
          tipo_mayoria: 'SIMPLE' as const,
          factor: 0,
          base: 'VOTOS_COMPUTABLES' as const,
        },
      ],
    }

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      // Verificamos que no se haya pisado el Content-Type para no romper el boundary
      const headers = init?.headers as Record<string, string> | undefined
      expect(headers?.['Content-Type']).toBeUndefined()
      expect(init?.body instanceof FormData).toBe(true)

      return Promise.resolve(
        new Response(JSON.stringify(respuestaMock), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    const cliente = new ClienteModeracion({
      baseUrl: 'http://api.test',
      fetch: mockFetch,
    })

    const csvContenido =
      'nro_votacion,tipo,tema,tipo_mayoria,factor,base\n1,Despacho,Tema 1,SIMPLE,,'
    const resultado = await cliente.cargarOrdenDelDia(csvContenido)

    expect(resultado.puntos).toHaveLength(1)
    expect(resultado.puntos[0].tema).toBe('Tema 1')
  })

  it('preserva exactamente { codigo, mensaje } ante error HTTP estructurado del backend', async () => {
    const errorCuerpo = {
      codigo: 'QUORUM_INSUFICIENTE',
      mensaje: 'No hay concejales suficientes para abrir sesión.',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorCuerpo), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const cliente = new ClienteModeracion({ fetch: mockFetch })

    try {
      await cliente.abrirSesion()
      expect.unreachable('Debió haber lanzado ErrorHttp')
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorHttp)
      const errorHttp = error as ErrorHttp
      expect(errorHttp.tipo).toBe('HTTP')
      expect(errorHttp.estado).toBe(409)
      expect(errorHttp.codigo).toBe('QUORUM_INSUFICIENTE')
      expect(errorHttp.mensajeBackend).toBe('No hay concejales suficientes para abrir sesión.')
      expect(errorHttp.message).toContain('QUORUM_INSUFICIENTE')
    }
  })

  it('preserva detalle sin inventar código de dominio ante error de validación 422', async () => {
    const errorDetalle = {
      detail: [
        {
          loc: ['body', 'motivo'],
          msg: 'Field required',
          type: 'missing',
        },
      ],
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorDetalle), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const cliente = new ClienteModeracion({ fetch: mockFetch })

    try {
      await cliente.finalizarVotacion('vot-1', '')
      expect.unreachable('Debió haber lanzado ErrorHttp')
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorHttp)
      const errorHttp = error as ErrorHttp
      expect(errorHttp.estado).toBe(422)
      expect(errorHttp.codigo).toBeUndefined()
      expect(errorHttp.detalle).toBeDefined()
    }
  })

  it('lanza ErrorTransporte ante fallo de red en fetch', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const cliente = new ClienteModeracion({ fetch: mockFetch })

    await expect(cliente.obtenerEstado()).rejects.toThrow(ErrorTransporte)
  })

  it('lanza ErrorProtocolo cuando la respuesta HTTP no es un JSON válido', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('<html>Error de servidor HTML</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    )

    const rest = new ClienteRest({ fetch: mockFetch })
    await expect(rest.solicitarJson('GET', '/api/v1/estado/moderacion')).rejects.toThrow(
      ErrorProtocolo,
    )
  })

  it('soporta cancelación mediante AbortSignal lanzando ErrorCancelacion', async () => {
    const controller = new AbortController()
    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      if (init?.signal?.aborted) {
        const error = new Error('This operation was aborted')
        error.name = 'AbortError'
        return Promise.reject(error)
      }
      return Promise.resolve(new Response(null, { status: 204 }))
    })

    const cliente = new ClienteModeracion({ fetch: mockFetch })
    controller.abort()

    await expect(cliente.prepararSala(controller.signal)).rejects.toThrow(ErrorCancelacion)
  })
})
