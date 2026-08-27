/** Fixtures públicas completas; nunca incluyen campos privados de Moderación. */

import type { ConcejalPublico, EstadoRecinto } from '@botonera2/api-client'

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
