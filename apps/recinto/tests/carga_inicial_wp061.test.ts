/**
 * Relevo del indicador de carga inicial en la Pantalla del Recinto (WP-061).
 *
 * El indicador previo a la hidratación vive en el HTML y lo retira Nuxt al montar; lo que
 * se comprueba acá es la segunda mitad del relevo: mientras el shell público no recibió su
 * primer snapshot debe mostrar la barra indeterminada compartida, y debe dejar de
 * mostrarla —quitándola del árbol, no ocultándola— en cuanto llega el estado.
 *
 * Se eligió el Recinto para esta prueba de DOM porque es la única de las cuatro pantallas
 * cuyo shell recibe el estado como prop y puede montarse fuera del runtime de Nuxt. Las
 * otras tres superficies se verifican en el navegador, en
 * `tests/playwright/carga_inicial_wp061.spec.ts`.
 */

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PantallaRecinto from '../app/components/PantallaRecinto.vue'
import { crearEstadoRecintoPrueba } from './datos_prueba'

const montados: VueWrapper[] = []

afterEach(() => {
  while (montados.length > 0) montados.pop()?.unmount()
})

describe('Indicador de carga inicial del Recinto', () => {
  it('muestra la barra indeterminada mientras no llegó el primer estado', () => {
    const wrapper = mount(PantallaRecinto, {
      props: { estado: null, estadoConexion: 'INICIAL', desactualizado: false },
    })
    montados.push(wrapper)

    // La semántica accesible del indicador se verifica sobre su render real en
    // `packages/frontend-shared/tests/indicador_carga_inicial.test.ts`; acá interesa que la
    // pantalla lo monte. Convive con el mensaje textual de espera que ya tenía: uno explica
    // qué se está esperando y el otro es la señal continua de que la carga sigue en curso.
    expect(wrapper.find('[data-testid="carga-inicial-aplicacion"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="estado-inicial"]').text()).toContain('Conectando')
  })

  it('conserva la barra si la conexión falla antes del primer estado', () => {
    const wrapper = mount(PantallaRecinto, {
      props: { estado: null, estadoConexion: 'DESCONECTADO', desactualizado: false },
    })
    montados.push(wrapper)

    // Sin snapshot la pantalla sigue sin poder operar, así que la señal de espera
    // continúa aunque el motivo pase a ser una desconexión.
    expect(wrapper.find('[data-testid="carga-inicial-aplicacion"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="estado-inicial"]').text()).toContain('sin conexión')
  })

  it('retira la barra del árbol en cuanto llega el primer estado', async () => {
    const wrapper = mount(PantallaRecinto, {
      props: { estado: null, estadoConexion: 'INICIAL', desactualizado: false },
    })
    montados.push(wrapper)

    await wrapper.setProps({
      estado: crearEstadoRecintoPrueba(),
      estadoConexion: 'CONECTADO',
    })

    // `exists()` es la afirmación correcta: el WP exige que desaparezca sin dejar espacio,
    // y un elemento oculto seguiría existiendo en el árbol.
    expect(wrapper.find('[data-testid="carga-inicial-aplicacion"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="estado-inicial"]').exists()).toBe(false)
  })

  it('vuelve a mostrarla si una reconexión no conserva estado previo', async () => {
    const wrapper = mount(PantallaRecinto, {
      props: {
        estado: crearEstadoRecintoPrueba(),
        estadoConexion: 'CONECTADO',
        desactualizado: false,
      },
    })
    montados.push(wrapper)
    expect(wrapper.find('[data-testid="carga-inicial-aplicacion"]').exists()).toBe(false)

    await wrapper.setProps({ estado: null, estadoConexion: 'RECONECTANDO' })

    expect(wrapper.find('[data-testid="carga-inicial-aplicacion"]').exists()).toBe(true)
  })
})
