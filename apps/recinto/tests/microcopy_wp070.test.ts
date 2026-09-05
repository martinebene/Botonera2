/**
 * WP-070 — Aviso corto de vista desactualizada en la cabecera del Recinto.
 *
 * Cuando el Recinto pierde la conexión, el composable de sincronización marca el snapshot
 * como `desactualizado` y la cabecera lo avisa. Hasta WP-070 ese aviso decía "Reconectando
 * · vista desactualizada": era el texto más largo del sector derecho, competía por ancho
 * con las autoridades y describía el diagnóstico técnico en vez del hecho relevante para
 * quien mira la proyección.
 *
 * HUMAN_GATE fijó el reemplazo literal "(Sin conexion)" —con paréntesis y sin tilde— y
 * prohibió corregirle la ortografía sin una decisión nueva. Por eso las comparaciones son
 * exactas: `toContain('Sin conexion')` dejaría pasar tanto la versión acentuada como una
 * que perdiera los paréntesis.
 *
 * Lo que este archivo NO prueba es la geometría: jsdom no calcula layout. Que la cabecera
 * siga en un solo renglón se mide en Playwright.
 */

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import CabeceraRecinto from '../app/components/CabeceraRecinto.vue'
import type { EstadoConexionRecinto } from '../app/composables/useEstadoRecinto'
import { crearEstadoRecintoPrueba } from './datos_prueba'

/** Texto exacto cerrado por HUMAN_GATE para la vista desactualizada. */
const TEXTO_DESACTUALIZADO = '(Sin conexion)'

const montados: VueWrapper[] = []

afterEach(() => {
  while (montados.length > 0) montados.pop()?.unmount()
})

function montarCabecera(
  estadoConexion: EstadoConexionRecinto,
  desactualizado: boolean,
): VueWrapper {
  const wrapper = mount(CabeceraRecinto, {
    props: { estado: crearEstadoRecintoPrueba(), estadoConexion, desactualizado },
  })
  montados.push(wrapper)
  return wrapper
}

function textoConexion(wrapper: VueWrapper): string {
  return wrapper.get('[data-testid="estado-conexion"]').text().trim()
}

describe('WP-070 · aviso de vista desactualizada', () => {
  it('muestra exactamente el texto aprobado cuando el snapshot quedó viejo', () => {
    expect(textoConexion(montarCabecera('RECONECTANDO', true))).toBe(TEXTO_DESACTUALIZADO)
  })

  it('mantiene ese texto cualquiera sea el estado de conexión subyacente', () => {
    // `desactualizado` tiene prioridad sobre el estado del transporte: una vista vieja es
    // peor noticia para el recinto que un socket intentando reconectar.
    for (const estado of ['INICIAL', 'CONECTADO', 'RECONECTANDO', 'DESCONECTADO'] as const) {
      expect(textoConexion(montarCabecera(estado, true))).toBe(TEXTO_DESACTUALIZADO)
    }
  })

  it('no altera los textos de conexión vigentes cuando la vista está al día', () => {
    // Criterio de aceptación 8: fuera del caso desactualizado la cabecera no cambia.
    expect(textoConexion(montarCabecera('CONECTADO', false))).toBe('En línea')
    expect(textoConexion(montarCabecera('RECONECTANDO', false))).toBe('Reconectando')
    expect(textoConexion(montarCabecera('DESCONECTADO', false))).toBe('Sin conexión')
    expect(textoConexion(montarCabecera('INICIAL', false))).toBe('Conectando')
  })

  it('ya no muestra la redacción larga anterior', () => {
    expect(textoConexion(montarCabecera('RECONECTANDO', true))).not.toContain('desactualizada')
  })
})
