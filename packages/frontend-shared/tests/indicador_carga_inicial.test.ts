/**
 * Pruebas del indicador de carga inicial compartido (WP-061).
 *
 * Lo que se puede afirmar sobre el DOM es la **semántica** del componente: que se anuncia
 * como estado en curso para los lectores de pantalla, que no declara ningún porcentaje
 * —la decisión humana del WP fue una barra indeterminada— y que expone identificadores
 * estables para las pruebas de geometría.
 *
 * La parte que depende del layout real —que cubra el ancho del viewport, que no ocupe
 * espacio en el flujo y que desaparezca sin dejar hueco— se mide con Playwright en
 * `tests/playwright/carga_inicial_wp061.spec.ts`, porque el DOM liviano de Vitest no
 * calcula cajas y cualquier afirmación sobre píxeles sería falsa.
 */

import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import IndicadorCargaInicial from '../src/componentes/IndicadorCargaInicial.vue'

async function renderizar(props: Record<string, unknown> = {}): Promise<string> {
  return renderToString(createSSRApp(IndicadorCargaInicial, props))
}

describe('Indicador de carga inicial compartido', () => {
  it('se anuncia como estado en curso y expone su identificador por defecto', async () => {
    const html = await renderizar()

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-label="Esperando el primer estado del sistema"')
    expect(html).toContain('data-testid="carga-inicial-aplicacion"')
  })

  it('no declara ningún avance: la barra es indeterminada', async () => {
    const html = await renderizar()

    // Un progreso determinado se anunciaría con estos atributos. Su ausencia es la
    // comprobación de que no se inventó un porcentaje, que es lo que cerró el WP.
    expect(html).not.toContain('aria-valuenow')
    expect(html).not.toContain('aria-valuemax')
    expect(html).not.toContain('role="progressbar"')
    expect(html).not.toContain('%')
  })

  it('permite ajustar el rótulo accesible y el identificador de prueba', async () => {
    const html = await renderizar({
      rotulo: 'Cargando el puesto técnico',
      dataTestid: 'carga-tecnico',
    })

    expect(html).toContain('aria-label="Cargando el puesto técnico"')
    expect(html).toContain('data-testid="carga-tecnico"')
    expect(html).not.toContain('data-testid="carga-inicial-aplicacion"')
  })

  it('dibuja un único tramo de avance dentro del riel', async () => {
    const html = await renderizar()

    expect(html.match(/indicador-carga-inicial__avance/g)).toHaveLength(1)
  })
})
