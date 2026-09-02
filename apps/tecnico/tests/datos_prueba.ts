/**
 * Fixtures del puesto de Apoyo Técnico (WP-056).
 *
 * Construyen exactamente los DTO que publica el backend, sin campos inventados: si el
 * contrato cambiara, estas fábricas dejarían de compilar y la divergencia se detectaría
 * acá antes que en la pantalla.
 */

import type {
  AvisoTecnicoProyectado,
  BibliotecaMensajesProyectada,
  DestinoAvisoTecnico,
  EstadoTecnico,
  EventoRecienteProyectado,
  MensajeTecnicoProyectado,
  TransmisionProyectada,
} from '@botonera2/api-client'

export function crearTransmisionPrueba(
  parcial: Partial<TransmisionProyectada> = {},
): TransmisionProyectada {
  return {
    estado: parcial.estado ?? 'APAGADO',
    iniciada_en: parcial.iniciada_en ?? null,
    en_vivo_desde: parcial.en_vivo_desde ?? null,
    cuenta_regresiva_segundos: parcial.cuenta_regresiva_segundos ?? null,
    segundos_restantes: parcial.segundos_restantes ?? null,
  }
}

export function crearAvisoPrueba(
  parcial: Partial<AvisoTecnicoProyectado> = {},
): AvisoTecnicoProyectado {
  return {
    aviso_id: parcial.aviso_id ?? 'aviso-1',
    texto: parcial.texto ?? 'Corte de energía en el recinto',
    destino: parcial.destino ?? 'AMBOS',
    publicado_en: parcial.publicado_en ?? '2026-09-02T10:00:00Z',
    expira_en: parcial.expira_en ?? null,
    segundos_restantes: parcial.segundos_restantes ?? null,
  }
}

export function crearMensajePrueba(
  mensajeId: string,
  texto: string,
  destino: DestinoAvisoTecnico = 'AMBOS',
): MensajeTecnicoProyectado {
  return { mensaje_id: mensajeId, texto, destino }
}

export function crearBibliotecaPrueba(
  parcial: Partial<BibliotecaMensajesProyectada> = {},
): BibliotecaMensajesProyectada {
  return {
    disponible: parcial.disponible ?? true,
    motivo: parcial.motivo ?? null,
    detalle: parcial.detalle ?? null,
    mensajes: parcial.mensajes ?? [],
  }
}

export function crearEventoPrueba(
  parcial: Partial<EventoRecienteProyectado> = {},
): EventoRecienteProyectado {
  return {
    seq: parcial.seq ?? 1,
    timestamp: parcial.timestamp ?? '2026-09-02 10:00:00',
    nivel: parcial.nivel ?? 'L3',
    etiqueta: parcial.etiqueta ?? 'SESION',
    codigo_evento: parcial.codigo_evento ?? 'EVENTO_PRUEBA',
    mensaje: parcial.mensaje ?? 'Mensaje de auditoría',
    hecho: parcial.hecho ?? null,
  }
}

export function crearEstadoTecnicoPrueba(parcial: Partial<EstadoTecnico> = {}): EstadoTecnico {
  return {
    revision: parcial.revision ?? 1,
    generado_en: parcial.generado_en ?? '2026-09-02T10:00:00Z',
    estado_global: parcial.estado_global ?? 'SIN_PREPARAR',
    transmision: parcial.transmision ?? crearTransmisionPrueba(),
    aviso_moderacion: parcial.aviso_moderacion ?? null,
    aviso_recinto: parcial.aviso_recinto ?? null,
    biblioteca: parcial.biblioteca ?? crearBibliotecaPrueba(),
    eventos_recientes: parcial.eventos_recientes ?? [],
    auditoria: parcial.auditoria ?? {
      activa: false,
      disponible: true,
      fallado: false,
      cerrado: false,
      motivo: null,
    },
  }
}
