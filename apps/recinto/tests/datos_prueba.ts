/** Fixtures públicas completas; nunca incluyen campos privados de Moderación. */

import type { ConcejalPublico, EstadoRecinto, VotacionPublica } from '@botonera2/api-client'

export function crearConcejalesPublicos(cantidad: number): ConcejalPublico[] {
  return Array.from({ length: cantidad }, (_, indice) => {
    const banca = indice + 1
    return {
      nombre: `Nombre${banca}`,
      apellido: `Apellido${banca}`,
      bloque: banca % 2 === 0 ? 'Bloque Azul' : 'Bloque Verde',
      banca,
      ruta_imagen: `assets/bancas/banca-${String(banca).padStart(2, '0')}.png`,
      presente: banca !== 2,
      test_activo: banca === 3,
      test_expira_en: banca === 3 ? '2026-08-27T10:00:05Z' : null,
    }
  })
}

export function crearEstadoRecintoPrueba(parcial: Partial<EstadoRecinto> = {}): EstadoRecinto {
  return {
    revision: parcial.revision ?? 1,
    generado_en: parcial.generado_en ?? '2026-08-27T10:00:00Z',
    estado_global: parcial.estado_global ?? 'SIN_PREPARAR',
    preparacion: parcial.preparacion ?? null,
    sesion: parcial.sesion ?? null,
    filas_bancas: parcial.filas_bancas ?? null,
    concejales: parcial.concejales ?? [],
    quorum: parcial.quorum ?? null,
    votacion: parcial.votacion ?? null,
    palabra: parcial.palabra ?? null,
  }
}

/** Construye el DTO público exacto que entregan REST y SSE. */
export function crearVotacionPublicaPrueba(
  parcial: Partial<VotacionPublica> = {},
): VotacionPublica {
  return {
    id: parcial.id ?? 'votacion-1',
    numero_votacion: parcial.numero_votacion ?? 1,
    tipo: parcial.tipo ?? 'Despacho',
    tema: parcial.tema ?? 'Tratamiento del expediente público',
    tipo_mayoria: parcial.tipo_mayoria ?? 'SIMPLE',
    factor: parcial.factor ?? 0,
    base: parcial.base ?? 'VOTOS_COMPUTABLES',
    estado_recepcion: parcial.estado_recepcion ?? 'EN_CURSO',
    resultado: parcial.resultado ?? null,
    fecha_hora_apertura: parcial.fecha_hora_apertura ?? '2026-08-28T10:00:00Z',
    fecha_hora_cierre: parcial.fecha_hora_cierre ?? null,
    cuenta_regresiva_hasta: parcial.cuenta_regresiva_hasta ?? null,
    resultado_visible_hasta: parcial.resultado_visible_hasta ?? null,
    bancas_voto_emitido: parcial.bancas_voto_emitido ?? [],
    votos_individuales: parcial.votos_individuales ?? null,
    conteos: parcial.conteos ?? null,
    voto_presidencial: parcial.voto_presidencial ?? null,
  }
}
