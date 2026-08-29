/**
 * Tipos de datos del cliente API derivados de OpenAPI y contratos propios del paquete.
 *
 * Los tipos de modelos del backend (DTOs de Moderación, Recinto, Votación, etc.)
 * se derivan directamente de components["schemas"] generados por openapi-typescript,
 * garantizando que FastAPI sea la única fuente técnica de verdad.
 */

import type { components, paths, operations } from './esquema'

// =============================================================================
// 1. Tipos de dominio derivados de OpenAPI (DTOs de FastAPI)
// =============================================================================

/** Estado global del sistema: SIN_PREPARAR | PREPARANDO | SESION_ABIERTA */
export type EstadoGlobal = components['schemas']['EstadoGlobal']

/** Proyección completa del estado para la interfaz de Moderación */
export type EstadoModeracion = components['schemas']['EstadoModeracion']

/** Proyección restrictiva de solo lectura para la Pantalla del Recinto */
export type EstadoRecinto = components['schemas']['EstadoRecinto']

/** Datos institucionales de la etapa de preparación */
export type DatosPreparacion = components['schemas']['DatosPreparacion']

/** Datos institucionales de la sesión abierta */
export type DatosSesion = components['schemas']['DatosSesion']

/** Configuración congelada del backend expuesta a Moderación */
export type ConfiguracionProyectada = components['schemas']['ConfiguracionProyectada']

/** Información de banca y concejal para la pantalla de Moderación */
export type ConcejalModeracion = components['schemas']['ConcejalModeracion']

/** Información pública de banca y concejal para el Recinto (sin DNI ni dispositivo) */
export type ConcejalPublico = components['schemas']['ConcejalPublico']

/** Estado del quórum calculado por el backend */
export type EstadoQuorum = components['schemas']['EstadoQuorum']

/** Información completa de la votación activa o reciente para Moderación */
export type VotacionModeracion = components['schemas']['VotacionModeracion']

/** Información pública restrictiva de la votación para el Recinto */
export type VotacionPublica = components['schemas']['VotacionPublica']

/** Voto individual de un concejal para Moderación */
export type VotoModeracion = components['schemas']['VotoModeracion']

/** Voto individual público posterior al cierre de votación */
export type VotoPublico = components['schemas']['VotoPublico']

/** Voto presidencial de desempate proyectado */
export type VotoPresidencialProyectado = components['schemas']['VotoPresidencialProyectado']

/** Conteos de votos computados */
export type ConteosVotosProyectados = components['schemas']['ConteosVotosProyectados']

/** Estado del uso de la palabra para Moderación (con DNI) */
export type EstadoPalabraModeracion = components['schemas']['EstadoPalabraModeracion']

/** Estado público del uso de la palabra para Recinto (sin DNI) */
export type EstadoPalabraPublico = components['schemas']['EstadoPalabraPublico']

/** Identidad de orador o solicitante en cola para Moderación */
export type PersonaPalabraModeracion = components['schemas']['PersonaPalabraModeracion']

/** Identidad de orador o solicitante en cola para Recinto */
export type PersonaPalabraPublica = components['schemas']['PersonaPalabraPublica']

/** Punto individual del Orden del Día proyectado en el estado */
export type PuntoOrdenDelDiaProyectado = components['schemas']['PuntoOrdenDelDiaProyectado']

/** Punto normalizado devuelto tras la carga del CSV del Orden del Día */
export type PuntoOrdenDelDiaRespuesta = components['schemas']['PuntoOrdenDelDiaRespuesta']

/** Respuesta de la carga del CSV del Orden del Día */
export type RespuestaOrdenDelDia = components['schemas']['CargaOrdenDelDiaRespuesta']

/** Evento reciente auditado confirmado */
export type EventoRecienteProyectado = components['schemas']['EventoRecienteProyectado']

/** Estado técnico del escritor institucional de auditoría */
export type EstadoAuditoriaProyectado = components['schemas']['EstadoAuditoriaProyectado']

/** Operación física activa visible exclusivamente para Moderación */
export type EstadoRemapeoModeracion = components['schemas']['EstadoRemapeoModeracion']

/** Respuesta del inicio/callback de una coordinación de remapeo */
export type EstadoRemapeoRespuesta = components['schemas']['EstadoRemapeoRespuesta']

/** Capacidad operativa individual evaluada por el backend */
export type Capacidad = components['schemas']['Capacidad']

/** Conjunto de capacidades operativas disponibles para Moderación */
export type CapacidadesModeracion = components['schemas']['CapacidadesModeracion']

/** Estado de recepción de votos en una votación: EN_CURSO | CERRADA */
export type EstadoVotacion = components['schemas']['EstadoVotacion']

/** Regla de mayoría: SIMPLE | ESPECIAL */
export type TipoMayoria = components['schemas']['TipoMayoria']

/** Base o denominador de mayoría: VOTOS_COMPUTABLES | PRESENTES | CUERPO */
export type BaseMayoria = components['schemas']['BaseMayoria']

/** Sentido de voto ordinario: POSITIVO | ABSTENCION | NEGATIVO */
export type ValorVotoOrdinario = components['schemas']['ValorVotoOrdinario']

/** Acción de palabra producida por tecla 7 */
export type AccionPalabra = components['schemas']['AccionPalabra']

/** Respuesta de salud del backend */
export type RespuestaSalud = components['schemas']['RespuestaSalud']

/** Respuesta tras abrir una votación */
export type RespuestaVotacion = components['schemas']['RespuestaVotacion']

/** Cuerpo de error estructurado devuelto por el backend */
export type ErrorRespuesta = components['schemas']['ErrorRespuesta']

// Solicitudes / Bodies de comandos REST
export type SolicitudActualizarPreparacion = components['schemas']['SolicitudActualizarPreparacion']
export type SolicitudActualizarSesion = components['schemas']['SolicitudActualizarSesion']
export type SolicitudVotacionSimple = components['schemas']['SolicitudVotacionSimple']
export type SolicitudVotacionEspecial = components['schemas']['SolicitudVotacionEspecial']
export type SolicitudAperturaVotacion = SolicitudVotacionSimple | SolicitudVotacionEspecial
export type SolicitudFinalizarVotacion = components['schemas']['SolicitudFinalizarVotacion']
export type SolicitudDesempate = components['schemas']['SolicitudDesempate']
export type SolicitudIniciarRemapeo = components['schemas']['SolicitudIniciarRemapeo']
export type SolicitudConfirmarRemapeo = components['schemas']['SolicitudConfirmarRemapeo']
export type SolicitudTecla = components['schemas']['SolicitudTecla']
export type RespuestaTecla = components['schemas']['RespuestaTecla']

// =============================================================================
// 2. Tipos y contratos del cliente TypeScript (no-DTOs de backend)
// =============================================================================

/**
 * Función temporizadora inyectable para esperas asíncronas con soporte de cancelación.
 */
export type Temporizador = (milisegundos: number, signal?: AbortSignal) => Promise<void>

/**
 * Parámetros de configuración de la estrategia de reconexión con retroceso exponencial.
 */
export interface ConfiguracionBackoff {
  /** Tiempo inicial de espera en milisegundos (por defecto: 500 ms) */
  esperaInicialMs?: number
  /** Tiempo máximo de espera en milisegundos (por defecto: 5000 ms) */
  esperaMaximaMs?: number
  /** Factor de multiplicación para cada reintento consecutivo (por defecto: 1.5) */
  factorMultiplicador?: number
  /** Función temporizadora inyectable para pruebas unitarias */
  temporizador?: Temporizador
}

/**
 * Interfaz mínima requerida de un EventSource nativo o simulado.
 */
export interface InterfazEventSource {
  onopen: ((evento: Event) => void) | null
  onerror: ((evento: Event) => void) | null
  onmessage: ((evento: MessageEvent) => void) | null
  addEventListener(tipo: string, listener: (evento: MessageEvent) => void): void
  removeEventListener(tipo: string, listener: (evento: MessageEvent) => void): void
  close(): void
}

/**
 * Fábrica inyectable para crear instancias de EventSource.
 */
export type FabricaEventSource = (url: string) => InterfazEventSource

/**
 * Configuración general para instanciar clientes de Moderación o Recinto.
 */
export interface ConfiguracionCliente {
  /**
   * URL base del backend (por ejemplo: "http://localhost:8000" o "/").
   * Si se omite, se utiliza una cadena vacía (mismo origen).
   */
  baseUrl?: string

  /**
   * Implementación de fetch inyectable (por defecto: globalThis.fetch).
   */
  fetch?: typeof fetch

  /**
   * Fábrica inyectable para crear conexiones EventSource (por defecto: () => new EventSource(url)).
   */
  fabricaEventSource?: FabricaEventSource

  /**
   * Configuración de la estrategia de retroceso (backoff) para reconexiones SSE.
   */
  backoff?: ConfiguracionBackoff
}

/**
 * Opciones para suscribirse al flujo reactivo de sincronización de estado.
 */
export interface OpcionesSuscripcion<T> {
  /**
   * Callback invocado cada vez que se adopta un nuevo estado completo válido
   * (tanto por snapshot inicial/recuperación como por eventos SSE recibidos).
   */
  alEstado: (estado: T) => void

  /**
   * Callback opcional invocado ante un error de transporte, HTTP o protocolo.
   * La recepción de un error no detiene el ciclo de reconexión automática.
   */
  alError?: (error: unknown) => void

  /**
   * Callback opcional invocado cuando cambia el estado de conexión del stream SSE
   * (true al abrirse el stream, false al perderse o cerrarse).
   */
  alCambiarConexion?: (conectado: boolean) => void
}

/**
 * Representa una suscripción activa a un stream de sincronización de estado.
 */
export interface Suscripcion {
  /**
   * Detiene de forma determinista e idempotente la sincronización,
   * cancelando timers de backoff, abortando requests de recuperación pendientes
   * y cerrando el EventSource activo sin emitir callbacks posteriores.
   */
  cancelar(): void

  /**
   * Indica si la suscripción continúa activa.
   */
  readonly activa: boolean
}

// Re-exportamos los tipos OpenAPI raíz para consumidores avanzados
export type { paths, components, operations }
