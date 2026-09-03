/**
 * E2E multi-contexto de Apoyo Técnico contra el stack real (WP-056).
 *
 * Abre simultáneamente las tres pantallas —Técnico, Moderación y Recinto— servidas por un
 * único FastAPI y comprueba que un comando emitido desde el puesto técnico se refleja por
 * SSE en la superficie correcta, sin ningún sondeo periódico y sin que las pantallas
 * decidan nada por su cuenta:
 *
 * 1. la ruta `/tecnico/` se sirve desde el mismo origen que las otras dos;
 * 2. una transmisión instantánea llega al Recinto como `● EN VIVO`;
 * 3. una cuenta regresiva cruza sola a EN VIVO, sin interacción adicional;
 * 4. detener la transmisión devuelve el indicador a apagado;
 * 5. un aviso MODERACION reemplaza Q4 y no toca el Recinto;
 * 6. un aviso RECINTO reemplaza la franja de votación y no toca Moderación;
 * 7. un aviso AMBOS afecta las dos superficies a la vez;
 * 8. un aviso con duración desaparece solo de los dos destinos al vencer;
 * 9. la cancelación manual restaura ambas superficies;
 * 10. el CRUD de mensajes precargados persiste y sobrevive a un reload;
 * 11. el puesto técnico ofrece el mismo remapeo que Moderación —mismo padrón, mismo
 *     componente— y una orden real no deja a Moderación en un estado inconsistente. El
 *     recorrido completo del remapeo exige el device-bridge físico, que este stack de
 *     desarrollo no levanta; su lógica ya está cubierta por las pruebas del backend.
 *
 * Todo el estado es autoritativo del backend: la prueba nunca fabrica payloads.
 */

import { promises as archivos } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { ProcesoStackIntegrado, URL_STACK, puertoOcupado, pulsarSecuencia } from './infraestructura'

/**
 * Biblioteca de mensajes precargados versionada en el repositorio.
 *
 * El CRUD que ejercita esta prueba escribe realmente sobre este archivo, porque es la
 * única forma de demostrar que la persistencia funciona. Su contenido se guarda antes de
 * empezar y se restaura al terminar, incluso si una prueba falla: el checkout debe quedar
 * limpio para que el empaquetado productivo siga correspondiendo a su SHA.
 */
const RUTA_BIBLIOTECA = resolve(__dirname, '../../config/apoyo-tecnico/mensajes.csv')

/**
 * Deja el recinto en sesión abierta para poder observar la franja completa del Recinto.
 *
 * Es idempotente porque las pruebas de este archivo comparten un único proceso FastAPI y
 * su estado vive en memoria: la primera abre la sesión y las siguientes la encuentran ya
 * abierta. Reabrirla no sólo fallaría, sino que además reiniciaría el contexto operativo
 * en medio del recorrido.
 */
async function abrirSesion(moderacion: Page): Promise<void> {
  if (await moderacion.getByTestId('vista-sesion-abierta').isVisible()) return

  await moderacion.getByTestId('btn-preparar-sala').click()
  await moderacion.getByTestId('vista-preparando').waitFor()
  await pulsarSecuencia(['1-9', '2-9', '3-9', '4-9', '5-9', '6-9', '7-9'])
  await moderacion.getByTestId('input-numero-sesion').fill('56')
  await moderacion.getByTestId('input-presidencia').fill('Presidencia WP-056')
  await moderacion.getByTestId('input-secretaria').fill('Secretaría WP-056')
  await moderacion.getByTestId('btn-guardar-preparacion').click()
  await moderacion.getByTestId('btn-abrir-sesion').click()
  await moderacion.getByTestId('vista-sesion-abierta').waitFor()
}

/** Publica un aviso desde el puesto técnico con el destino y la duración indicados. */
async function publicarAviso(
  tecnico: Page,
  texto: string,
  destino: string,
  duracionSegundos?: number,
): Promise<void> {
  await tecnico.getByTestId('input-texto-aviso').fill(texto)
  await tecnico.getByTestId('select-destino-aviso').selectOption(destino)
  await tecnico
    .getByTestId('input-duracion-aviso')
    .fill(duracionSegundos === undefined ? '' : String(duracionSegundos))
  await tecnico.getByTestId('btn-publicar-aviso').click()
}

test.describe.serial('WP-056 · Apoyo Técnico sobre stack real', () => {
  const stack = new ProcesoStackIntegrado()

  let bibliotecaOriginal = ''

  test.beforeAll(async () => {
    bibliotecaOriginal = await archivos.readFile(RUTA_BIBLIOTECA, 'utf8')
    await stack.iniciar()
  })
  test.afterAll(async () => {
    await stack.detener()
    expect(await puertoOcupado()).toBe(false)
    await archivos.writeFile(RUTA_BIBLIOTECA, bibliotecaOriginal, 'utf8')
  })

  test.afterEach(async ({}, informacion) => {
    if (informacion.status !== informacion.expectedStatus) {
      await informacion.attach('stdout-stderr-stack.txt', {
        body: stack.obtenerSalida(),
        contentType: 'text/plain',
      })
    }
  })

  test('refleja transmisión y avisos en las superficies correctas de las tres pantallas', async ({
    browser,
  }) => {
    const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const moderacion = await contexto.newPage()
    const recinto = await contexto.newPage()
    const tecnico = await contexto.newPage()

    try {
      // 1. Las tres pantallas comparten origen; /tecnico/ existe en el stack real.
      await Promise.all([
        moderacion.goto(`${URL_STACK}/moderacion/`),
        recinto.goto(`${URL_STACK}/recinto/`),
        tecnico.goto(`${URL_STACK}/tecnico/`),
      ])
      await expect(tecnico.getByTestId('cabecera-tecnico')).toBeVisible()
      await expect(tecnico.getByTestId('estado-conexion')).toHaveText('Conectado')

      await abrirSesion(moderacion)
      await expect(recinto.getByTestId('franja-votacion-quorum')).toBeVisible()

      // -------------------------------------------------------------------
      // 2. Transmisión instantánea
      // -------------------------------------------------------------------
      await tecnico.getByTestId('btn-transmision-instantanea').click()
      await expect(recinto.getByTestId('en-vivo')).toContainText('EN VIVO')
      await expect(tecnico.getByTestId('estado-transmision')).toHaveAttribute(
        'data-estado',
        'EN_VIVO',
      )

      // 3. Detención manual: `EN VIVO` sólo termina por orden explícita.
      await tecnico.getByTestId('btn-transmision-detener').click()
      await expect(recinto.getByTestId('transmision-apagada')).toBeVisible()

      // -------------------------------------------------------------------
      // 4. Cuenta regresiva que cruza sola a EN VIVO
      // -------------------------------------------------------------------
      await tecnico.getByTestId('input-cuenta-regresiva').fill('3')
      await tecnico.getByTestId('btn-transmision-cuenta').click()
      await expect(recinto.getByTestId('cuenta-regresiva-transmision')).toBeVisible()
      // Sin ninguna interacción adicional: la frontera la cruza el backend.
      await expect(recinto.getByTestId('en-vivo')).toContainText('EN VIVO', { timeout: 15_000 })
      await tecnico.getByTestId('btn-transmision-detener').click()
      await expect(recinto.getByTestId('transmision-apagada')).toBeVisible()

      // -------------------------------------------------------------------
      // 5. Aviso dirigido sólo a Moderación
      // -------------------------------------------------------------------
      await publicarAviso(tecnico, 'Aviso sólo para Moderación', 'MODERACION')
      await expect(moderacion.getByTestId('aviso-tecnico-moderacion')).toContainText(
        'Aviso sólo para Moderación',
      )
      await expect(moderacion.getByTestId('panel-eventos')).toHaveCount(0)
      // El Recinto no se entera: la separación de ranuras la aplica el backend.
      await expect(recinto.getByTestId('franja-votacion-quorum')).toBeVisible()
      await expect(recinto.getByTestId('aviso-tecnico-recinto')).toHaveCount(0)

      await tecnico.getByTestId('btn-cancelar-moderacion').click()
      await expect(moderacion.getByTestId('panel-eventos')).toBeVisible()

      // -------------------------------------------------------------------
      // 6. Aviso dirigido sólo al Recinto
      // -------------------------------------------------------------------
      await publicarAviso(tecnico, 'Aviso sólo para el Recinto', 'RECINTO')
      await expect(recinto.getByTestId('aviso-tecnico-recinto')).toContainText(
        'Aviso sólo para el Recinto',
      )
      await expect(recinto.getByTestId('franja-votacion-quorum')).toHaveCount(0)
      // La columna derecha y las bancas siguen intactas.
      await expect(recinto.getByTestId('columna-palabra-publica')).toBeVisible()
      await expect(recinto.getByTestId('area-bancas-publica')).toBeVisible()
      await expect(moderacion.getByTestId('panel-eventos')).toBeVisible()

      await tecnico.getByTestId('btn-cancelar-recinto').click()
      await expect(recinto.getByTestId('franja-votacion-quorum')).toBeVisible()

      // -------------------------------------------------------------------
      // 7. Aviso AMBOS y vencimiento automático por duración
      // -------------------------------------------------------------------
      await publicarAviso(tecnico, 'Cuarto intermedio breve', 'AMBOS', 3)
      await expect(moderacion.getByTestId('aviso-tecnico-moderacion')).toBeVisible()
      await expect(recinto.getByTestId('aviso-tecnico-recinto')).toBeVisible()

      // Al vencer, ambas superficies se restauran solas: nadie ejecuta un comando.
      await expect(moderacion.getByTestId('panel-eventos')).toBeVisible({ timeout: 15_000 })
      await expect(recinto.getByTestId('franja-votacion-quorum')).toBeVisible({ timeout: 15_000 })
    } finally {
      await contexto.close()
    }
  })

  test('administra los mensajes precargados y los conserva tras recargar', async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const tecnico = await contexto.newPage()

    try {
      await tecnico.goto(`${URL_STACK}/tecnico/`)
      await expect(tecnico.getByTestId('estado-conexion')).toHaveText('Conectado')

      // Alta.
      await tecnico.getByTestId('input-mensaje-nuevo').fill('Retomamos en cinco minutos')
      await tecnico.getByTestId('select-destino-nuevo').selectOption('RECINTO')
      await tecnico.getByTestId('btn-crear-mensaje').click()
      const fila = tecnico.getByTestId('mensaje-precargado').filter({
        hasText: 'Retomamos en cinco minutos',
      })
      await expect(fila).toHaveCount(1)

      // Persistencia real: el CSV del backend sobrevive a un reload completo.
      await tecnico.reload()
      await expect(
        tecnico.getByTestId('mensaje-precargado').filter({ hasText: 'Retomamos en cinco minutos' }),
      ).toHaveCount(1)

      // Selección: precarga el formulario sin publicar.
      await tecnico
        .getByTestId('mensaje-precargado')
        .filter({ hasText: 'Retomamos en cinco minutos' })
        .getByTestId('btn-cargar-mensaje')
        .click()
      await expect(tecnico.getByTestId('input-texto-aviso')).toHaveValue(
        'Retomamos en cinco minutos',
      )
      await expect(tecnico.getByTestId('select-destino-aviso')).toHaveValue('RECINTO')
      await expect(tecnico.getByTestId('ranura-recinto')).toContainText('Sin aviso vigente')

      // Edición.
      await tecnico
        .getByTestId('mensaje-precargado')
        .filter({ hasText: 'Retomamos en cinco minutos' })
        .getByTestId('btn-editar-mensaje')
        .click()
      await tecnico.getByTestId('input-mensaje-editado').fill('Retomamos en diez minutos')
      await tecnico.getByTestId('select-destino-editado').selectOption('AMBOS')
      await tecnico.getByTestId('btn-guardar-mensaje').click()
      await expect(
        tecnico.getByTestId('mensaje-precargado').filter({ hasText: 'Retomamos en diez minutos' }),
      ).toHaveCount(1)

      // Baja.
      await tecnico
        .getByTestId('mensaje-precargado')
        .filter({ hasText: 'Retomamos en diez minutos' })
        .getByTestId('btn-eliminar-mensaje')
        .click()
      await expect(
        tecnico.getByTestId('mensaje-precargado').filter({ hasText: 'Retomamos en diez minutos' }),
      ).toHaveCount(0)

      // El estado también sobrevive a un reload: la baja quedó en el CSV.
      await tecnico.reload()
      await expect(
        tecnico.getByTestId('mensaje-precargado').filter({ hasText: 'Retomamos en diez minutos' }),
      ).toHaveCount(0)
    } finally {
      await contexto.close()
    }
  })

  test('ofrece el mismo remapeo que Moderación y no la deja inconsistente', async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const moderacion = await contexto.newPage()
    const tecnico = await contexto.newPage()

    try {
      await Promise.all([
        moderacion.goto(`${URL_STACK}/moderacion/`),
        tecnico.goto(`${URL_STACK}/tecnico/`),
      ])
      await abrirSesion(moderacion)
      await expect(tecnico.getByTestId('gestion-remapeo')).toBeVisible()

      // 1. El puesto técnico ofrece exactamente el padrón autoritativo, sin una copia
      //    propia: cada opción corresponde a un concejal del snapshot de Moderación.
      const snapshotInicial = (await (
        await moderacion.request.get(`${URL_STACK}/api/v1/estado/moderacion`)
      ).json()) as { concejales: { banca: number; dispositivo_votacion: string }[] }
      const opcionesTecnico = await tecnico
        .getByTestId('selector-banca-remapeo')
        .locator('option')
        .allTextContents()
      // La primera opción es el texto de invitación; las demás son las bancas reales.
      expect(opcionesTecnico).toHaveLength(snapshotInicial.concejales.length + 1)
      for (const concejal of snapshotInicial.concejales) {
        expect(
          opcionesTecnico.some(
            (opcion) =>
              opcion.includes(`Banca ${concejal.banca} `) &&
              opcion.includes(concejal.dispositivo_votacion),
          ),
        ).toBe(true)
      }

      // 2. Una orden real desde el puesto técnico llega al backend autoritativo. En este
      //    stack no hay device-bridge físico, así que el backend la rechaza con su código
      //    institucional; lo que importa es que ese rechazo se muestre tal cual y que no
      //    quede ninguna operación colgada.
      await tecnico.getByTestId('selector-banca-remapeo').selectOption('dev01')
      await tecnico.getByTestId('btn-iniciar-remapeo').click()
      await expect(tecnico.getByTestId('error-remapeo')).toBeVisible()

      // 3. Moderación queda intacta: sin operación activa y con su sesión operativa.
      await expect(moderacion.getByTestId('remapeo-activo')).toHaveCount(0)
      await expect(moderacion.getByTestId('vista-sesion-abierta')).toBeVisible()
      await expect(tecnico.getByTestId('inicio-remapeo')).toBeVisible()

      // 4. El snapshot autoritativo confirma que no quedó residuo del intento.
      const snapshot = await moderacion.request.get(`${URL_STACK}/api/v1/estado/moderacion`)
      expect(((await snapshot.json()) as { remapeo: unknown }).remapeo).toBeNull()
    } finally {
      await contexto.close()
    }
  })
})
