/**
 * El manual de usuario servido por el stack real (WP-067).
 *
 * El E2E de componentes comprueba el acceso dentro de cada cabecera, pero no puede abrir
 * el manual: allí cada aplicación tiene su propio servidor de desarrollo y `/manual/` es
 * una ruta del origen unificado. Acá sí, porque el stack integrado publica exactamente la
 * misma superficie que Nginx sirve en producción.
 *
 * Lo que se demuestra:
 *
 * 1. `/manual/` responde con el documento versionado bajo el mismo origen que la API;
 * 2. el icono de ayuda de Moderación abre ese documento en una pestaña nueva, sin
 *    reemplazar la pantalla operativa;
 * 3. el manual está completo: tiene sus trece capítulos y su índice llega a todos;
 * 4. navegar por el índice funciona de verdad, no sólo como texto;
 * 5. no pide ni un solo recurso a otro origen, que es la condición para que se lea igual
 *    en una instalación sin salida a Internet.
 */

import { expect, test } from '@playwright/test'
import { ProcesoStackIntegrado, URL_STACK, puertoOcupado } from './infraestructura'

/** Identificadores de los trece capítulos obligatorios, en su orden canónico. */
const CAPITULOS = [
  'cap-01-vision-general',
  'cap-02-preparacion',
  'cap-03-sesion-autoridades',
  'cap-04-presencia-quorum',
  'cap-05-orden-del-dia',
  'cap-06-votaciones',
  'cap-07-palabra',
  'cap-08-apoyo-tecnico',
  'cap-09-sonidos',
  'cap-10-configuracion',
  'cap-11-instalacion',
  'cap-12-operacion',
  'cap-13-navegador',
] as const

const ESPERA_MONTAJE = 25_000

test.describe.serial('WP-067 · Manual de usuario sobre el stack real', () => {
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

  test('el mismo origen publica el manual completo y autocontenido', async () => {
    const respuesta = await fetch(`${URL_STACK}/manual/`)
    expect(respuesta.ok).toBe(true)
    expect(respuesta.headers.get('content-type')).toContain('text/html')

    const html = await respuesta.text()
    for (const capitulo of CAPITULOS) {
      expect(html, `falta el capítulo ${capitulo}`).toContain(`id="${capitulo}"`)
      expect(html, `el índice no enlaza ${capitulo}`).toContain(`href="#${capitulo}"`)
    }

    // Un único documento: sin hoja de estilos aparte, sin scripts y sin nada remoto.
    expect(html).not.toContain('<link')
    expect(html).not.toContain('<script')
    expect(html).not.toMatch(/(?:src|href)="(?:https?:)?\/\//)
  })

  test('el icono de ayuda de Moderación abre el manual en otra pestaña', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto(`${URL_STACK}/moderacion/`)

    const acceso = page.getByTestId('acceso-manual')
    await expect(acceso).toBeVisible({ timeout: ESPERA_MONTAJE })

    const peticionesExternas: string[] = []
    const [manual] = await Promise.all([context.waitForEvent('page'), acceso.click()])
    manual.on('request', (peticion) => {
      if (!peticion.url().startsWith(URL_STACK)) peticionesExternas.push(peticion.url())
    })
    await manual.waitForLoadState('domcontentloaded')

    expect(manual.url()).toBe(`${URL_STACK}/manual/`)
    // La pantalla operativa no se movió: sigue montada y en su propia URL.
    expect(page.url()).toBe(`${URL_STACK}/moderacion/`)
    await expect(page.getByTestId('cabecera-moderacion')).toBeVisible()

    // El documento se identifica como SISLeg y presenta sus trece capítulos.
    await expect(manual).toHaveTitle(/SISLeg/)
    for (const capitulo of CAPITULOS) {
      await expect(manual.locator(`#${capitulo}`)).toHaveCount(1)
    }

    // Navegar por el índice lleva de verdad al capítulo, no sólo cambia el texto de la URL.
    await manual.locator(`a[href="#${CAPITULOS[9]}"]`).first().click()
    await expect(manual.locator(`#${CAPITULOS[9]}`)).toBeInViewport()

    expect(peticionesExternas).toEqual([])
    await manual.close()
  })

  test('el mismo acceso existe en Apoyo Técnico y apunta al mismo documento', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto(`${URL_STACK}/tecnico/`)

    const acceso = page.getByTestId('acceso-manual')
    await expect(acceso).toBeVisible({ timeout: ESPERA_MONTAJE })
    await expect(acceso).toHaveAttribute('href', '/manual/')
    await expect(acceso).toHaveAttribute('target', '_blank')
  })
})
