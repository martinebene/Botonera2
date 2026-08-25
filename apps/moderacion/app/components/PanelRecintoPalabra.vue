<script setup lang="ts">
/**
 * Panel de Recinto y Palabra (Cuadrante 3 de Moderación).
 *
 * Responsabilidades:
 * 1. Mostrar el estado y condición del quórum reglamentario (presentes, requerido, faltantes).
 * 2. Disponer las bancas del recinto según la configuración de filas (filas_bancas) y padrón activo.
 * 3. Reflejar presencia física y test temporal de teclado en modo solo lectura.
 * 4. Presentar el estado actual del uso de la palabra (orador en curso y solicitudes en cola)
 *    de forma pasiva, compatible con la extensión de controles completos en WP-024.
 *
 * Invariantes respetados:
 * - NO incluye controles de presencia manual ni atajos de teclado para marcar presencia.
 * - NO modifica localmente quórum ni presencia ante tests de teclado.
 * - Resuelve imágenes exclusivamente desde ruta_imagen sin hardcodeo de nombres de archivo.
 */

import { computed } from 'vue'
import type { EstadoModeracion } from '@botonera2/api-client'
import PanelContenedor from './PanelContenedor.vue'
import IndicadorQuorum from './IndicadorQuorum.vue'
import GrillaRecinto from './GrillaRecinto.vue'

const props = defineProps<{
  /** Estado autoritativo de moderación recibido desde el backend */
  estado: EstadoModeracion | null
}>()

// Cantidad de concejales registrados en el padrón activo
const totalConcejales = computed(() => props.estado?.concejales?.length ?? 0)

// Cantidad de concejales presentes según el estado de quórum o el padrón
const cantidadPresentes = computed(() => {
  if (props.estado?.quorum) {
    return props.estado.quorum.cantidad_presentes
  }
  return props.estado?.concejales?.filter((c) => c.presente).length ?? 0
})

// Texto para el badge superior del panel
const textoBadge = computed(() => {
  if (!props.estado) return 'Esperando datos...'
  return `${cantidadPresentes.value}/${totalConcejales.value} presentes`
})

// Estilo del badge según quórum alcanzado
const claseBadge = computed(() => {
  if (props.estado?.quorum?.alcanzado) {
    return 'bg-emerald-950 text-emerald-300 border border-emerald-700'
  }
  return 'bg-slate-800 text-slate-300 border border-slate-700'
})

// Información de orador actual
const oradorActual = computed(() => {
  if (!props.estado?.palabra?.orador) return null
  const o = props.estado.palabra.orador
  return `${o.nombre} ${o.apellido} (Banca ${o.banca})`
})

// Cantidad de solicitantes en la cola de palabra
const cantidadEnCola = computed(() => props.estado?.palabra?.cola?.length ?? 0)
</script>

<template>
  <PanelContenedor
    titulo="Recinto y palabra"
    subtitulo="Bancas, presencia física y estado de oradores"
    data-testid="panel-recinto-palabra"
    :badge="textoBadge"
    :clase-badge="claseBadge"
  >
    <div class="space-y-4 text-sm text-slate-300">
      <!-- Indicador principal de quórum reglamentario -->
      <IndicadorQuorum v-if="estado" :quorum="estado.quorum" :total-concejales="totalConcejales" />

      <!-- Mapa y disposición de bancas del recinto -->
      <div
        v-if="estado && estado.concejales && estado.concejales.length > 0"
        class="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5"
      >
        <div
          class="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2 px-1 text-xs"
        >
          <span class="font-bold text-slate-300 uppercase tracking-wider text-[11px]"
            >Distribución de bancas</span
          >
          <span class="text-[11px] text-slate-400 font-mono"
            >Solo lectura · Acreditación física</span
          >
        </div>
        <GrillaRecinto
          :concejales="estado.concejales"
          :filas-bancas="estado.configuracion?.filas_bancas"
        />
      </div>

      <!-- Estado pasivo del uso de la palabra -->
      <div
        v-if="estado?.palabra"
        data-testid="seccion-palabra"
        class="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
      >
        <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-300"
            >Uso de la palabra</span
          >
          <span
            data-testid="badge-cola-palabra"
            class="rounded px-2 py-0.5 text-[10px] font-bold"
            :class="
              cantidadEnCola > 0
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            "
          >
            {{ cantidadEnCola }} en cola
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <!-- Orador actual -->
          <div class="rounded border border-slate-800/80 bg-slate-900/50 p-2">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400"
              >Orador en uso de palabra:</span
            >
            <p
              data-testid="orador-actual-texto"
              class="font-semibold mt-0.5"
              :class="oradorActual ? 'text-cyan-300' : 'text-slate-400 italic'"
            >
              {{ oradorActual ?? 'Sin orador activo' }}
            </p>
          </div>

          <!-- Próximos en cola -->
          <div class="rounded border border-slate-800/80 bg-slate-900/50 p-2">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400"
              >Próximos pedidos en cola:</span
            >
            <div v-if="cantidadEnCola > 0" class="mt-0.5 space-y-0.5">
              <p
                v-for="(persona, idx) in estado.palabra.cola.slice(0, 3)"
                :key="idx"
                class="truncate text-slate-200 font-medium"
              >
                {{ idx + 1 }}. {{ persona.nombre }} {{ persona.apellido }} (Banca
                {{ persona.banca }})
              </p>
              <p v-if="cantidadEnCola > 3" class="text-[10px] text-slate-400 italic">
                +{{ cantidadEnCola - 3 }} más en espera
              </p>
            </div>
            <p v-else class="text-slate-400 italic mt-0.5">Sin pedidos en espera</p>
          </div>
        </div>
      </div>

      <!-- Estado inicial mientras no hay datos -->
      <div
        v-if="!estado"
        class="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg"
      >
        Conectando y esperando estado autoritativo del backend...
      </div>
    </div>
  </PanelContenedor>
</template>
