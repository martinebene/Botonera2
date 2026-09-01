/**
 * Pruebas del reloj anclado y del renglón único de la cabecera pública.
 *
 * La geometría real (altura, una sola línea, elipsis) se verifica en Playwright
 * con bounding boxes; acá se fija la *estructura* que la hace posible, porque
 * jsdom no calcula layout.
 */

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

describe('Cabecera pública de una sola línea (WP-050)', () => {
  /** Devuelve las etiquetas de los hijos directos del bloque central. */
  function hijosDelContexto(wrapper: VueWrapper): string[] {
    return Array.from(wrapper.get('[data-testid="cabecera-contexto"]').element.children).map(
      (hijo) => hijo.tagName.toLowerCase(),
    )
  }

  it('condensa título, sesión, duración y autoridades como elementos en línea', () => {
    vi.useFakeTimers()
    vi.setSystemTime('2030-01-01T00:00:00Z')
    const wrapper = montarCabecera(crearSesion('2026-08-30T10:00:00', '2026-08-30T09:30:00'))

    // Cuatro elementos en línea, ningún párrafo: antes de WP-050 el centro eran
    // un `h1` y dos `p`, es decir tres renglones apilados.
    expect(hijosDelContexto(wrapper)).toEqual(['h1', 'span', 'span', 'span'])
    expect(hijosDelContexto(wrapper)).not.toContain('p')

    // Cada dato conserva su texto limpio: el separador `·` lo dibuja CSS, de
    // modo que ninguna prueba ni lector de pantalla lo lee como contenido.
    expect(wrapper.get('[data-testid="cabecera-sesion"]').text()).toBe('Sesión N.º 39')
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toBe('00:30:00')
    expect(wrapper.get('[data-testid="cabecera-autoridades"]').text()).toBe(
      'Presidencia: Presidencia de prueba · Secretaría: Secretaría de prueba',
    )
    expect(wrapper.text()).toContain('Concejo Deliberante de Puerto Madryn')
  })

  it('no reserva renglón cuando faltan autoridades o duración', async () => {
    const wrapper = montarCabecera(
      crearEstadoRecintoPrueba({
        generado_en: '2026-08-30T10:00:00',
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-30T09:00:00',
          numero_sesion: 61,
          presidencia: null,
          secretaria_legislativa: null,
        },
      }),
    )

    // Sin autoridades el elemento directamente no existe: ya no queda un
    // párrafo con un espacio duro ocupando altura.
    expect(wrapper.find('[data-testid="cabecera-autoridades"]').exists()).toBe(false)
    // PREPARANDO no expone duración de sesión.
    expect(wrapper.find('[data-testid="cabecera-tiempo-sesion"]').exists()).toBe(false)
    expect(hijosDelContexto(wrapper)).toEqual(['h1', 'span'])
    expect(wrapper.get('[data-testid="cabecera-sesion"]').text()).toContain('61')

    // Con una sola autoridad tampoco aparece una segunda fila: se suma un solo
    // elemento en línea más.
    await wrapper.setProps({
      estado: crearEstadoRecintoPrueba({
        generado_en: '2026-08-30T10:00:00',
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-30T09:00:00',
          numero_sesion: 61,
          presidencia: 'Sólo Presidencia',
          secretaria_legislativa: null,
        },
      }),
    })
    expect(hijosDelContexto(wrapper)).toEqual(['h1', 'span', 'span'])
    expect(wrapper.get('[data-testid="cabecera-autoridades"]').text()).toBe(
      'Presidencia: Sólo Presidencia',
    )
  })

  it('ofrece el texto completo de autoridades en `title` porque en pantalla se recorta', () => {
    const largo = 'Presidencia con un nombre deliberadamente extenso para forzar el recorte visual'
    const wrapper = montarCabecera(
      crearEstadoRecintoPrueba({
        generado_en: '2026-08-30T10:00:00',
        estado_global: 'SESION_ABIERTA',
        sesion: {
          fecha_hora_inicio_preparacion: '2026-08-30T09:00:00',
          fecha_hora_apertura: '2026-08-30T09:30:00',
          numero_sesion: 62,
          presidencia: largo,
          secretaria_legislativa: null,
        },
      }),
    )
    // El DOM liviano de estas pruebas expone los atributos por `getAttribute`.
    const autoridades = wrapper.get('[data-testid="cabecera-autoridades"]').element
    expect(autoridades.getAttribute('title')).toBe(`Presidencia: ${largo}`)
    // El texto largo no agrega hijos: sigue siendo un único elemento en línea.
    expect(hijosDelContexto(wrapper)).toEqual(['h1', 'span', 'span', 'span'])
  })
})
