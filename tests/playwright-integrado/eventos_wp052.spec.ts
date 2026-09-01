/**
 * WP-052 · frontera de secreto del panel de Eventos sobre el stack real.
 *
 * Recorre el ciclo completo con un único FastAPI, el simulador de dispositivos
 * versionado y la SPA construida de Moderación:
 *
 * 1. pedido y retiro de palabra muestran ✋ y ✊;
 * 2. con la votación `EN_CURSO`, los votos aparecen como identidad + banca +
 *    `Voto emitido`, sin sentido ni emoji, y el evento L2 de la pulsación
 *    oculta la tecla física;
 * 3. al vencer la frontera autoritativa de revelado, los mismos `seq` se
 *    enriquecen con sentido e icono sin duplicarse;
 * 4. el CSV institucional conserva desde el primer momento el mensaje durable
 *    completo, porque la protección vive en la proyección y no en el archivo.
 *
 * La prueba consulta además el snapshot REST crudo: si la fuga volviera por un
 * campo distinto del que mira la UI, el aserto sobre el JSON también fallaría.
 */

import { expect, test, type Page } from '@playwright/test'
import {
  ProcesoStackIntegrado,
  URL_STACK,
  leerAuditoria,
  listarCsvAuditoria,
  puertoOcupado,
  pulsar,
  pulsarSecuencia,
} from './infraestructura'

// `config/system.toml` fija `moderation_vote_reveal_seconds = 4`. El margen
// extra absorbe la latencia real de SSE y del render sin volver frágil la
// espera: lo que se comprueba es el cambio de estado, no un cronómetro exacto.
const SEGUNDOS_REVELADO = 4
const MARGEN_REVELADO_MILISEGUNDOS = 6_000

/** Devuelve la tarjeta del panel de eventos cuyo código coincide. */
function tarjetaEvento(page: Page, codigo: string) {
  return page
    .getByTestId('evento-reciente')
    .filter({ has: page.getByTestId('codigo-evento').filter({ hasText: codigo }) })
}

/** Lee el snapshot autoritativo tal como lo recibe cualquier consumidor REST. */
async function snapshotModeracion(page: Page): Promise<Record<string, unknown>> {
  const respuesta = await page.request.get(`${URL_STACK}/api/v1/estado/moderacion`)
  expect(respuesta.ok()).toBe(true)
  return (await respuesta.json()) as Record<string, unknown>
}

test.describe.serial('WP-052 · eventos operativos seguros sobre stack real', () => {
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

  test('protege el sentido durante EN_CURSO y enriquece el mismo seq al revelarlo', async ({
    page,
  }) => {
    await page.goto(`${URL_STACK}/moderacion/`)
    await page.getByTestId('btn-preparar-sala').click()
    await page.getByTestId('vista-preparando').waitFor()
    await pulsarSecuencia(['1-9', '2-9', '3-9', '4-9', '5-9', '6-9', '7-9'])
    await page.getByTestId('input-numero-sesion').fill('52')
    await page.getByTestId('input-presidencia').fill('Presidencia E2E WP-052')
    await page.getByTestId('input-secretaria').fill('Secretaría E2E WP-052')
    await page.getByTestId('btn-guardar-preparacion').click()
    await page.getByTestId('btn-abrir-sesion').click()
    await page.getByTestId('vista-sesion-abierta').waitFor()

    // --- Palabra: iconografía acordada por HUMAN_GATE -----------------------
    await pulsar('2-7')
    const pedido = tarjetaEvento(page, 'PEDIDO_PALABRA_REGISTRADO')
    await expect(pedido).toHaveCount(1)
    await expect(pedido.getByTestId('hecho-detalle')).toHaveText('Pedido de palabra')
    await expect(pedido.getByTestId('icono-evento')).toHaveText('✋')
    await expect(pedido.getByTestId('hecho-concejal')).toContainText('Banca 2')

    await pulsar('2-7')
    const retiro = tarjetaEvento(page, 'PEDIDO_PALABRA_RETIRADO')
    await expect(retiro).toHaveCount(1)
    await expect(retiro.getByTestId('hecho-detalle')).toHaveText('Pedido de palabra retirado')
    await expect(retiro.getByTestId('icono-evento')).toHaveText('✊')

    // --- Votación abierta y votos parciales ---------------------------------
    await page.getByTestId('input-numero-votacion').fill('1')
    await page.getByTestId('select-tipo-votacion').selectOption({ label: 'Otro' })
    await page.getByTestId('input-tema-votacion').fill('Frontera de secreto WP-052')
    await page.getByTestId('btn-abrir-votacion').click()
    await expect(page.getByTestId('estado-votacion')).toHaveText('EN_CURSO')

    // Solo tres de las siete bancas presentes votan: la recepción sigue
    // abierta, que es exactamente el estado en el que el secreto debe regir.
    await pulsarSecuencia(['1-1', '2-3', '3-2'])
    const votos = tarjetaEvento(page, 'VOTO_ORDINARIO_REGISTRADO')
    await expect(votos).toHaveCount(3)

    for (let indice = 0; indice < 3; indice += 1) {
      const voto = votos.nth(indice)
      await expect(voto.getByTestId('hecho-detalle')).toHaveText('Voto emitido')
      await expect(voto.getByTestId('icono-evento')).toHaveCount(0)
      const html = await voto.evaluate((elemento) => elemento.outerHTML)
      expect(html).not.toMatch(/POSITIVO|NEGATIVO|ABSTENCI/)
      expect(html).not.toMatch(/✅|❌|🟡/)
    }

    // El panel completo, no solo las tarjetas de voto: el diagnóstico L2 de
    // entrada tampoco puede publicar la tecla mientras el secreto rige.
    await page.getByTestId('filtro-eventos').selectOption('L2')
    const panel = await page.getByTestId('lista-eventos').evaluate((nodo) => nodo.textContent ?? '')
    expect(panel).toContain('tecla [oculta]')
    expect(panel).not.toMatch(/tecla \[[123]\]/)

    // Y el snapshot autoritativo que alimenta a la UI tampoco lo contiene.
    const secreto = await snapshotModeracion(page)
    const payloadSecreto = JSON.stringify(secreto)
    expect(payloadSecreto).not.toMatch(/POSITIVO|NEGATIVO|ABSTENCION/)
    expect(payloadSecreto).not.toMatch(/tecla \[[123]\]/)

    const seqDeVotos = await votos.evaluateAll((tarjetas) =>
      tarjetas.map((tarjeta) => tarjeta.textContent?.match(/#(\d+)/)?.[1] ?? ''),
    )

    // --- La auditoría durable ya guardó el sentido completo -----------------
    const auditoriaDurante = await leerAuditoria(await listarCsvAuditoria())
    expect(auditoriaDurante).toContain('votó POSITIVO')
    expect(auditoriaDurante).toContain('votó NEGATIVO')
    expect(auditoriaDurante).toContain('votó ABSTENCION')
    expect(auditoriaDurante).toContain('tecla [1]')

    // --- Vencida la frontera, los mismos seq se enriquecen ------------------
    await page.getByTestId('filtro-eventos').selectOption('L3')
    await expect(votos.nth(0).getByTestId('icono-evento')).toHaveCount(1, {
      timeout: SEGUNDOS_REVELADO * 1000 + MARGEN_REVELADO_MILISEGUNDOS,
    })
    await expect(votos).toHaveCount(3)

    const seqRevelados = await votos.evaluateAll((tarjetas) =>
      tarjetas.map((tarjeta) => tarjeta.textContent?.match(/#(\d+)/)?.[1] ?? ''),
    )
    expect(seqRevelados).toEqual(seqDeVotos)

    const iconos = await votos
      .getByTestId('icono-evento')
      .evaluateAll((nodos) => nodos.map((nodo) => nodo.textContent?.trim() ?? ''))
    // Orden visual descendente por seq: banca 3 (🟡), banca 2 (❌) y banca 1 (✅).
    expect(iconos).toEqual(['🟡', '❌', '✅'])

    const detalles = await votos
      .getByTestId('hecho-detalle')
      .evaluateAll((nodos) => nodos.map((nodo) => nodo.textContent?.trim() ?? ''))
    expect(detalles).toEqual(['Voto ABSTENCIÓN', 'Voto NEGATIVO', 'Voto POSITIVO'])

    // La votación siguió EN_CURSO todo el recorrido: el revelado de Moderación
    // depende de su propia frontera temporal y no del cierre de la recepción.
    await expect(page.getByTestId('estado-votacion')).toHaveText('EN_CURSO')
  })
})
