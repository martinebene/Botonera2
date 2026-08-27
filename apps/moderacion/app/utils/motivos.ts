/**
 * Utilidades para la traducción y presentación comprensible de motivos de capacidades.
 *
 * El backend expone en cada `Capacidad` un listado de códigos de motivo estables
 * legibles por máquina (ej: 'QUORUM_INSUFICIENTE', 'PRESIDENCIA_REQUERIDA').
 *
 * Este módulo traduce esos códigos a explicaciones claras y pedagógicas en español
 * para el operador institucional, sin alterar la autoridad funcional del backend.
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
 * Traduce un código de motivo backend a una descripción humana en español.
 *
 * @param codigo Identificador de motivo retornado por el backend (ej: "QUORUM_INSUFICIENTE")
 * @returns Mensaje explicativo legible para el operador
 */
export function traducirMotivo(codigo: string): string {
  if (!codigo) return ''
  return DICCIONARIO_MOTIVOS[codigo] || `Motivo técnico: ${codigo}`
}

/**
 * Traduce una lista de motivos del backend.
 *
 * @param motivos Lista de códigos de motivo
 * @returns Lista de mensajes traducidos
 */
export function traducirMotivos(motivos?: string[] | null): string[] {
  if (!motivos || motivos.length === 0) return []
  return motivos.map(traducirMotivo)
}
