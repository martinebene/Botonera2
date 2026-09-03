/**
 * Indicador de carga inicial sobre el artefacto estático real (WP-061).
 *
 * El E2E de componentes ya prueba las cuatro superficies contra sus servidores de
 * desarrollo. Falta la evidencia que de verdad importa en producción: que el
 * **`index.html` generado** —el archivo que Nginx servirá tal cual, sin proceso Node
 * detrás— traiga incrustado el indicador, y que ese HTML lo sirva el mismo origen que la
 * API. Es exactamente la ventana del defecto: el navegador ya tiene el documento y
 * todavía no ejecutó ni una línea del bundle de Vue.
 *
 * Por eso esta prueba mira dos cosas complementarias:
 *
 * 1. el HTML crudo descargado con `fetch`, sin navegador de por medio, que es lo que
 *    llegaría a una pantalla del Recinto en una LAN lenta;
 * 2. la misma ruta abierta en el navegador con los scripts retenidos, para comprobar que
 *    ese HTML se pinta con fondo institucional y barra, y que al montar la aplicación el
 *    indicador se retira por completo.
 *
 * El stack lo levanta la propia prueba con `pnpm test:e2e:integrado`, que construye antes
 * las cuatro SPA: lo que se inspecciona es el resultado de ese build, no un servidor de
 * desarrollo.
 */

import { expect, test, type Page, type Route } from '@playwright/test'
import { ProcesoStackIntegrado, URL_STACK, puertoOcupado } from './infraestructura'

/** Rutas públicas de las cuatro superficies bajo el contrato de mismo origen. */
const SUPERFICIES = [
  { nombre: 'Moderación', ruta: '/moderacion/' },
  { nombre: 'Recinto', ruta: '/recinto/' },
  { nombre: 'Simulador', ruta: '/simulador/' },
  { nombre: 'Apoyo Técnico', ruta: '/tecnico/' },
] as const

/** Azul profundo institucional declarado por `carga_inicial.html`, en sus dos notaciones. */
const FONDO_INSTITUCIONAL = 'rgb(7, 17, 31)'
const FONDO_INSTITUCIONAL_HEXADECIMAL = '#07111f'

const DEMORA_SCRIPTS_MS = 2_000

function esperar(milisegundos: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, milisegundos))
}

/**
 * Retiene los scripts hasta un instante límite común y deja pasar el resto.
 *
 * Misma técnica que en el E2E de componentes: un límite absoluto reproduce "el bundle
 * todavía no llegó" sin multiplicar la espera por cada módulo descubierto en cascada.
 */
async function demorarScripts(page: Page, milisegundos: number): Promise<void> {
  const limite = Date.now() + milisegundos
  await page.route('**/*', async (ruta: Route) => {
    if (ruta.request().resourceType() === 'script') {
      const restante = limite - Date.now()
      if (restante > 0) await esperar(restante)
    }
    await ruta.continue()
  })
}

test.describe.serial('WP-061 · Indicador de carga inicial sobre el build estático', () => {
  const stack = new ProcesoStackIntegrado()

  test.beforeAll(async () => {
    await stack.iniciar()
  })

  test.afterAll(async () => {
    await stack.detener()
    expect(await puertoOcupado()).toBe(false)
  })

  test.afterEach(async ({}, informacion) => {
    if (informacion.status !== informacion.expectedStatus) {
      await informacion.attach('stdout-stderr-stack.txt', {
        body: stack.obtenerSalida(),
        contentType: 'text/plain',
      })
    }
  })

  test('el HTML generado de las cuatro SPA ya trae el indicador incrustado', async () => {
    for (const superficie of SUPERFICIES) {
      const respuesta = await fetch(`${URL_STACK}${superficie.ruta}`)
      expect(respuesta.ok, `${superficie.nombre} debe servirse desde el mismo origen`).toBe(true)
      const html = await respuesta.text()

      // El contenedor de la aplicación llega vacío: sin el indicador, esto es literalmente
      // un viewport en blanco hasta que se evalúa el bundle.
      expect(html).toContain('<div id="__nuxt"></div>')

      // Y el indicador viaja en el mismo documento, con sus estilos en línea: no depende
      // de JavaScript ni de la hoja de estilos de la aplicación para poder pintarse.
      expect(html).toContain('id="__nuxt-loader"')
      expect(html).toContain('data-testid="carga-inicial-previa"')
      expect(html).toContain('carga-inicial__avance')
      expect(html).toContain(FONDO_INSTITUCIONAL_HEXADECIMAL)
    }
  })

  for (const superficie of SUPERFICIES) {
    test(`${superficie.nombre} pinta el indicador y lo retira al quedar operativa`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1366, height: 768 })
      await demorarScripts(page, DEMORA_SCRIPTS_MS)
      await page.goto(`${URL_STACK}${superficie.ruta}`, { waitUntil: 'commit' })

      const indicador = page.getByTestId('carga-inicial-previa')
      await expect(indicador).toBeVisible()
      const fondo = await page.evaluate(() => {
        const elemento = document.querySelector('[data-testid="carga-inicial-previa"]')
        return elemento === null ? 'sin elemento' : getComputedStyle(elemento).backgroundColor
      })
      expect(fondo).toBe(FONDO_INSTITUCIONAL)

      // Con el backend real respondiendo, la aplicación termina de montar y de recibir su
      // primer snapshot: los dos indicadores deben quedar fuera del árbol.
      await expect(indicador).toHaveCount(0, { timeout: 20_000 })
      await expect(page.getByTestId('carga-inicial-aplicacion')).toHaveCount(0, {
        timeout: 20_000,
      })

      const medidas = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(medidas.scrollHeight).toBeLessThanOrEqual(medidas.clientHeight + 1)
      expect(medidas.scrollWidth).toBeLessThanOrEqual(medidas.clientWidth + 1)
    })
  }
})
