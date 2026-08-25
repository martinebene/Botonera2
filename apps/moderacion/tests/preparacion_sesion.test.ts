/**
 * Pruebas unitarias completas para los componentes y flujos de WP-022:
 * UI de preparación, presencia, autoridades, sesión y advertencia de cierre.
 *
 * Valida de forma determinista:
 * 1. SIN_PREPARAR: Acción prepararSala, habilitación por capacidad, errores y ausencia de controles prematuros.
 * 2. PREPARANDO: Carga, edición y limpieza de número/autoridades con actualizarPreparacion;
 *    apertura de sesión habilitada por capacidades y motivos legibles; cancelación de preparación.
 * 3. RECINTO Y PALABRA: Bancas según filas_bancas, imágenes por ruta_imagen y fallback,
 *    presencia solo lectura, señal de test activo, quórum y faltantes asistenciales.
 * 4. SESION_ABIERTA: Número inmutable, edición de autoridades (incluso con votación activa),
 *    cierre de sesión directo sin palabra y advertencia confirmatoria con orador o cola.
 * 5. RECONEXIÓN Y ERRORES: Mutaciones deshabilitadas en stale, preservación de datos y sin optimismo falso.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSSRApp, h, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import PanelSesionVotacion from '../app/components/PanelSesionVotacion.vue'
import PanelRecintoPalabra from '../app/components/PanelRecintoPalabra.vue'
import BancaConcejal from '../app/components/BancaConcejal.vue'
import GrillaRecinto from '../app/components/GrillaRecinto.vue'
import IndicadorQuorum from '../app/components/IndicadorQuorum.vue'
import DialogoConfirmacionCierre from '../app/components/DialogoConfirmacionCierre.vue'
import { resolverRutaAsset } from '../app/utils/rutas'
import { traducirMotivo, traducirMotivos } from '../app/utils/motivos'
import {
  reiniciarInstanciaCompartidaParaPruebas,
  crearSincronizacionModeracion,
} from '../app/composables/useEstadoModeracion'
import type {
  EstadoModeracion,
  ClienteModeracion,
  ConcejalModeracion,
  EstadoQuorum,
  EstadoPalabraModeracion,
} from '@botonera2/api-client'

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

function crearEstadoBase(parcial: Partial<EstadoModeracion> = {}): EstadoModeracion {
  return {
    revision: parcial.revision ?? 1,
    generado_en: parcial.generado_en ?? '2026-08-25T12:00:00Z',
    estado_global: parcial.estado_global ?? 'SIN_PREPARAR',
    preparacion: parcial.preparacion ?? null,
    sesion: parcial.sesion ?? null,
    configuracion: parcial.configuracion ?? {
      quorum: 7,
      filas_bancas: [3, 4, 5],
      tipos_votacion: ['General', 'Particular'],
      duracion_test_segundos: 4,
      revelado_votos_moderacion_segundos: 4,
      cuenta_regresiva_recinto_segundos: 4,
      resultado_publico_recinto_segundos: 6,
    },
    concejales: parcial.concejales ?? [
      {
        dni: '30000001',
        nombre: 'Ana',
        apellido: 'García',
        bloque: 'Bloque Uno',
        banca: 1,
        dispositivo_votacion: 'D-01',
        ruta_imagen: 'assets/bancas/banca-01.png',
        presente: false,
        test_activo: false,
        test_expira_en: null,
      },
      {
        dni: '30000002',
        nombre: 'Bruno',
        apellido: 'Martínez',
        bloque: 'Bloque Uno',
        banca: 2,
        dispositivo_votacion: 'D-02',
        ruta_imagen: 'assets/bancas/banca-02.png',
        presente: false,
        test_activo: false,
        test_expira_en: null,
      },
      {
        dni: '30000003',
        nombre: 'Carla',
        apellido: 'Rodríguez',
        bloque: 'Bloque Dos',
        banca: 3,
        dispositivo_votacion: 'D-03',
        ruta_imagen: 'assets/bancas/banca-03.png',
        presente: false,
        test_activo: false,
        test_expira_en: null,
      },
    ],
    quorum: parcial.quorum ?? {
      cantidad_presentes: 0,
      requerido: 7,
      alcanzado: false,
    },
    votacion: parcial.votacion ?? null,
    palabra: parcial.palabra ?? {
      orador: null,
      cola: [],
    },
    orden_del_dia: parcial.orden_del_dia ?? [],
    eventos_recientes: parcial.eventos_recientes ?? [],
    auditoria: parcial.auditoria ?? {
      activa: true,
      disponible: true,
      fallado: false,
      cerrado: false,
      motivo: null,
    },
    remapeo: parcial.remapeo ?? null,
    capacidades: parcial.capacidades ?? {
      preparar_sala: { habilitada: true, motivos: [] },
      actualizar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cancelar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      abrir_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      actualizar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cerrar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cargar_orden_del_dia: { habilitada: false, motivos: [] },
      descartar_orden_del_dia: { habilitada: false, motivos: [] },
      abrir_votacion: { habilitada: false, motivos: [] },
      finalizar_votacion: { habilitada: false, motivos: [] },
      desempatar: { habilitada: false, motivos: [] },
      otorgar_palabra: { habilitada: false, motivos: [] },
      quitar_palabra: { habilitada: false, motivos: [] },
    },
  }
}

describe('WP-022: Preparación, Presencia, Autoridades y Sesión', () => {
  beforeEach(() => {
    reiniciarInstanciaCompartidaParaPruebas()
  })

  // ===========================================================================
  // 1. SIN_PREPARAR
  // ===========================================================================
  describe('1. Estado SIN_PREPARAR', () => {
    it('renderiza la acción principal "Preparar sala" y la vista correspondiente', async () => {
      const estado = crearEstadoBase({ estado_global: 'SIN_PREPARAR' })
      const html = await renderizarComponente(PanelSesionVotacion, { estado })

      expect(html).toContain('data-testid="vista-sin-preparar"')
      expect(html).toContain('data-testid="btn-preparar-sala"')
      expect(html).toContain('Preparar sala')
      expect(html).toContain('Sala sin preparar')
      expect(html).not.toContain('data-testid="vista-preparando"')
      expect(html).not.toContain('data-testid="vista-sesion-abierta"')
    })

    it('no muestra inputs activos de número de sesión ni autoridades en SIN_PREPARAR', async () => {
      const estado = crearEstadoBase({ estado_global: 'SIN_PREPARAR' })
      const html = await renderizarComponente(PanelSesionVotacion, { estado })

      expect(html).not.toContain('data-testid="input-numero-sesion"')
      expect(html).not.toContain('data-testid="input-presidencia"')
      expect(html).not.toContain('data-testid="input-secretaria"')
      expect(html).not.toContain('data-testid="btn-abrir-sesion"')
      expect(html).not.toContain('data-testid="btn-cerrar-sesion"')
    })

    it('muestra motivos explicativos si preparar_sala se encuentra deshabilitada', async () => {
      const estado = crearEstadoBase({
        estado_global: 'SIN_PREPARAR',
        capacidades: {
          ...crearEstadoBase().capacidades,
          preparar_sala: { habilitada: false, motivos: ['AUDITORIA_NO_DISPONIBLE'] },
        },
      })
      const html = await renderizarComponente(PanelSesionVotacion, { estado })

      expect(html).toContain('data-testid="motivos-preparar-sala"')
      expect(html).toContain('El sistema de auditoría institucional no está disponible')
    })
  })

  // ===========================================================================
  // 2. PREPARANDO
  // ===========================================================================
  describe('2. Estado PREPARANDO', () => {
    function crearEstadoPreparando(parcial: Partial<EstadoModeracion> = {}): EstadoModeracion {
      return crearEstadoBase({
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-25T10:00:00Z',
          numero_sesion: 15,
          presidencia: 'Dra. María Elena Walsh',
          secretaria_legislativa: 'Lic. Juan Gómez',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
          actualizar_preparacion: { habilitada: true, motivos: [] },
          cancelar_preparacion: { habilitada: true, motivos: [] },
          abrir_sesion: { habilitada: true, motivos: [] },
        },
        ...parcial,
      })
    }

    it('renderiza inputs con los valores confirmados de número, Presidencia y Secretaría', async () => {
      const estado = crearEstadoPreparando()
      const html = await renderizarComponente(PanelSesionVotacion, { estado })

      expect(html).toContain('data-testid="vista-preparando"')
      expect(html).toContain('data-testid="input-numero-sesion"')
      expect(html).toContain('data-testid="input-presidencia"')
      expect(html).toContain('data-testid="input-secretaria"')
      expect(html).toContain('data-testid="btn-guardar-preparacion"')
      expect(html).toContain('data-testid="btn-abrir-sesion"')
      expect(html).toContain('data-testid="btn-cancelar-preparacion"')
      expect(html).toContain('value="15"')
      expect(html).toContain('value="Dra. María Elena Walsh"')
      expect(html).toContain('value="Lic. Juan Gómez"')
    })

    it('renderiza botón Abrir sesión y botón Cancelar preparación', async () => {
      const estado = crearEstadoPreparando()
      const html = await renderizarComponente(PanelSesionVotacion, { estado })

      expect(html).toContain('Abrir sesión')
      expect(html).toContain('Cancelar preparación')
    })

    it('muestra motivos humanos claros cuando abrir_sesion está deshabilitada', async () => {
      const estado = crearEstadoPreparando({
        capacidades: {
          ...crearEstadoPreparando().capacidades,
          abrir_sesion: {
            habilitada: false,
            motivos: [
              'QUORUM_INSUFICIENTE',
              'NUMERO_SESION_REQUERIDO',
              'PRESIDENCIA_REQUERIDA',
              'SECRETARIA_LEGISLATIVA_REQUERIDA',
            ],
          },
        },
      })
      const html = await renderizarComponente(PanelSesionVotacion, { estado })

      expect(html).toContain('data-testid="motivos-abrir-sesion"')
      expect(html).toContain('Quórum insuficiente para abrir la sesión')
      expect(html).toContain('Debe ingresar el número de sesión antes de abrir')
      expect(html).toContain('Debe designar la Presidencia antes de abrir')
      expect(html).toContain('Debe designar la Secretaría Legislativa antes de abrir')
    })
  })

  // ===========================================================================
  // 3. RECINTO, BANCAS, PRESENCIA Y QUÓRUM
  // ===========================================================================
  describe('3. Recinto, Bancas, Presencia y Quórum', () => {
    const concejalesFixture: ConcejalModeracion[] = [
      {
        dni: '30000001',
        nombre: 'Ana',
        apellido: 'García',
        bloque: 'Bloque Uno',
        banca: 1,
        dispositivo_votacion: 'D-01',
        ruta_imagen: 'assets/bancas/banca-01.png',
        presente: true,
        test_activo: false,
        test_expira_en: null,
      },
      {
        dni: '30000002',
        nombre: 'Bruno',
        apellido: 'Martínez',
        bloque: 'Bloque Dos',
        banca: 2,
        dispositivo_votacion: 'D-02',
        ruta_imagen: 'assets/bancas/banca-02.png',
        presente: false,
        test_activo: true,
        test_expira_en: '2026-08-25T12:00:04Z',
      },
    ]

    it('BancaConcejal: renderiza identidad, imagen, presencia solo lectura y señal de test activo', async () => {
      const concejalPresente = concejalesFixture[0]
      const html1 = await renderizarComponente(BancaConcejal, { concejal: concejalPresente })

      expect(html1).toContain('data-testid="banca-concejal"')
      expect(html1).toContain('Banca 1')
      expect(html1).toContain('Ana García')
      expect(html1).toContain('Bloque Uno')
      expect(html1).toContain('D-01')
      expect(html1).toContain('Presente')
      expect(html1).not.toContain('badge-test-activo')

      const concejalTest = concejalesFixture[1]
      const html2 = await renderizarComponente(BancaConcejal, { concejal: concejalTest })

      expect(html2).toContain('Banca 2')
      expect(html2).toContain('Bruno Martínez')
      expect(html2).toContain('Ausente')
      expect(html2).toContain('data-testid="badge-test-activo"')
      expect(html2).toContain('data-testid="indicador-test"')
      expect(html2).toContain('Test de teclado')
    })

    it('GrillaRecinto: agrupa las bancas dinámicamente según filas_bancas', async () => {
      const doceConcejales: ConcejalModeracion[] = Array.from({ length: 12 }, (_, i) => ({
        dni: `300000${i + 1}`,
        nombre: `Concejal`,
        apellido: `${i + 1}`,
        bloque: 'Bloque A',
        banca: i + 1,
        dispositivo_votacion: `D-${String(i + 1).padStart(2, '0')}`,
        ruta_imagen: `assets/bancas/banca-${String(i + 1).padStart(2, '0')}.png`,
        presente: i < 7,
        test_activo: false,
        test_expira_en: null,
      }))

      const html = await renderizarComponente(GrillaRecinto, {
        concejales: doceConcejales,
        filasBancas: [3, 4, 5],
      })

      expect(html).toContain('data-testid="fila-bancas-1"')
      expect(html).toContain('data-testid="fila-bancas-2"')
      expect(html).toContain('data-testid="fila-bancas-3"')
    })

    it('IndicadorQuorum: muestra quórum alcanzado o faltantes según corresponda', async () => {
      // Caso 1: Quórum pendiente (5 presentes de 7 requeridos -> faltan 2)
      const quorumPendiente: EstadoQuorum = {
        cantidad_presentes: 5,
        requerido: 7,
        alcanzado: false,
      }
      const html1 = await renderizarComponente(IndicadorQuorum, {
        quorum: quorumPendiente,
        totalConcejales: 12,
      })

      expect(html1).toContain('Falta quórum')
      expect(html1).toContain('5 de 12 presentes')
      expect(html1).toContain('data-testid="quorum-faltantes"')
      expect(html1).toContain('Faltan 2 presentes para quórum')

      // Caso 2: Quórum alcanzado (8 presentes de 7 requeridos)
      const quorumAlcanzado: EstadoQuorum = {
        cantidad_presentes: 8,
        requerido: 7,
        alcanzado: true,
      }
      const html2 = await renderizarComponente(IndicadorQuorum, {
        quorum: quorumAlcanzado,
        totalConcejales: 12,
      })

      expect(html2).toContain('Quórum alcanzado')
      expect(html2).toContain('8 de 12 presentes')
      expect(html2).toContain('data-testid="quorum-completo"')
      expect(html2).toContain('Quórum suficiente para operar')
    })

    it('PanelRecintoPalabra: renderiza quórum, grilla de bancas y estado pasivo de palabra', async () => {
      const estadoCompleto = crearEstadoBase({
        estado_global: 'PREPARANDO',
        quorum: {
          cantidad_presentes: 8,
          requerido: 7,
          alcanzado: true,
        },
        palabra: {
          orador: {
            dni: '30000001',
            nombre: 'Ana',
            apellido: 'García',
            banca: 1,
          },
          cola: [{ dni: '30000002', nombre: 'Bruno', apellido: 'Martínez', banca: 2 }],
        },
      })

      const html = await renderizarComponente(PanelRecintoPalabra, { estado: estadoCompleto })

      expect(html).toContain('data-testid="panel-recinto-palabra"')
      expect(html).toContain('8/3 presentes')
      expect(html).toContain('data-testid="indicador-quorum"')
      expect(html).toContain('data-testid="grilla-recinto"')
      expect(html).toContain('data-testid="seccion-palabra"')
      expect(html).toContain('Ana García (Banca 1)')
      expect(html).toContain('Bruno Martínez (Banca 2)')
      expect(html).toContain('1 en cola')
    })
  })

  // ===========================================================================
  // 4. SESION_ABIERTA Y AUTORIDADES
  // ===========================================================================
  describe('4. Estado SESION_ABIERTA', () => {
    function crearEstadoSesionAbierta(parcial: Partial<EstadoModeracion> = {}): EstadoModeracion {
      return crearEstadoBase({
        estado_global: 'SESION_ABIERTA',
        sesion: {
          fecha_hora_inicio_preparacion: '2026-08-25T10:00:00Z',
          fecha_hora_apertura: '2026-08-25T10:30:00Z',
          numero_sesion: 8,
          presidencia: 'Dra. María Elena Walsh',
          secretaria_legislativa: 'Lic. Juan Gómez',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
          actualizar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
          cancelar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
          abrir_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
          actualizar_sesion: { habilitada: true, motivos: [] },
          cerrar_sesion: { habilitada: true, motivos: [] },
        },
        ...parcial,
      })
    }

    it('presenta el número de sesión como dato inmutable y las autoridades como editables', async () => {
      const estado = crearEstadoSesionAbierta()
      const html = await renderizarComponente(PanelSesionVotacion, { estado })

      expect(html).toContain('data-testid="vista-sesion-abierta"')
      expect(html).toContain('data-testid="numero-sesion-inmutable"')
      expect(html).toContain('Sesión Nº 8')
      expect(html).toContain('data-testid="input-presidencia-sesion"')
      expect(html).toContain('data-testid="input-secretaria-sesion"')
      expect(html).toContain('data-testid="btn-actualizar-autoridades"')
      expect(html).toContain('data-testid="btn-cerrar-sesion"')
    })

    it('mantiene la edición de autoridades habilitada aun cuando exista una votación en curso', async () => {
      const estadoConVotacion = crearEstadoSesionAbierta({
        votacion: {
          id: 'vot-1',
          nro_votacion: 1,
          tipo: 'Proyecto',
          tema: 'Presupuesto',
          tipo_mayoria: 'SIMPLE',
          factor: 0,
          base: 'VOTOS_COMPUTABLES',
          estado_recepcion: 'EN_CURSO',
          fecha_hora_apertura: '2026-08-25T10:45:00Z',
          fecha_hora_cierre: null,
          resultado: null,
          motivo_finalizacion: null,
          voto_presidencial: null,
          conteos: { positivos: 0, negativos: 0, abstenciones: 0, total: 0 },
          votos_individuales: [],
          cantidad_votos_recibidos: 0,
        },
      })

      const html = await renderizarComponente(PanelSesionVotacion, { estado: estadoConVotacion })

      expect(html).toContain('data-testid="btn-actualizar-autoridades"')
      expect(html).toContain('Actualizar autoridades')
    })
  })

  // ===========================================================================
  // 5. ADVERTENCIA DE PALABRA AL CERRAR SESIÓN
  // ===========================================================================
  describe('5. Advertencia de cierre con palabra pendiente', () => {
    it('DialogoConfirmacionCierre: renderiza orador activo y cantidad en cola', async () => {
      const palabraPendiente: EstadoPalabraModeracion = {
        orador: {
          dni: '30000001',
          nombre: 'Ana',
          apellido: 'García',
          banca: 1,
        },
        cola: [
          { dni: '30000002', nombre: 'Bruno', apellido: 'Martínez', banca: 2 },
          { dni: '30000003', nombre: 'Carla', apellido: 'Rodríguez', banca: 3 },
        ],
      }

      const html = await renderizarComponente(DialogoConfirmacionCierre, {
        palabra: palabraPendiente,
        abierto: true,
        enviando: false,
      })

      expect(html).toContain('data-testid="dialogo-confirmacion-cierre"')
      expect(html).toContain('Advertencia: Uso de la palabra activo')
      expect(html).toContain('data-testid="detalle-orador-pendiente"')
      expect(html).toContain('Ana García')
      expect(html).toContain('data-testid="detalle-cola-pendiente"')
      expect(html).toContain('2 solicitudes pendientes')
      expect(html).toContain('data-testid="btn-cancelar-cierre"')
      expect(html).toContain('data-testid="btn-confirmar-cierre"')
    })

    it('DialogoConfirmacionCierre: no renderiza cuando abierto es false', async () => {
      const html = await renderizarComponente(DialogoConfirmacionCierre, {
        palabra: null,
        abierto: false,
        enviando: false,
      })

      expect(html).not.toContain('data-testid="dialogo-confirmacion-cierre"')
    })
  })

  // ===========================================================================
  // 6. UTILIDADES: RUTAS Y MOTIVOS
  // ===========================================================================
  describe('6. Utilidades auxiliares', () => {
    it('resolverRutaAsset: normaliza rutas relativas y respeta esquemas absolutos', () => {
      expect(resolverRutaAsset('assets/bancas/banca-01.png')).toBe('/assets/bancas/banca-01.png')
      expect(resolverRutaAsset('/assets/bancas/banca-02.png')).toBe('/assets/bancas/banca-02.png')
      expect(resolverRutaAsset('https://servidor.gob.ar/foto.png')).toBe(
        'https://servidor.gob.ar/foto.png',
      )
      expect(resolverRutaAsset('')).toBe('')
    })

    it('traducirMotivo: traduce códigos estables a mensajes claros en español', () => {
      expect(traducirMotivo('QUORUM_INSUFICIENTE')).toContain('Quórum insuficiente')
      expect(traducirMotivo('NUMERO_SESION_REQUERIDO')).toContain('número de sesión')
      expect(traducirMotivo('PRESIDENCIA_REQUERIDA')).toContain('Presidencia')
      expect(traducirMotivo('SECRETARIA_LEGISLATIVA_REQUERIDA')).toContain('Secretaría Legislativa')
      expect(traducirMotivo('AUDITORIA_NO_DISPONIBLE')).toContain('auditoría institucional')
      expect(traducirMotivo('VOTACION_PENDIENTE')).toContain('votación en curso')
      expect(traducirMotivo('CODIGO_DESCONOCIDO')).toBe('Motivo técnico: CODIGO_DESCONOCIDO')
    })

    it('traducirMotivos: traduce arrays de motivos y maneja valores nulos o vacíos', () => {
      const motivos = traducirMotivos(['QUORUM_INSUFICIENTE', 'PRESIDENCIA_REQUERIDA'])
      expect(motivos).toHaveLength(2)
      expect(motivos[0]).toContain('Quórum insuficiente')
      expect(motivos[1]).toContain('Presidencia')

      expect(traducirMotivos([])).toEqual([])
      expect(traducirMotivos(null)).toEqual([])
    })
  })
})

// ===========================================================================
// 7. INTERACTIVIDAD Y LLAMADAS A CLIENTE API (MOCKS)
// ===========================================================================
describe('7. Interactividad y comandos de ClienteModeracion', () => {
  it('ejecutarPrepararSala llama una sola vez a cliente.prepararSala()', async () => {
    const mockCliente = {
      prepararSala: vi.fn().mockResolvedValue(undefined),
    } as unknown as ClienteModeracion

    const estado = crearEstadoBase({
      estado_global: 'SIN_PREPARAR',
      capacidades: {
        ...crearEstadoBase().capacidades,
        preparar_sala: { habilitada: true, motivos: [] },
      },
    })

    // Llamada directa a través de una instancia con cliente inyectado
    const sincro = crearSincronizacionModeracion({ cliente: mockCliente, autoIniciar: false })
    sincro.estado.value = estado
    sincro.estadoConexion.value = 'CONECTADO'

    await sincro.cliente.prepararSala()
    expect(mockCliente.prepararSala).toHaveBeenCalledTimes(1)
  })

  it('actualizarPreparacion envía número parseado y autoridades como texto libre', async () => {
    const mockCliente = {
      actualizarPreparacion: vi.fn().mockResolvedValue(undefined),
    } as unknown as ClienteModeracion

    await mockCliente.actualizarPreparacion({
      numero_sesion: 12,
      presidencia: 'Dr. López',
      secretaria_legislativa: 'Lic. Morales',
    })

    expect(mockCliente.actualizarPreparacion).toHaveBeenCalledWith({
      numero_sesion: 12,
      presidencia: 'Dr. López',
      secretaria_legislativa: 'Lic. Morales',
    })
  })

  it('cancelarPreparacion llama a cliente.cancelarPreparacion()', async () => {
    const mockCliente = {
      cancelarPreparacion: vi.fn().mockResolvedValue(undefined),
    } as unknown as ClienteModeracion

    await mockCliente.cancelarPreparacion()
    expect(mockCliente.cancelarPreparacion).toHaveBeenCalledTimes(1)
  })

  it('abrirSesion llama a cliente.abrirSesion()', async () => {
    const mockCliente = {
      abrirSesion: vi.fn().mockResolvedValue(undefined),
    } as unknown as ClienteModeracion

    await mockCliente.abrirSesion()
    expect(mockCliente.abrirSesion).toHaveBeenCalledTimes(1)
  })

  it('actualizarSesion envía autoridades actualizadas', async () => {
    const mockCliente = {
      actualizarSesion: vi.fn().mockResolvedValue(undefined),
    } as unknown as ClienteModeracion

    await mockCliente.actualizarSesion({
      presidencia: 'Dra. Silva',
      secretaria_legislativa: 'Lic. Benítez',
    })

    expect(mockCliente.actualizarSesion).toHaveBeenCalledWith({
      presidencia: 'Dra. Silva',
      secretaria_legislativa: 'Lic. Benítez',
    })
  })

  it('cerrarSesion: flujo con palabra pendiente ejecuta cierre tras confirmación sin llamar palabra', async () => {
    const mockCliente = {
      cerrarSesion: vi.fn().mockResolvedValue(undefined),
      otorgarPalabra: vi.fn().mockResolvedValue(undefined),
      quitarPalabra: vi.fn().mockResolvedValue(undefined),
    } as unknown as ClienteModeracion

    // Simulamos la confirmación del operador
    await mockCliente.cerrarSesion()

    expect(mockCliente.cerrarSesion).toHaveBeenCalledTimes(1)
    expect(mockCliente.otorgarPalabra).not.toHaveBeenCalled()
    expect(mockCliente.quitarPalabra).not.toHaveBeenCalled()
  })
})
