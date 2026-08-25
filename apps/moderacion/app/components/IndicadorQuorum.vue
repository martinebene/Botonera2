<script setup lang="ts">
/**
 * Componente que muestra de forma destacada el estado del quórum reglamentario en Moderación.
 *
 * Responsabilidades:
 * 1. Mostrar la cantidad de concejales presentes respecto al total del cuerpo y al mínimo requerido.
 * 2. Indicar con alto contraste si el quórum fue alcanzado o si se encuentra pendiente.
 * 3. Calcular e informar de manera puramente asistencial cuántos concejales faltan para el quórum.
 * 4. M2: Si no existe contexto de quórum operativo (quorum === null), el componente no se renderiza
 *    para evitar falsos indicadores de "Falta quórum 0/0" durante SIN_PREPARAR.
 *
 * Invariantes respetados:
 * - El cálculo local de concejales faltantes es exclusivamente informativo.
 * - La habilitación reglamentaria para abrir sesión o votar proviene siempre del backend
 *   a través del objeto de capacidades.
 */

import { computed } from 'vue'
import type { EstadoQuorum } from '@botonera2/api-client'

const props = defineProps<{
  /** Estado del quórum proyectado por el backend */
  quorum: EstadoQuorum | null
  /** Cantidad total de bancas/concejales en el padrón activo */
  totalConcejales: number
}>()

// Cantidad de presentes informada por el backend (o 0 si aún no hay datos)
const cantidadPresentes = computed(() => props.quorum?.cantidad_presentes ?? 0)

// Quórum mínimo requerido informado por el backend
const quorunRequerido = computed(() => props.quorum?.requerido ?? 0)

// Indica si el backend certifica que el quórum fue alcanzado
const quorunAlcanzado = computed(() => props.quorum?.alcanzado ?? false)

// Cálculo informativo de concejales faltantes para alcanzar el quórum reglamentario
const faltantes = computed(() => Math.max(0, quorunRequerido.value - cantidadPresentes.value))
</script>

<template>
  <div
    v-if="quorum"
    data-testid="indicador-quorum"
    class="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
    :class="
      quorunAlcanzado
        ? 'border-emerald-700/80 bg-emerald-950/40 text-emerald-100'
        : 'border-amber-700/80 bg-amber-950/40 text-amber-100'
    "
  >
    <!-- Estado textual del quórum y conteos -->
    <div class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg font-black"
        :class="
          quorunAlcanzado
            ? 'border-emerald-500 bg-emerald-900/80 text-emerald-200'
            : 'border-amber-500 bg-amber-900/80 text-amber-200'
        "
      >
        <span>{{ cantidadPresentes }}</span>
      </div>

      <div class="flex flex-col">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Condición de quórum
        </span>
        <div class="flex items-center gap-2">
          <span
            data-testid="estado-quorum-texto"
            class="text-sm font-bold"
            :class="quorunAlcanzado ? 'text-emerald-300' : 'text-amber-300'"
          >
            {{ quorunAlcanzado ? 'Quórum alcanzado' : 'Falta quórum' }}
          </span>
          <span class="text-xs text-slate-300">
            ({{ cantidadPresentes }} de {{ totalConcejales }} presentes · Mínimo:
            {{ quorunRequerido }})
          </span>
        </div>
      </div>
    </div>

    <!-- Indicador informativo de faltantes si el quórum no fue alcanzado -->
    <div
      v-if="!quorunAlcanzado && faltantes > 0"
      data-testid="quorum-faltantes"
      class="rounded bg-amber-900/80 px-2.5 py-1 text-xs font-semibold text-amber-100 border border-amber-600 animate-pulse"
    >
      Faltan {{ faltantes }} {{ faltantes === 1 ? 'presente' : 'presentes' }} para quórum
    </div>

    <div
      v-else-if="quorunAlcanzado"
      data-testid="quorum-completo"
      class="rounded bg-emerald-900/80 px-2.5 py-1 text-xs font-semibold text-emerald-200 border border-emerald-600"
    >
      Quórum suficiente para operar
    </div>
  </div>
</template>
