/**
 * Presentación del factor de mayoría especial en la Pantalla del Recinto (WP-063).
 *
 * El Recinto sólo lee el DTO público: no valida el factor ni lo recalcula. La única
 * superficie donde ese número aparece es el resumen de la votación, y debe escribirse con
 * exactamente dos decimales truncados, igual que en Moderación.
 *
 * El DTO recibido conserva su precisión completa: estas pruebas comprueban el texto
 * renderizado, no el dato, para dejar explícito que WP-063 es un cambio de presentación.
 */

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PanelVotacionPublica from '../app/components/PanelVotacionPublica.vue'
import { crearVotacionPublicaPrueba } from './datos_prueba'

const montados: VueWrapper[] = []

function montarPanel(factor: number): VueWrapper {
  const wrapper = mount(PanelVotacionPublica, {
    props: {
      votacion: crearVotacionPublicaPrueba({
        tipo_mayoria: 'ESPECIAL',
        factor,
        base: 'PRESENTES',
      }),
    },
  })
  montados.push(wrapper)
  return wrapper
}

afterEach(() => {
  while (montados.length > 0) montados.pop()?.unmount()
})

describe('WP-063 · factor con dos decimales truncados en el Recinto', () => {
  it('trunca los decimales sobrantes del factor en el resumen de la votación', () => {
    const resumen = montarPanel(0.6789).get('[data-testid="resumen-votacion"]')
    expect(resumen.text()).toContain('factor 0.67')
    expect(resumen.text()).not.toContain('0.6789')
  })

  it('no redondea hacia el centésimo siguiente', () => {
    const resumen = montarPanel(0.6799).get('[data-testid="resumen-votacion"]')
    expect(resumen.text()).toContain('factor 0.67')
    expect(resumen.text()).not.toContain('0.68')
  })

  it('completa siempre dos decimales aunque el factor no los tenga', () => {
    expect(montarPanel(0.6).get('[data-testid="resumen-votacion"]').text()).toContain('factor 0.60')
    expect(montarPanel(1).get('[data-testid="resumen-votacion"]').text()).toContain('factor 1.00')
  })

  it('conserva intacto el factor real del DTO público recibido', () => {
    // El panel muestra `0.67`, pero la votación que le llegó sigue teniendo `0.6789`. Si el
    // componente reemplazara el dato por su texto, esta comprobación fallaría.
    const wrapper = montarPanel(0.6789)
    expect(wrapper.props('votacion')).toMatchObject({ factor: 0.6789 })
  })
})
