<script setup lang="ts">
/**
 * Componente del Log Global de Pulsaciones y Respuestas de FastAPI.
 *
 * Responsabilidades:
 * 1. Mostrar de forma compacta y legible las respuestas reales del backend.
 * 2. Autoscrollear automáticamente hacia el último evento registrado.
 * 3. Diferenciar con claridad visual las respuestas aceptadas, rechazadas o con error.
 * 4. Permitir vaciar localmente el historial en memoria mediante un botón "Limpiar".
 */

import { nextTick, ref, watch } from 'vue'
import type { EntradaLogSimulador } from '../types/simulador'

const props = defineProps<{
  entradas: EntradaLogSimulador[]
}>()

const emit = defineEmits<{
  (evento: 'limpiar'): void
}>()

const contenedorLog = ref<HTMLElement | null>(null)

function autoscroll(): void {
  nextTick(() => {
    if (contenedorLog.value) {
      contenedorLog.value.scrollTop = contenedorLog.value.scrollHeight
    }
  })
}

// Cada vez que se agrega una entrada nueva al log, scrolleamos automáticamente al final
watch(
  () => props.entradas.length,
  () => {
    autoscroll()
  },
)
</script>

<template>
  <section
    data-testid="seccion-log-pulsaciones"
    class="flex flex-col border-t border-slate-800 bg-slate-950/90 text-slate-300 min-h-0 shrink-0"
  >
    <!-- Barra de título del log con contador y botón Limpiar -->
    <div
      class="flex items-center justify-between px-4 py-1.5 border-b border-slate-800 bg-slate-900/60"
    >
      <div class="flex items-center gap-2">
        <span class="font-semibold text-xs text-slate-200">Registro de pulsaciones (FastAPI)</span>
        <span
          data-testid="contador-entradas-log"
          class="rounded-full bg-slate-800 px-2 py-0.2 text-[10px] font-mono text-slate-400"
        >
          {{ entradas.length }} eventos
        </span>
      </div>
      <button
        data-testid="btn-limpiar-log"
        type="button"
        class="text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700/60 cursor-pointer transition-colors"
        @click="emit('limpiar')"
      >
        Limpiar
      </button>
    </div>

    <!-- Contenedor autoscrolleable del historial -->
    <div
      ref="contenedorLog"
      data-testid="contenedor-entradas-log"
      class="h-32 sm:h-36 lg:h-40 overflow-y-auto p-2 font-mono text-xs space-y-1 divide-y divide-slate-900"
    >
      <div
        v-if="entradas.length === 0"
        data-testid="log-vacio"
        class="text-slate-600 italic text-center py-6"
      >
        No hay pulsaciones registradas en esta sesión.
      </div>

      <div
        v-for="entrada in entradas"
        :key="entrada.id"
        :data-testid="`entrada-log-${entrada.dispositivo}-${entrada.tecla}`"
        class="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1 text-[11px] leading-tight"
      >
        <!-- Timestamp -->
        <span class="text-slate-500 shrink-0">{{ entrada.timestamp }}</span>

        <!-- Dispositivo -->
        <span class="font-bold text-sky-400 shrink-0 w-12">{{ entrada.dispositivo }}</span>

        <!-- Acción y Tecla -->
        <span class="text-slate-300 shrink-0 w-32 truncate">
          {{ entrada.accion }} <span class="text-slate-500">[{{ entrada.tecla }}]</span>
        </span>

        <!-- Estado HTTP -->
        <span
          v-if="entrada.statusHttp"
          class="shrink-0 px-1 py-0.2 rounded text-[10px]"
          :class="
            entrada.statusHttp === 200
              ? 'bg-slate-800 text-slate-300'
              : 'bg-rose-950 text-rose-300 border border-rose-800'
          "
        >
          HTTP {{ entrada.statusHttp }}
        </span>

        <!-- Aceptada / Rechazada -->
        <span
          v-if="entrada.aceptada !== undefined"
          :data-testid="`log-resultado-${entrada.aceptada ? 'aceptada' : 'rechazada'}`"
          class="shrink-0 px-1.5 py-0.2 rounded font-bold text-[10px]"
          :class="
            entrada.aceptada
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              : 'bg-amber-950 text-amber-300 border border-amber-800'
          "
        >
          {{ entrada.aceptada ? 'ACEPTADA' : 'RECHAZADA' }}
        </span>

        <!-- Motivo -->
        <span
          v-if="entrada.motivo"
          data-testid="log-motivo"
          class="font-medium truncate shrink-0"
          :class="entrada.aceptada ? 'text-emerald-400' : 'text-amber-400'"
        >
          {{ entrada.motivo }}
        </span>

        <!-- Error técnico si existió -->
        <span v-if="entrada.errorTecnico" class="text-rose-400 truncate shrink-0">
          Error: {{ entrada.errorTecnico }}
        </span>

        <!-- Latencia -->
        <span class="text-slate-600 text-[10px] ml-auto shrink-0">
          {{ entrada.latenciaMs }} ms
        </span>
      </div>
    </div>
  </section>
</template>
