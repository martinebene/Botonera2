<script setup lang="ts">
/**
 * Tarjeta mínima para un dispositivo lógico individual (ej. dev01..dev20).
 *
 * Invariantes estrictos de diseño (WP-034 y WP-035):
 * 1. Cada tarjeta contiene ÚNICAMENTE su identificador (devXX) y los seis botones funcionales.
 * 2. NO muestra concejal, banca, presencia, estado de test, estado de palabra, votos,
 *    latencia ni resultados persistentes.
 * 3. Disposición exacta 2 filas × 3 columnas (WP-035):
 *    - Fila superior: Presencia (9) / Test (8) / Palabra (7)
 *    - Fila inferior: Afirmativo (1) / Abstención (2) / Negativo (3)
 * 4. La etiqueta de presencia es deliberadamente neutra: "Pres. / Aus." (tecla 9).
 * 5. La distinción entre Afirmativo, Abstención y Negativo utiliza símbolos textuales explícitos
 *    (✓, ○, ✗) además de contraste y color para garantizar accesibilidad.
 * 6. Bloqueo efímero del botón mientras su petición HTTP particular está en vuelo.
 */

import { ACCIONES_SIMULADOR, type AccionSimulador } from '../types/simulador'

const props = defineProps<{
  dispositivo: string
  peticionesEnVuelo: Record<string, boolean>
}>()

const emit = defineEmits<{
  (evento: 'pulsar', payload: { dispositivo: string; tecla: string; nombre: string }): void
}>()

function estaEnVuelo(tecla: string): boolean {
  return Boolean(props.peticionesEnVuelo[`${props.dispositivo}-${tecla}`])
}

function manejarClick(accion: AccionSimulador): void {
  if (estaEnVuelo(accion.tecla)) return
  emit('pulsar', {
    dispositivo: props.dispositivo,
    tecla: accion.tecla,
    nombre: accion.nombre,
  })
}

function obtenerClasesBoton(accion: AccionSimulador): string {
  const enVuelo = estaEnVuelo(accion.tecla)
  const base =
    'relative flex items-center justify-between px-1.5 py-1 sm:px-2 sm:py-1.5 rounded text-xs font-medium border transition-all duration-100 select-none active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-w-0'

  if (enVuelo) {
    return `${base} bg-slate-800 border-slate-700 text-slate-400 animate-pulse`
  }

  switch (accion.variante) {
    case 'afirmativo':
      return `${base} bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-200 border-emerald-700/60 hover:border-emerald-500 shadow-sm shadow-emerald-950/50`
    case 'abstencion':
      return `${base} bg-amber-950/70 hover:bg-amber-900/90 text-amber-200 border-amber-700/60 hover:border-amber-500 shadow-sm shadow-amber-950/50`
    case 'negativo':
      return `${base} bg-rose-950/70 hover:bg-rose-900/90 text-rose-200 border-rose-700/60 hover:border-rose-500 shadow-sm shadow-rose-950/50`
    case 'palabra':
      return `${base} bg-sky-950/70 hover:bg-sky-900/90 text-sky-200 border-sky-700/60 hover:border-sky-500 shadow-sm shadow-sky-950/50`
    case 'test':
      return `${base} bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 border-purple-700/60 hover:border-purple-500 shadow-sm shadow-purple-950/50`
    case 'presencia':
      return `${base} bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border-slate-600/60 hover:border-slate-400 shadow-sm shadow-slate-950/50`
  }
}
</script>

<template>
  <div
    :data-testid="`tarjeta-${dispositivo}`"
    class="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-2 sm:p-2.5 shadow-sm hover:border-slate-700 transition-colors"
  >
    <!-- Cabecera mínima: Identificador lógico del dispositivo -->
    <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/80">
      <span
        :data-testid="`titulo-${dispositivo}`"
        class="font-mono font-bold text-sm tracking-wider text-sky-400 flex items-center gap-1.5"
      >
        <span class="h-2 w-2 rounded-full bg-sky-400/80" />
        {{ dispositivo }}
      </span>
      <span class="text-[10px] text-slate-500 uppercase tracking-wider font-mono">lógico</span>
    </div>

    <!-- Grilla de los seis botones: exactamente 2 filas x 3 columnas (WP-035) -->
    <div class="grid grid-cols-3 gap-1.5">
      <button
        v-for="accion in ACCIONES_SIMULADOR"
        :key="accion.id"
        :data-testid="`btn-${dispositivo}-${accion.tecla}`"
        type="button"
        :disabled="estaEnVuelo(accion.tecla)"
        :class="obtenerClasesBoton(accion)"
        :title="`${accion.nombre} (Tecla ${accion.tecla})`"
        @click="manejarClick(accion)"
      >
        <span class="flex items-center gap-1 truncate min-w-0">
          <span class="font-bold text-[11px] opacity-80 shrink-0">{{ accion.simbolo }}</span>
          <span class="truncate">{{ accion.nombre }}</span>
        </span>
        <span class="font-mono text-[10px] opacity-60 ml-1 shrink-0">[{{ accion.tecla }}]</span>
      </button>
    </div>
  </div>
</template>
