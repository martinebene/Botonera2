/** Pruebas del reloj local y del contexto compacto de la cabecera pública. */

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CabeceraRecinto from '../app/components/CabeceraRecinto.vue'
import { formatearDuracion } from '../app/utils/tiempo'
import { crearEstadoRecintoPrueba } from './datos_prueba'

const montados: VueWrapper[] = []

function montarCabecera(estado = crearEstadoRecintoPrueba()): VueWrapper {
  const wrapper = mount(CabeceraRecinto, {
    props: { estado, estadoConexion: 'CONECTADO', desactualizado: false },
  })
  montados.push(wrapper)
  return wrapper
}

afterEach(() => {
  while (montados.length > 0) montados.pop()?.unmount()
  vi.useRealTimers()
})

describe('Cabecera pública compacta', () => {
  it('muestra fecha/hora local y actualiza reloj y duración sin red', async () => {
    vi.useFakeTimers()
    const ahora = new Date(2026, 7, 30, 10, 0, 0)
    vi.setSystemTime(ahora)
    const apertura = new Date(2026, 7, 30, 9, 30, 0).toISOString()
    const wrapper = montarCabecera(
      crearEstadoRecintoPrueba({
        estado_global: 'SESION_ABIERTA',
        sesion: {
          fecha_hora_inicio_preparacion: apertura,
          fecha_hora_apertura: apertura,
          numero_sesion: 39,
          presidencia: 'Presidencia',
          secretaria_legislativa: 'Secretaría',
        },
      }),
    )

    expect(wrapper.get('[data-testid="cabecera-fecha-hora"]').text()).toBe('30/08/2026 10:00:00')
    expect(wrapper.get('[data-testid="cabecera-sesion"]').text()).toBe('Sesión N.º 39')
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:30:00')

    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(wrapper.get('[data-testid="cabecera-fecha-hora"]').text()).toBe('30/08/2026 10:00:01')
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:30:01')
  })

  it('recalcula al cambiar la apertura y omite duración durante PREPARANDO', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 30, 10, 0, 0))
    const aperturaInicial = new Date(2026, 7, 30, 9, 0, 0).toISOString()
    const wrapper = montarCabecera(
      crearEstadoRecintoPrueba({
        estado_global: 'SESION_ABIERTA',
        sesion: {
          fecha_hora_inicio_preparacion: aperturaInicial,
          fecha_hora_apertura: aperturaInicial,
          numero_sesion: 39,
          presidencia: 'Presidencia',
          secretaria_legislativa: 'Secretaría',
        },
      }),
    )
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('01:00:00')

    const aperturaNueva = new Date(2026, 7, 30, 9, 55, 0).toISOString()
    await wrapper.setProps({
      estado: crearEstadoRecintoPrueba({
        estado_global: 'SESION_ABIERTA',
        sesion: {
          fecha_hora_inicio_preparacion: aperturaNueva,
          fecha_hora_apertura: aperturaNueva,
          numero_sesion: 40,
          presidencia: 'Otra Presidencia',
          secretaria_legislativa: 'Otra Secretaría',
        },
      }),
    })
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:05:00')

    await wrapper.setProps({
      estado: crearEstadoRecintoPrueba({
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: aperturaNueva,
          numero_sesion: 40,
          presidencia: 'Otra Presidencia',
          secretaria_legislativa: 'Otra Secretaría',
        },
      }),
    })
    expect(wrapper.get('[data-testid="cabecera-sesion"]').text()).toContain('Preparando')
    expect(wrapper.find('[data-testid="cabecera-tiempo-sesion"]').exists()).toBe(false)
  })

  it('libera el ticker al desmontar y admite duraciones mayores a 24 horas', () => {
    vi.useFakeTimers()
    const wrapper = montarCabecera()
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    montados.pop()
    expect(vi.getTimerCount()).toBe(0)
    expect(formatearDuracion(90_000_000)).toBe('25:00:00')
  })
})
