<script setup lang="ts">
/**
 * Panel de Recinto y Palabra (Cuadrante 3).
 *
 * En este WP (WP-021), establece la identidad visual, contenedor con scroll interno
 * y placeholder descriptivo para el mapa de bancas, presencia física, estado del quórum
 * y administración de la cola de oradores y palabra.
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
    titulo="Recinto y palabra"
    subtitulo="Bancas, presencia y administración de oradores"
    data-testid="panel-recinto-palabra"
    :badge="
      estado?.quorum
        ? `${estado.quorum.cantidad_presentes}/${estado.concejales.length} presentes`
        : 'Sin datos'
    "
    :clase-badge="
      estado?.quorum?.alcanzado
        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
        : 'bg-slate-800 text-slate-300 border border-slate-700'
    "
  >
    <div class="space-y-4 text-sm text-slate-300">
      <!-- Resumen de quórum y orador actual si existe en la proyección -->
      <div v-if="estado" class="grid grid-cols-2 gap-2 text-xs">
        <div v-if="estado.quorum" class="rounded border border-slate-800 bg-slate-950/60 p-2.5">
          <span class="text-slate-400">Condición de quórum:</span>
          <p
            class="font-semibold"
            :class="estado.quorum.alcanzado ? 'text-emerald-400' : 'text-amber-400'"
          >
            {{ estado.quorum.alcanzado ? 'Quórum alcanzado' : 'Falta quórum' }} ({{
              estado.quorum.cantidad_presentes
            }}/{{ estado.quorum.requerido }})
          </p>
        </div>
        <div v-if="estado.palabra" class="rounded border border-slate-800 bg-slate-950/60 p-2.5">
          <span class="text-slate-400">Uso de palabra:</span>
          <p class="font-semibold text-slate-200">
            {{
              estado.palabra.orador
                ? `${estado.palabra.orador.nombre} ${estado.palabra.orador.apellido}`
                : 'Sin orador activo'
            }}
          </p>
        </div>
      </div>

      <!-- Placeholder descriptivo de funciones futuras -->
      <div class="rounded-lg border border-dashed border-slate-800 p-4 text-center">
        <p class="font-medium text-slate-300">Área de bancas y pedidos de palabra</p>
        <p class="mt-1 text-xs text-slate-400">
          La grilla interactiva de concejales, visualización de presencias, tests de teclado y
          controles de otorgar/quitar palabra se integrarán en los Work Packages respectivos.
        </p>
      </div>
    </div>
  </PanelContenedor>
</template>
