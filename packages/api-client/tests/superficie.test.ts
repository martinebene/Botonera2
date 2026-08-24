import { describe, expect, expectTypeOf, it } from 'vitest'
import { ClienteModeracion, ClienteRecinto } from '../src'

describe('Separación de superficies públicas de Moderación y Recinto', () => {
  it('ClienteModeracion expone todos los comandos del operador y sincronización', () => {
    const cliente = new ClienteModeracion()

    expect(typeof cliente.obtenerEstado).toBe('function')
    expect(typeof cliente.suscribirEstado).toBe('function')
    expect(typeof cliente.prepararSala).toBe('function')
    expect(typeof cliente.actualizarPreparacion).toBe('function')
    expect(typeof cliente.cancelarPreparacion).toBe('function')
    expect(typeof cliente.abrirSesion).toBe('function')
    expect(typeof cliente.actualizarSesion).toBe('function')
    expect(typeof cliente.cerrarSesion).toBe('function')
    expect(typeof cliente.cargarOrdenDelDia).toBe('function')
    expect(typeof cliente.descartarOrdenDelDia).toBe('function')
    expect(typeof cliente.abrirVotacion).toBe('function')
    expect(typeof cliente.finalizarVotacion).toBe('function')
    expect(typeof cliente.desempatar).toBe('function')
    expect(typeof cliente.otorgarPalabra).toBe('function')
    expect(typeof cliente.quitarPalabra).toBe('function')

    // No debe exponer la ruta física de pulsaciones del bridge
    expect((cliente as unknown as Record<string, unknown>).procesarTecla).toBeUndefined()
    expect((cliente as unknown as Record<string, unknown>).enviarTecla).toBeUndefined()
  })

  it('ClienteRecinto expone únicamente métodos de solo lectura en runtime', () => {
    const cliente = new ClienteRecinto()

    expect(typeof cliente.obtenerEstado).toBe('function')
    expect(typeof cliente.suscribirEstado).toBe('function')

    const registro = cliente as unknown as Record<string, unknown>
    expect(registro.prepararSala).toBeUndefined()
    expect(registro.actualizarPreparacion).toBeUndefined()
    expect(registro.cancelarPreparacion).toBeUndefined()
    expect(registro.abrirSesion).toBeUndefined()
    expect(registro.actualizarSesion).toBeUndefined()
    expect(registro.cerrarSesion).toBeUndefined()
    expect(registro.cargarOrdenDelDia).toBeUndefined()
    expect(registro.descartarOrdenDelDia).toBeUndefined()
    expect(registro.abrirVotacion).toBeUndefined()
    expect(registro.finalizarVotacion).toBeUndefined()
    expect(registro.desempatar).toBeUndefined()
    expect(registro.otorgarPalabra).toBeUndefined()
    expect(registro.quitarPalabra).toBeUndefined()
    expect(registro.procesarTecla).toBeUndefined()
  })

  it('demuestra mediante tipos de TypeScript que ClienteRecinto no contiene métodos mutantes', () => {
    // Verificación estricta a nivel de compilador TypeScript con expectTypeOf
    type MetodosRecinto = keyof ClienteRecinto

    // Métodos mutantes prohibidos en Recinto
    type MetodosProhibidos =
      | 'prepararSala'
      | 'actualizarPreparacion'
      | 'cancelarPreparacion'
      | 'abrirSesion'
      | 'actualizarSesion'
      | 'cerrarSesion'
      | 'cargarOrdenDelDia'
      | 'descartarOrdenDelDia'
      | 'abrirVotacion'
      | 'finalizarVotacion'
      | 'desempatar'
      | 'otorgarPalabra'
      | 'quitarPalabra'
      | 'procesarTecla'

    // Verificamos que la intersección entre las claves de ClienteRecinto y los métodos prohibidos sea never
    expectTypeOf<Extract<MetodosRecinto, MetodosProhibidos>>().toBeNever()

    // Verificamos que ClienteModeracion sí contenga los métodos mutantes
    type MetodosModeracion = keyof ClienteModeracion
    expectTypeOf<Extract<MetodosModeracion, 'abrirVotacion'>>().toEqualTypeOf<'abrirVotacion'>()
    expectTypeOf<Extract<MetodosModeracion, 'prepararSala'>>().toEqualTypeOf<'prepararSala'>()
    expectTypeOf<Extract<MetodosModeracion, 'abrirSesion'>>().toEqualTypeOf<'abrirSesion'>()
  })
})
