<script setup lang="ts">
/**
 * Componente Selector de Cantidad de Dispositivos Lógicos (WP-035).
 *
 * Responsabilidades:
 * 1. Proporcionar un control compacto con botones de incremento (+) y decremento (−).
 * 2. Visualizar la cantidad seleccionada en formato solo lectura (sin campo de texto libre).
 * 3. Respetar estrictamente los límites canónicos: mínimo 1 y máximo 20.
 * 4. Deshabilitar visual y funcionalmente el botón correspondiente al alcanzar los extremos.
 */

import { CANTIDAD_DISPOSITIVOS_MINIMA, CANTIDAD_DISPOSITIVOS_MAXIMA } from '../types/simulador'

const props = withDefaults(
  defineProps<{
    /** Cantidad actual de dispositivos (entre 1 y 20) */
    cantidad: number
    /** Límite inferior permitido (por defecto 1) */
    min?: number
    /** Límite superior permitido (por defecto 20) */
    max?: number
  }>(),
  {
    min: CANTIDAD_DISPOSITIVOS_MINIMA,
    max: CANTIDAD_DISPOSITIVOS_MAXIMA,
  },
)

const emit = defineEmits<{
  /** Evento emitido al solicitar modificar la cantidad (incrementar o decrementar en 1) */
  (evento: 'incrementar' | 'decrementar'): void
}>()

function manejarDecrementar(): void {
  if (props.cantidad <= props.min) return
  emit('decrementar')
}

function manejarIncrementar(): void {
  if (props.cantidad >= props.max) return
  emit('incrementar')
}
</script>

<template>
  <div
    data-testid="selector-cantidad"
    class="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1 text-xs shadow-sm"
  >
    <span class="text-slate-400 font-medium select-none hidden sm:inline text-[11px]">
      Dispositivos:
    </span>

    <!-- Botón Decrementar (−) -->
    <button
      data-testid="btn-disminuir-cantidad"
      type="button"
      :disabled="cantidad <= min"
      class="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors active:scale-95 font-bold text-sm select-none"
      title="Disminuir cantidad de dispositivos (mínimo 1)"
      aria-label="Disminuir cantidad de dispositivos"
      @click="manejarDecrementar"
    >
      −
    </button>

    <!-- Indicador de cantidad (solo lectura, sin input de texto libre) -->
    <span
      data-testid="valor-cantidad"
      class="font-mono font-bold text-sky-400 text-xs sm:text-sm px-1.5 min-w-[1.75rem] sm:min-w-[2rem] text-center select-none"
    >
      {{ cantidad }}
    </span>

    <!-- Botón Incrementar (+) -->
    <button
      data-testid="btn-aumentar-cantidad"
      type="button"
      :disabled="cantidad >= max"
      class="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors active:scale-95 font-bold text-sm select-none"
      title="Aumentar cantidad de dispositivos (máximo 20)"
      aria-label="Aumentar cantidad de dispositivos"
      @click="manejarIncrementar"
    >
      +
    </button>
  </div>
</template>
