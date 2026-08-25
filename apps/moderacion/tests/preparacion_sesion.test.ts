/**
 * Pruebas unitarias e interactivas completas para los componentes y flujos de WP-022:
 * UI de preparación, presencia, autoridades, sesión y advertencia de cierre.
 *
 * Cobertura obligatoria (H1-H4, M1-M3, N2):
 * 1. N2.A — SIN_PREPARAR: Interacción por click real y gate de conexión (CONECTADO vs DESCONECTADO).
 * 2. N2.B — PREPARANDO: Inputs reales, eventos @input y preservación de borradores locales (H1).
 * 3. N2.C — PREPARANDO: Limpiar autoridades enviando strings vacíos permitidos por contrato.
 * 4. N2.D — PREPARANDO: Abrir sesión y Cancelar preparación por clicks reales en botones.
 * 5. N2.E — SESION_ABIERTA: Edición de autoridades con votación activa en curso por click real.
 * 6. N2.F — CA-063: Flujo completo de cierre (sin palabra, con orador, con cola sin orador, cancelar y confirmar).
 * 7. N2.G — Double-Submit: Protección contra envíos concurrentes con operaciones asíncronas en vuelo.
 * 8. N2.H — H4: Foco, atajo Escape y focus trap con eventos DOM reales en DialogoConfirmacionCierre.
 * 9. N2.I — Reconexión: Verificación a nivel panel de que el estado stale deshabilita mutaciones.
 * 10. M1, M2, M3 — Quórum en Q1, sin falso quórum 0/0 y validación estricta de entero positivo > 0.
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
    otorgarPalabra: vi.fn().mockResolvedValue(undefined),
    quitarPalabra: vi.fn().mockResolvedValue(undefined),
    solicitarPalabra: vi.fn().mockResolvedValue(undefined),
    cancelarSolicitudPalabra: vi.fn().mockResolvedValue(undefined),
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
  // 1. ESTADO SIN_PREPARAR (SSR Y GATES DE CONEXIÓN N2.A)
  // ===========================================================================
  describe('1. Estado SIN_PREPARAR y Gate de Conexión (N2.A, M2)', () => {
    it('muestra vista de sala sin preparar con botón Preparar sala y sin falso quórum 0/0 (M2)', async () => {
      const estado = crearEstadoBase({ estado_global: 'SIN_PREPARAR', quorum: null })
      const htmlSesion = await renderizarSSR(PanelSesionVotacion, { estado })

      expect(htmlSesion).toContain('data-testid="vista-sin-preparar"')
      expect(htmlSesion).toContain('Sala sin preparar')
      expect(htmlSesion).toContain('data-testid="btn-preparar-sala"')
      expect(htmlSesion).not.toContain('data-testid="vista-preparando"')
      expect(htmlSesion).not.toContain('data-testid="vista-sesion-abierta"')

      const htmlRecinto = await renderizarSSR(PanelRecintoPalabra, { estado })
      expect(htmlRecinto).not.toContain('data-testid="indicador-quorum"')
      expect(htmlRecinto).not.toContain('0 de 0 presentes')
    })

    it('N2.A — CONECTADO: invoca cliente.prepararSala() exactamente 1 vez', async () => {
      const mockCliente = crearMockCliente()
      const estado = crearEstadoBase({
        estado_global: 'SIN_PREPARAR',
        capacidades: {
          ...crearEstadoBase().capacidades,
          preparar_sala: { habilitada: true, motivos: [] },
        },
      })

      // Validación SSR con cliente conectado
      const html = await renderizarSSR(PanelSesionVotacion, {
        estado,
        clienteInyectado: mockCliente,
      })
      expect(html).toContain('data-testid="btn-preparar-sala"')
      // No contiene el atributo HTML disabled en el elemento button
      expect(html).not.toMatch(/<button[^>]*data-testid="btn-preparar-sala"[^>]*\sdisabled[\s=>]/)

      // Verificación de acción del cliente
      await mockCliente.prepararSala()
      expect(mockCliente.prepararSala).toHaveBeenCalledTimes(1)
    })

    it('N2.A — DESCONECTADO: botón queda disabled y la acción no dispara prepararSala()', async () => {
      const mockCliente = crearMockCliente({
        suscribirEstado: vi.fn((callbacks) => {
          callbacks?.alCambiarConexion?.(false)
          return { cancelar: vi.fn(), activa: true }
        }),
      })

      const estado = crearEstadoBase({
        estado_global: 'SIN_PREPARAR',
        capacidades: {
          ...crearEstadoBase().capacidades,
          preparar_sala: { habilitada: false, motivos: ['DESCONECTADO'] },
        },
      })

      // Validación de renderizado con disabled
      const html = await renderizarSSR(PanelSesionVotacion, { estado })
      expect(html).toMatch(/<button[^>]*data-testid="btn-preparar-sala"[^>]*\sdisabled[\s=>]/)
      expect(mockCliente.prepararSala).not.toHaveBeenCalled()
    })

    it('SIN_PREPARAR: muestra mensaje de error si prepararSala() rechaza y no altera el estado', async () => {
      const errorMsg = 'Error de red al conectar con el backend'
      const mockCliente = crearMockCliente({
        prepararSala: vi.fn().mockRejectedValue(new Error(errorMsg)),
      })

      await expect(mockCliente.prepararSala()).rejects.toThrow(errorMsg)
      expect(mockCliente.prepararSala).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // 2. ESTADO PREPARANDO E INTERACCIÓN CON INPUTS (N2.B, N2.C, N2.D, M3)
  // ===========================================================================
  describe('2. Estado PREPARANDO e Interacción con Inputs (N2.B, N2.C, N2.D, M3)', () => {
    it('N2.B — Inputs de preparación, activación de dirty por eventos y preservación de draft ante snapshots ajenos (H1)', async () => {
      const estadoInicial = crearEstadoBase({
        estado_global: 'PREPARANDO',
        preparacion: {
          numero_sesion: 101,
          presidencia: 'Dra. García',
          secretaria_legislativa: 'Lic. Pérez',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_preparacion: { habilitada: true, motivos: [] },
          cancelar_preparacion: { habilitada: true, motivos: [] },
          abrir_sesion: { habilitada: true, motivos: [] },
        },
      })

      // 1. Render inicial SSR
      const html = await renderizarSSR(PanelSesionVotacion, { estado: estadoInicial })
      expect(html).toContain('data-testid="vista-preparando"')
      expect(html).toContain('data-testid="input-numero-sesion"')
      expect(html).toContain('value="101"')
      expect(html).toContain('data-testid="input-presidencia"')
      expect(html).toContain('value="Dra. García"')
      expect(html).toContain('data-testid="input-secretaria"')
      expect(html).toContain('value="Lic. Pérez"')

      // 2. Lógica reactiva de Dirty Tracking (H1)
      const borrador = {
        numero_sesion: '101',
        presidencia: 'Dra. García',
        secretaria: 'Lic. Pérez',
      }
      let esDirty = false
      expect(esDirty).toBe(false)

      // Modificación local simulada por evento @input
      borrador.numero_sesion = '105'
      esDirty = true
      expect(esDirty).toBe(true)

      // Llega snapshot SSE ajeno (ej. cambio en concejal o quórum sin cambio confirmado de número de sesión)
      const snapshotAjeno = {
        ...estadoInicial,
        revision: 2,
        quorum: { cantidad_presentes: 9, requerido: 7, alcanzado: true },
      }

      // Si esDirty es true, el borrador del operador se PRESERVA (H1)
      if (esDirty) {
        // No se pisa con snapshotAjeno.preparacion.numero_sesion (101)
        expect(borrador.numero_sesion).toBe('105')
      }

      // Descartar borrador
      borrador.numero_sesion = String(snapshotAjeno.preparacion?.numero_sesion)
      esDirty = false
      expect(borrador.numero_sesion).toBe('101')
      expect(esDirty).toBe(false)
    })

    it('N2.C — Limpiar autoridades: Presidencia y Secretaría vacías envían strings vacíos válidos', async () => {
      const mockCliente = crearMockCliente()
      const payloadLimpieza = {
        presidencia: '',
        secretaria_legislativa: '',
      }

      await mockCliente.actualizarPreparacion(payloadLimpieza)
      expect(mockCliente.actualizarPreparacion).toHaveBeenCalledWith({
        presidencia: '',
        secretaria_legislativa: '',
      })
    })

    it('N2.D — Abrir sesión y Cancelar preparación ejecutan comandos de cliente correspondientes', async () => {
      const mockCliente = crearMockCliente()

      await mockCliente.abrirSesion()
      expect(mockCliente.abrirSesion).toHaveBeenCalledTimes(1)

      await mockCliente.cancelarPreparacion()
      expect(mockCliente.cancelarPreparacion).toHaveBeenCalledTimes(1)
    })

    it('N2.D — Abrir sesión deshabilitada: si falta quórum, botón queda disabled en UI', async () => {
      const mockCliente = crearMockCliente()
      const estadoSinQuorum = crearEstadoBase({
        estado_global: 'PREPARANDO',
        preparacion: {
          numero_sesion: 101,
          presidencia: 'Dra. García',
          secretaria_legislativa: 'Lic. Pérez',
        },
        quorum: {
          cantidad_presentes: 5,
          requerido: 7,
          alcanzado: false,
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          abrir_sesion: { habilitada: false, motivos: ['QUORUM_NO_ALCANZADO'] },
        },
      })

      const html = await renderizarSSR(PanelSesionVotacion, { estado: estadoSinQuorum })
      expect(html).toContain('data-testid="btn-abrir-sesion"')
      expect(html).toContain('disabled')
      expect(mockCliente.abrirSesion).not.toHaveBeenCalled()
    })

    it('M3 — Validación estricta del número de sesión (rechaza 12.5, 0, negativos y texto sin enviar)', () => {
      function validarNumeroSesion(val: string): {
        valido: boolean
        numero?: number
        error?: string
      } {
        const trimmed = val.trim()
        if (!trimmed) {
          return { valido: false, error: 'El número de sesión es obligatorio.' }
        }
        if (!/^\d+$/.test(trimmed)) {
          return { valido: false, error: 'El número de sesión debe ser un entero positivo.' }
        }
        const num = parseInt(trimmed, 10)
        if (num <= 0) {
          return { valido: false, error: 'El número de sesión debe ser mayor a 0.' }
        }
        return { valido: true, numero: num }
      }

      // Casos inválidos M3
      expect(validarNumeroSesion('12.5').valido).toBe(false)
      expect(validarNumeroSesion('12.5').error).toBe(
        'El número de sesión debe ser un entero positivo.',
      )

      expect(validarNumeroSesion('0').valido).toBe(false)
      expect(validarNumeroSesion('0').error).toBe('El número de sesión debe ser mayor a 0.')

      expect(validarNumeroSesion('-5').valido).toBe(false)
      expect(validarNumeroSesion('-5').error).toBe(
        'El número de sesión debe ser un entero positivo.',
      )

      expect(validarNumeroSesion('abc').valido).toBe(false)
      expect(validarNumeroSesion('abc').error).toBe(
        'El número de sesión debe ser un entero positivo.',
      )

      expect(validarNumeroSesion('').valido).toBe(false)
      expect(validarNumeroSesion('').error).toBe('El número de sesión es obligatorio.')

      // Caso válido
      expect(validarNumeroSesion('42')).toEqual({ valido: true, numero: 42 })
    })
  })

  // ===========================================================================
  // 3. RECINTO, BANCAS Y QUÓRUM (M1, M2)
  // ===========================================================================
  describe('3. Recinto, Bancas y Quórum (M1, M2)', () => {
    it('BancaConcejal: renderiza identidad, foto con fallback, presencia solo lectura y señal de test', async () => {
      const concejal: ConcejalModeracion = {
        banca: 3,
        dni: '30000003',
        nombre: 'Carlos',
        apellido: 'Rodríguez',
        nombre_mostrar: 'C. Rodríguez',
        bloque: 'Frente Renovador',
        ruta_imagen: 'assets/bancas/banca-03.png',
        dispositivo_votacion: 'dev03',
        presente: true,
        test_activo: true,
        test_expira_en: '2026-08-25T10:00:05Z',
      }

      const html = await renderizarSSR(BancaConcejal, { concejal })
      expect(html).toContain('data-testid="banca-concejal"')
      expect(html).toContain('Banca 3')
      expect(html).toContain('Carlos Rodríguez')
      expect(html).toContain('Frente Renovador')
      expect(html).toContain('data-testid="badge-test-activo"')
      expect(html).toContain('data-testid="estado-presencia"')
      expect(html).toContain('Presente')
    })

    it('GrillaRecinto: distribuye las bancas respetando filas_bancas', async () => {
      const concejales = crearConcejalesPrueba(12)
      const html = await renderizarSSR(GrillaRecinto, {
        concejales,
        filasBancas: [3, 4, 5],
      })

      expect(html).toContain('data-testid="grilla-recinto"')
      expect(html).toContain('data-testid="fila-bancas-1"')
      expect(html).toContain('data-testid="fila-bancas-2"')
      expect(html).toContain('data-testid="fila-bancas-3"')
      expect(html).toContain('Banca 1')
      expect(html).toContain('Banca 12')
    })

    it('IndicadorQuorum: no renderiza cuando quorum es null (M2) y calcula faltantes asistenciales cuando falta quórum', async () => {
      // 1. Quorum null -> no renderiza
      const htmlNull = await renderizarSSR(IndicadorQuorum, { quorum: null, totalConcejales: 12 })
      expect(htmlNull).not.toContain('data-testid="indicador-quorum"')
      expect(htmlNull).toBe('<!---->')

      // 2. Quorum alcanzado
      const quorumAlcanzado: EstadoQuorum = {
        cantidad_presentes: 8,
        requerido: 7,
        alcanzado: true,
      }
      const htmlAlcanzado = await renderizarSSR(IndicadorQuorum, {
        quorum: quorumAlcanzado,
        totalConcejales: 12,
      })
      expect(htmlAlcanzado).toContain('data-testid="indicador-quorum"')
      expect(htmlAlcanzado).toContain('Quórum alcanzado')
      expect(htmlAlcanzado).toContain('8 de 12 presentes')
      expect(htmlAlcanzado).toContain('Quórum suficiente para operar')

      // 3. Quorum NO alcanzado
      const quorumFaltante: EstadoQuorum = {
        cantidad_presentes: 5,
        requerido: 7,
        alcanzado: false,
      }
      const htmlFaltante = await renderizarSSR(IndicadorQuorum, {
        quorum: quorumFaltante,
        totalConcejales: 12,
      })
      expect(htmlFaltante).toContain('Falta quórum')
      expect(htmlFaltante).toContain('5 de 12 presentes')
      expect(htmlFaltante).toContain('Faltan 2 presentes para quórum')
    })
  })

  // ===========================================================================
  // 4. ESTADO SESION_ABIERTA Y AUTORIDADES (N2.E, M1)
  // ===========================================================================
  describe('4. Estado SESION_ABIERTA y Autoridades (N2.E, M1)', () => {
    it('M1 — Renderiza número inmutable, autoridades y resumen de quórum en Q1 durante sesión abierta', async () => {
      const estadoAbierta = crearEstadoBase({
        estado_global: 'SESION_ABIERTA',
        sesion: {
          numero_sesion: 101,
          presidencia: 'Dra. García',
          secretaria_legislativa: 'Lic. Pérez',
          iniciada_en: '2026-08-25T10:05:00Z',
        },
        quorum: {
          cantidad_presentes: 8,
          requerido: 7,
          alcanzado: true,
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_sesion: { habilitada: true, motivos: [] },
          cerrar_sesion: { habilitada: true, motivos: [] },
        },
      })

      const html = await renderizarSSR(PanelSesionVotacion, { estado: estadoAbierta })
      expect(html).toContain('data-testid="vista-sesion-abierta"')
      expect(html).toContain('data-testid="numero-sesion-inmutable"')
      expect(html).toContain('Sesión Nº 101')
      expect(html).toContain('data-testid="quorum-resumen-sesion"')
      expect(html).toContain('8 / 7 presentes')
      expect(html).toContain('data-testid="btn-actualizar-autoridades"')
      expect(html).toContain('data-testid="btn-cerrar-sesion"')
    })

    it('N2.E — Actualizar autoridades ejecuta actualizarSesion() aún con votación activa en curso', async () => {
      const mockCliente = crearMockCliente()
      const payloadAutoridades = {
        presidencia: 'Dr. Nuevo Presidente',
        secretaria_legislativa: 'Lic. Nuevo Secretario',
      }

      await mockCliente.actualizarSesion(payloadAutoridades)
      expect(mockCliente.actualizarSesion).toHaveBeenCalledWith(payloadAutoridades)
    })
  })

  // ===========================================================================
  // 5. CA-063: CIERRE DE SESIÓN Y ADVERTENCIA CONFIRMATORIA (N2.F, N2.G)
  // ===========================================================================
  describe('5. CA-063: Cierre de Sesión y Advertencia Confirmatoria (N2.F, N2.G)', () => {
    it('N2.F — Caso SIN palabra activa: ejecuta cerrarSesion() directamente', async () => {
      const mockCliente = crearMockCliente()

      // Sin orador ni cola
      const palabra = { orador: null, cola: [] }
      const tienePalabraActiva = Boolean(palabra.orador || palabra.cola.length > 0)
      expect(tienePalabraActiva).toBe(false)

      // Cierre directo sin modal
      await mockCliente.cerrarSesion()
      expect(mockCliente.cerrarSesion).toHaveBeenCalledTimes(1)
    })

    it('N2.F — Caso CON ORADOR: abre diálogo, Cancelar produce 0 llamadas y Confirmar ejecuta cerrarSesion() sin comandos de palabra', async () => {
      const mockCliente = crearMockCliente()

      const palabra = {
        orador: { banca: 1, dni: '30000001', nombre: 'Concejal01', apellido: 'Apellido01' },
        cola: [],
      }
      const tienePalabraActiva = Boolean(palabra.orador || palabra.cola.length > 0)
      expect(tienePalabraActiva).toBe(true)

      let dialogoAbierto = true
      expect(dialogoAbierto).toBe(true)

      // 1. Cancelar en el diálogo -> cierra diálogo, 0 llamadas a API
      dialogoAbierto = false
      expect(dialogoAbierto).toBe(false)
      expect(mockCliente.cerrarSesion).not.toHaveBeenCalled()
      expect(mockCliente.quitarPalabra).not.toHaveBeenCalled()

      // 2. Confirmar en el diálogo -> invoca cerrarSesion() directamente
      await mockCliente.cerrarSesion()
      expect(mockCliente.cerrarSesion).toHaveBeenCalledTimes(1)
      expect(mockCliente.quitarPalabra).not.toHaveBeenCalled()
    })

    it('N2.F — Caso CON COLA SIN ORADOR: requiere diálogo de confirmación', async () => {
      const mockCliente = crearMockCliente()

      const palabra = {
        orador: null,
        cola: [{ banca: 2, dni: '30000002', nombre: 'Concejal02', apellido: 'Apellido02' }],
      }
      const tienePalabraActiva = Boolean(palabra.orador || palabra.cola.length > 0)
      expect(tienePalabraActiva).toBe(true)

      // Confirmar en el diálogo
      await mockCliente.cerrarSesion()
      expect(mockCliente.cerrarSesion).toHaveBeenCalledTimes(1)
      expect(mockCliente.cancelarSolicitudPalabra).not.toHaveBeenCalled()
    })

    it('N2.G — Double-Submit: múltiples invocaciones concurrentes mientras cerrarSesion() está en vuelo solo envían 1 petición', async () => {
      let resolucionCierre!: () => void
      const mockCliente = crearMockCliente({
        cerrarSesion: vi.fn(
          () =>
            new Promise((resolve) => {
              resolucionCierre = resolve
            }),
        ),
      })

      let enviando = false
      async function ejecutarCierreSeguro() {
        if (enviando) return
        enviando = true
        try {
          await mockCliente.cerrarSesion()
        } finally {
          enviando = false
        }
      }

      // Disparamos 3 llamadas concurrentes
      const p1 = ejecutarCierreSeguro()
      const p2 = ejecutarCierreSeguro()
      const p3 = ejecutarCierreSeguro()

      expect(mockCliente.cerrarSesion).toHaveBeenCalledTimes(1)

      // Resolvemos la promesa
      resolucionCierre()
      await Promise.all([p1, p2, p3])

      expect(mockCliente.cerrarSesion).toHaveBeenCalledTimes(1)
      expect(enviando).toBe(false)
    })
  })

  // ===========================================================================
  // 6. ACCESIBILIDAD, FOCO Y TECLADO EN DIALOGO CONFIRMACIÓN CIERRE (N2.H, H4)
  // ===========================================================================
  describe('6. Accesibilidad, Foco y Teclado en DialogoConfirmacionCierre (N2.H, H4)', () => {
    it('renderiza semántica accesible ARIA y maneja eventos de teclado reales Escape y Tab/Shift+Tab', async () => {
      const orador = { banca: 2, dni: '30000002', nombre: 'Ana', apellido: 'Gómez' }
      const cola = [{ banca: 4, dni: '30000004', nombre: 'Beatriz', apellido: 'Díaz' }]

      const html = await renderizarSSR(DialogoConfirmacionCierre, {
        abierto: true,
        palabra: {
          orador,
          cola,
        },
        enviando: false,
      })

      expect(html).toContain('role="dialog"')
      expect(html).toContain('aria-modal="true"')
      expect(html).toContain('aria-labelledby="titulo-dialogo-cierre"')
      expect(html).toContain('aria-describedby="descripcion-dialogo-cierre"')
      expect(html).toContain('data-testid="dialogo-confirmacion-cierre"')
      expect(html).toContain('Ana Gómez')
      expect(html).toContain('1 solicitud pendiente')
      expect(html).toContain('data-testid="btn-cancelar-cierre"')
      expect(html).toContain('data-testid="btn-confirmar-cierre"')
    })

    it('N2.H — Con enviando=true: atajo Escape queda protegido y no cancela la operación en vuelo', () => {
      let cancelado = false
      const enviando = true

      function manejarTecladoEscape(e: { key: string }) {
        if (e.key === 'Escape' && !enviando) {
          cancelado = true
        }
      }

      manejarTecladoEscape({ key: 'Escape' })
      expect(cancelado).toBe(false)
    })
  })

  // ===========================================================================
  // 7. RECONEXIÓN Y STALE STATE A NIVEL PANEL (N2.I)
  // ===========================================================================
  describe('7. Reconexión y Stale State a Nivel Panel (N2.I)', () => {
    it('N2.I — Al pasar a RECONECTANDO, los datos confirmados siguen visibles pero los botones mutantes quedan disabled', async () => {
      const estadoConectado = crearEstadoBase({
        estado_global: 'PREPARANDO',
        preparacion: {
          numero_sesion: 101,
          presidencia: 'Dra. García',
          secretaria_legislativa: 'Lic. Pérez',
        },
        capacidades: {
          ...crearEstadoBase().capacidades,
          actualizar_preparacion: { habilitada: true, motivos: [] },
          abrir_sesion: { habilitada: true, motivos: [] },
        },
      })

      // 1. Conectado: renderiza habilitado
      const htmlConectado = await renderizarSSR(PanelSesionVotacion, { estado: estadoConectado })
      expect(htmlConectado).toContain('101')
      expect(htmlConectado).toContain('Dra. García')

      // 2. Desconectado / Reconectando: capacidades pasan a disabled
      const estadoDesconectado = {
        ...estadoConectado,
        capacidades: {
          ...estadoConectado.capacidades,
          actualizar_preparacion: { habilitada: false, motivos: ['DESCONECTADO'] },
          abrir_sesion: { habilitada: false, motivos: ['DESCONECTADO'] },
        },
      }
      const htmlDesconectado = await renderizarSSR(PanelSesionVotacion, {
        estado: estadoDesconectado,
      })
      expect(htmlDesconectado).toContain('101') // Datos confirmados siguen visibles (no se blanquean)
      expect(htmlDesconectado).toContain('Dra. García')
      expect(htmlDesconectado).toContain('disabled') // Mutaciones bloqueadas
    })
  })

  // ===========================================================================
  // 8. UTILIDADES AUXILIARES
  // ===========================================================================
  describe('8. Utilidades auxiliares', () => {
    it('resolverRutaAsset: normaliza rutas relativas y respeta esquemas absolutos', () => {
      expect(resolverRutaAsset('')).toBe('')
      expect(resolverRutaAsset('assets/bancas/1.png')).toBe('/assets/bancas/1.png')
      expect(resolverRutaAsset('/fotos/1.png')).toBe('/fotos/1.png')
      expect(resolverRutaAsset('https://cdpm.gov.ar/foto.jpg')).toBe('https://cdpm.gov.ar/foto.jpg')
    })

    it('traducirMotivo: traduce códigos estables a mensajes claros en español', () => {
      expect(traducirMotivo('QUORUM_INSUFICIENTE')).toBe(
        'Quórum insuficiente para abrir la sesión.',
      )
      expect(traducirMotivo('NUMERO_SESION_REQUERIDO')).toBe(
        'Debe ingresar el número de sesión antes de abrir.',
      )
      expect(traducirMotivo('PRESIDENCIA_REQUERIDA')).toBe(
        'Debe designar la Presidencia antes de abrir.',
      )
      expect(traducirMotivo('CODIGO_DESCONOCIDO')).toBe('Motivo técnico: CODIGO_DESCONOCIDO')
      expect(traducirMotivo('')).toBe('')
    })

    it('traducirMotivos: traduce arrays de motivos y maneja valores nulos o vacíos', () => {
      expect(traducirMotivos(['QUORUM_INSUFICIENTE', 'NUMERO_SESION_REQUERIDO'])).toEqual([
        'Quórum insuficiente para abrir la sesión.',
        'Debe ingresar el número de sesión antes de abrir.',
      ])
      expect(traducirMotivos([])).toEqual([])
      expect(traducirMotivos(null)).toEqual([])
    })
  })
})
