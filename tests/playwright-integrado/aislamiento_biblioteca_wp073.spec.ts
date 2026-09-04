/**
 * Aislamiento de la biblioteca de Apoyo Técnico en el E2E integrado (WP-073).
 *
 * WP-073 convierte `config/apoyo-tecnico/mensajes.csv` en dato operativo local: ya no
 * está versionado y puede contener mensajes que alguien cargó a mano. Su criterio 15
 * exige que ese archivo **nunca** sea sobrescrito por el bootstrap, por los tests ni por
 * la migración. Restaurarlo al final no alcanza: durante la prueba estaría pisado.
 *
 * Esta suite demuestra las dos mitades de la solución:
 *
 * 1. el stack integrado arranca apuntado a una biblioteca temporal, fuera del
 *    repositorio, sembrada desde la plantilla versionada;
 * 2. un CRUD real por REST persiste en esa biblioteca temporal y deja el archivo
 *    operativo del checkout byte a byte y con la misma fecha de modificación.
 *
 * La segunda comprobación se repite además en `ProcesoStackIntegrado.detener()`, de modo
 * que cubre a *todas* las suites integradas y no sólo a ésta.
 */

import { promises as archivos } from 'node:fs'
import { resolve, sep } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  ProcesoStackIntegrado,
  RUTA_BIBLIOTECA_OPERATIVA,
  URL_STACK,
  puertoOcupado,
  tomarHuella,
  type HuellaArchivo,
} from './infraestructura'

const RAIZ_REPOSITORIO = resolve(__dirname, '../..')

test.describe.serial('WP-073 · la E2E integrada no toca la biblioteca operativa', () => {
  const stack = new ProcesoStackIntegrado()

  /** Huella tomada antes de arrancar nada, para comparar al final. */
  let huellaInicial: HuellaArchivo = null

  test.beforeAll(async () => {
    huellaInicial = await tomarHuella(RUTA_BIBLIOTECA_OPERATIVA)
    await stack.iniciar()
  })

  test.afterAll(async () => {
    await stack.detener()
    expect(await puertoOcupado()).toBe(false)
  })

  test('el stack usa una biblioteca temporal fuera del repositorio', async () => {
    const rutaAislada = stack.obtenerRutaBiblioteca()

    // No alcanza con que sea «otra ruta»: tiene que estar fuera del árbol del
    // repositorio, para que ninguna prueba pueda ensuciar el checkout.
    expect(rutaAislada).not.toBe(RUTA_BIBLIOTECA_OPERATIVA)
    expect(rutaAislada.startsWith(RAIZ_REPOSITORIO + sep)).toBe(false)

    // Y tiene que existir ya sembrada con el encabezado canónico, para que el
    // backend arranque con una biblioteca válida y no simplemente vacía.
    const contenido = await archivos.readFile(rutaAislada, 'utf8')
    expect(contenido).toContain('id,texto,destino')
  })

  test('un CRUD real persiste en la copia aislada y deja intacta la operativa', async () => {
    const rutaAislada = stack.obtenerRutaBiblioteca()
    const texto = 'Mensaje de aislamiento WP-073'

    // Alta por REST contra el backend real. No hay mock: el servicio reescribe
    // el CSV completo de forma atómica antes de actualizar su memoria.
    const alta = await fetch(`${URL_STACK}/api/v1/apoyo-tecnico/mensajes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texto, destino: 'RECINTO' }),
    })
    expect(alta.ok).toBe(true)
    const creado = (await alta.json()) as { mensaje_id: string }

    // Persistencia real a disco, comprobada en el archivo aislado.
    expect(await archivos.readFile(rutaAislada, 'utf8')).toContain(texto)

    // Un proceso nuevo tendría que leer eso mismo: se comprueba releyendo la
    // biblioteca por REST, que es la proyección publicada del CSV.
    const listado = await fetch(`${URL_STACK}/api/v1/apoyo-tecnico/mensajes`)
    expect(await listado.text()).toContain(texto)

    // Baja, para dejar la biblioteca aislada como estaba.
    const baja = await fetch(
      `${URL_STACK}/api/v1/apoyo-tecnico/mensajes/${encodeURIComponent(creado.mensaje_id)}`,
      { method: 'DELETE' },
    )
    expect(baja.ok).toBe(true)
    expect(await archivos.readFile(rutaAislada, 'utf8')).not.toContain(texto)

    // El archivo operativo del checkout no fue leído para escribir, ni tocado:
    // ni su contenido ni su fecha de modificación cambiaron. Si no existía,
    // sigue sin existir: el E2E tampoco puede crearlo.
    const huellaFinal = await tomarHuella(RUTA_BIBLIOTECA_OPERATIVA)
    expect(huellaFinal).toEqual(huellaInicial)
  })
})
