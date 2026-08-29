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
 * Límites canónicos para la cantidad de dispositivos dinámicos en el simulador (WP-035).
 *
 * El usuario puede ajustar la cantidad visible entre 1 y 20 dispositivos.
 * El valor inicial al cargar la SPA es 12.
 */
export const CANTIDAD_DISPOSITIVOS_MINIMA = 1
export const CANTIDAD_DISPOSITIVOS_MAXIMA = 20
export const CANTIDAD_DISPOSITIVOS_POR_DEFECTO = 12

/**
 * Genera la secuencia continua y ordenada de identificadores lógicos dev01..devNN.
 *
 * Por ejemplo:
 * - cantidad = 8  => ['dev01', 'dev02', ..., 'dev08']
 * - cantidad = 12 => ['dev01', 'dev02', ..., 'dev12']
 * - cantidad = 20 => ['dev01', 'dev02', ..., 'dev20']
 *
 * Si se solicita un valor fuera del rango 1..20, se ajusta automáticamente a los límites.
 *
 * @param cantidad Número de dispositivos deseados a representar.
 * @returns Lista ordenada de cadenas con formato devXX con padding de 2 dígitos.
 */
export function generarIdentificadoresDispositivos(cantidad: number): string[] {
  // Aseguramos que la cantidad esté acotada entre el mínimo (1) y el máximo (20)
  const cantidadSaneada = Math.min(
    Math.max(Math.floor(cantidad), CANTIDAD_DISPOSITIVOS_MINIMA),
    CANTIDAD_DISPOSITIVOS_MAXIMA,
  )

  return Array.from({ length: cantidadSaneada }, (_, indice) => {
    const numero = indice + 1
    return `dev${String(numero).padStart(2, '0')}`
  })
}

/**
 * Lista canónica predeterminada de 12 dispositivos dev01..dev12.
 * Mantenida para compatibilidad y como valor de referencia inicial.
 */
export const DISPOSITIVOS_SIMULADOR: readonly string[] = Object.freeze(
  generarIdentificadoresDispositivos(CANTIDAD_DISPOSITIVOS_POR_DEFECTO),
)

/**
 * Las seis acciones funcionales disponibles en cada tarjeta, ordenadas exactamente
 * según la especificación de diseño de WP-035 (grilla de 2 filas x 3 columnas):
 *
 * |               | Columna 1              | Columna 2           | Columna 3          |
 * |---------------|------------------------|---------------------|--------------------|
 * | Fila superior | Presencia (tecla 9)    | Test (tecla 8)      | Palabra (tecla 7)  |
 * | Fila inferior | Afirmativo (tecla 1)   | Abstención (tecla 2)| Negativo (tecla 3) |
 *
 * Al renderizar con CSS Grid (`grid-cols-3`), los primeros 3 elementos ocupan
 * la fila superior y los siguientes 3 ocupan la fila inferior.
 */
export const ACCIONES_SIMULADOR: readonly AccionSimulador[] = [
  // Fila superior (Columna 1, 2, 3)
  {
    id: 'presencia',
    nombre: 'Pres. / Aus.',
    tecla: '9',
    simbolo: '👤',
    variante: 'presencia',
  },
  {
    id: 'test',
    nombre: 'Test',
    tecla: '8',
    simbolo: '⚡',
    variante: 'test',
  },
  {
    id: 'palabra',
    nombre: 'Palabra',
    tecla: '7',
    simbolo: '🎤',
    variante: 'palabra',
  },
  // Fila inferior (Columna 1, 2, 3)
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
] as const
