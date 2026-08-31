/** Pruebas del reloj anclado y del contexto estable de la cabecera pública. */

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CabeceraRecinto from '../app/components/CabeceraRecinto.vue'
import {
  calcularDuracionEnSnapshot,
  convertirMarcaBackend,
  formatearDuracion,
} from '../app/utils/tiempo'
import { crearEstadoRecintoPrueba } from './datos_prueba'

const montados: VueWrapper[] = []

function crearSesion(generadoEn: string, fechaHoraApertura: string, numeroSesion = 39) {
  return crearEstadoRecintoPrueba({
    generado_en: generadoEn,
    estado_global: 'SESION_ABIERTA',
    sesion: {
      fecha_hora_inicio_preparacion: fechaHoraApertura,
      fecha_hora_apertura: fechaHoraApertura,
      numero_sesion: numeroSesion,
      presidencia: 'Presidencia de prueba',
      secretaria_legislativa: 'Secretaría de prueba',
    },
  })
}

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

describe('Cabecera pública con reloj anclado', () => {
  it('resta dos marcas naive backend sin usar la zona ni el instante absoluto del navegador', async () => {
    vi.useFakeTimers()
    // El monitor simulado vive nueve años después del snapshot. La solución
    // anterior Date.now()-Date.parse(apertura) habría producido una duración
    // absurda; la nueva solo resta las dos lecturas del reloj backend.
    vi.setSystemTime('2035-01-02T03:04:05Z')
    const wrapper = montarCabecera(crearSesion('2026-08-30T10:00:00', '2026-08-30T09:30:00'))

    expect(calcularDuracionEnSnapshot('2026-08-30T10:00:00', '2026-08-30T09:30:00')).toBe(1_800_000)
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:30:00')
    expect(wrapper.get('[data-testid="cabecera-autoridades"]').text()).toContain(
      'Presidencia de prueba',
    )

    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:30:01')
  })

  it('continúa entre snapshots y una baseline nueva reemplaza completamente el ancla', async () => {
    vi.useFakeTimers()
    vi.setSystemTime('2040-05-01T00:00:00Z')
    const wrapper = montarCabecera(crearSesion('2026-08-30T10:00:00', '2026-08-30T09:00:00'))
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('01:00:00')

    // No llega snapshot durante esta ventana (equivale a una reconexión con la
    // última baseline confirmada): el elapsed local continúa visualmente.
    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('01:00:05')

    await wrapper.setProps({
      estado: crearSesion('2026-08-30T10:10:00', '2026-08-30T10:05:00', 40),
    })
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:05:00')
    expect(wrapper.get('[data-testid="cabecera-sesion"]').text()).toBe('Sesión N.º 40')

    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:05:01')
  })

  it('recorta aperturas futuras, omite PREPARANDO y acepta más de 24 horas', async () => {
    vi.useFakeTimers()
    vi.setSystemTime('2040-05-01T00:00:00Z')
    const wrapper = montarCabecera(crearSesion('2026-08-30T10:00:00', '2026-08-30T10:05:00'))
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:00:00')

    await wrapper.setProps({
      estado: crearEstadoRecintoPrueba({
        generado_en: '2026-08-30T10:00:00',
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-30T09:00:00',
          numero_sesion: 40,
          presidencia: 'Otra Presidencia',
          secretaria_legislativa: 'Otra Secretaría',
        },
      }),
    })
    expect(wrapper.find('[data-testid="cabecera-tiempo-sesion"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="cabecera-sesion"]').text()).toContain('Preparando')

    expect(
      formatearDuracion(calcularDuracionEnSnapshot('2026-08-31T11:00:00', '2026-08-30T10:00:00')!),
    ).toBe('25:00:00')
    expect(convertirMarcaBackend('marca inválida')).toBeNull()
  })

  it('libera el único ticker visual al desmontar', () => {
    vi.useFakeTimers()
    const wrapper = montarCabecera(crearSesion('2026-08-30T10:00:00', '2026-08-30T09:30:00'))
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    montados.pop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
