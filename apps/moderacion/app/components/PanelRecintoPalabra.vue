<script setup lang="ts">
/**
 * Panel de Recinto y Palabra (Cuadrante 3 de Moderación).
 *
 * Responsabilidades:
 * 1. Mostrar el estado y condición del quórum reglamentario (presentes, requerido, faltantes).
 *    M2: En SIN_PREPARAR (donde quorum es null), no renderiza un falso indicador 0/0.
 * 2. Disponer las bancas del recinto según la configuración de filas (filas_bancas) y padrón activo.
 * 3. Reflejar presencia física y test temporal de teclado en modo solo lectura.
 * 4. Integrar los controles autoritativos de palabra y el flujo de remapeo físico.
 *
 * Invariantes respetados:
 * - NO incluye controles de presencia manual ni atajos de teclado para marcar presencia.
 * - NO modifica localmente quórum ni presencia ante tests de teclado.
 * - Resuelve imágenes exclusivamente desde ruta_imagen sin hardcodeo de nombres de archivo.
 */

import { computed } from 'vue'
import {
  crearClienteModeracion,
  type ClienteModeracion,
  type EstadoModeracion,
} from '@botonera2/api-client'
import PanelContenedor from './PanelContenedor.vue'
import IndicadorQuorum from './IndicadorQuorum.vue'
import GrillaRecinto from './GrillaRecinto.vue'
import GestionPalabra from './GestionPalabra.vue'
import GestionRemapeo from './GestionRemapeo.vue'

const props = defineProps<{
  /** Estado autoritativo de moderación recibido desde el backend */
  estado: EstadoModeracion | null
  /** Cliente compartido por la aplicación; la inyección mantiene tests deterministas. */
  cliente?: ClienteModeracion
  /** Solo una conexión confirmada habilita los comandos del cuadrante. */
  conectado?: boolean
}>()

// El fallback permite renderizar el componente aislado en SSR sin abrir una
// suscripción ni duplicar la frontera de sincronización de la aplicación.
const clienteEfectivo = props.cliente ?? crearClienteModeracion()

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
</script>

<template>
  <PanelContenedor
    titulo="Recinto y palabra"
    subtitulo="Bancas, palabra y coordinación de dispositivos"
    data-testid="panel-recinto-palabra"
    :badge="textoBadge"
    :clase-badge="claseBadge"
  >
    <div class="space-y-4 text-sm text-slate-300">
      <!-- Indicador principal de quórum reglamentario (solo cuando existe contexto de quórum) (M2) -->
      <IndicadorQuorum
        v-if="estado && estado.quorum"
        :quorum="estado.quorum"
        :total-concejales="totalConcejales"
      />

      <!-- Cola/orador y comandos: toda transición llega luego desde REST/SSE. -->
      <GestionPalabra :estado="estado" :cliente="clienteEfectivo" :conectado="conectado ?? false" />

      <!-- Flujo físico coordinado por FastAPI, nunca por acceso directo al bridge. -->
      <GestionRemapeo
        v-if="estado && estado.estado_global !== 'SIN_PREPARAR'"
        :estado="estado"
        :cliente="clienteEfectivo"
        :conectado="conectado ?? false"
      />

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
