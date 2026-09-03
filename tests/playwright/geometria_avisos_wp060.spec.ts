/**
 * Regresión geométrica de los avisos compartidos (WP-060).
 *
 * La prueba humana de WP-056 encontró avisos cuya última línea aparecía cortada contra el
 * borde inferior, o pegada a él, aunque el componente informara que el texto entraba
 * completo. La causa medida fue geométrica: el ajuste tipográfico comparaba el párrafo
 * contra `clientHeight` de la superficie, que **incluye el relleno interior**, mientras el
 * párrafo sólo puede dibujarse dentro de la caja de contenido. El texto recibía como
 * espacio escribible los dos rellenos —más de treinta píxeles en la franja del Recinto— y
 * el sobrante se recortaba en silencio.
 *
 * Estas pruebas fijan ese contrato con medidas reales del navegador, sobre las superficies
 * verdaderas de Moderación y del Recinto, en las dos resoluciones que exige el WP.
 *
 * ### Cómo se mide "el texto entra completo"
 *
 * No alcanza con `scrollHeight <= clientHeight`: las dos son enteros redondeados y pueden
 * diferir en un píxel por puro redondeo. La comprobación fuerte es otra: se clona el
 * párrafo dentro de la misma superficie, se le quita todo límite de alto y se le fija el
 * ancho útil real. Ese clon mide, con precisión decimal, cuánto ocuparía el texto íntegro.
 * Si esa altura entra en la caja de contenido, entonces no hay ninguna línea recortada.
 *
 * El mismo clon demuestra las otras dos reglas cerradas por HUMAN_GATE:
 *
 * - el cuerpo elegido es el máximo posible, porque con dos píxeles más ya no entraría;
 * - la elipsis sólo es legítima si el texto completo no entra ni con el cuerpo mínimo.
 */

import { expect, test, type Page } from '@playwright/test'

import {
  aviso,
  esperarSinScrollGlobal,
  estadoModeracion,
  estadoRecinto,
  instalarBackend,
  medirDocumento,
  RESOLUCIONES,
  URL_MODERACION,
  URL_RECINTO,
} from './soporte/apoyo_tecnico'

/** Cuerpo mínimo declarado por `AvisoSuperficie`; por debajo de él se recorta con `…`. */
const TAMANO_MINIMO = 14
/** Cuerpo máximo declarado por `AvisoSuperficie`; nunca se supera aunque sobre espacio. */
const TAMANO_MAXIMO = 128

/**
 * Tolerancia en píxeles para comparar magnitudes que el navegador redondea.
 *
 * Los rectángulos son decimales y `scrollHeight`/`clientHeight` son enteros: un píxel de
 * diferencia entre ambos mundos es redondeo, no recorte. El defecto que originó el WP se
 * medía en decenas de píxeles, así que esta tolerancia no puede ocultarlo.
 */
const TOLERANCIA = 1

/**
 * Espera máxima para que la aplicación monte y publique el aviso, en milisegundos.
 *
 * Las aplicaciones se sirven en modo desarrollo y transforman sus módulos bajo demanda, así
 * que en una máquina cargada el montaje puede tardar bastante más que una interacción
 * normal. Este margen sólo cubre ese arranque: ninguna comprobación geométrica lo usa, y
 * todas se evalúan sobre una única fotografía del layout ya estabilizado.
 */
const ESPERA_MONTAJE = 45_000

/** Textos exigidos por el WP: los cuatro que deben entrar completos y el que no entra. */
const TEXTO_CORTO = 'Aviso'
const TEXTO_CUARTO = 'Cuarto intermedio en curso'
const TEXTO_HUMANO = 'martin, se cayo internet, va a tardar un buen rato, que hacemos?'
const TEXTO_LARGO =
  'Comunicación institucional extensa para forzar la reducción del cuerpo tipográfico del aviso. '.repeat(
    4,
  )
const TEXTO_EXTREMO = 'Comunicación institucional extensa. '.repeat(120)

/** Superficies reales donde el aviso debe comportarse igual. */
const SUPERFICIES = [
  {
    nombre: 'Moderación',
    url: URL_MODERACION,
    testid: 'aviso-tecnico-moderacion',
    estados: (texto: string) => ({
      '/api/v1/estado/moderacion': estadoModeracion({ aviso: aviso(texto, 'MODERACION') }),
    }),
  },
  {
    nombre: 'Recinto',
    url: URL_RECINTO,
    testid: 'aviso-tecnico-recinto',
    estados: (texto: string) => ({
      '/api/v1/estado/recinto': estadoRecinto({ aviso: aviso(texto, 'RECINTO') }),
    }),
  },
] as const

/**
 * Compila por adelantado las dos aplicaciones servidas en modo desarrollo.
 *
 * Nuxt transforma los módulos bajo demanda: la primera visita a cada ruta puede tardar más
 * que el tiempo de espera de una aserción y provocar un fallo que no dice nada sobre la
 * geometría. Se paga ese costo una sola vez por proceso de pruebas.
 */
test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000)
  const pagina = await browser.newPage()
  for (const superficie of SUPERFICIES) {
    await pagina.goto(superficie.url).catch(() => undefined)
  }
  await pagina.close()
})

/**
 * Fotografía geométrica completa de un aviso ya renderizado.
 *
 * Todo se calcula dentro del navegador en una sola pasada para que las medidas describan
 * el mismo instante de layout.
 */
async function medirAviso(page: Page, testid: string) {
  return page.evaluate((id) => {
    const superficie = document.querySelector(`[data-testid="${id}"]`) as HTMLElement
    const parrafo = superficie.querySelector('[data-testid="texto-aviso"]') as HTMLElement
    const estiloSuperficie = getComputedStyle(superficie)
    const estiloParrafo = getComputedStyle(parrafo)
    const aPixeles = (valor: string): number => Number.parseFloat(valor) || 0

    const rectSuperficie = superficie.getBoundingClientRect()
    const rectParrafo = parrafo.getBoundingClientRect()

    const relleno = {
      superior: aPixeles(estiloSuperficie.paddingTop),
      derecho: aPixeles(estiloSuperficie.paddingRight),
      inferior: aPixeles(estiloSuperficie.paddingBottom),
      izquierdo: aPixeles(estiloSuperficie.paddingLeft),
    }
    const borde = {
      superior: aPixeles(estiloSuperficie.borderTopWidth),
      derecho: aPixeles(estiloSuperficie.borderRightWidth),
      inferior: aPixeles(estiloSuperficie.borderBottomWidth),
      izquierdo: aPixeles(estiloSuperficie.borderLeftWidth),
    }

    // Caja de contenido: el rectángulo donde el texto puede dibujarse de verdad.
    const contenido = {
      superior: rectSuperficie.top + borde.superior + relleno.superior,
      inferior: rectSuperficie.bottom - borde.inferior - relleno.inferior,
      izquierdo: rectSuperficie.left + borde.izquierdo + relleno.izquierdo,
      derecho: rectSuperficie.right - borde.derecho - relleno.derecho,
    }
    const anchoContenido = contenido.derecho - contenido.izquierdo
    const altoContenido = contenido.inferior - contenido.superior

    const tamano = aPixeles(estiloParrafo.fontSize)
    const interlineado = aPixeles(estiloParrafo.lineHeight) / tamano

    /**
     * Mide cuánto ocuparía el texto íntegro con un cuerpo dado, sin ningún límite de alto.
     *
     * El clon se cuelga de la propia superficie para heredar la misma tipografía, se
     * posiciona fuera de la vista y se descarta enseguida: no altera lo que se está
     * midiendo ni lo que el usuario ve.
     */
    function medirTextoLibre(tamanoPx: number) {
      const clon = parrafo.cloneNode(true) as HTMLElement
      clon.removeAttribute('data-testid')
      clon.style.cssText = ''
      clon.style.position = 'absolute'
      clon.style.left = '-10000px'
      clon.style.top = '0'
      clon.style.visibility = 'hidden'
      clon.style.display = 'block'
      clon.style.width = `${anchoContenido}px`
      clon.style.maxWidth = 'none'
      clon.style.maxHeight = 'none'
      clon.style.height = 'auto'
      clon.style.overflow = 'visible'
      clon.style.fontSize = `${tamanoPx}px`
      clon.style.lineHeight = String(interlineado)
      superficie.appendChild(clon)
      const medida = {
        alto: clon.getBoundingClientRect().height,
        ancho: clon.scrollWidth,
      }
      clon.remove()
      return medida
    }

    return {
      truncado: superficie.getAttribute('data-truncado'),
      recorte: estiloParrafo.webkitLineClamp,
      tamano,
      interlineado,
      relleno,
      anchoContenido,
      altoContenido,
      // Distancia entre cada borde del párrafo y el borde de la caja de contenido.
      holguraSuperior: rectParrafo.top - contenido.superior,
      holguraInferior: contenido.inferior - rectParrafo.bottom,
      holguraIzquierda: rectParrafo.left - contenido.izquierdo,
      holguraDerecha: contenido.derecho - rectParrafo.right,
      desbordeSuperficie: {
        alto: superficie.scrollHeight - superficie.clientHeight,
        ancho: superficie.scrollWidth - superficie.clientWidth,
      },
      desbordeParrafo: {
        alto: parrafo.scrollHeight - parrafo.clientHeight,
        ancho: parrafo.scrollWidth - parrafo.clientWidth,
      },
      textoActual: medirTextoLibre(tamano),
      textoUnPasoMayor: medirTextoLibre(tamano + 2),
      textoConMinimo: medirTextoLibre(14),
    }
  }, testid)
}

type MedidaAviso = Awaited<ReturnType<typeof medirAviso>>

/** Verifica las reglas que valen para cualquier aviso, entre completo o recortado. */
function esperarSuperficieSana(medida: MedidaAviso): void {
  // 1. El relleno interior es equidistante en los cuatro lados.
  expect(medida.relleno.derecho).toBeCloseTo(medida.relleno.superior, 2)
  expect(medida.relleno.inferior).toBeCloseTo(medida.relleno.superior, 2)
  expect(medida.relleno.izquierdo).toBeCloseTo(medida.relleno.superior, 2)
  expect(medida.relleno.superior).toBeGreaterThan(0)

  // 2. El párrafo queda dentro de la caja de contenido: no invade el relleno ni el borde.
  expect(medida.holguraSuperior).toBeGreaterThanOrEqual(-0.5)
  expect(medida.holguraInferior).toBeGreaterThanOrEqual(-0.5)
  expect(medida.holguraIzquierda).toBeGreaterThanOrEqual(-0.5)
  expect(medida.holguraDerecha).toBeGreaterThanOrEqual(-0.5)

  // 3. Las holguras son equidistantes: el texto queda centrado, no empujado contra un borde.
  expect(Math.abs(medida.holguraSuperior - medida.holguraInferior)).toBeLessThanOrEqual(TOLERANCIA)
  expect(Math.abs(medida.holguraIzquierda - medida.holguraDerecha)).toBeLessThanOrEqual(TOLERANCIA)

  // 4. La superficie nunca gana scroll propio.
  expect(medida.desbordeSuperficie.alto).toBeLessThanOrEqual(TOLERANCIA)
  expect(medida.desbordeSuperficie.ancho).toBeLessThanOrEqual(TOLERANCIA)

  // 5. El cuerpo elegido siempre respeta el rango declarado por el componente.
  expect(medida.tamano).toBeGreaterThanOrEqual(TAMANO_MINIMO)
  expect(medida.tamano).toBeLessThanOrEqual(TAMANO_MAXIMO)
}

/** Verifica el contrato de un aviso que sí entra: íntegro, sin recorte y con el mayor cuerpo. */
function esperarTextoIntegro(medida: MedidaAviso): void {
  esperarSuperficieSana(medida)

  // 1. El componente declara que no hubo recorte y no aplica ningún `line-clamp`.
  expect(medida.truncado).toBe('no')
  expect(medida.recorte).toBe('none')

  // 2. El texto completo cabe en la caja de contenido: ninguna línea puede quedar cortada.
  expect(medida.textoActual.alto).toBeLessThanOrEqual(medida.altoContenido + 0.5)
  expect(medida.textoActual.ancho).toBeLessThanOrEqual(medida.anchoContenido + TOLERANCIA)

  // 3. El párrafo no esconde contenido detrás de su propio recorte.
  expect(medida.desbordeParrafo.alto).toBeLessThanOrEqual(TOLERANCIA)
  expect(medida.desbordeParrafo.ancho).toBeLessThanOrEqual(TOLERANCIA)

  // 4. El cuerpo elegido es el máximo utilizable: con dos píxeles más ya no entraría.
  //    Se exime al tope declarado, donde el límite lo pone el componente y no el espacio.
  if (medida.tamano < TAMANO_MAXIMO) {
    expect(medida.textoUnPasoMayor.alto).toBeGreaterThan(medida.altoContenido + 0.5)
  }
}

// =============================================================================
// 1. Los cuatro textos que deben verse completos
// =============================================================================

const CASOS_COMPLETOS = [
  { nombre: 'texto corto', texto: TEXTO_CORTO, reduceCuerpo: false },
  { nombre: 'cuarto intermedio', texto: TEXTO_CUARTO, reduceCuerpo: false },
  { nombre: 'mensaje humano multilínea', texto: TEXTO_HUMANO, reduceCuerpo: false },
  { nombre: 'texto largo que reduce el cuerpo', texto: TEXTO_LARGO, reduceCuerpo: true },
] as const

for (const viewport of RESOLUCIONES) {
  for (const superficie of SUPERFICIES) {
    for (const caso of CASOS_COMPLETOS) {
      test(`${superficie.nombre} muestra íntegro el ${caso.nombre} en ${viewport.width}×${viewport.height}`, async ({
        page,
      }) => {
        test.slow()
        await page.setViewportSize(viewport)
        await instalarBackend(page, superficie.estados(caso.texto))
        await page.goto(superficie.url)
        await expect(page.getByTestId(superficie.testid)).toBeVisible({ timeout: ESPERA_MONTAJE })

        const medida = await medirAviso(page, superficie.testid)
        esperarTextoIntegro(medida)

        // El texto largo debe demostrar que el ajuste automático bajó el cuerpo de letra
        // en lugar de recortar: es la diferencia entre adaptarse y esconder texto.
        if (caso.reduceCuerpo) {
          expect(medida.tamano).toBeLessThan(TAMANO_MAXIMO)
          expect(medida.tamano).toBeGreaterThan(TAMANO_MINIMO)
        }

        esperarSinScrollGlobal(await medirDocumento(page))
      })
    }
  }
}

// =============================================================================
// 2. El único caso donde la elipsis es legítima
// =============================================================================

for (const viewport of RESOLUCIONES) {
  for (const superficie of SUPERFICIES) {
    test(`${superficie.nombre} sólo recorta cuando ni el cuerpo mínimo entra en ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      test.slow()
      await page.setViewportSize(viewport)
      await instalarBackend(page, superficie.estados(TEXTO_EXTREMO))
      await page.goto(superficie.url)
      await expect(page.getByTestId(superficie.testid)).toBeVisible({ timeout: ESPERA_MONTAJE })

      const medida = await medirAviso(page, superficie.testid)
      esperarSuperficieSana(medida)

      // 1. Justificación del recorte: con el cuerpo mínimo el texto completo tampoco entra.
      expect(medida.textoConMinimo.alto).toBeGreaterThan(medida.altoContenido + 0.5)

      // 2. Recién entonces se acepta la elipsis, y se acepta declarada y visible.
      expect(medida.truncado).toBe('si')
      expect(medida.tamano).toBe(TAMANO_MINIMO)
      expect(medida.recorte).not.toBe('none')

      // 3. Las líneas conservadas siguen entrando enteras en la caja de contenido.
      expect(medida.altoContenido).toBeGreaterThanOrEqual(
        Number.parseInt(medida.recorte, 10) * medida.tamano * medida.interlineado - TOLERANCIA,
      )

      esperarSinScrollGlobal(await medirDocumento(page))
    })
  }
}
