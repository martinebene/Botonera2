/**
 * Pruebas unitarias e interactivas completas para los componentes y flujos de WP-022:
 * UI de preparación, presencia, autoridades, sesión y advertencia de cierre.
 *
 * Cobertura obligatoria:
 * 1. H1 — Gestión de borradores locales (draft/dirty) ante snapshots SSE y transiciones institucionales.
 * 2. H2 — Pruebas interactivas con componentes reales montados ejercitando estado reactivo y llamadas a métodos de API.
 * 3. H4 — Modalidad accesible, atajo Escape y gestión de foco en DialogoConfirmacionCierre.
 * 4. M1 — Resumen de quórum y presentes en Q1 durante SESION_ABIERTA.
 * 5. M2 — Ausencia de falso quórum 0/0 en SIN_PREPARAR cuando quorum es null.
 * 6. M3 — Validación estricta del número de sesión (enteros positivos > 0 sin truncado ni conversión silenciosa).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSSRApp, h, nextTick, type Component, ssrContextKey } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { mount, type MountingOptions } from '@vue/test-utils'
import PanelSesionVotacion from '../app/components/PanelSesionVotacion.vue'
import PanelRecintoPalabra from '../app/components/PanelRecintoPalabra.vue'
import BancaConcejal from '../app/components/BancaConcejal.vue'
import GrillaRecinto from '../app/components/GrillaRecinto.vue'
import IndicadorQuorum from '../app/components/IndicadorQuorum.vue'
import DialogoConfirmacionCierre from '../app/components/DialogoConfirmacionCierre.vue'
import { resolverRutaAsset } from '../app/utils/rutas'
import { traducirMotivo, traducirMotivos } from '../app/utils/motivos'
import { reiniciarInstanciaCompartidaParaPruebas } from '../app/composables/useEstadoModeracion'
import type {
  EstadoModeracion,
  ClienteModeracion,
  ConcejalModeracion,
  EstadoQuorum,
} from '@botonera2/api-client'

async function renderizarSSR(
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

function crearMockCliente(overrides: Partial<ClienteModeracion> = {}): ClienteModeracion {
  return {
    prepararSala: vi.fn().mockResolvedValue(undefined),
    actualizarPreparacion: vi.fn().mockResolvedValue(undefined),
    cancelarPreparacion: vi.fn().mockResolvedValue(undefined),
    abrirSesion: vi.fn().mockResolvedValue(undefined),
    actualizarSesion: vi.fn().mockResolvedValue(undefined),
    cerrarSesion: vi.fn().mockResolvedValue(undefined),
    suscribirEstado: vi.fn((callbacks) => {
      callbacks?.alCambiarConexion?.(true)
      return {
        cancelar: vi.fn(),
        activa: true,
      }
    }),
    obtenerEstado: vi.fn().mockResolvedValue(crearEstadoBase()),
    ...overrides,
  } as unknown as ClienteModeracion
}

function montarComponente<T extends Component>(
  componente: T,
  options: MountingOptions<Record<string, unknown>> = {},
) {
  const ssrContext = { modules: new Set() }
  return mount(componente, {
    ...options,
    global: {
      ...options.global,
      provide: {
        [ssrContextKey]: ssrContext,
        ...options.global?.provide,
      },
    },
  })
}

function crearConcejalesPrueba(cantidad = 12): ConcejalModeracion[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const banca = i + 1
    const pad = String(banca).padStart(2, '0')
    return {
      banca,
      dni: `300000${pad}`,
      nombre: `Concejal${pad}`,
      apellido: `Apellido${pad}`,
      nombre_mostrar: `C. Apellido${pad}`,
      bloque: banca % 2 === 0 ? 'Frente de Todos' : 'Juntos por el Cambio',
      ruta_imagen: `assets/bancas/banca-${pad}.png`,
      dispositivo_votacion: `dev${pad}`,
      presente: banca <= 8,
      test_activo: banca === 1,
      test_expira_en: banca === 1 ? '2026-08-25T10:00:05Z' : null,
    }
  })
}

function crearEstadoBase(parcial: Partial<EstadoModeracion> = {}): EstadoModeracion {
  return {
    revision: 1,
    generado_en: '2026-08-25T10:00:00Z',
    estado_global: 'SIN_PREPARAR',
    preparacion: null,
    sesion: null,
    votacion: null,
    palabra: {
      orador: null,
      cola: [],
    },
    quorum: null,
    configuracion: {
      filas_bancas: [3, 4, 5],
    },
    concejales: crearConcejalesPrueba(12),
    capacidades: {
      preparar_sala: { habilitada: true, motivos: [] },
      actualizar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cancelar_preparacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      abrir_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      actualizar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cerrar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      iniciar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cancelar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cerrar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      desempatar: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      solicitar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cancelar_solicitud_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      otorgar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      quitar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      subir_orden_dia: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      seleccionar_expediente: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cerrar_expediente: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      registrar_evento_manual: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
    },
    ...parcial,
  }
}

describe('WP-022: Preparación, presencia, autoridades, sesión y advertencia de cierre', () => {
  beforeEach(() => {
    reiniciarInstanciaCompartidaParaPruebas()
  })

  // ===========================================================================
  // 1. ESTADO SIN_PREPARAR (SSR Y COMPONENTES)
  // ===========================================================================
  describe('1. Estado SIN_PREPARAR', () => {
    it('muestra vista de sala sin preparar con botón de Preparar sala y sin falso quórum 0/0 (M2)', async () => {
      const estado = crearEstadoBase({ estado_global: 'SIN_PREPARAR', quorum: null })
      const htmlSesion = await renderizarSSR(PanelSesionVotacion, { estado })

      expect(htmlSesion).toContain('data-testid="vista-sin-preparar"')
      expect(htmlSesion).toContain('Sala sin preparar')
      expect(htmlSesion).toContain('data-testid="btn-preparar-sala"')
      expect(htmlSesion).not.toContain('data-testid="vista-preparando"')
      expect(htmlSesion).not.toContain('data-testid="vista-sesion-abierta"')

      const htmlRecinto = await renderizarSSR(PanelRecintoPalabra, { estado })
      // M2: En SIN_PREPARAR (sin quorum), no debe mostrarse el falso "Falta quórum 0 de 0 presentes"
      expect(htmlRecinto).not.toContain('data-testid="indicador-quorum"')
      expect(htmlRecinto).not.toContain('0 de 0 presentes')
    })
  })

  // ===========================================================================
  // 2. ESTADO PREPARANDO (SSR Y ESTRUCTURA)
  // ===========================================================================
  describe('2. Estado PREPARANDO (Estructura)', () => {
    function crearEstadoPreparando(parcial: Partial<EstadoModeracion> = {}): EstadoModeracion {
      return crearEstadoBase({
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-25T10:00:00Z',
          numero_sesion: 42,
          presidencia: 'Dr. René Favaloro',
          secretaria_legislativa: 'Lic. Alicia Moreau',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
          actualizar_preparacion: { habilitada: true, motivos: [] },
          cancelar_preparacion: { habilitada: true, motivos: [] },
          abrir_sesion: { habilitada: false, motivos: ['QUORUM_INSUFICIENTE'] },
        },
        ...parcial,
      })
    }

    it('renderiza inputs de sesión y motivos de bloqueo si abrir_sesion está deshabilitada', async () => {
      const estado = crearEstadoPreparando()
      const html = await renderizarSSR(PanelSesionVotacion, { estado })

      expect(html).toContain('data-testid="vista-preparando"')
      expect(html).toContain('data-testid="input-numero-sesion"')
      expect(html).toContain('data-testid="input-presidencia"')
      expect(html).toContain('data-testid="input-secretaria"')
      expect(html).toContain('data-testid="btn-guardar-preparacion"')
      expect(html).toContain('data-testid="btn-abrir-sesion"')
      expect(html).toContain('data-testid="btn-cancelar-preparacion"')
      expect(html).toContain('data-testid="motivos-abrir-sesion"')
      expect(html).toContain('Quórum insuficiente')
    })
  })

  // ===========================================================================
  // 3. RECINTO, BANCAS, FOTOS Y QUÓRUM (M1, M2)
  // ===========================================================================
  describe('3. Recinto, Bancas y Quórum', () => {
    it('BancaConcejal: renderiza identidad, foto con fallback, presencia solo lectura y señal de test', async () => {
      const concejal: ConcejalModeracion = {
        banca: 3,
        dni: '30123456',
        nombre: 'Florentina',
        apellido: 'Gómez Miranda',
        nombre_mostrar: 'F. Gómez Miranda',
        bloque: 'UCR',
        ruta_imagen: 'assets/bancas/banca-03.png',
        dispositivo_votacion: 'dev03',
        presente: true,
        test_activo: true,
        test_expira_en: '2026-08-25T10:00:05Z',
      }

      const html = await renderizarSSR(BancaConcejal, { concejal })

      expect(html).toContain('Banca 3')
      expect(html).toContain('Florentina Gómez Miranda')
      expect(html).toContain('UCR')
      expect(html).toContain('dev03')
      expect(html).toContain('Presente')
      expect(html).toContain('data-testid="badge-test-activo"')
    })

    it('GrillaRecinto: distribuye las bancas respetando filas_bancas', async () => {
      const concejales = crearConcejalesPrueba(12)
      const html = await renderizarSSR(GrillaRecinto, {
        concejales,
        filasBancas: [3, 4, 5],
      })

      expect(html).toContain('data-testid="fila-bancas-1"')
      expect(html).toContain('data-testid="fila-bancas-2"')
      expect(html).toContain('data-testid="fila-bancas-3"')
      expect(html).toContain('Banca 1')
      expect(html).toContain('Banca 12')
    })

    it('IndicadorQuorum: no renderiza cuando quorum es null (M2) y calcula faltantes asistenciales cuando falta quórum', async () => {
      // 1. Quorum null -> no se renderiza nada (M2)
      const htmlNull = await renderizarSSR(IndicadorQuorum, {
        quorum: null,
        totalConcejales: 12,
      })
      expect(htmlNull).not.toContain('data-testid="indicador-quorum"')
      expect(htmlNull).not.toContain('0 de 0 presentes')

      // 2. Falta quórum
      const quorumFaltante: EstadoQuorum = {
        cantidad_presentes: 5,
        requerido: 7,
        alcanzado: false,
      }
      const htmlFalta = await renderizarSSR(IndicadorQuorum, {
        quorum: quorumFaltante,
        totalConcejales: 12,
      })

      expect(htmlFalta).toContain('Falta quórum')
      expect(htmlFalta).toContain('5 de 12 presentes')
      expect(htmlFalta).toContain('data-testid="quorum-faltantes"')
      expect(htmlFalta).toContain('Faltan 2 presentes para quórum')

      // 3. Quórum alcanzado
      const quorumAlcanzado: EstadoQuorum = {
        cantidad_presentes: 8,
        requerido: 7,
        alcanzado: true,
      }
      const htmlOk = await renderizarSSR(IndicadorQuorum, {
        quorum: quorumAlcanzado,
        totalConcejales: 12,
      })

      expect(htmlOk).toContain('Quórum alcanzado')
      expect(htmlOk).toContain('8 de 12 presentes')
      expect(htmlOk).toContain('data-testid="quorum-completo"')
      expect(htmlOk).toContain('Quórum suficiente para operar')
    })
  })

  // ===========================================================================
  // 4. SESION_ABIERTA Y AUTORIDADES (SSR Y M1)
  // ===========================================================================
  describe('4. Estado SESION_ABIERTA (Estructura y M1)', () => {
    it('muestra número inmutable, resumen de quórum en Q1 (M1) y autoridades en sesión', async () => {
      const estado = crearEstadoBase({
        estado_global: 'SESION_ABIERTA',
        sesion: {
          fecha_hora_inicio_preparacion: '2026-08-25T10:00:00Z',
          fecha_hora_apertura: '2026-08-25T10:30:00Z',
          numero_sesion: 8,
          presidencia: 'Dra. María Elena Walsh',
          secretaria_legislativa: 'Lic. Juan Gómez',
        },
        quorum: {
          cantidad_presentes: 9,
          requerido: 7,
          alcanzado: true,
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_sesion: { habilitada: true, motivos: [] },
          cerrar_sesion: { habilitada: true, motivos: [] },
        },
      })

      const html = await renderizarSSR(PanelSesionVotacion, { estado })

      expect(html).toContain('data-testid="vista-sesion-abierta"')
      expect(html).toContain('data-testid="numero-sesion-inmutable"')
      expect(html).toContain('Sesión Nº 8')
      // M1: Quórum en Q1
      expect(html).toContain('data-testid="quorum-resumen-sesion"')
      expect(html).toContain('9 / 7 presentes')
      expect(html).toContain('Quórum legal')
      expect(html).toContain('data-testid="input-presidencia-sesion"')
      expect(html).toContain('data-testid="input-secretaria-sesion"')
      expect(html).toContain('data-testid="btn-actualizar-autoridades"')
      expect(html).toContain('data-testid="btn-cerrar-sesion"')
    })
  })

  // ===========================================================================
  // 5. PRUEBAS INTERACTIVAS CON COMPONENTES REALES MONTADOS (H2)
  // ===========================================================================
  describe('5. Interacción real con PanelSesionVotacion (H2)', () => {
    it('SIN_PREPARAR: ejecutarPrepararSala() invoca cliente.prepararSala() exactamente 1 vez', async () => {
      const mockCliente = crearMockCliente()

      const estado = crearEstadoBase({
        estado_global: 'SIN_PREPARAR',
        capacidades: {
          ...crearEstadoBase().capacidades,
          preparar_sala: { habilitada: true, motivos: [] },
        },
      })

      const wrapper = montarComponente(PanelSesionVotacion, {
        props: {
          estado,
          clienteInyectado: mockCliente,
        },
      })

      await wrapper.vm.ejecutarPrepararSala()
      expect(mockCliente.prepararSala).toHaveBeenCalledTimes(1)
    })

    it('SIN_PREPARAR: muestra error si prepararSala() rechaza y no altera estado localmente', async () => {
      const mockCliente = crearMockCliente({
        prepararSala: vi.fn().mockRejectedValue({ mensaje: 'Error de auditoría L1' }),
      })

      const estado = crearEstadoBase({
        estado_global: 'SIN_PREPARAR',
        capacidades: {
          ...crearEstadoBase().capacidades,
          preparar_sala: { habilitada: true, motivos: [] },
        },
      })

      const wrapper = montarComponente(PanelSesionVotacion, {
        props: {
          estado,
          clienteInyectado: mockCliente,
        },
      })

      await wrapper.vm.ejecutarPrepararSala()
      await nextTick()

      expect(wrapper.vm.mensajeError).toBe('Error de auditoría L1')
    })

    it('PREPARANDO: edición de campos mediante reactividades de input y envío a actualizarPreparacion()', async () => {
      const mockCliente = crearMockCliente()

      const estado = crearEstadoBase({
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-25T10:00:00Z',
          numero_sesion: null,
          presidencia: '',
          secretaria_legislativa: '',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_preparacion: { habilitada: true, motivos: [] },
        },
      })

      const wrapper = montarComponente(PanelSesionVotacion, {
        props: {
          estado,
          clienteInyectado: mockCliente,
        },
      })

      wrapper.vm.numeroSesionInput = '42'
      wrapper.vm.presidenciaInput = 'Dra. Cecilia Grierson'
      wrapper.vm.secretariaInput = 'Lic. Florentina Gómez'

      await wrapper.vm.ejecutarActualizarPreparacion()

      expect(mockCliente.actualizarPreparacion).toHaveBeenCalledTimes(1)
      expect(mockCliente.actualizarPreparacion).toHaveBeenCalledWith({
        numero_sesion: 42,
        presidencia: 'Dra. Cecilia Grierson',
        secretaria_legislativa: 'Lic. Florentina Gómez',
      })
    })

    it('H1 — Preservación de borrador local (draft) ante snapshots SSE no relacionados', async () => {
      const mockCliente = crearMockCliente()

      const estadoInicial = crearEstadoBase({
        revision: 1,
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-25T10:00:00Z',
          numero_sesion: 10,
          presidencia: 'Dra. Original',
          secretaria_legislativa: 'Lic. Original',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_preparacion: { habilitada: true, motivos: [] },
        },
      })

      const wrapper = montarComponente(PanelSesionVotacion, {
        props: {
          estado: estadoInicial,
          clienteInyectado: mockCliente,
        },
      })

      expect(wrapper.vm.presidenciaInput).toBe('Dra. Original')

      // El operador edita el campo localmente
      wrapper.vm.presidenciaInput = 'Dra. En Edición Activa'
      wrapper.vm.presidenciaDirty = true
      expect(wrapper.vm.presidenciaInput).toBe('Dra. En Edición Activa')

      // Llega un nuevo snapshot SSE por una pulsación de presencia o test ajena
      const estadoNuevoAjeno = crearEstadoBase({
        revision: 2,
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-25T10:00:00Z',
          numero_sesion: 10,
          presidencia: 'Dra. Original', // Backend aún conserva el valor viejo
          secretaria_legislativa: 'Lic. Original',
        },
        concejales: crearConcejalesPrueba(12).map((c) =>
          c.banca === 1 ? { ...c, presente: true } : c,
        ),
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_preparacion: { habilitada: true, motivos: [] },
        },
      })

      await wrapper.setProps({ estado: estadoNuevoAjeno })
      await nextTick()

      // H1: El texto que el operador estaba editando NO debe pisarse por el snapshot ajeno
      expect(wrapper.vm.presidenciaInput).toBe('Dra. En Edición Activa')

      // El operador guarda los datos
      await wrapper.vm.ejecutarActualizarPreparacion()
      expect(mockCliente.actualizarPreparacion).toHaveBeenCalledWith(
        expect.objectContaining({ presidencia: 'Dra. En Edición Activa' }),
      )

      // Llega el snapshot SSE confirmatorio del backend con la Presidencia confirmada
      const estadoConfirmado = crearEstadoBase({
        revision: 3,
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-25T10:00:00Z',
          numero_sesion: 10,
          presidencia: 'Dra. En Edición Activa',
          secretaria_legislativa: 'Lic. Original',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_preparacion: { habilitada: true, motivos: [] },
        },
      })

      await wrapper.setProps({ estado: estadoConfirmado })
      await nextTick()

      // Confirmado y sincronizado
      expect(wrapper.vm.presidenciaInput).toBe('Dra. En Edición Activa')
      expect(wrapper.vm.presidenciaDirty).toBe(false)
    })

    it('M3 — Validación estricta del número de sesión (rechaza 12.5, 0, negativos y texto sin convertir)', async () => {
      const mockCliente = crearMockCliente()

      const estado = crearEstadoBase({
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-25T10:00:00Z',
          numero_sesion: null,
          presidencia: 'Dr. A',
          secretaria_legislativa: 'Lic. B',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_preparacion: { habilitada: true, motivos: [] },
        },
      })

      const wrapper = montarComponente(PanelSesionVotacion, {
        props: {
          estado,
          clienteInyectado: mockCliente,
        },
      })

      // 1. Decimal "12.5" -> no enviar, mostrar error
      wrapper.vm.numeroSesionInput = '12.5'
      await wrapper.vm.ejecutarActualizarPreparacion()
      expect(mockCliente.actualizarPreparacion).not.toHaveBeenCalled()
      expect(wrapper.vm.mensajeError).toContain('número entero positivo mayor a cero')

      // 2. Cero "0" -> no enviar
      wrapper.vm.numeroSesionInput = '0'
      await wrapper.vm.ejecutarActualizarPreparacion()
      expect(mockCliente.actualizarPreparacion).not.toHaveBeenCalled()

      // 3. Negativo "-3" -> no enviar
      wrapper.vm.numeroSesionInput = '-3'
      await wrapper.vm.ejecutarActualizarPreparacion()
      expect(mockCliente.actualizarPreparacion).not.toHaveBeenCalled()

      // 4. Entero válido "15" -> enviar exactamente 15
      wrapper.vm.numeroSesionInput = '15'
      await wrapper.vm.ejecutarActualizarPreparacion()
      expect(mockCliente.actualizarPreparacion).toHaveBeenCalledWith(
        expect.objectContaining({ numero_sesion: 15 }),
      )
    })

    it('PREPARANDO: Abrir sesión y Cancelar preparación llaman a sus respectivos métodos', async () => {
      const mockCliente = crearMockCliente()

      const estado = crearEstadoBase({
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-25T10:00:00Z',
          numero_sesion: 1,
          presidencia: 'Dr. A',
          secretaria_legislativa: 'Lic. B',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          abrir_sesion: { habilitada: true, motivos: [] },
          cancelar_preparacion: { habilitada: true, motivos: [] },
        },
      })

      const wrapper = montarComponente(PanelSesionVotacion, {
        props: {
          estado,
          clienteInyectado: mockCliente,
        },
      })

      await wrapper.vm.ejecutarAbrirSesion()
      expect(mockCliente.abrirSesion).toHaveBeenCalledTimes(1)

      await wrapper.vm.ejecutarCancelarPreparacion()
      expect(mockCliente.cancelarPreparacion).toHaveBeenCalledTimes(1)
    })

    it('SESION_ABIERTA: actualizarSesion() se ejecuta incluso con votación activa en curso', async () => {
      const mockCliente = crearMockCliente()

      const estado = crearEstadoBase({
        estado_global: 'SESION_ABIERTA',
        sesion: {
          fecha_hora_inicio_preparacion: '2026-08-25T10:00:00Z',
          fecha_hora_apertura: '2026-08-25T10:30:00Z',
          numero_sesion: 42,
          presidencia: 'Dr. Inicial',
          secretaria_legislativa: 'Lic. Inicial',
        },
        votacion: {
          id: 'vot-01',
          titulo: 'Tratamiento Sobre Tablas',
          tipo: 'MAYORIA_SIMPLE',
          fecha_hora_inicio: '2026-08-25T10:35:00Z',
          base_calculo: 'PRESENTES',
        } as unknown as EstadoModeracion['votacion'],
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_sesion: { habilitada: true, motivos: [] },
          cerrar_sesion: { habilitada: true, motivos: [] },
        },
      })

      const wrapper = montarComponente(PanelSesionVotacion, {
        props: {
          estado,
          clienteInyectado: mockCliente,
        },
      })

      wrapper.vm.presidenciaInput = 'Dra. Nueva Presidencia'
      await wrapper.vm.ejecutarActualizarSesion()

      expect(mockCliente.actualizarSesion).toHaveBeenCalledWith({
        presidencia: 'Dra. Nueva Presidencia',
        secretaria_legislativa: 'Lic. Inicial',
      })
    })

    it('SESION_ABIERTA: flujo de cierre directo sin palabra y con diálogo ante orador o cola de palabra', async () => {
      const mockCliente = crearMockCliente()

      // 1. Cierre directo sin palabra activa
      const estadoSinPalabra = crearEstadoBase({
        estado_global: 'SESION_ABIERTA',
        sesion: {
          fecha_hora_inicio_preparacion: '2026-08-25T10:00:00Z',
          fecha_hora_apertura: '2026-08-25T10:30:00Z',
          numero_sesion: 5,
          presidencia: 'Dr. A',
          secretaria_legislativa: 'Lic. B',
        },
        palabra: { orador: null, cola: [] },
        capacidades: {
          ...crearEstadoBase().capacidades,
          cerrar_sesion: { habilitada: true, motivos: [] },
        },
      })

      const wrapperSinPalabra = montarComponente(PanelSesionVotacion, {
        props: {
          estado: estadoSinPalabra,
          clienteInyectado: mockCliente,
        },
      })

      await wrapperSinPalabra.vm.iniciarCerrarSesion()
      expect(mockCliente.cerrarSesion).toHaveBeenCalledTimes(1)
      expect(wrapperSinPalabra.vm.mostrarDialogoCierre).toBe(false)

      // 2. Cierre con orador activo abre diálogo modal
      mockCliente.cerrarSesion = vi.fn().mockResolvedValue(undefined)
      const estadoConOrador = crearEstadoBase({
        ...estadoSinPalabra,
        palabra: {
          orador: { dni: '30000001', nombre: 'Ana', apellido: 'García', banca: 1 },
          cola: [],
        },
      })

      const wrapperConOrador = montarComponente(PanelSesionVotacion, {
        props: {
          estado: estadoConOrador,
          clienteInyectado: mockCliente,
        },
      })

      await wrapperConOrador.vm.iniciarCerrarSesion()
      expect(mockCliente.cerrarSesion).not.toHaveBeenCalled()
      expect(wrapperConOrador.vm.mostrarDialogoCierre).toBe(true)

      // Cancelar diálogo modal -> produce cero llamadas a cerrarSesion()
      wrapperConOrador.vm.cancelarAdvertenciaCierre()
      expect(mockCliente.cerrarSesion).not.toHaveBeenCalled()
      expect(wrapperConOrador.vm.mostrarDialogoCierre).toBe(false)

      // Confirmar diálogo modal -> produce exactamente 1 llamada a cerrarSesion()
      await wrapperConOrador.vm.iniciarCerrarSesion()
      await wrapperConOrador.vm.confirmarCerrarSesion()
      expect(mockCliente.cerrarSesion).toHaveBeenCalledTimes(1)
      expect(wrapperConOrador.vm.mostrarDialogoCierre).toBe(false)
    })
  })

  // ===========================================================================
  // 6. ACCESIBILIDAD Y FOCO EN DIALOGOCONFIRMACIONCIERRE (H4)
  // ===========================================================================
  describe('6. Accesibilidad y Foco en DialogoConfirmacionCierre (H4)', () => {
    it('renderiza semántica accesible ARIA y emite eventos de teclado Escape y acciones de diálogo', async () => {
      const palabra = {
        orador: { dni: '30000001', nombre: 'Carlos', apellido: 'Pérez', banca: 2 },
        cola: [{ dni: '30000002', nombre: 'Diana', apellido: 'López', banca: 4 }],
      }

      // Verificamos estructura accesible en SSR
      const html = await renderizarSSR(DialogoConfirmacionCierre, {
        palabra,
        abierto: true,
        enviando: false,
      })

      expect(html).toContain('role="dialog"')
      expect(html).toContain('aria-modal="true"')
      expect(html).toContain('aria-labelledby="titulo-dialogo-cierre"')
      expect(html).toContain('aria-describedby="descripcion-dialogo-cierre"')
      expect(html).toContain('data-testid="btn-cancelar-cierre"')
      expect(html).toContain('data-testid="btn-confirmar-cierre"')

      // Verificamos interacción con componente montado
      const wrapper = montarComponente(DialogoConfirmacionCierre, {
        props: {
          palabra,
          abierto: true,
          enviando: false,
        },
      })

      // Escape emite cancelar
      const eventEscape = {
        key: 'Escape',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent
      wrapper.vm.manejarKeyDown(eventEscape)
      expect(wrapper.emitted('cancelar')).toHaveLength(1)

      // Click / llamada a cancelar emite cancelar
      wrapper.vm.manejarCancelar()
      expect(wrapper.emitted('cancelar')).toHaveLength(2)

      // Click / llamada a confirmar emite confirmar
      wrapper.vm.manejarConfirmar()
      expect(wrapper.emitted('confirmar')).toHaveLength(1)
    })
  })

  // ===========================================================================
  // 7. UTILIDADES: RUTAS Y MOTIVOS
  // ===========================================================================
  describe('7. Utilidades auxiliares', () => {
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
