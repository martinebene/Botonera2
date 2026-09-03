<script setup lang="ts">
/**
 * Cabecera superior del Simulador Web de Dispositivos Lógicos.
 *
 * Muestra el título institucional, el distintivo inequívoco de que se trata
 * de un SIMULADOR que emite pulsaciones reales al backend, la aclaración
 * arquitectónica de que opera directamente con FastAPI sin pasar por el device-bridge,
 * y el control compacto de selección de cantidad de dispositivos (1..20, WP-035).
 */

import {
  CANTIDAD_DISPOSITIVOS_MINIMA,
  CANTIDAD_DISPOSITIVOS_MAXIMA,
  CANTIDAD_DISPOSITIVOS_POR_DEFECTO,
} from '../types/simulador'
import SelectorCantidad from './SelectorCantidad.vue'

withDefaults(
  defineProps<{
    /** Cantidad actual de dispositivos configurada para mostrar en la interfaz */
    cantidad?: number
    /** Mínimo permitido (1) */
    min?: number
    /** Máximo permitido (20) */
    max?: number
  }>(),
  {
    cantidad: CANTIDAD_DISPOSITIVOS_POR_DEFECTO,
    min: CANTIDAD_DISPOSITIVOS_MINIMA,
    max: CANTIDAD_DISPOSITIVOS_MAXIMA,
  },
)

const emit = defineEmits<{
  (evento: 'incrementar' | 'decrementar'): void
}>()
</script>

<template>
  <header
    data-testid="cabecera-simulador"
    class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-4 py-2 text-slate-200 shrink-0"
  >
    <div class="flex items-center gap-3">
      <!--
        WP-062 retiró la marca del título, igual que WP-059 ya había hecho en Moderación y
        en Apoyo Técnico: la identidad del producto se publica ahora en el título de la
        pestaña y en el logo de la pantalla de carga, no repetida en cada cabecera. Lo que
        queda es el dato que sí distingue esta pantalla de las otras tres.
      -->
      <h1 class="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
        <span>Simulador de Dispositivos Lógicos</span>
      </h1>
      <span
        data-testid="badge-simulador"
        class="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/40 uppercase tracking-wider"
      >
        <span>⚠️</span>
        <span>Simulador · Entradas reales a FastAPI</span>
      </span>
    </div>

    <!-- Selector compacto de cantidad de dispositivos (WP-035) -->
    <SelectorCantidad
      :cantidad="cantidad"
      :min="min"
      :max="max"
      @incrementar="emit('incrementar')"
      @decrementar="emit('decrementar')"
    />

    <div class="text-xs text-slate-400 font-mono flex items-center gap-2">
      <span class="hidden md:inline text-slate-500">Arquitectura:</span>
      <span class="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-sky-300">
        /simulador/ &rarr; FastAPI (POST /api/v1/entradas/tecla) [sin device-bridge]
      </span>
    </div>
  </header>
</template>
