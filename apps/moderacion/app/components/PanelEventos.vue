<script setup lang="ts">
/**
 * Panel de Eventos Recientes (Cuadrante 4).
 *
 * En este WP (WP-021), establece la identidad visual, contenedor con scroll interno
 * y visualización del listado de eventos recientes auditados provistos por EstadoModeracion.
 *
 * CRÍTICO: El crecimiento del listado de eventos no debe aumentar la altura de los demás paneles.
 * Por eso, utiliza scroll interno vertical independiente dentro del contenedor.
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
    titulo="Eventos"
    subtitulo="Registro de actividad y eventos institucionales recientes"
    data-testid="panel-eventos"
    :badge="
      estado?.eventos_recientes?.length ? `${estado.eventos_recientes.length} eventos` : '0 eventos'
    "
  >
    <!-- Listado de eventos con scroll interno aislado -->
    <div v-if="estado?.eventos_recientes?.length" class="space-y-2 font-mono text-xs">
      <div
        v-for="evento in estado.eventos_recientes"
        :key="evento.seq"
        class="rounded border border-slate-800 bg-slate-950/70 p-2 text-slate-300 transition-colors hover:border-slate-700"
      >
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-semibold text-cyan-400">#{{ evento.seq }} [{{ evento.etiqueta }}]</span>
          <span>{{ evento.timestamp }}</span>
        </div>
        <div class="mt-1 flex items-center gap-2">
          <span
            class="rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold"
            :class="{
              'bg-emerald-950 text-emerald-400 border border-emerald-800': evento.nivel === 'INFO',
              'bg-amber-950 text-amber-400 border border-amber-800': evento.nivel === 'WARN',
              'bg-rose-950 text-rose-400 border border-rose-800': evento.nivel === 'ERROR',
            }"
          >
            {{ evento.codigo_evento }}
          </span>
          <span class="truncate text-slate-200">{{ evento.mensaje }}</span>
        </div>
      </div>
    </div>

    <!-- Mensaje cuando no hay eventos registrados -->
    <div
      v-else
      class="rounded-lg border border-dashed border-slate-800 p-4 text-center text-sm text-slate-400"
    >
      <p class="font-medium text-slate-300">Sin eventos en la sesión activa</p>
      <p class="mt-1 text-xs">
        Los eventos de auditoría (L1, L2 y L3) emitidos por el backend aparecerán automáticamente
        aquí a medida que ocurran.
      </p>
    </div>
  </PanelContenedor>
</template>
