/**
 * Tipos y constantes del Simulador Web de Dispositivos Lógicos.
 *
 * Contiene las definiciones de las 6 acciones estándar por tarjeta,
 * la lista de dispositivos mínimos dev01..dev12 y la estructura del log global.
 */

/**
 * Representa una acción humana disponible en la tarjeta de un dispositivo.
 */
export interface AccionSimulador {
  /** Identificador técnico de la acción */
  id: string
  /** Etiqueta visible en el botón */
  nombre: string
  /** Tecla funcional enviada a FastAPI */
  tecla: string
  /** Símbolo o icono textual distintivo (accesibilidad visual sin depender solo de color) */
  simbolo: string
  /** Color/estilo semántico base del botón */
  variante: 'afirmativo' | 'abstencion' | 'negativo' | 'palabra' | 'test' | 'presencia'
}

/**
 * Registro de una pulsación emitida hacia FastAPI para diagnóstico visual.
 */
export interface EntradaLogSimulador {
  /** Identificador único local para la clave de renderizado (v-for) */
  id: string
  /** Hora local en formato HH:MM:SS */
  timestamp: string
  /** Dispositivo emisor (ej. 'dev01') */
  dispositivo: string
  /** Nombre humano de la acción (ej. 'Afirmativo') */
  accion: string
  /** Tecla funcional enviada (ej. '1') */
  tecla: string
  /** Código de estado HTTP de la respuesta (ej. 200, 422, 503) */
  statusHttp?: number
  /** Si la pulsación fue aceptada institucionalmente por FastAPI */
  aceptada?: boolean
  /** Código de motivo reportado por FastAPI (ej. 'PRESENCIA_ACTUALIZADA', 'TECLA_NO_HABILITADA') */
  motivo?: string
  /** Tiempo de ida y vuelta en milisegundos */
  latenciaMs: number
  /** Mensaje de error técnico si no hubo respuesta HTTP válida */
  errorTecnico?: string
}

/**
 * Estados del canal de comunicación y sincronización de Moderación.
 */
export type EstadoConexion = 'INICIAL' | 'CONECTADO' | 'RECONECTANDO' | 'DESCONECTADO'

/**
 * Lista canónica de los 12 dispositivos lógicos representados simultáneamente.
 */
export const DISPOSITIVOS_SIMULADOR: readonly string[] = [
  'dev01',
  'dev02',
  'dev03',
  'dev04',
  'dev05',
  'dev06',
  'dev07',
  'dev08',
  'dev09',
  'dev10',
  'dev11',
  'dev12',
] as const

/**
 * Las seis acciones funcionales disponibles en cada tarjeta.
 *
 * Mapeo canónico:
 * - Afirmativo -> '1'
 * - Abstención -> '2'
 * - Negativo   -> '3'
 * - Palabra    -> '7'
 * - Test       -> '8'
 * - Pres. / Aus. -> '9' (etiqueta neutra, sin indicar presencia/ausencia actual)
 */
export const ACCIONES_SIMULADOR: readonly AccionSimulador[] = [
  {
    id: 'afirmativo',
    nombre: 'Afirmativo',
    tecla: '1',
    simbolo: '✓',
    variante: 'afirmativo',
  },
  {
    id: 'abstencion',
    nombre: 'Abstención',
    tecla: '2',
    simbolo: '○',
    variante: 'abstencion',
  },
  {
    id: 'negativo',
    nombre: 'Negativo',
    tecla: '3',
    simbolo: '✗',
    variante: 'negativo',
  },
  {
    id: 'palabra',
    nombre: 'Palabra',
    tecla: '7',
    simbolo: '🎤',
    variante: 'palabra',
  },
  {
    id: 'test',
    nombre: 'Test',
    tecla: '8',
    simbolo: '⚡',
    variante: 'test',
  },
  {
    id: 'presencia',
    nombre: 'Pres. / Aus.',
    tecla: '9',
    simbolo: '👤',
    variante: 'presencia',
  },
] as const
