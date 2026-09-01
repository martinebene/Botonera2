<script setup lang="ts">
/**
 * Cabecera compacta del Shell de Moderación (WP-047).
 *
 * Esta barra concentra en una sola línea todos los datos globales de la pantalla,
 * para que ningún cuadrante tenga que repetirlos y para que la grilla 2×2 disponga
 * de la mayor superficie útil posible incluso a 1366×768.
 *
 * Muestra, en este orden y de forma condicional:
 * 1. Identidad de la pantalla: `Moderación`.
 * 2. Número de sesión confirmado o provisorio, cuando existe.
 * 3. Quórum global, en cuanto existe contexto preparado que lo calcule.
 * 4. Advertencia de estado posiblemente desactualizado.
 * 5. Presidencia y Secretaría Legislativa, desde que fueron cargadas (también en PREPARANDO).
 * 6. Tiempo transcurrido desde la apertura formal, solo durante SESION_ABIERTA.
 * 7. Fecha y hora local, calculada en el propio equipo.
 * 8. Estado técnico de la conexión.
 *
 * Agrupación por origen del dato (WP-054):
 * - A la izquierda queda el contexto *institucional del backend*: pantalla, número de
 *   sesión y quórum. Son los datos que el operador consulta para decidir.
 * - A la derecha se concentra el *contexto de la sesión y del puesto*: autoridades,
 *   tiempo de sesión, fecha/hora local y conexión. HUMAN_GATE pidió esa agrupación
 *   porque Presidencia y Secretaría se leen junto al tiempo, no como dato central.
 * - Las etiquetas `Tiempo de sesión` y `Fecha` son explícitas: antes decían sólo
 *   `Tiempo` y la fecha no tenía rótulo, lo que obligaba a deducir cada valor por su
 *   formato. El texto extra crece a lo ancho, nunca a lo alto.
 *
 * Decisiones de densidad:
 * - Se retiró el estado global visible: Q1 ya representa la etapa operativa y repetir
 *   `Sesión abierta` consumía ancho sin aportar una segunda decisión al operador.
 * - La revisión monotónica dejó de ocupar espacio permanente. Sigue formando parte del
 *   contrato y de la sincronización, y se conserva accesible como texto emergente
 *   (`title`) del indicador de conexión para diagnóstico.
 * - Todos los datos globales se muestran con `v-if`: la cabecera nunca inventa valores
 *   ni reserva huecos vacíos para información que el backend todavía no proyectó.
 */

import { computed } from 'vue'
import type { EstadoConexion } from '../composables/useEstadoModeracion'
import type { EstadoGlobal, EstadoQuorum } from '@botonera2/api-client'
import { useRelojLocal } from '../composables/useRelojLocal'
import { formatearFechaHoraLocal } from '../utils/tiempo'

const props = withDefaults(
  defineProps<{
    /** Estado técnico de la conexión */
    estadoConexion: EstadoConexion
    /** Estado global del backend */
    estadoGlobal: EstadoGlobal | null
    /** Número de revisión monotónica recibida; no se muestra de forma permanente */
    revision: number | null
    /** Indica si la conexión se interrumpió y los datos mostrados pueden estar desactualizados */
    desactualizado: boolean
    /** Estado de quórum proyectado por el backend, o null si aún no hay contexto preparado */
    quorum?: EstadoQuorum | null
    /** Cantidad de bancas del padrón activo, usada como total de referencia del quórum */
    totalConcejales?: number
    /** Presidencia ya cargada en preparación o sesión, o null si todavía no fue definida */
    presidencia?: string | null
    /** Secretaría Legislativa ya cargada, o null si todavía no fue definida */
    secretariaLegislativa?: string | null
    /** Marca ISO de la apertura formal de la sesión (`sesion.fecha_hora_apertura`) */
    fechaHoraApertura?: string | null
    /** Marca de generación del mismo snapshot que contiene la apertura */
    generadoEn?: string | null
    /** Número confirmado de sesión o valor provisorio ya cargado durante PREPARANDO */
    numeroSesion?: number | null
  }>(),
  {
    quorum: null,
    totalConcejales: 0,
    presidencia: null,
    secretariaLegislativa: null,
    fechaHoraApertura: null,
    generadoEn: null,
    numeroSesion: null,
  },
)

/**
 * Baseline temporal mínima. Solo depende de campos del snapshot que cambian el ancla,
 * de modo que una actualización visual ajena no reinicia accidentalmente el contador.
 */
const anclaSesion = computed(() => ({
  estadoGlobal: props.estadoGlobal,
  generadoEn: props.generadoEn,
  fechaHoraApertura: props.fechaHoraApertura,
}))

// Un único ticker alimenta tanto la hora local como la duración anclada de sesión.
const { ahora, tiempoSesion } = useRelojLocal(anclaSesion)

/** Fecha y hora local en formato compacto `dd/mm/aaaa hh:mm:ss`. */
const fechaHoraLocal = computed(() => formatearFechaHoraLocal(ahora.value))

// Mapeo amigable de textos y clases CSS para el estado de conexión
const etiquetaConexion = computed(() => {
  switch (props.estadoConexion) {
    case 'CONECTADO':
      return 'Conectado'
    case 'RECONECTANDO':
      return 'Reconectando'
    case 'INICIAL':
      return 'Conectando'
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

/**
 * Texto emergente del indicador de conexión.
 * Conserva visible bajo demanda la revisión monotónica que ya no ocupa espacio fijo.
 */
const detalleConexion = computed(() =>
  props.revision !== null
    ? `${etiquetaConexion.value} · revisión ${props.revision}`
    : `${etiquetaConexion.value} · sin revisión adoptada`,
)

/**
 * Resumen textual del quórum en una sola línea.
 * Combina condición reglamentaria, presentes sobre el padrón y mínimo requerido,
 * que es exactamente la información que antes se repetía en Q1 y en Q3.
 */
const textoQuorum = computed(() => {
  if (!props.quorum) {
    return ''
  }
  const condicion = props.quorum.alcanzado ? 'Quórum' : 'Sin quórum'
  return `${condicion} ${props.quorum.cantidad_presentes}/${props.totalConcejales} · mín ${props.quorum.requerido}`
})

const claseQuorum = computed(() =>
  props.quorum?.alcanzado
    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
    : 'bg-amber-950 text-amber-300 border-amber-700',
)
</script>

<template>
  <header
    data-testid="cabecera-moderacion"
    class="flex shrink-0 flex-nowrap items-center gap-2 overflow-hidden border-b border-slate-800 bg-slate-900/95 px-2 py-1 text-[11px] shadow-md backdrop-blur-sm"
  >
    <!-- Identidad de la pantalla: única marca conservada tras WP-036 -->
    <h1 class="shrink-0 text-sm font-bold tracking-tight text-slate-100">Moderación</h1>

    <!-- Número institucional: aparece antes del quórum y nunca se inventa. -->
    <span
      v-if="numeroSesion !== null"
      data-testid="cabecera-numero-sesion"
      class="shrink-0 whitespace-nowrap font-semibold text-cyan-200"
    >
      Sesión Nº {{ numeroSesion }}
    </span>

    <!-- Quórum global: única presentación de este dato en toda la pantalla -->
    <span
      v-if="quorum"
      data-testid="cabecera-quorum"
      class="shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 font-semibold"
      :class="claseQuorum"
    >
      {{ textoQuorum }}
    </span>

    <!--
      Sector derecho (WP-054): autoridades + tiempo + fecha + conexión.

      `ml-auto` absorbe todo el ancho sobrante y empuja el grupo contra el borde,
      sin necesidad de un elemento separador vacío. El grupo puede encogerse
      (`min-w-0`, sin `shrink-0`) para que, cuando el ancho aprieta, se recorten
      los nombres de las autoridades y nunca los valores de ancho fijo.
      `flex-nowrap` garantiza que el sector completo permanezca en el mismo
      renglón que el bloque institucional izquierdo.
    -->
    <div class="ml-auto flex min-w-0 flex-nowrap items-center justify-end gap-2">
      <!-- Alerta de estado potencialmente desactualizado -->
      <span
        v-if="desactualizado"
        data-testid="alerta-desactualizado"
        class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-700 bg-amber-950/80 px-1.5 py-0.5 font-medium text-amber-200"
      >
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
        <span>Estado desactualizado</span>
      </span>

      <!--
        Autoridades institucionales. Son los únicos textos de longitud
        imprevisible del sector, así que son los únicos que se recortan: cada
        uno trunca con elipsis y conserva el nombre completo en `title`.
      -->
      <span
        v-if="presidencia"
        data-testid="cabecera-presidencia"
        class="min-w-0 truncate text-slate-300"
        :title="`Presidencia: ${presidencia}`"
      >
        <span class="text-slate-500">Presidencia:&nbsp;</span>
        <span class="font-medium text-slate-200">{{ presidencia }}</span>
      </span>

      <span
        v-if="secretariaLegislativa"
        data-testid="cabecera-secretaria"
        class="min-w-0 truncate text-slate-300"
        :title="`Secretaría: ${secretariaLegislativa}`"
      >
        <span class="text-slate-500">Secretaría:&nbsp;</span>
        <span class="font-medium text-slate-200">{{ secretariaLegislativa }}</span>
      </span>

      <!--
        Tiempo transcurrido desde la apertura formal de la sesión.
        La etiqueta es explícita (`Tiempo de sesión`) porque el valor `hh:mm:ss`
        convive con la hora local y ambos son numéricos.
      -->
      <span
        v-if="tiempoSesion"
        data-testid="cabecera-tiempo-sesion"
        class="shrink-0 whitespace-nowrap font-mono text-slate-200"
        title="Tiempo transcurrido desde la apertura formal de la sesión"
      >
        <span class="font-sans text-slate-500">Tiempo de sesión&nbsp;</span>
        {{ tiempoSesion }}
      </span>

      <!-- Fecha y hora local del puesto de Moderación, con rótulo explícito. -->
      <span
        data-testid="cabecera-fecha-hora"
        class="shrink-0 whitespace-nowrap font-mono text-slate-300"
      >
        <span class="font-sans text-slate-500">Fecha&nbsp;</span>
        {{ fechaHoraLocal }}
      </span>

      <!-- Indicador de conexión técnica -->
      <span
        data-testid="estado-conexion"
        class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 font-semibold"
        :class="claseConexion"
        :title="detalleConexion"
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="{
            'bg-emerald-400': estadoConexion === 'CONECTADO',
            'bg-amber-400': estadoConexion === 'RECONECTANDO',
            'bg-sky-400': estadoConexion === 'INICIAL',
            'bg-rose-400': estadoConexion === 'DESCONECTADO',
          }"
        />
        <span>{{ etiquetaConexion }}</span>
      </span>
    </div>
  </header>
</template>
