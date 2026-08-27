<script setup lang="ts">
/**
 * Panel de Eventos Recientes (Cuadrante 4).
 *
 * Consume directamente la baseline autoritativa `eventos_recientes` y aplica
 * únicamente un filtro visual local por nivel acumulativo L1/L2/L3.
 *
 * CRÍTICO: El crecimiento del listado de eventos no debe aumentar la altura de los demás paneles.
 * Por eso, utiliza scroll interno vertical independiente dentro del contenedor.
 */

import { computed, ref } from 'vue'
import type { EstadoModeracion } from '@botonera2/api-client'
import PanelContenedor from './PanelContenedor.vue'

const props = defineProps<{
  /** Estado de moderación recibido desde el backend */
  estado: EstadoModeracion | null
}>()

type FiltroEventos = 'L3' | 'L2' | 'L1'

// El filtro es deliberadamente local: no acumula eventos ni modifica la
// auditoría. L3 es la vista inicial acordada para la operación cotidiana.
const filtroSeleccionado = ref<FiltroEventos>('L3')

const nivelesPorFiltro: Record<FiltroEventos, readonly string[]> = {
  L3: ['L3'],
  L2: ['L2', 'L3'],
  L1: ['L1', 'L2', 'L3'],
}

const eventosFiltrados = computed(() => {
  const permitidos = nivelesPorFiltro[filtroSeleccionado.value]
  return (props.estado?.eventos_recientes ?? []).filter((evento) =>
    permitidos.includes(evento.nivel),
  )
})

function claseNivel(nivel: string): string {
  switch (nivel) {
    case 'L3':
      return 'border-violet-700 bg-violet-950 text-violet-200'
    case 'L2':
      return 'border-cyan-800 bg-cyan-950 text-cyan-300'
    case 'L1':
      return 'border-slate-700 bg-slate-900 text-slate-300'
    default:
      return 'border-rose-800 bg-rose-950 text-rose-200'
  }
}
</script>

<template>
  <PanelContenedor
    titulo="Eventos"
    subtitulo="Registro de actividad y eventos institucionales recientes"
    data-testid="panel-eventos"
    :badge="`${eventosFiltrados.length} de ${estado?.eventos_recientes?.length ?? 0}`"
  >
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <label for="filtro-eventos" class="text-xs font-semibold text-slate-300">
        Nivel visible
      </label>
      <select
        id="filtro-eventos"
        v-model="filtroSeleccionado"
        data-testid="filtro-eventos"
        class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100"
      >
        <option value="L3">Principales (L3)</option>
        <option value="L2">Intermedios (L2+L3)</option>
        <option value="L1">Sistema (L1+L2+L3)</option>
      </select>
    </div>

    <!-- Listado de eventos con scroll interno aislado -->
    <div
      v-if="eventosFiltrados.length"
      data-testid="lista-eventos"
      class="space-y-2 font-mono text-xs"
    >
      <div
        v-for="evento in eventosFiltrados"
        :key="evento.seq"
        data-testid="evento-reciente"
        class="rounded border border-slate-800 bg-slate-950/70 p-2 text-slate-300 transition-colors hover:border-slate-700"
      >
        <div class="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
          <span class="font-semibold text-cyan-400">#{{ evento.seq }}</span>
          <span>{{ evento.timestamp }}</span>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <span
            data-testid="nivel-evento"
            class="rounded border px-1.5 py-0.5 text-[10px] font-bold"
            :class="claseNivel(evento.nivel)"
          >
            {{ evento.nivel }}
          </span>
          <span data-testid="etiqueta-evento" class="text-slate-400">[{{ evento.etiqueta }}]</span>
          <span data-testid="codigo-evento" class="font-semibold text-slate-200">
            {{ evento.codigo_evento }}
          </span>
        </div>
        <p data-testid="mensaje-evento" class="mt-1 whitespace-pre-wrap break-words text-slate-300">
          {{ evento.mensaje }}
        </p>
      </div>
    </div>

    <!-- Mensaje cuando no hay eventos registrados -->
    <div
      v-else
      class="rounded-lg border border-dashed border-slate-800 p-4 text-center text-sm text-slate-400"
    >
      <p class="font-medium text-slate-300">
        {{
          estado?.eventos_recientes?.length
            ? 'No hay eventos para el filtro seleccionado'
            : 'Sin eventos en la sesión activa'
        }}
      </p>
      <p class="mt-1 text-xs">
        Los eventos de auditoría (L1, L2 y L3) emitidos por el backend aparecerán automáticamente
        aquí a medida que ocurran.
      </p>
    </div>
  </PanelContenedor>
</template>
