import { describe, expect, expectTypeOf, it } from 'vitest'
import * as ModuloApiClient from '../src'
import { ClienteModeracion, ClienteRecinto } from '../src'
import type { CapacidadesModeracion } from '../src'

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
    expect(typeof cliente.iniciarRemapeo).toBe('function')
    expect(typeof cliente.confirmarRemapeo).toBe('function')
    expect(typeof cliente.cancelarRemapeo).toBe('function')

    // No debe exponer la ruta física de pulsaciones del bridge
    expect((cliente as unknown as Record<string, unknown>).procesarTecla).toBeUndefined()
    expect((cliente as unknown as Record<string, unknown>).enviarTecla).toBeUndefined()
    expect((cliente as unknown as Record<string, unknown>).informarCandidatoRemapeo).toBeUndefined()
  })

  it('ClienteRecinto expone estrictamente solo lectura y oculta ClienteRest', () => {
    const cliente = new ClienteRecinto()

    // Métodos aprobados de solo lectura
    expect(typeof cliente.obtenerEstado).toBe('function')
    expect(typeof cliente.suscribirEstado).toBe('function')

    // Comprobación de que no existen métodos mutantes directos en el objeto
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
    expect(registro.iniciarRemapeo).toBeUndefined()
    expect(registro.confirmarRemapeo).toBeUndefined()
    expect(registro.cancelarRemapeo).toBeUndefined()
  })

  it('demuestra mediante tipos de TypeScript que ClienteRecinto tiene solo métodos de lectura y no expone rest', () => {
    // Verificación estricta de que la superficie pública de tipos de ClienteRecinto
    // contiene ÚNICAMENTE 'obtenerEstado' y 'suscribirEstado'.
    type MetodosRecinto = keyof ClienteRecinto
    expectTypeOf<MetodosRecinto>().toEqualTypeOf<'obtenerEstado' | 'suscribirEstado'>()

    // Demuestra que 'rest' no forma parte de la clave pública del tipo ClienteRecinto
    expectTypeOf<ClienteRecinto>().not.toHaveProperty('rest')

    // Métodos mutantes prohibidos en Recinto
    type MetodosProhibidos =
      | 'rest'
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
      | 'iniciarRemapeo'
      | 'confirmarRemapeo'
      | 'cancelarRemapeo'

    // Verificamos que la intersección entre las claves de ClienteRecinto y los métodos prohibidos sea never
    expectTypeOf<Extract<MetodosRecinto, MetodosProhibidos>>().toBeNever()

    // Verificamos que ClienteModeracion sí contenga los métodos mutantes del operador
    type MetodosModeracion = keyof ClienteModeracion
    expectTypeOf<Extract<MetodosModeracion, 'abrirVotacion'>>().toEqualTypeOf<'abrirVotacion'>()
    expectTypeOf<Extract<MetodosModeracion, 'prepararSala'>>().toEqualTypeOf<'prepararSala'>()
    expectTypeOf<Extract<MetodosModeracion, 'abrirSesion'>>().toEqualTypeOf<'abrirSesion'>()

    // Tampoco ClienteModeracion expone rest públicamente
    expectTypeOf<ClienteModeracion>().not.toHaveProperty('rest')
  })

  it('incluye en el contrato generado las tres capacidades de remapeo de Moderación', () => {
    type CapacidadesRemapeo = Extract<
      keyof CapacidadesModeracion,
      'iniciar_remapeo' | 'confirmar_remapeo' | 'cancelar_remapeo'
    >

    expectTypeOf<CapacidadesRemapeo>().toEqualTypeOf<
      'iniciar_remapeo' | 'confirmar_remapeo' | 'cancelar_remapeo'
    >()
  })

  it('el entrypoint público del paquete no exporta ClienteRest ni crearClienteRest', () => {
    const exportaciones = ModuloApiClient as Record<string, unknown>

    // En tiempo de ejecución
    expect(exportaciones.ClienteRest).toBeUndefined()
    expect(exportaciones.crearClienteRest).toBeUndefined()

    // En el sistema de tipos de TypeScript
    expectTypeOf<typeof ModuloApiClient>().not.toHaveProperty('ClienteRest')
    expectTypeOf<typeof ModuloApiClient>().not.toHaveProperty('crearClienteRest')

    // Exportaciones públicas legítimas presentes
    expect(exportaciones.ClienteModeracion).toBeDefined()
    expect(exportaciones.crearClienteModeracion).toBeDefined()
    expect(exportaciones.ClienteRecinto).toBeDefined()
    expect(exportaciones.crearClienteRecinto).toBeDefined()
    expect(exportaciones.ClienteSimulador).toBeDefined()
    expect(exportaciones.crearClienteSimulador).toBeDefined()
    expect(exportaciones.SincronizadorEstado).toBeDefined()
    expect(exportaciones.iniciarSincronizacionEstado).toBeDefined()
    expect(exportaciones.ErrorHttp).toBeDefined()
    expect(exportaciones.ErrorTransporte).toBeDefined()
    expect(exportaciones.ErrorProtocolo).toBeDefined()
    expect(exportaciones.ErrorCancelacion).toBeDefined()
  })
})
