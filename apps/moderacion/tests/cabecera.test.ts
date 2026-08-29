/**
 * Pruebas dedicadas de la cabecera compacta de Moderación (WP-036).
 *
 * Cobertura:
 * 1. Densidad: el distintivo `BOTONERA2` desapareció y `Moderación` sigue siendo la identidad.
 * 2. Reloj local: se muestra la fecha/hora del equipo y avanza con el paso del tiempo,
 *    verificado con un reloj falso (sin depender del reloj real de la máquina de CI).
 * 3. Tiempo de sesión: aparece sólo cuando existe `sesion.fecha_hora_apertura` y se deriva
 *    de esa marca autoritativa más el reloj local.
 * 4. Autoridades: Presidencia y Secretaría Legislativa se muestran desde que fueron cargadas,
 *    tanto en PREPARANDO como en SESION_ABIERTA, y se omiten mientras no existan.
 * 5. Quórum: se presenta en cabecera cuando el backend lo proyecta y se omite cuando es null.
 * 6. Conexión y advertencia de estado desactualizado.
 * 7. Funciones puras de formateo temporal.
 *
 * El shell completo (`app.vue`) aporta a la cabecera los datos derivados del estado; esas
 * derivaciones se comprueban aquí sobre las mismas reglas: sesión primero, preparación después.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { compile, createSSRApp, h, nextTick, ssrContextKey, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { mount, type VueWrapper } from '@vue/test-utils'
import CabeceraModeracion from '../app/components/CabeceraModeracion.vue'
import fuenteCabeceraModeracion from '../app/components/CabeceraModeracion.vue?raw'
import {
  formatearFechaHoraLocal,
  formatearDuracion,
  calcularTiempoTranscurrido,
} from '../app/utils/tiempo'
import type { EstadoQuorum } from '@botonera2/api-client'

/**
 * Vitest ejecuta este paquete en entorno Node, donde el plugin de Vue produce `ssrRender`.
 * Para montar el componente real con @vue/test-utils hace falta además un render de cliente:
 * compilamos la plantilla exacta del componente productivo importada con `?raw`. No se replica
 * ninguna lógica; sólo se cubre la frontera de compilación que en un navegador ya viene resuelta.
 */
function habilitarRenderCliente(componente: Component, fuente: string): void {
  const coincidencia = fuente.match(/<template>([\s\S]*)<\/template>/)
  if (!coincidencia?.[1]) {
    throw new Error('No se encontró la plantilla Vue que debe compilarse para la prueba')
  }

  const componenteCompilable = componente as {
    render?: ReturnType<typeof compile>
    setup?: (props: unknown, contexto: unknown) => unknown
  }

  const setupOriginal = componenteCompilable.setup
  if (setupOriginal) {
    componenteCompilable.setup = (props, contexto) => {
      const resultado = setupOriginal(props, contexto)
      if (typeof resultado === 'object' && resultado !== null) {
        // El compilador SFC marca el resultado como `$setup`. Al compilar la plantilla en
        // runtime, copiar el objeto retira esa marca y habilita el acceso equivalente por `_ctx`.
        return { ...resultado }
      }
      return resultado
    }
  }

  componenteCompilable.render = compile(coincidencia[1], { hoistStatic: false })
}

habilitarRenderCliente(CabeceraModeracion, fuenteCabeceraModeracion)

/** Props mínimas obligatorias de la cabecera, para no repetirlas en cada caso. */
function propsBase(parcial: Record<string, unknown> = {}) {
  return {
    estadoConexion: 'CONECTADO',
    estadoGlobal: 'SESION_ABIERTA',
    revision: 7,
    desactualizado: false,
    ...parcial,
  }
}

/** Renderiza la cabecera a texto para inspeccionar su estructura sin montar el DOM. */
async function renderizarSSR(props: Record<string, unknown>): Promise<string> {
  const app = createSSRApp({
    render() {
      return h(CabeceraModeracion, props)
    },
  })
  return renderToString(app)
}

const montados: VueWrapper[] = []

/** Monta la cabecera real para poder observar la reactividad del reloj tick a tick. */
function montarCabecera(props: Record<string, unknown>): VueWrapper {
  // El componente compilado para SSR consulta el contexto de servidor durante su setup;
  // proveerlo explícitamente permite montarlo también como componente de cliente.
  const contextoSsr = { modules: new Set<string>() }
  const wrapper = mount(CabeceraModeracion, {
    props,
    global: { provide: { [ssrContextKey]: contextoSsr } },
  })
  montados.push(wrapper)
  return wrapper
}

describe('Utilidades de tiempo de la cabecera', () => {
  it('formatea fecha y hora local en formato compacto y estable', () => {
    // Se construye con componentes locales para no depender de la zona horaria del entorno.
    const fecha = new Date(2026, 7, 29, 9, 5, 3)
    expect(formatearFechaHoraLocal(fecha)).toBe('29/08/2026 09:05:03')
  })

  it('devuelve un guion ante una fecha inválida en lugar de texto basura', () => {
    expect(formatearFechaHoraLocal(new Date('no-es-una-fecha'))).toBe('—')
  })

  it('formatea duraciones como hh:mm:ss y recorta valores negativos a cero', () => {
    expect(formatearDuracion(0)).toBe('00:00:00')
    expect(formatearDuracion(45_000)).toBe('00:00:45')
    expect(formatearDuracion(3_725_000)).toBe('01:02:05')
    expect(formatearDuracion(90_000_000)).toBe('25:00:00')
    expect(formatearDuracion(-5_000)).toBe('00:00:00')
  })

  it('calcula el tiempo transcurrido desde la apertura formal y omite el dato sin sesión', () => {
    const ahora = new Date('2026-08-29T12:30:15Z')

    expect(calcularTiempoTranscurrido('2026-08-29T12:00:00Z', ahora)).toBe('00:30:15')
    expect(calcularTiempoTranscurrido(null, ahora)).toBeNull()
    expect(calcularTiempoTranscurrido(undefined, ahora)).toBeNull()
    expect(calcularTiempoTranscurrido('fecha-invalida', ahora)).toBeNull()
  })
})

describe('CabeceraModeracion (WP-036)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    while (montados.length > 0) {
      montados.pop()?.unmount()
    }
    vi.useRealTimers()
  })

  describe('Densidad e identidad', () => {
    it('conserva únicamente Moderación como identidad y no muestra la revisión de forma permanente', async () => {
      const html = await renderizarSSR(propsBase())

      expect(html).toContain('Moderación')
      expect(html).not.toContain('Botonera2')
      expect(html).not.toContain('BOTONERA2')
      expect(html).not.toContain('data-testid="revision-estado"')
      expect(html).not.toContain('Revisión:')
    })
  })

  describe('Reloj local y tiempo de sesión', () => {
    it('muestra la hora local y la actualiza con el paso del tiempo sin polling', async () => {
      vi.setSystemTime(new Date(2026, 7, 29, 10, 0, 0))
      const wrapper = montarCabecera(propsBase())

      expect(wrapper.get('[data-testid="cabecera-fecha-hora"]').text()).toBe('29/08/2026 10:00:00')

      // Un tick del temporizador local basta para refrescar la vista: no hay ningún fetch de por medio.
      vi.advanceTimersByTime(1000)
      await nextTick()

      expect(wrapper.get('[data-testid="cabecera-fecha-hora"]').text()).toBe('29/08/2026 10:00:01')
    })

    it('cancela su temporizador al desmontarse para no dejar trabajo pendiente', async () => {
      vi.setSystemTime(new Date(2026, 7, 29, 10, 0, 0))
      const wrapper = montarCabecera(propsBase())

      expect(vi.getTimerCount()).toBeGreaterThan(0)

      wrapper.unmount()
      montados.pop()

      expect(vi.getTimerCount()).toBe(0)
    })

    it('omite el tiempo de sesión mientras no exista fecha de apertura formal', async () => {
      const html = await renderizarSSR(
        propsBase({ estadoGlobal: 'PREPARANDO', fechaHoraApertura: null }),
      )

      expect(html).not.toContain('data-testid="cabecera-tiempo-sesion"')
    })

    it('deriva el tiempo de sesión de fecha_hora_apertura y del reloj local', async () => {
      vi.setSystemTime(new Date('2026-08-29T12:30:15Z'))
      const wrapper = montarCabecera(propsBase({ fechaHoraApertura: '2026-08-29T12:00:00Z' }))

      expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:30:15')

      vi.advanceTimersByTime(45_000)
      await nextTick()

      expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').text()).toContain('00:31:00')
    })
  })

  describe('Autoridades institucionales', () => {
    it('muestra Presidencia y Secretaría ya cargadas durante PREPARANDO', async () => {
      const html = await renderizarSSR(
        propsBase({
          estadoGlobal: 'PREPARANDO',
          presidencia: 'Dra. María Elena Walsh',
          secretariaLegislativa: 'Lic. Juan Gómez',
        }),
      )

      expect(html).toContain('data-testid="cabecera-presidencia"')
      expect(html).toContain('Dra. María Elena Walsh')
      expect(html).toContain('data-testid="cabecera-secretaria"')
      expect(html).toContain('Lic. Juan Gómez')
    })

    it('omite cada autoridad mientras no haya sido cargada', async () => {
      const html = await renderizarSSR(
        propsBase({
          estadoGlobal: 'PREPARANDO',
          presidencia: null,
          secretariaLegislativa: null,
        }),
      )

      expect(html).not.toContain('data-testid="cabecera-presidencia"')
      expect(html).not.toContain('data-testid="cabecera-secretaria"')
    })
  })

  describe('Quórum global', () => {
    it('presenta presentes, padrón y mínimo requerido cuando el quórum está alcanzado', async () => {
      const quorum: EstadoQuorum = { cantidad_presentes: 9, requerido: 7, alcanzado: true }
      const html = await renderizarSSR(propsBase({ quorum, totalConcejales: 12 }))

      expect(html).toContain('data-testid="cabecera-quorum"')
      expect(html).toContain('Quórum 9/12 · mín 7')
    })

    it('distingue explícitamente la falta de quórum', async () => {
      const quorum: EstadoQuorum = { cantidad_presentes: 5, requerido: 7, alcanzado: false }
      const html = await renderizarSSR(
        propsBase({ estadoGlobal: 'PREPARANDO', quorum, totalConcejales: 12 }),
      )

      expect(html).toContain('Sin quórum 5/12 · mín 7')
    })

    it('no muestra ningún indicador de quórum cuando el backend no lo proyecta', async () => {
      const html = await renderizarSSR(
        propsBase({ estadoGlobal: 'SIN_PREPARAR', quorum: null, totalConcejales: 12 }),
      )

      expect(html).not.toContain('data-testid="cabecera-quorum"')
      expect(html).not.toContain('Sin quórum')
    })
  })

  describe('Conexión y advertencia de desactualización', () => {
    it('refleja cada estado técnico de conexión con su etiqueta legible', async () => {
      const esperados: Array<[string, string]> = [
        ['INICIAL', 'Conectando'],
        ['CONECTADO', 'Conectado'],
        ['RECONECTANDO', 'Reconectando'],
        ['DESCONECTADO', 'Sin conexión'],
      ]

      for (const [estadoConexion, etiqueta] of esperados) {
        const html = await renderizarSSR(propsBase({ estadoConexion }))
        expect(html).toContain('data-testid="estado-conexion"')
        expect(html).toContain(etiqueta)
      }
    })

    it('mantiene la advertencia de estado desactualizado durante una reconexión', async () => {
      const html = await renderizarSSR(
        propsBase({ estadoConexion: 'RECONECTANDO', desactualizado: true }),
      )

      expect(html).toContain('data-testid="alerta-desactualizado"')
      expect(html).toContain('Estado desactualizado')
    })

    it('no muestra la advertencia mientras la conexión es plena', async () => {
      const html = await renderizarSSR(propsBase({ desactualizado: false }))

      expect(html).not.toContain('data-testid="alerta-desactualizado"')
    })
  })
})
