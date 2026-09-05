/**
 * Utilidades para la traducción y presentación comprensible de motivos de capacidades.
 *
 * El backend expone en cada `Capacidad` un listado de códigos de motivo estables
 * legibles por máquina (ej: 'QUORUM_INSUFICIENTE', 'PRESIDENCIA_REQUERIDA').
 *
 * Este módulo traduce esos códigos a explicaciones claras y pedagógicas en español
 * para el operador institucional, sin alterar la autoridad funcional del backend.
 *
 * WP-051 agrega una segunda dimensión: el **contexto**. Un mismo código puede aparecer
 * en capacidades distintas y significar impedimentos distintos para el operador. El caso
 * concreto que motivó el cambio es `QUORUM_INSUFICIENTE`: el backend lo publica tanto en
 * `abrir_sesion` (durante PREPARANDO) como en `abrir_votacion` (con la sesión ya abierta).
 * Traducirlo siempre como "para abrir la sesión" confundía al operador durante una sesión
 * en curso, porque la sesión ya estaba abierta y lo que quedaba impedido era votar.
 *
 * WP-070 agrega el segundo caso por la misma razón: `ESTADO_INCOMPATIBLE` es el código
 * genérico con el que el backend rechaza cualquier acción fuera del estado global que la
 * habilita, así que su redacción general no puede decir qué falta hacer. Leído desde
 * `cargar_orden_del_dia` sí se sabe: el operador todavía no comenzó a preparar el recinto.
 *
 * El contexto solo cambia la **redacción**: no agrega, quita ni reinterpreta motivos. La
 * autoridad sobre qué está permitido sigue siendo exclusivamente del backend.
 */

const DICCIONARIO_MOTIVOS: Record<string, string> = {
  QUORUM_INSUFICIENTE: 'Quórum insuficiente para abrir la sesión.',
  NUMERO_SESION_REQUERIDO: 'Debe ingresar el número de sesión antes de abrir.',
  PRESIDENCIA_REQUERIDA: 'Debe designar la Presidencia antes de abrir.',
  SECRETARIA_LEGISLATIVA_REQUERIDA: 'Debe designar la Secretaría Legislativa antes de abrir.',
  AUDITORIA_NO_DISPONIBLE: 'El sistema de auditoría institucional no está disponible.',
  ESTADO_INCOMPATIBLE: 'El estado actual del sistema no permite ejecutar esta acción.',
  VOTACION_PENDIENTE:
    'No se puede cerrar la sesión con una votación en curso o pendiente de desempate.',
  VOTACION_EN_CURSO: 'Existe una votación en curso.',
  VOTACION_NO_EN_CURSO: 'No existe una votación en curso que pueda finalizarse.',
  VOTACION_NO_EMPATADA: 'No existe una mayoría simple empatada pendiente de desempate.',
  DESEMPATE_YA_EMITIDO: 'El voto presidencial ya fue emitido y no puede repetirse.',
  PADRON_NO_DISPONIBLE: 'El padrón de concejales no se encuentra disponible.',
  SESION_YA_INICIADA: 'La sesión ya se encuentra abierta.',
  DESEMPATE_NO_REQUERIDO: 'La votación no se encuentra en condición de empate.',
  ORADOR_NO_PRESENTE: 'El concejal seleccionado no se encuentra presente.',
  COLA_VACIA: 'No hay pedidos de palabra registrados en la cola.',
  REMAPEO_YA_ACTIVO: 'Ya existe un remapeo en curso.',
  REMAPEO_NO_COINCIDE: 'No existe una operación de remapeo aplicable.',
  REMAPEO_SIN_CANDIDATO: 'Todavía no hay un teclado candidato para confirmar.',
}

/**
 * Capacidad concreta desde la que se está leyendo un motivo.
 *
 * Solo se enumeran los contextos que realmente necesitan una redacción propia. Para el
 * resto alcanza el texto general del diccionario, así que no se declaran contextos
 * preventivos que después nadie mantendría.
 */
export type ContextoMotivo = 'abrir_votacion' | 'cargar_orden_del_dia'

/**
 * Redacciones específicas por contexto.
 *
 * Se lee como: "cuando el motivo `X` viene de la capacidad `C`, decilo así". Si un código
 * no figura acá para el contexto pedido, se usa la traducción general.
 */
const MOTIVOS_POR_CONTEXTO: Record<ContextoMotivo, Record<string, string>> = {
  // Con la sesión ya abierta, la falta de quórum no impide "abrir la sesión": impide
  // poner una votación en marcha. Es el texto que pidió la prueba humana del 01/09/2026.
  abrir_votacion: {
    QUORUM_INSUFICIENTE: 'Quórum insuficiente para abrir una votación.',
  },
  // WP-070: antes de PREPARANDO el backend impide cargar el Orden del Día con el mismo
  // código genérico `ESTADO_INCOMPATIBLE` que usa para cualquier otra acción fuera de
  // estado. El operador leía "El estado actual del sistema no permite ejecutar esta
  // acción." y no podía deducir qué le faltaba hacer. Este texto —fijado literalmente por
  // HUMAN_GATE, sin tildes y sin punto final— nombra la acción que destraba la carga.
  cargar_orden_del_dia: {
    ESTADO_INCOMPATIBLE: 'Debe comenzar a preparar el recinto antes de cargar el orden del dia',
  },
}

/**
 * Traduce un código de motivo backend a una descripción humana en español.
 *
 * @param codigo Identificador de motivo retornado por el backend (ej: "QUORUM_INSUFICIENTE")
 * @param contexto Capacidad desde la que se lee el motivo. Cuando existe una redacción
 *   específica para ese contexto se prefiere; si no, se usa la traducción general.
 * @returns Mensaje explicativo legible para el operador
 */
export function traducirMotivo(codigo: string, contexto?: ContextoMotivo): string {
  if (!codigo) return ''
  if (contexto) {
    const especifico = MOTIVOS_POR_CONTEXTO[contexto][codigo]
    if (especifico) return especifico
  }
  return DICCIONARIO_MOTIVOS[codigo] || `Motivo técnico: ${codigo}`
}

/**
 * Traduce una lista de motivos del backend.
 *
 * @param motivos Lista de códigos de motivo
 * @param contexto Capacidad desde la que se leen todos esos motivos
 * @returns Lista de mensajes traducidos
 */
export function traducirMotivos(motivos?: string[] | null, contexto?: ContextoMotivo): string[] {
  if (!motivos || motivos.length === 0) return []
  return motivos.map((codigo) => traducirMotivo(codigo, contexto))
}
