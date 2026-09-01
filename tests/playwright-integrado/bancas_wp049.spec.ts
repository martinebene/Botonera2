/**
 * WP-049 · prueba real de Q3/Recinto contra un único FastAPI y SSE.
 *
 * Reproduce el diagnóstico humano sobre el stack construido, observa ambas
 * superficies al mismo tiempo y recorre participación, cierre y expiración.
 * También mide tarjetas y centros reales a las dos resoluciones obligatorias.
 */

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { ProcesoStackIntegrado, URL_STACK, puertoOcupado, pulsarSecuencia } from './infraestructura'

const RESOLUCIONES = [
  { nombre: '1366×768', width: 1366, height: 768 },
  { nombre: '1920×1080', width: 1920, height: 1080 },
] as const

interface Superficie {
  contexto: BrowserContext
  moderacion: Page
  recinto: Page
  nombre: string
}

/** Comprueba dimensiones uniformes con tolerancia de redondeo subpíxel. */
async function verificarTarjetasUniformes(tarjetas: Locator): Promise<void> {
  const cajas = await tarjetas.evaluateAll((elementos) =>
    elementos.map((elemento) => {
      const caja = elemento.getBoundingClientRect()
      return { width: caja.width, height: caja.height }
    }),
  )
  expect(cajas).toHaveLength(12)
  const referencia = cajas[0]!
  for (const caja of cajas) {
    expect(Math.abs(caja.width - referencia.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(caja.height - referencia.height)).toBeLessThanOrEqual(1)
  }
}

/** Verifica el centro del conjunto de tarjetas, no solo una clase CSS. */
async function verificarFilasCentradas(page: Page): Promise<void> {
  const filas = page.locator('[data-fila-fisica]')
  await expect(filas).toHaveCount(3)
  for (let indice = 0; indice < (await filas.count()); indice += 1) {
    const diferencia = await filas.nth(indice).evaluate((fila) => {
      const cajaFila = fila.getBoundingClientRect()
      const bancas = Array.from(fila.querySelectorAll<HTMLElement>(':scope > [data-banca]'))
      const cajas = bancas.map((banca) => banca.getBoundingClientRect())
      const izquierda = Math.min(...cajas.map((caja) => caja.left))
      const derecha = Math.max(...cajas.map((caja) => caja.right))
      return Math.abs((izquierda + derecha) / 2 - (cajaFila.left + cajaFila.right) / 2)
    })
    expect(diferencia).toBeLessThanOrEqual(1)
  }
}

/** Asegura que el bitmap cargó y su contenido cabe por `contain`. */
async function verificarImagenCompleta(tarjeta: Locator): Promise<void> {
  const medidas = await tarjeta.locator('[data-testid="imagen-concejal"]').evaluate((nodo) => {
    const imagen = nodo as HTMLImageElement
    const area = imagen.parentElement!.getBoundingClientRect()
    const escala = Math.min(area.width / imagen.naturalWidth, area.height / imagen.naturalHeight)
    return {
      ajuste: getComputedStyle(imagen).objectFit,
      naturalWidth: imagen.naturalWidth,
      naturalHeight: imagen.naturalHeight,
      anchoPresentado: imagen.naturalWidth * escala,
      altoPresentado: imagen.naturalHeight * escala,
      anchoArea: area.width,
      altoArea: area.height,
    }
  })
  expect(medidas.ajuste).toBe('contain')
  expect(medidas.naturalWidth).toBeGreaterThan(0)
  expect(medidas.naturalHeight).toBeGreaterThan(0)
  expect(medidas.anchoPresentado).toBeLessThanOrEqual(medidas.anchoArea + 0.5)
  expect(medidas.altoPresentado).toBeLessThanOrEqual(medidas.altoArea + 0.5)
}

async function verificarSinScroll(page: Page, selectorGrilla?: string): Promise<void> {
  const desborde = await page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - innerHeight,
    horizontal: document.documentElement.scrollWidth - innerWidth,
  }))
  expect(desborde.vertical).toBeLessThanOrEqual(1)
  expect(desborde.horizontal).toBeLessThanOrEqual(1)
  if (selectorGrilla) {
    const propio = await page
      .locator(selectorGrilla)
      .evaluate((elemento) => elemento.scrollHeight - elemento.clientHeight)
    expect(propio).toBeLessThanOrEqual(1)
  }
}

test.describe.serial('WP-049 · bancas canónicas sobre stack real', () => {
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

  test('sincroniza voto parcial, resultado, deadline y geometría a 1366/1920', async ({
    browser,
  }) => {
    const superficies: Superficie[] = []
    try {
      for (const resolucion of RESOLUCIONES) {
        const contexto = await browser.newContext({ viewport: resolucion })
        const moderacion = await contexto.newPage()
        const recinto = await contexto.newPage()
        await Promise.all([
          moderacion.goto(`${URL_STACK}/moderacion/`),
          recinto.goto(`${URL_STACK}/recinto/`),
        ])
        superficies.push({ contexto, moderacion, recinto, nombre: resolucion.nombre })
      }

      const operador = superficies[1]!.moderacion
      await operador.getByTestId('btn-preparar-sala').click()
      await operador.getByTestId('vista-preparando').waitFor()
      await pulsarSecuencia(['1-9', '2-9', '3-9', '4-9', '5-9', '6-9', '7-9'])
      await operador.getByTestId('input-numero-sesion').fill('49')
      await operador.getByTestId('input-presidencia').fill('Presidencia E2E WP-049')
      await operador.getByTestId('input-secretaria').fill('Secretaría E2E WP-049')
      await operador.getByTestId('btn-guardar-preparacion').click()
      await operador.getByTestId('btn-abrir-sesion').click()
      await operador.getByTestId('vista-sesion-abierta').waitFor()
      await operador.getByTestId('input-numero-votacion').fill('1')
      await operador.getByTestId('select-tipo-votacion').selectOption({ label: 'Otro' })
      await operador.getByTestId('input-tema-votacion').fill('Diagnóstico integrado WP-049')
      await operador.getByTestId('btn-abrir-votacion').click()
      await expect(operador.getByTestId('estado-votacion')).toHaveText('EN_CURSO')

      await pulsarSecuencia(['1-1', '2-3', '3-2'])
      for (const superficie of superficies) {
        for (const page of [superficie.moderacion, superficie.recinto]) {
          for (const banca of [1, 2, 3]) {
            const tarjeta = page.locator(`[data-banca="${banca}"]`)
            await expect(tarjeta).toHaveAttribute('data-estado-banca', 'VOTO_EMITIDO')
            await expect(tarjeta.locator('[data-testid="etiqueta-banca"]')).toHaveText(
              'Voto emitido',
            )
            const html = await tarjeta.evaluate((elemento) => elemento.outerHTML)
            expect(html).not.toMatch(/POSITIVO|NEGATIVO|ABSTENCION/)
          }
        }

        await verificarTarjetasUniformes(
          superficie.moderacion.locator('[data-testid="banca-concejal"]'),
        )
        await verificarTarjetasUniformes(
          superficie.recinto.locator('[data-testid="banca-publica"]'),
        )
        await verificarFilasCentradas(superficie.moderacion)
        await verificarFilasCentradas(superficie.recinto)
        await verificarImagenCompleta(superficie.moderacion.locator('[data-banca="1"]'))
        await verificarImagenCompleta(superficie.recinto.locator('[data-banca="1"]'))
        await verificarSinScroll(superficie.moderacion, '[data-testid="grilla-recinto"]')
        await verificarSinScroll(superficie.recinto)
      }

      const [estadoModeracion, estadoRecinto] = await Promise.all([
        operador.request.get(`${URL_STACK}/api/v1/estado/moderacion`).then((r) => r.json()),
        operador.request.get(`${URL_STACK}/api/v1/estado/recinto`).then((r) => r.json()),
      ])
      expect(estadoModeracion.votacion.bancas_voto_emitido).toEqual([1, 2, 3])
      expect(estadoRecinto.votacion.bancas_voto_emitido).toEqual([1, 2, 3])
      expect(estadoRecinto.votacion.votos_individuales).toBeNull()

      await pulsarSecuencia(['4-1', '5-1', '6-1', '7-1'])
      for (const superficie of superficies) {
        await expect(superficie.moderacion.getByTestId('estado-votacion')).toHaveText('APROBADA')
        await expect(superficie.recinto.getByTestId('estado-votacion')).toHaveText('Aprobada')
        for (const page of [superficie.moderacion, superficie.recinto]) {
          await expect(page.locator('[data-banca="1"]')).toHaveAttribute(
            'data-estado-banca',
            'RESULTADO_POSITIVO',
            { timeout: 8_000 },
          )
        }
      }

      const [cerradaModeracion, cerradaRecinto] = await Promise.all([
        operador.request.get(`${URL_STACK}/api/v1/estado/moderacion`).then((r) => r.json()),
        operador.request.get(`${URL_STACK}/api/v1/estado/recinto`).then((r) => r.json()),
      ])
      expect(cerradaModeracion.votacion.resultado_visible_hasta).toBe(
        cerradaRecinto.votacion.resultado_visible_hasta,
      )

      for (const superficie of superficies) {
        await expect(superficie.recinto.getByTestId('estado-votacion')).toHaveText('Sin votación', {
          timeout: 9_000,
        })
        await expect(superficie.moderacion.locator('[data-banca="1"]')).toHaveAttribute(
          'data-estado-banca',
          'NORMAL',
          { timeout: 1_000 },
        )
        // Q1 conserva el resultado institucional: solo expiró la presentación Q3.
        await expect(superficie.moderacion.getByTestId('estado-votacion')).toHaveText('APROBADA')
        await verificarTarjetasUniformes(
          superficie.moderacion.locator('[data-testid="banca-concejal"]'),
        )
        await verificarTarjetasUniformes(
          superficie.recinto.locator('[data-testid="banca-publica"]'),
        )
      }
    } finally {
      await Promise.all(superficies.map((superficie) => superficie.contexto.close()))
    }
  })
})
