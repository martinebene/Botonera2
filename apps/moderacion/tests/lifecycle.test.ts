import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import {
  useEstadoModeracion,
  reiniciarInstanciaCompartidaParaPruebas,
  obtenerCantidadConsumidoresParaPruebas,
} from '../app/composables/useEstadoModeracion'
import type { ClienteModeracion, Suscripcion } from '@botonera2/api-client'

describe('Lifecycle y Reference Counting de useEstadoModeracion con @vue/test-utils', () => {
  beforeEach(() => {
    reiniciarInstanciaCompartidaParaPruebas()
  })

  it('gestiona correctamente la suscripción única, conteo de consumidores y cancelación final al desmontar', () => {
    let cancelaciones = 0
    let suscripcionesCreadas = 0
    let mockActiva = true

    const mockSuscripcion: Suscripcion = {
      cancelar: () => {
        mockActiva = false
        cancelaciones++
      },
      get activa() {
        return mockActiva
      },
    }

    const mockCliente = {
      suscribirEstado: vi.fn(() => {
        suscripcionesCreadas++
        mockActiva = true
        return mockSuscripcion
      }),
    } as unknown as ClienteModeracion

    // Componente consumidor A
    const ConsumidorA = defineComponent({
      name: 'ConsumidorA',
      setup() {
        const sincronizacion = useEstadoModeracion(mockCliente)
        return { sincronizacion }
      },
      render() {
        return h('div', { class: 'consumidor-a' }, 'Consumidor A')
      },
    })

    // Componente consumidor B
    const ConsumidorB = defineComponent({
      name: 'ConsumidorB',
      setup() {
        const sincronizacion = useEstadoModeracion(mockCliente)
        return { sincronizacion }
      },
      render() {
        return h('div', { class: 'consumidor-b' }, 'Consumidor B')
      },
    })

    // 1. Montamos Consumidor A
    const wrapperA = mount(ConsumidorA)
    expect(suscripcionesCreadas).toBe(1)
    expect(obtenerCantidadConsumidoresParaPruebas()).toBe(1)
    expect(cancelaciones).toBe(0)

    // 2. Montamos Consumidor B (concurrente)
    const wrapperB = mount(ConsumidorB)
    // Sigue habiendo exactamente 1 suscripción (reutiliza el singleton)
    expect(suscripcionesCreadas).toBe(1)
    expect(obtenerCantidadConsumidoresParaPruebas()).toBe(2)
    expect(cancelaciones).toBe(0)

    // 3. Desmontamos Consumidor A
    wrapperA.unmount()
    // No se cancela porque Consumidor B sigue activo
    expect(obtenerCantidadConsumidoresParaPruebas()).toBe(1)
    expect(cancelaciones).toBe(0)

    // 4. Desmontamos Consumidor B (el último)
    wrapperB.unmount()
    // Al quedar 0 consumidores, se ejecuta cancelar() exactamente 1 vez
    expect(obtenerCantidadConsumidoresParaPruebas()).toBe(0)
    expect(cancelaciones).toBe(1)
    expect(mockActiva).toBe(false)

    // 5. Montamos un nuevo Consumidor C tras la liberación
    const ConsumidorC = defineComponent({
      name: 'ConsumidorC',
      setup() {
        const sincronizacion = useEstadoModeracion(mockCliente)
        return { sincronizacion }
      },
      render() {
        return h('div', { class: 'consumidor-c' }, 'Consumidor C')
      },
    })

    const wrapperC = mount(ConsumidorC)
    // Crea una NUEVA sincronización y suscripción limpia
    expect(suscripcionesCreadas).toBe(2)
    expect(obtenerCantidadConsumidoresParaPruebas()).toBe(1)
    expect(cancelaciones).toBe(1)

    // Limpieza final
    wrapperC.unmount()
    expect(obtenerCantidadConsumidoresParaPruebas()).toBe(0)
    expect(cancelaciones).toBe(2)
  })
})
