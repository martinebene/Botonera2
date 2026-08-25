<script setup lang="ts">
/**
 * Panel de Orden del Día (Cuadrante 2).
 *
 * En este WP (WP-021), establece la identidad visual, contenedor con scroll interno
 * y placeholder descriptivo para la carga de CSV asistencial y precarga de temas a votar.
 */

import type { EstadoModeracion } from '@botonera2/api-client'
import PanelContenedor from './PanelContenedor.vue'

defineProps<{
  /** Estado de moderación recibido desde el backend */
  estado: EstadoModeracion | null
}>()
</script>

<template>
  <PanelContenedor
    titulo="Orden del Día"
    subtitulo="Asistencia temática y puntos a debatir"
    data-testid="panel-orden-del-dia"
    :badge="estado?.orden_del_dia?.length ? `${estado.orden_del_dia.length} puntos` : 'Sin cargar'"
  >
    <div class="space-y-4 text-sm text-slate-300">
      <!-- Si existen puntos en el estado proyectado, mostrarlos con scroll interno -->
      <!-- Usamos clave combinada índice + número para tolerar números de votación no únicos o repetidos -->
      <div v-if="estado?.orden_del_dia?.length" class="space-y-2">
        <div
          v-for="(punto, indice) in estado.orden_del_dia"
          :key="`${punto.nro_votacion}-${indice}`"
          class="rounded border border-slate-800 bg-slate-950/60 p-2.5 text-xs"
        >
          <div class="flex items-center justify-between">
            <span class="font-semibold text-slate-200"
              >#{{ punto.nro_votacion }} · {{ punto.tipo }}</span
            >
            <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{{
              punto.tipo_mayoria
            }}</span>
          </div>
          <p class="mt-1 text-slate-400">{{ punto.tema }}</p>
        </div>
      </div>

      <!-- Placeholder descriptivo de funciones futuras -->
      <div v-else class="rounded-lg border border-dashed border-slate-800 p-4 text-center">
        <p class="font-medium text-slate-300">Colección de Orden del Día no cargada</p>
        <p class="mt-1 text-xs text-slate-400">
          La funcionalidad para importar el archivo CSV institucional y seleccionar puntos para la
          votación se integrará en una etapa posterior.
        </p>
      </div>
    </div>
  </PanelContenedor>
</template>
