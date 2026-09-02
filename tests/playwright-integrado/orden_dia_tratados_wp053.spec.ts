/**
 * WP-053 · seguimiento asistencial de temas tratados sobre el stack real.
 *
 * Recorre con un único FastAPI, el simulador de dispositivos versionado y la SPA
 * construida de Moderación el camino exacto que hará el operador:
 *
 * 1. carga un Orden del Día donde el número 71 aparece dos veces;
 * 2. comprueba que, antes de abrir nada, ningún punto está atenuado;
 * 3. abre la votación Nº 71 y verifica que **las dos** filas Nº 71 quedan
 *    atenuadas mientras la Nº 72 conserva su estilo normal;
 * 4. vuelve a hacer click en una fila atenuada y confirma que sigue precargando
 *    el formulario de Q1 con normalidad, porque la marca no consume el punto;
 * 5. recarga la SPA y comprueba que la ayuda se reconstruye desde el backend,
 *    sin ninguna persistencia en el navegador.
 *
 * La prueba consulta además el snapshot REST: la marca tiene que venir resuelta
 * desde el backend, no derivada por la interfaz.
 */

import { resolve } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { ProcesoStackIntegrado, URL_STACK, puertoOcupado, pulsarSecuencia } from './infraestructura'

const RUTA_ORDEN_DIA_REPETIDO = resolve(__dirname, 'fixtures/orden-del-dia-repetido.csv')

/** Puntos del cuadrante 2, en el mismo orden en que los proyecta el backend. */
function puntosOrdenDelDia(page: Page): Locator {
  return page.getByTestId('punto-orden-dia')
}

/** Lee la marca declarada por cada tarjeta, que es lo que dispara la atenuación. */
async function marcasVisibles(page: Page): Promise<(string | null)[]> {
  return puntosOrdenDelDia(page).evaluateAll((tarjetas) =>
    tarjetas.map((tarjeta) => tarjeta.getAttribute('data-tratado')),
  )
}

/** Comprueba la atenuación por el estilo realmente computado en el navegador. */
async function opacidadDe(tarjeta: Locator): Promise<number> {
  return tarjeta.evaluate((nodo) => Number(getComputedStyle(nodo).opacity))
}

/** Marca que viaja en el snapshot autoritativo para cada punto proyectado. */
async function marcasEnSnapshot(page: Page): Promise<boolean[]> {
  const respuesta = await page.request.get(`${URL_STACK}/api/v1/estado/moderacion`)
  expect(respuesta.ok()).toBe(true)
  const estado = (await respuesta.json()) as { orden_del_dia: { tratado: boolean }[] }
  return estado.orden_del_dia.map((punto) => punto.tratado)
}

test.describe.serial('WP-053 · números tratados del Orden del Día sobre stack real', () => {
  const stack = new ProcesoStackIntegrado()

  test.beforeAll(async () => stack.iniciar())
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

  test('atenúa todas las filas del número abierto y las conserva tras recargar', async ({
    page,
  }) => {
    await page.goto(`${URL_STACK}/moderacion/`)
    await page.getByTestId('btn-preparar-sala').click()
    await page.getByTestId('vista-preparando').waitFor()

    // El Orden del Día es asistencial y puede cargarse ya durante PREPARANDO.
    await page.getByTestId('input-archivo-orden-dia').setInputFiles(RUTA_ORDEN_DIA_REPETIDO)
    await page.getByTestId('btn-cargar-orden-dia').click()
    await expect(puntosOrdenDelDia(page)).toHaveCount(3)
    expect(await marcasVisibles(page)).toEqual(['false', 'false', 'false'])
    expect(await marcasEnSnapshot(page)).toEqual([false, false, false])

    await pulsarSecuencia(['1-9', '2-9', '3-9', '4-9', '5-9', '6-9', '7-9'])
    await page.getByTestId('input-numero-sesion').fill('53')
    await page.getByTestId('input-presidencia').fill('Presidencia E2E WP-053')
    await page.getByTestId('input-secretaria').fill('Secretaría E2E WP-053')
    await page.getByTestId('btn-guardar-preparacion').click()
    await page.getByTestId('btn-abrir-sesion').click()
    await page.getByTestId('vista-sesion-abierta').waitFor()

    // Abrir la sesión tampoco trata ningún número por sí solo.
    expect(await marcasVisibles(page)).toEqual(['false', 'false', 'false'])

    // --- Precarga desde el primer punto Nº 71 y apertura real ---------------
    await puntosOrdenDelDia(page).first().click()
    await expect(page.getByTestId('input-numero-votacion')).toHaveValue('71')
    await expect(page.getByTestId('input-tema-votacion')).toHaveValue(
      'Primera lectura del numero repetido',
    )
    await page.getByTestId('btn-abrir-votacion').click()
    await expect(page.getByTestId('estado-votacion')).toHaveText('EN_CURSO')

    // --- La ayuda cubre las dos filas Nº 71, sin finalizar la votación ------
    await expect.poll(async () => marcasVisibles(page)).toEqual(['true', 'false', 'true'])
    expect(await marcasEnSnapshot(page)).toEqual([true, false, true])
    expect(await opacidadDe(puntosOrdenDelDia(page).nth(0))).toBeLessThan(1)
    expect(await opacidadDe(puntosOrdenDelDia(page).nth(2))).toBeLessThan(1)
    expect(await opacidadDe(puntosOrdenDelDia(page).nth(1))).toBe(1)

    // --- Cerrar la votación no revierte la ayuda ----------------------------
    // Votan las siete bancas presentes, así que la recepción cierra sola por
    // completitud. El número 71 siguió siendo tratado.
    await pulsarSecuencia(['1-1', '2-1', '3-1', '4-1', '5-1', '6-1', '7-1'])
    // El badge pasa a mostrar el resultado en cuanto la votación queda cerrada.
    await expect(page.getByTestId('estado-votacion')).toHaveText('APROBADA')
    expect(await marcasVisibles(page)).toEqual(['true', 'false', 'true'])

    // --- Atenuado no es bloqueado: la segunda fila Nº 71 sigue precargando --
    await puntosOrdenDelDia(page).nth(2).click()
    await expect(page.getByTestId('toast-punto-copiado')).toContainText('Punto Nº 71')
    await expect(page.getByTestId('input-numero-votacion')).toHaveValue('71')
    await expect(page.getByTestId('input-tema-votacion')).toHaveValue(
      'Segunda lectura del numero repetido',
    )
    // El punto no desapareció ni cambió de marca por haber sido copiado.
    expect(await marcasVisibles(page)).toEqual(['true', 'false', 'true'])

    // --- Reload: la ayuda se reconstruye desde el backend -------------------
    await page.reload()
    await page.getByTestId('vista-sesion-abierta').waitFor()
    await expect(puntosOrdenDelDia(page)).toHaveCount(3)
    await expect.poll(async () => marcasVisibles(page)).toEqual(['true', 'false', 'true'])
    expect(await opacidadDe(puntosOrdenDelDia(page).nth(0))).toBeLessThan(1)
  })
})
