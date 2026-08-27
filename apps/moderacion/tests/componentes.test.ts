/**
 * Pruebas unitarias de renderizado para los componentes visuales del Shell de Moderación.
 *
 * Utiliza el renderizador nativo de Vue 3 (renderToString / createSSRApp) en entorno Node,
 * validando que los componentes generen la estructura semántica, textos, badges y estados
 * esperados sin dependencias externas adicionales.
 *
 * Valida:
 * 1. Cabecera con estado inicial sin snapshot (guiones en estado y revisión).
 * 2. Cabecera con estado conectado y datos confirmados.
 * 3. Cabecera con advertencia de desactualizado durante reconexión.
 * 4. Los cuatro paneles y sus identidades visuales estables.
 */

import { describe, it, expect } from 'vitest'
import { createSSRApp, h, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import CabeceraModeracion from '../app/components/CabeceraModeracion.vue'
import PanelContenedor from '../app/components/PanelContenedor.vue'
import PanelSesionVotacion from '../app/components/PanelSesionVotacion.vue'
import PanelOrdenDelDia from '../app/components/PanelOrdenDelDia.vue'
import PanelRecintoPalabra from '../app/components/PanelRecintoPalabra.vue'
import PanelEventos from '../app/components/PanelEventos.vue'
import type { EstadoModeracion } from '@botonera2/api-client'

async function renderizarComponente(
  componente: Component,
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {},
) {
  const app = createSSRApp({
    render() {
      return h(componente, props, slots)
    },
  })
  return renderToString(app)
}

function crearEstadoFixture(parcial: Partial<EstadoModeracion> = {}): EstadoModeracion {
  return {
    revision: parcial.revision ?? 5,
    generado_en: parcial.generado_en ?? '2026-08-24T12:00:00Z',
    estado_global: parcial.estado_global ?? 'PREPARANDO',
    preparacion: parcial.preparacion ?? {
      numero_sesion: 42,
      presidencia: 'Dra. García',
      secretaria_legislativa: 'Lic. Pérez',
    },
    sesion: parcial.sesion ?? null,
    configuracion: parcial.configuracion ?? null,
    concejales: parcial.concejales ?? [
      {
        banca: 1,
        dni: '12345678',
        nombre: 'Juan',
        apellido: 'López',
        nombre_mostrar: 'Juan López',
        bloque: 'Bloque A',
        ruta_imagen: '/fotos/1.jpg',
        dispositivo: 'dev01',
        presente: true,
        test_visual_activo: false,
      },
    ],
    quorum: parcial.quorum ?? {
      cantidad_presentes: 8,
      requerido: 7,
      alcanzado: true,
    },
    votacion: parcial.votacion ?? null,
    palabra: parcial.palabra ?? {
      orador: {
        dni: '12345678',
        nombre: 'Juan',
        apellido: 'López',
        banca: 1,
      },
      cola: [],
    },
    orden_del_dia: parcial.orden_del_dia ?? [
      {
        nro_votacion: 1,
        tipo: 'Proyecto',
        tema: 'Presupuesto Anual',
        tipo_mayoria: 'SIMPLE',
        factor: 0,
        base: 'VOTOS_COMPUTABLES',
      },
    ],
    eventos_recientes: parcial.eventos_recientes ?? [
      {
        seq: 101,
        timestamp: '2026-08-24T12:00:01Z',
        nivel: 'L3',
        etiqueta: 'SESION',
        codigo_evento: 'PREPARACION_INICIADA',
        mensaje: 'Preparación de sala iniciada',
      },
    ],
    auditoria: parcial.auditoria ?? {
      disponible: true,
      directorio: '/tmp',
      ultimo_error: null,
    },
    remapeo: parcial.remapeo ?? null,
    capacidades: parcial.capacidades ?? {
      preparar_sala: { habilitada: false, motivos: [] },
      actualizar_preparacion: { habilitada: true, motivos: [] },
      cancelar_preparacion: { habilitada: true, motivos: [] },
      abrir_sesion: { habilitada: true, motivos: [] },
      actualizar_sesion: { habilitada: false, motivos: [] },
      cerrar_sesion: { habilitada: false, motivos: [] },
      cargar_orden_del_dia: { habilitada: true, motivos: [] },
      descartar_orden_del_dia: { habilitada: true, motivos: [] },
      abrir_votacion: { habilitada: false, motivos: [] },
      finalizar_votacion: { habilitada: false, motivos: [] },
      desempatar: { habilitada: false, motivos: [] },
      otorgar_palabra: { habilitada: true, motivos: [] },
      quitar_palabra: { habilitada: true, motivos: [] },
      iniciar_remapeo: { habilitada: true, motivos: [] },
      confirmar_remapeo: { habilitada: false, motivos: [] },
      cancelar_remapeo: { habilitada: false, motivos: [] },
    },
  }
}

describe('Componentes del Shell de Moderación', () => {
  describe('CabeceraModeracion', () => {
    it('muestra estado inicial con guiones sin inventar estado global ni revisión', async () => {
      const html = await renderizarComponente(CabeceraModeracion, {
        estadoConexion: 'INICIAL',
        estadoGlobal: null,
        revision: null,
        desactualizado: false,
      })

      expect(html).toContain('Botonera2')
      expect(html).toContain('Moderación')
      expect(html).toContain('data-testid="estado-global"')
      expect(html).toContain('—')
      expect(html).toContain('data-testid="revision-estado"')
      expect(html).toContain('Iniciando conexión...')
      expect(html).not.toContain('data-testid="alerta-desactualizado"')
    })

    it('muestra estado conectado con revisión y estado global confirmado', async () => {
      const html = await renderizarComponente(CabeceraModeracion, {
        estadoConexion: 'CONECTADO',
        estadoGlobal: 'SESION_ABIERTA',
        revision: 142,
        desactualizado: false,
      })

      expect(html).toContain('Sesión abierta')
      expect(html).toContain('142')
      expect(html).toContain('Conectado')
      expect(html).not.toContain('data-testid="alerta-desactualizado"')
    })

    it('muestra alerta visible de desactualizado durante reconexión', async () => {
      const html = await renderizarComponente(CabeceraModeracion, {
        estadoConexion: 'RECONECTANDO',
        estadoGlobal: 'SESION_ABIERTA',
        revision: 142,
        desactualizado: true,
      })

      expect(html).toContain('data-testid="alerta-desactualizado"')
      expect(html).toContain('Estado posiblemente desactualizado')
      expect(html).toContain('Reconectando')
    })
  })

  describe('PanelContenedor', () => {
    it('renderiza título, subtítulo, badge y contenido del slot', async () => {
      const html = await renderizarComponente(
        PanelContenedor,
        {
          titulo: 'Título de Prueba',
          subtitulo: 'Subtítulo descriptivo',
          badge: 'Activo',
          dataTestid: 'panel-prueba',
        },
        {
          default: () => h('p', { class: 'contenido-slot' }, 'Contenido interno'),
        },
      )

      expect(html).toContain('data-testid="panel-prueba"')
      expect(html).toContain('Título de Prueba')
      expect(html).toContain('Subtítulo descriptivo')
      expect(html).toContain('Activo')
      expect(html).toContain('Contenido interno')
    })
  })

  describe('PanelSesionVotacion', () => {
    it('renderiza el cuadrante de sesión y votación con sus datos', async () => {
      const estado = crearEstadoFixture()
      const html = await renderizarComponente(PanelSesionVotacion, { estado })

      expect(html).toContain('data-testid="panel-sesion-votacion"')
      expect(html).toContain('Sesión y votación')
      expect(html).toContain('PREPARANDO')
      expect(html).toContain('Dra. García')
    })
  })

  describe('PanelOrdenDelDia', () => {
    it('renderiza los puntos del Orden del Día', async () => {
      const estado = crearEstadoFixture()
      const html = await renderizarComponente(PanelOrdenDelDia, { estado })

      expect(html).toContain('data-testid="panel-orden-del-dia"')
      expect(html).toContain('Orden del Día')
      expect(html).toContain('Presupuesto Anual')
      expect(html).toContain('1 puntos')
    })

    it('tolera y renderiza puntos con números de votación duplicados o no correlativos (M-2)', async () => {
      const estado = crearEstadoFixture({
        orden_del_dia: [
          {
            nro_votacion: 1,
            tipo: 'Proyecto',
            tema: 'Primer tema con nro 1',
            tipo_mayoria: 'SIMPLE',
            factor: 0,
            base: 'VOTOS_COMPUTABLES',
          },
          {
            nro_votacion: 1,
            tipo: 'Resolución',
            tema: 'Segundo tema con nro 1 repetido',
            tipo_mayoria: 'ESPECIAL',
            factor: 0.66,
            base: 'PRESENTES',
          },
        ],
      })
      const html = await renderizarComponente(PanelOrdenDelDia, { estado })

      expect(html).toContain('Primer tema con nro 1')
      expect(html).toContain('Segundo tema con nro 1 repetido')
      expect(html).toContain('2 puntos')
    })
  })

  describe('PanelRecintoPalabra', () => {
    it('renderiza datos de quórum y orador de palabra', async () => {
      const estado = crearEstadoFixture()
      const html = await renderizarComponente(PanelRecintoPalabra, { estado })

      expect(html).toContain('data-testid="panel-recinto-palabra"')
      expect(html).toContain('Recinto y palabra')
      expect(html).toContain('Quórum alcanzado')
      expect(html).toContain('Juan López')
    })
  })

  describe('PanelEventos', () => {
    it('renderiza los eventos recientes auditados en su listado', async () => {
      const estado = crearEstadoFixture()
      const html = await renderizarComponente(PanelEventos, { estado })

      expect(html).toContain('data-testid="panel-eventos"')
      expect(html).toContain('Eventos')
      expect(html).toContain('#101')
      expect(html).toContain('PREPARACION_INICIADA')
      expect(html).toContain('Preparación de sala iniciada')
    })
  })
})
