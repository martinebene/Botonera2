/**
 * Pruebas del acceso compartido al manual de usuario (WP-067).
 *
 * Este componente es la única fuente del icono de ayuda que muestran las cabeceras de
 * Moderación y de Apoyo Técnico, así que acá se fija su contrato: a dónde apunta, cómo se
 * abre y qué anuncia a un lector de pantalla. Las pruebas de cada cabecera comprueban
 * después que ese acceso esté presente y en el extremo derecho, y las de Playwright miden
 * la geometría real, que un DOM sin layout no puede evaluar.
 */

import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import AccesoManual from '../src/componentes/AccesoManual.vue'
import { ROTULO_ACCESO_MANUAL, RUTA_MANUAL } from '../src/manual'

async function renderizar(props: Record<string, unknown> = {}): Promise<string> {
  return renderToString(createSSRApp(AccesoManual, props))
}

describe('Acceso al manual de usuario (WP-067)', () => {
  it('publica una ruta absoluta y de mismo origen', () => {
    // Absoluta porque cada aplicación se sirve bajo su propio prefijo: una ruta relativa
    // buscaría el manual dentro de `/moderacion/` o de `/tecnico/`, donde no existe.
    expect(RUTA_MANUAL).toBe('/manual/')
    expect(RUTA_MANUAL.startsWith('/')).toBe(true)
    expect(RUTA_MANUAL).not.toMatch(/^https?:/)
  })

  it('enlaza al manual y lo abre en una pestaña nueva protegida', async () => {
    const html = await renderizar()

    expect(html).toContain(`href="${RUTA_MANUAL}"`)
    expect(html).toContain('target="_blank"')
    // `noopener` impide que el documento abierto manipule la pantalla operativa;
    // `noreferrer` evita filtrar la URL de origen.
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('es un enlace real y no un botón con JavaScript', async () => {
    const html = await renderizar()

    expect(html).toContain('<a ')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('onclick')
  })

  it('ofrece texto accesible que advierte la apertura en otra pestaña', async () => {
    const html = await renderizar()

    expect(ROTULO_ACCESO_MANUAL).toMatch(/pestaña nueva/i)
    expect(html).toContain(`aria-label="${ROTULO_ACCESO_MANUAL}"`)
    expect(html).toContain(`title="${ROTULO_ACCESO_MANUAL}"`)
    // El signo visible es decorativo: si un lector de pantalla lo leyera, diría
    // «interrogación» además del rótulo.
    expect(html).toContain('aria-hidden="true"')
  })

  it('expone un identificador estable y permite personalizarlo', async () => {
    expect(await renderizar()).toContain('data-testid="acceso-manual"')
    expect(await renderizar({ dataTestid: 'ayuda-otra-pantalla' })).toContain(
      'data-testid="ayuda-otra-pantalla"',
    )
  })

  it('no se encoge cuando la cabecera queda sin ancho sobrante', async () => {
    // La cabecera debe recortar los textos de longitud imprevisible, nunca este acceso.
    expect(await renderizar()).toContain('shrink-0')
  })
})
