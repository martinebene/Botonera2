<script setup lang="ts">
/**
 * Cabecera principal del Shell de Moderación.
 *
 * Muestra permanentemente:
 * 1. Identificación del sistema: Botonera2 · Moderación.
 * 2. Estado de la conexión técnica (INICIAL, CONECTADO, RECONECTANDO, DESCONECTADO).
 * 3. Estado global del backend (SIN_PREPARAR, PREPARANDO, SESION_ABIERTA o "—" antes del primer snapshot).
 * 4. Número de revisión del último estado adoptado (o "—" si no existe).
 * 5. Indicador visible cuando el estado mostrado puede encontrarse desactualizado.
 */

import { computed } from 'vue'
import type { EstadoConexion } from '../composables/useEstadoModeracion'
import type { EstadoGlobal } from '@botonera2/api-client'

const props = defineProps<{
  /** Estado técnico de la conexión */
  estadoConexion: EstadoConexion
  /** Estado global del backend */
  estadoGlobal: EstadoGlobal | null
  /** Número de revisión monotónica recibida */
  revision: number | null
  /** Indica si la conexión se interrumpió y los datos mostrados pueden estar desactualizados */
  desactualizado: boolean
}>()

// Mapeo amigable de textos y clases CSS para el estado de conexión
const etiquetaConexion = computed(() => {
  switch (props.estadoConexion) {
    case 'CONECTADO':
      return 'Conectado'
    case 'RECONECTANDO':
      return 'Reconectando'
    case 'INICIAL':
      return 'Iniciando conexión...'
    case 'DESCONECTADO':
      return 'Sin conexión'
    default:
      return props.estadoConexion
  }
})

const claseConexion = computed(() => {
  switch (props.estadoConexion) {
    case 'CONECTADO':
      return 'bg-emerald-950 text-emerald-300 border-emerald-700'
    case 'RECONECTANDO':
      return 'bg-amber-950 text-amber-300 border-amber-600 animate-pulse'
    case 'INICIAL':
      return 'bg-sky-950 text-sky-300 border-sky-700'
    case 'DESCONECTADO':
      return 'bg-rose-950 text-rose-300 border-rose-700'
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700'
  }
})

// Mapeo legible del estado global
const etiquetaEstadoGlobal = computed(() => {
  if (!props.estadoGlobal) {
    return '—'
  }
  switch (props.estadoGlobal) {
    case 'SIN_PREPARAR':
      return 'Sin preparar'
    case 'PREPARANDO':
      return 'Preparando sala'
    case 'SESION_ABIERTA':
      return 'Sesión abierta'
    default:
      return props.estadoGlobal
  }
})

const claseEstadoGlobal = computed(() => {
  if (!props.estadoGlobal) {
    return 'text-slate-400'
  }
  switch (props.estadoGlobal) {
    case 'SESION_ABIERTA':
      return 'text-emerald-400 font-semibold'
    case 'PREPARANDO':
      return 'text-cyan-400 font-semibold'
    case 'SIN_PREPARAR':
      return 'text-slate-300 font-medium'
    default:
      return 'text-slate-300'
  }
})
</script>

<template>
  <header
    data-testid="cabecera-moderacion"
    class="flex shrink-0 flex-wrap items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-2.5 shadow-md backdrop-blur-sm lg:px-6"
  >
    <!-- Identificación de la aplicación -->
    <div class="flex items-center gap-3">
      <span
        class="rounded bg-cyan-950 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-cyan-400 border border-cyan-800"
      >
        Botonera2
      </span>
      <h1 class="text-lg font-bold text-slate-100 lg:text-xl">Moderación</h1>
    </div>

    <!-- Información de estado técnico e institucional -->
    <div class="flex items-center gap-3 lg:gap-5 text-sm">
      <!-- Alerta de estado potencialmente desactualizado -->
      <div
        v-if="desactualizado"
        data-testid="alerta-desactualizado"
        class="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-amber-950/80 px-2.5 py-1 text-xs font-medium text-amber-200 border border-amber-700"
      >
        <span class="inline-block h-2 w-2 rounded-full bg-amber-400 animate-ping" />
        <span>Estado posiblemente desactualizado</span>
      </div>

      <!-- Estado global del backend -->
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-slate-400 uppercase tracking-wider">Estado:</span>
        <span data-testid="estado-global" :class="claseEstadoGlobal">
          {{ etiquetaEstadoGlobal }}
        </span>
      </div>

      <!-- Revisión monotónica -->
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-slate-400 uppercase tracking-wider">Revisión:</span>
        <span data-testid="revision-estado" class="font-mono text-xs font-semibold text-slate-200">
          {{ revision !== null ? revision : '—' }}
        </span>
      </div>

      <!-- Indicador de conexión técnica -->
      <div
        data-testid="estado-conexion"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold"
        :class="claseConexion"
      >
        <span
          class="h-2 w-2 rounded-full"
          :class="{
            'bg-emerald-400': estadoConexion === 'CONECTADO',
            'bg-amber-400': estadoConexion === 'RECONECTANDO',
            'bg-sky-400': estadoConexion === 'INICIAL',
            'bg-rose-400': estadoConexion === 'DESCONECTADO',
          }"
        />
        <span>{{ etiquetaConexion }}</span>
      </div>
    </div>
  </header>
</template>
