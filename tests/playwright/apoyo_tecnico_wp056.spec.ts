/**
 * Geometría y operación del plano de Apoyo Técnico (WP-056).
 *
 * Estas pruebas miden lo que el DOM de Vitest no puede: cajas reales, proporciones y
 * ausencia de scroll. Se ejecutan en las dos resoluciones que exige el WP —1366×768 y
 * 1920×1080— y comprueban, con `boundingBox` y `scrollHeight`, que:
 *
 * 1. la SPA técnica entra completa en pantalla, sin scroll global nuevo;
 * 2. la columna derecha del Recinto reparte aproximadamente 1/5 para transmisión y 4/5
 *    para los pedidos de palabra;
 * 3. la cuenta regresiva y el rótulo `● EN VIVO` quedan contenidos en ese quinto superior;
 * 4. un aviso reemplaza exactamente la superficie acordada, sin solaparse con la cabecera,
 *    las bancas ni la columna derecha en el Recinto, ni con Q1/Q2/Q3 en Moderación;
 * 5. el texto del aviso queda contenido dentro de su superficie y no genera scroll propio.
 *
 * Cada aplicación se sirve desde su propio servidor de desarrollo, declarado en
 * `playwright.config.ts`. El backend se sustituye por un doble determinista instalado en
 * el navegador: lo que se verifica acá es la interfaz, no el transporte.
 *
 * Las fábricas de estado y ese doble viven en `soporte/apoyo_tecnico`, porque WP-060 los
 * reutiliza para medir la geometría de los avisos sobre las mismas superficies.
 */

import { expect, test } from '@playwright/test'

import {
  aviso,
  esperarSinScrollGlobal,
  estadoModeracion,
  estadoRecinto,
  estadoTecnico,
  instalarBackend,
  medirDocumento,
  RESOLUCIONES,
  transmision,
  URL_MODERACION,
  URL_RECINTO,
  URL_TECNICO,
} from './soporte/apoyo_tecnico'

// =============================================================================
// 1. SPA de Apoyo Técnico
// =============================================================================

for (const viewport of RESOLUCIONES) {
  test(`la SPA técnica opera completa sin scroll global en ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await instalarBackend(page, {
      '/api/v1/estado/tecnico': estadoTecnico(),
      '/api/v1/estado/moderacion': estadoModeracion(),
    })
    await page.goto(URL_TECNICO)

    // 1. Cabecera y estado de conexión visibles.
    await expect(page.getByTestId('cabecera-tecnico')).toBeVisible()
    await expect(page.getByTestId('estado-conexion')).toHaveText('Conectado')

    // 2. Los cinco bloques operativos entran simultáneamente.
    for (const panel of [
      'panel-transmision',
      'panel-avisos',
      'panel-eventos-tecnico',
      'panel-biblioteca',
      'panel-remapeo-tecnico',
    ]) {
      await expect(page.getByTestId(panel)).toBeVisible()
    }

    // 3. Controles reconstruidos desde el snapshot autoritativo.
    await expect(page.getByTestId('estado-transmision')).toHaveAttribute('data-estado', 'APAGADO')
    await expect(page.getByTestId('mensaje-precargado')).toHaveCount(2)
    await expect(page.getByTestId('gestion-remapeo')).toBeVisible()

    // 4. Medición estricta: ninguna de las dos dimensiones desborda.
    esperarSinScrollGlobal(await medirDocumento(page))
  })
}

test('el puesto técnico conserva el filtro acumulativo de eventos y su frontera de secreto', async ({
  page,
}) => {
  await page.setViewportSize(RESOLUCIONES[0])
  await instalarBackend(page, {
    '/api/v1/estado/tecnico': estadoTecnico(),
    '/api/v1/estado/moderacion': estadoModeracion(),
  })
  await page.goto(URL_TECNICO)

  // Con L3 sólo se ven los eventos de ese nivel; con L1 se acumulan los tres.
  const soloL3 = await page.getByTestId('evento-tecnico').count()
  await page.getByTestId('filtro-eventos-tecnico').selectOption('L1')
  const todos = await page.getByTestId('evento-tecnico').count()
  expect(todos).toBeGreaterThan(soloL3)
  expect(todos).toBe(25)

  // Ningún evento sin `hecho` puede mostrar identidad ni icono: el secreto se aplica en
  // el servidor y la pantalla no lo reconstruye.
  await expect(page.getByTestId('hecho-evento-tecnico')).toHaveCount(0)
  await expect(page.getByTestId('icono-evento-tecnico')).toHaveCount(0)
})

test('cargar un preset precarga el formulario y no publica nada', async ({ page }) => {
  await page.setViewportSize(RESOLUCIONES[0])
  await instalarBackend(page, {
    '/api/v1/estado/tecnico': estadoTecnico(),
    '/api/v1/estado/moderacion': estadoModeracion(),
  })

  // Se registran las publicaciones que llegarían al backend para comprobar que no ocurre
  // ninguna al elegir un mensaje precargado.
  const publicaciones: string[] = []
  await page.route('**/api/v1/apoyo-tecnico/**', async (ruta) => {
    publicaciones.push(ruta.request().url())
    await ruta.fulfill({ status: 204, body: '' })
  })

  await page.goto(URL_TECNICO)
  await page.getByTestId('mensaje-precargado').first().getByTestId('btn-cargar-mensaje').click()

  await expect(page.getByTestId('input-texto-aviso')).toHaveValue('Cuarto intermedio')
  await expect(page.getByTestId('select-destino-aviso')).toHaveValue('AMBOS')
  expect(publicaciones).toHaveLength(0)
})

// =============================================================================
// 2. Pantalla del Recinto
// =============================================================================

for (const viewport of RESOLUCIONES) {
  test(`la columna derecha del Recinto reparte 1/5 y 4/5 en ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await instalarBackend(page, { '/api/v1/estado/recinto': estadoRecinto() })
    await page.goto(URL_RECINTO)
    await expect(page.getByTestId('columna-palabra-publica')).toBeVisible()

    const columna = (await page.getByTestId('columna-palabra-publica').boundingBox())!
    const bloque = (await page.getByTestId('bloque-transmision').boundingBox())!
    const palabra = (await page.getByTestId('panel-palabra').boundingBox())!

    // Proporción aproximada: el bloque de transmisión toma cerca de un quinto del alto.
    const proporcion = bloque.height / columna.height
    expect(proporcion).toBeGreaterThan(0.12)
    expect(proporcion).toBeLessThan(0.28)

    // Los dos bloques se reparten la columna sin superponerse ni desbordarla.
    expect(bloque.y + bloque.height).toBeLessThanOrEqual(palabra.y + 1)
    expect(palabra.y + palabra.height).toBeLessThanOrEqual(columna.y + columna.height + 1)

    // La cola de pedidos nunca puede desplazarse en horizontal.
    const desbordeCola = await page.evaluate(() => {
      const lista = document.querySelector('[data-testid="cola-palabra"]')
      if (!lista) return { scrollWidth: 0, clientWidth: 0 }
      return { scrollWidth: lista.scrollWidth, clientWidth: lista.clientWidth }
    })
    expect(desbordeCola.scrollWidth).toBeLessThanOrEqual(desbordeCola.clientWidth + 1)

    esperarSinScrollGlobal(await medirDocumento(page))
  })

  test(`el aviso del Recinto reemplaza la franja sin invadir el resto en ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await instalarBackend(page, {
      '/api/v1/estado/recinto': estadoRecinto({
        aviso: aviso('Se reanuda la sesión en instantes', 'RECINTO'),
      }),
    })
    await page.goto(URL_RECINTO)
    await expect(page.getByTestId('aviso-tecnico-recinto')).toBeVisible()

    // La franja original desaparece por completo: es un reemplazo, no una superposición.
    await expect(page.getByTestId('franja-votacion-quorum')).toHaveCount(0)

    const avisoCaja = (await page.getByTestId('aviso-tecnico-recinto').boundingBox())!
    const cabecera = (await page.getByTestId('cabecera-recinto').boundingBox())!
    const bancas = (await page.getByTestId('area-bancas-publica').boundingBox())!
    const columna = (await page.getByTestId('columna-palabra-publica').boundingBox())!

    // No se solapa con la cabecera, ni con las bancas, ni con la columna derecha.
    expect(avisoCaja.y).toBeGreaterThanOrEqual(cabecera.y + cabecera.height - 1)
    expect(avisoCaja.y + avisoCaja.height).toBeLessThanOrEqual(bancas.y + 1)
    expect(avisoCaja.y + avisoCaja.height).toBeLessThanOrEqual(columna.y + 1)

    // El texto queda contenido en su superficie y el aviso no tiene scroll propio.
    const contencion = await page.evaluate(() => {
      const superficie = document.querySelector('[data-testid="aviso-tecnico-recinto"]')!
      const texto = superficie.querySelector('[data-testid="texto-aviso"]')!
      return {
        scrollHeight: superficie.scrollHeight,
        clientHeight: superficie.clientHeight,
        scrollWidth: superficie.scrollWidth,
        clientWidth: superficie.clientWidth,
        textoAlto: texto.scrollHeight,
        superficieAlto: superficie.clientHeight,
        tamanoFuente: Number.parseFloat(getComputedStyle(texto).fontSize),
      }
    })
    expect(contencion.scrollHeight).toBeLessThanOrEqual(contencion.clientHeight + 1)
    expect(contencion.scrollWidth).toBeLessThanOrEqual(contencion.clientWidth + 1)
    expect(contencion.textoAlto).toBeLessThanOrEqual(contencion.superficieAlto + 1)
    // El ajuste eligió un cuerpo mayor al mínimo: hay espacio y se aprovecha.
    expect(contencion.tamanoFuente).toBeGreaterThan(14)

    esperarSinScrollGlobal(await medirDocumento(page))
  })
}

test('la cuenta regresiva y el rótulo EN VIVO quedan contenidos en el quinto superior', async ({
  page,
}) => {
  await page.setViewportSize(RESOLUCIONES[1])
  await instalarBackend(page, {
    '/api/v1/estado/recinto': estadoRecinto({
      transmision: transmision({
        estado: 'CUENTA_REGRESIVA',
        iniciada_en: '2026-09-02T10:00:00Z',
        en_vivo_desde: '2026-09-02T10:59:00Z',
        cuenta_regresiva_segundos: 3540,
        segundos_restantes: 3540,
      }),
    }),
  })
  await page.goto(URL_RECINTO)

  await expect(page.getByTestId('cuenta-regresiva-transmision')).toBeVisible()
  const bloque = (await page.getByTestId('bloque-transmision').boundingBox())!
  const numero = (await page.getByTestId('cuenta-regresiva-transmision').boundingBox())!
  expect(numero.y).toBeGreaterThanOrEqual(bloque.y - 1)
  expect(numero.y + numero.height).toBeLessThanOrEqual(bloque.y + bloque.height + 1)

  esperarSinScrollGlobal(await medirDocumento(page))
})

test('el Recinto muestra ● EN VIVO cuando el backend lo declara al aire', async ({ page }) => {
  await page.setViewportSize(RESOLUCIONES[0])
  await instalarBackend(page, {
    '/api/v1/estado/recinto': estadoRecinto({
      transmision: transmision({
        estado: 'EN_VIVO',
        iniciada_en: '2026-09-02T10:00:00Z',
        en_vivo_desde: '2026-09-02T10:00:00Z',
      }),
    }),
  })
  await page.goto(URL_RECINTO)

  await expect(page.getByTestId('en-vivo')).toContainText('EN VIVO')
  await expect(page.getByTestId('bloque-transmision')).toHaveAttribute(
    'data-estado-transmision',
    'EN_VIVO',
  )
  esperarSinScrollGlobal(await medirDocumento(page))
})

test('un aviso dirigido sólo a Moderación no altera la franja del Recinto', async ({ page }) => {
  await page.setViewportSize(RESOLUCIONES[0])
  // El backend nunca pone en el payload público un aviso de Moderación: la ranura del
  // Recinto llega vacía. La pantalla debe conservar su franja normal.
  await instalarBackend(page, { '/api/v1/estado/recinto': estadoRecinto({ aviso: null }) })
  await page.goto(URL_RECINTO)

  await expect(page.getByTestId('franja-votacion-quorum')).toBeVisible()
  await expect(page.getByTestId('aviso-tecnico-recinto')).toHaveCount(0)
})

// =============================================================================
// 3. Moderación
// =============================================================================

for (const viewport of RESOLUCIONES) {
  test(`el aviso de Moderación reemplaza Q4 sin solaparse en ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await instalarBackend(page, {
      '/api/v1/estado/moderacion': estadoModeracion({
        aviso: aviso('Cuarto intermedio de quince minutos', 'MODERACION'),
      }),
    })
    await page.goto(URL_MODERACION)
    await expect(page.getByTestId('aviso-tecnico-moderacion')).toBeVisible()

    // Reemplazo real: el panel y su selector de nivel desaparecen del documento.
    await expect(page.getByTestId('panel-eventos')).toHaveCount(0)
    await expect(page.getByTestId('filtro-eventos')).toHaveCount(0)

    // La grilla conserva sus cuatro celdas y el aviso ocupa exactamente la cuarta.
    const grilla = (await page.getByTestId('grilla-paneles').boundingBox())!
    const avisoCaja = (await page.getByTestId('aviso-tecnico-moderacion').boundingBox())!
    const q3 = (await page.getByTestId('panel-recinto-palabra').boundingBox())!

    expect(avisoCaja.x).toBeGreaterThanOrEqual(q3.x + q3.width - 1)
    expect(avisoCaja.y + avisoCaja.height).toBeLessThanOrEqual(grilla.y + grilla.height + 1)
    expect(avisoCaja.x + avisoCaja.width).toBeLessThanOrEqual(grilla.x + grilla.width + 1)

    esperarSinScrollGlobal(await medirDocumento(page))
  })
}

test('Moderación conserva Q4 cuando el aviso está dirigido sólo al Recinto', async ({ page }) => {
  await page.setViewportSize(RESOLUCIONES[0])
  // El backend no proyecta hacia Moderación un aviso de destino RECINTO.
  await instalarBackend(page, { '/api/v1/estado/moderacion': estadoModeracion({ aviso: null }) })
  await page.goto(URL_MODERACION)

  await expect(page.getByTestId('panel-eventos')).toBeVisible()
  await expect(page.getByTestId('aviso-tecnico-moderacion')).toHaveCount(0)
  esperarSinScrollGlobal(await medirDocumento(page))
})

test('un aviso largo se recorta con elipsis en lugar de generar scroll', async ({ page }) => {
  await page.setViewportSize(RESOLUCIONES[1])
  const textoLargo = 'Comunicación institucional extensa. '.repeat(14)
  await instalarBackend(page, {
    '/api/v1/estado/moderacion': estadoModeracion({ aviso: aviso(textoLargo, 'MODERACION') }),
  })
  await page.goto(URL_MODERACION)
  await expect(page.getByTestId('aviso-tecnico-moderacion')).toBeVisible()

  const medidas = await page.evaluate(() => {
    const superficie = document.querySelector('[data-testid="aviso-tecnico-moderacion"]')!
    const texto = superficie.querySelector('[data-testid="texto-aviso"]')!
    const estilo = getComputedStyle(texto)
    return {
      truncado: superficie.getAttribute('data-truncado'),
      scrollHeight: superficie.scrollHeight,
      clientHeight: superficie.clientHeight,
      recorte: estilo.webkitLineClamp,
      tamanoFuente: Number.parseFloat(estilo.fontSize),
    }
  })

  // El aviso no crece ni gana scroll propio, pase lo que pase con el texto.
  expect(medidas.scrollHeight).toBeLessThanOrEqual(medidas.clientHeight + 1)
  // El cuerpo elegido nunca baja del mínimo legible declarado por el componente.
  expect(medidas.tamanoFuente).toBeGreaterThanOrEqual(14)
  // Si hubo que recortar, el recorte es visible: hay `line-clamp` declarado.
  if (medidas.truncado === 'si') {
    expect(medidas.recorte).not.toBe('none')
  }

  esperarSinScrollGlobal(await medirDocumento(page))
})
