<script setup lang="ts">
/**
 * Cabecera compacta del puesto de Apoyo Técnico.
 *
 * Sigue la misma composición de una línea que la cabecera de Moderación, tal como pidió
 * HUMAN_GATE ("cabecera visualmente coherente con Moderación"): identidad de la pantalla
 * a la izquierda y contexto del puesto a la derecha. Concentra acá los datos globales
 * para que ningún panel tenga que repetirlos y la grilla conserve la mayor superficie
 * útil posible a 1366×768.
 *
 * Muestra el estado global del backend porque en este puesto sí es información nueva: la
 * transmisión y los avisos funcionan también en `SIN_PREPARAR`, y el operador técnico
 * necesita saber si además hay una preparación o una sesión en curso.
 */

import { computed } from 'vue'
import type { EstadoGlobal, EstadoTransmision } from '@botonera2/api-client'
import type { EstadoConexionTecnico } from '../composables/useEstadoTecnico'

const props = defineProps<{
  /** Estado técnico del stream principal. */
  estadoConexion: EstadoConexionTecnico
  /** Estado global autoritativo, o `null` antes del primer snapshot. */
  estadoGlobal: EstadoGlobal | null
  /** Revisión monotónica; se ofrece como texto emergente para diagnóstico. */
  revision: number | null
  /** `true` cuando lo mostrado puede haber quedado atrás por una desconexión. */
  desactualizado: boolean
  /** Estado de transmisión, repetido acá porque es el dato más consultado del puesto. */
  estadoTransmision: EstadoTransmision | null
}>()

const etiquetaConexion = computed(() => {
  switch (props.estadoConexion) {
    case 'CONECTADO':
      return 'Conectado'
    case 'RECONECTANDO':
      return 'Reconectando'
    case 'INICIAL':
      return 'Conectando'
    default:
      return 'Sin conexión'
  }
})

const claseConexion = computed(() => {
  switch (props.estadoConexion) {
    case 'CONECTADO':
      return 'border-emerald-700 bg-emerald-950 text-emerald-300'
    case 'RECONECTANDO':
      return 'animate-pulse border-amber-600 bg-amber-950 text-amber-300'
    case 'INICIAL':
      return 'border-sky-700 bg-sky-950 text-sky-300'
    default:
      return 'border-rose-700 bg-rose-950 text-rose-300'
  }
})

/** Redacción institucional del estado global; `null` mientras no llegó el snapshot. */
const etiquetaEstadoGlobal = computed(() => {
  switch (props.estadoGlobal) {
    case 'SIN_PREPARAR':
      return 'Sala sin preparar'
    case 'PREPARANDO':
      return 'Sala en preparación'
    case 'SESION_ABIERTA':
      return 'Sesión abierta'
    default:
      return null
  }
})

const etiquetaTransmision = computed(() => {
  switch (props.estadoTransmision) {
    case 'EN_VIVO':
      return 'En vivo'
    case 'CUENTA_REGRESIVA':
      return 'Cuenta regresiva'
    case 'APAGADO':
      return 'Transmisión apagada'
    default:
      return null
  }
})

const claseTransmision = computed(() =>
  props.estadoTransmision === 'EN_VIVO'
    ? 'border-rose-700 bg-rose-950 text-rose-200'
    : props.estadoTransmision === 'CUENTA_REGRESIVA'
      ? 'border-sky-700 bg-sky-950 text-sky-200'
      : 'border-slate-700 bg-slate-900 text-slate-400',
)
</script>

<template>
  <header
    data-testid="cabecera-tecnico"
    class="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-800 bg-slate-900/90 px-3 py-1.5 text-slate-200"
  >
    <div class="flex min-w-0 items-center gap-2">
      <h1 class="flex items-center gap-2 truncate text-sm font-bold tracking-tight text-white">
        <span class="text-sky-400">Botonera2</span>
        <span class="text-slate-600">·</span>
        <span>Apoyo Técnico</span>
      </h1>
      <span
        v-if="etiquetaEstadoGlobal"
        data-testid="estado-global-tecnico"
        class="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-slate-300"
      >
        {{ etiquetaEstadoGlobal }}
      </span>
    </div>

    <div class="flex flex-wrap items-center justify-end gap-2 text-[11px]">
      <span
        v-if="etiquetaTransmision"
        data-testid="resumen-transmision"
        class="rounded border px-2 py-0.5 font-bold"
        :class="claseTransmision"
      >
        {{ etiquetaTransmision }}
      </span>
      <span
        v-if="desactualizado"
        data-testid="aviso-desactualizado"
        class="rounded border border-amber-700 bg-amber-950 px-2 py-0.5 font-semibold text-amber-300"
      >
        Datos posiblemente desactualizados
      </span>
      <span
        data-testid="estado-conexion"
        class="rounded border px-2 py-0.5 font-bold"
        :class="claseConexion"
        :title="revision === null ? 'Sin revisión recibida' : `Revisión ${revision}`"
      >
        {{ etiquetaConexion }}
      </span>
    </div>
  </header>
</template>
