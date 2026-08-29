/**
 * Composable y frontera reactiva para el Simulador Web de Dispositivos Lógicos.
 *
 * Responsabilidades:
 * 1. Conectar con @botonera2/api-client mediante ClienteSimulador para la sincronización
 *    del estado de Moderación (diagnóstico en tiempo real mediante Snapshot REST + SSE).
 * 2. Administrar la emisión de pulsaciones directas a POST /api/v1/entradas/tecla:
 *    - Cero reglas de negocio en frontend: toda pulsación se envía a FastAPI.
 *    - Bloqueo efímero por control mientras la petición está en vuelo (evita doble click accidental).
 *    - Concurrencia real: dispositivos distintos no se bloquean entre sí.
 *    - Cero reintentos automáticos: como máximo un intento HTTP por click.
 * 3. Mantener el log global visible en memoria (acotado a 50 entradas) con autoscroll.
 * 4. Gestionar el ciclo de vida de la suscripción SSE liberando recursos al desmontar.
 */

import {
  ref,
  computed,
  onMounted,
  onScopeDispose,
  getCurrentScope,
  type Ref,
  type ComputedRef,
} from 'vue'
import {
  crearClienteSimulador,
  ErrorHttp,
  type ClienteSimulador,
  type EstadoGlobal,
  type EstadoModeracion,
  type Suscripcion,
  type ConfiguracionCliente,
} from '@botonera2/api-client'
import type { EntradaLogSimulador, EstadoConexion } from '../types/simulador'

/**
 * Parámetros opcionales para configurar o inyectar dependencias en useSimulador.
 */
export interface OpcionesSimulador {
  /** Cliente simulador preconfigurado (útil para pruebas unitarias) */
  cliente?: ClienteSimulador
  /** Configuración general para instanciar ClienteSimulador */
  configuracionCliente?: ConfiguracionCliente
  /** Si debe suscribirse automáticamente al crearse (por defecto false) */
  autoIniciar?: boolean
  /** Límite máximo de entradas retenidas en memoria para el log global */
  limiteLog?: number
}

/**
 * Interfaz pública expuesta por el composable useSimulador.
 */
export interface ManejadorSimulador {
  /** Último EstadoModeracion confirmado emitido por el backend */
  estado: Ref<EstadoModeracion | null>
  /** Estado técnico de la conexión (INICIAL, CONECTADO, RECONECTANDO, DESCONECTADO) */
  estadoConexion: Ref<EstadoConexion>
  /** Último error técnico de transporte o protocolo capturado */
  ultimoError: Ref<unknown | null>
  /** Indica si la conexión SSE en tiempo real está establecida */
  conectado: ComputedRef<boolean>
  /** Indica si el estado mostrado puede estar desactualizado por pérdida temporal de SSE */
  desactualizado: ComputedRef<boolean>
  /** Número de revisión monotónica actual */
  revision: ComputedRef<number | null>
  /** Estado global del sistema (SIN_PREPARAR, PREPARANDO, SESION_ABIERTA) */
  estadoGlobal: ComputedRef<EstadoGlobal | null>
  /** Resumen textual de presentes y quórum institucional */
  quorumResumen: ComputedRef<string>
  /** Resumen textual de la etapa/sesión activa */
  sesionResumen: ComputedRef<string>
  /** Resumen de la votación activa o reciente */
  votacionResumen: ComputedRef<string>
  /** Última latencia de petición HTTP observada en milisegundos */
  ultimaLatenciaMs: Ref<number | null>
  /** Mapa de peticiones en vuelo por dispositivo y tecla para feedback efímero */
  peticionesEnVuelo: Ref<Record<string, boolean>>
  /** Historial en memoria de las pulsaciones enviadas y sus respuestas */
  entradasLog: Ref<EntradaLogSimulador[]>
  /** Instancia del cliente API */
  cliente: ClienteSimulador
  /** Emite una pulsación lógica directa a FastAPI sin pasar por el device-bridge */
  enviarPulsacion: (dispositivo: string, tecla: string, nombreAccion: string) => Promise<void>
  /** Vacía el log local en memoria */
  limpiarLog: () => void
  /** Inicia manualmente la sincronización con el backend */
  iniciar: () => void
  /** Cancela la suscripción activa */
  cancelar: () => void
}

const LIMITE_LOG_PREDETERMINADO = 50

/**
 * Crea y administra la frontera reactiva del simulador de dispositivos lógicos.
 */
export function useSimulador(opciones: OpcionesSimulador = {}): ManejadorSimulador {
  const limiteLog = opciones.limiteLog ?? LIMITE_LOG_PREDETERMINADO

  // Resolución de la URL base mediante runtimeConfig de Nuxt si está disponible en este contexto
  let configuracion = opciones.configuracionCliente
  if (!configuracion && !opciones.cliente) {
    try {
      const config = useRuntimeConfig()
      configuracion = { baseUrl: config.public.apiBaseUrl }
    } catch {
      configuracion = {}
    }
  }

  const cliente = opciones.cliente ?? crearClienteSimulador(configuracion ?? {})

  const estado = ref<EstadoModeracion | null>(null)
  const estadoConexion = ref<EstadoConexion>('INICIAL')
  const ultimoError = ref<unknown | null>(null)
  const ultimaLatenciaMs = ref<number | null>(null)
  const peticionesEnVuelo = ref<Record<string, boolean>>({})
  const entradasLog = ref<EntradaLogSimulador[]>([])

  let suscripcionActiva: Suscripcion | null = null

  const conectado = computed(() => estadoConexion.value === 'CONECTADO')
  const desactualizado = computed(
    () => estadoConexion.value === 'RECONECTANDO' && estado.value !== null,
  )
  const revision = computed(() => estado.value?.revision ?? null)
  const estadoGlobal = computed(() => estado.value?.estado_global ?? null)

  const quorumResumen = computed(() => {
    if (!estado.value || !estado.value.quorum) return 'Sin datos'
    const q = estado.value.quorum
    const alcanzo = q.alcanzado ? 'Quórum alcanzado' : 'Sin quórum'
    return `${q.cantidad_presentes} presentes (${alcanzo})`
  })

  const sesionResumen = computed(() => {
    if (!estado.value) return 'Sin datos'
    if (estado.value.estado_global === 'SESION_ABIERTA' && estado.value.sesion) {
      return `Sesión N° ${estado.value.sesion.numero_sesion}`
    }
    if (estado.value.estado_global === 'PREPARANDO' && estado.value.preparacion) {
      return estado.value.preparacion.numero_sesion !== null
        ? `Preparación N° ${estado.value.preparacion.numero_sesion}`
        : 'Preparando'
    }
    return 'Sin preparar'
  })

  const votacionResumen = computed(() => {
    if (!estado.value || !estado.value.votacion) return 'Sin votación activa'
    const v = estado.value.votacion
    return `Votación N° ${v.numero_votacion} (${v.estado_recepcion}): ${v.tema}`
  })

  /**
   * Inicia el ciclo reactivo de sincronización con el backend.
   */
  function iniciar(): void {
    if (suscripcionActiva !== null) return

    estadoConexion.value = 'INICIAL'
    ultimoError.value = null

    suscripcionActiva = cliente.suscribirEstado({
      alEstado: (nuevoEstado) => {
        estado.value = nuevoEstado
        estadoConexion.value = 'CONECTADO'
      },
      alError: (error) => {
        ultimoError.value = error
      },
      alCambiarConexion: (conectadoSse) => {
        if (conectadoSse) {
          estadoConexion.value = 'CONECTADO'
        } else if (estado.value !== null) {
          estadoConexion.value = 'RECONECTANDO'
        } else {
          estadoConexion.value = 'DESCONECTADO'
        }
      },
    })
  }

  /**
   * Cancela la sincronización activa y libera el EventSource.
   */
  function cancelar(): void {
    if (suscripcionActiva !== null) {
      suscripcionActiva.cancelar()
      suscripcionActiva = null
    }
    estadoConexion.value = 'DESCONECTADO'
  }

  /**
   * Envía una pulsación directa a FastAPI midiendo latencia y registrando la respuesta.
   *
   * @param dispositivo Identificador del dispositivo (ej. 'dev01')
   * @param tecla Tecla funcional enviada (ej. '9')
   * @param nombreAccion Etiqueta humana para el log (ej. 'Pres. / Aus.')
   */
  async function enviarPulsacion(
    dispositivo: string,
    tecla: string,
    nombreAccion: string,
  ): Promise<void> {
    const claveControl = `${dispositivo}-${tecla}`

    // Evita doble click involuntario en el mismo botón mientras su petición está en vuelo
    if (peticionesEnVuelo.value[claveControl]) {
      return
    }

    peticionesEnVuelo.value[claveControl] = true
    const inicio = performance.now()
    const ahora = new Date()
    const timestamp = ahora.toTimeString().split(' ')[0] ?? ahora.toLocaleTimeString()

    try {
      // Como máximo un intento HTTP, sin retry automático
      const respuesta = await cliente.enviarTecla({ dispositivo, tecla })
      const latencia = Math.round(performance.now() - inicio)
      ultimaLatenciaMs.value = latencia

      // Registro fiel de la respuesta del servidor (status 200 con resultado funcional)
      agregarEntradaLog({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp,
        dispositivo,
        accion: nombreAccion,
        tecla,
        statusHttp: 200,
        aceptada: respuesta.aceptada,
        motivo: respuesta.motivo,
        latenciaMs: latencia,
      })
    } catch (error) {
      const latencia = Math.round(performance.now() - inicio)
      ultimaLatenciaMs.value = latencia

      if (error instanceof ErrorHttp) {
        // Respuesta estructurada no exitosa del backend (ej. 422, 503)
        const motivo =
          error.codigo ?? (typeof error.detalle === 'string' ? error.detalle : 'ERROR_HTTP')
        agregarEntradaLog({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp,
          dispositivo,
          accion: nombreAccion,
          tecla,
          statusHttp: error.estado,
          aceptada: false,
          motivo,
          latenciaMs: latencia,
        })
      } else {
        // Error de red, timeout o fallo de transporte
        const mensajeError = error instanceof Error ? error.message : String(error)
        agregarEntradaLog({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp,
          dispositivo,
          accion: nombreAccion,
          tecla,
          aceptada: false,
          errorTecnico: mensajeError,
          latenciaMs: latencia,
        })
      }
    } finally {
      // Liberar el control efímero inmediatamente al concluir la petición
      peticionesEnVuelo.value[claveControl] = false
    }
  }

  /**
   * Agrega una entrada al log global manteniendo acotada la cantidad de elementos en memoria.
   */
  function agregarEntradaLog(entrada: EntradaLogSimulador): void {
    entradasLog.value.push(entrada)
    if (entradasLog.value.length > limiteLog) {
      entradasLog.value.splice(0, entradasLog.value.length - limiteLog)
    }
  }

  /**
   * Limpia el registro local de pulsaciones en memoria.
   */
  function limpiarLog(): void {
    entradasLog.value = []
  }

  // Integración automática con el ciclo de vida del componente Nuxt/Vue
  if (getCurrentScope()) {
    onMounted(() => {
      iniciar()
    })

    onScopeDispose(() => {
      cancelar()
    })
  } else if (opciones.autoIniciar) {
    iniciar()
  }

  return {
    estado,
    estadoConexion,
    ultimoError,
    conectado,
    desactualizado,
    revision,
    estadoGlobal,
    quorumResumen,
    sesionResumen,
    votacionResumen,
    ultimaLatenciaMs,
    peticionesEnVuelo,
    entradasLog,
    cliente,
    enviarPulsacion,
    limpiarLog,
    iniciar,
    cancelar,
  }
}
