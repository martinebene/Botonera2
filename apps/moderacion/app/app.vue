<script setup lang="ts">
/**
 * Vista principal y Shell de la aplicación de Moderación de Botonera2.
 *
 * Responsabilidades:
 * 1. Inicializar y consumir la frontera reactiva de sincronización (useEstadoModeracion).
 * 2. Alimentar la cabecera compacta con todos los datos globales de la pantalla:
 *    estado global, conexión, quórum, autoridades y apertura formal de la sesión.
 * 3. Disponer los cuatro cuadrantes funcionales en una grilla 2×2 que entra completa
 *    en el viewport a 1366×768 y a 1920×1080, sin scroll de página.
 * 4. Garantizar que el crecimiento interno de cualquier panel quede confinado a su propio
 *    scroll sin deformar ni empujar la altura de los demás paneles.
 *
 * Sobre el dimensionado (WP-036): el shell no fija alturas ni anchos absolutos en píxeles.
 * La altura total la aporta `h-dvh`, el reparto vertical lo resuelve Flexbox con `flex-1`
 * y `min-h-0`, y los cuadrantes se reparten el espacio restante con filas y columnas
 * fraccionarias de CSS Grid. Así la grilla escala con el viewport en lugar de depender
 * de una resolución concreta.
 */

import { computed, shallowRef } from 'vue'
import type { PuntoOrdenDelDiaProyectado } from '@botonera2/api-client'
import { useEstadoModeracion } from './composables/useEstadoModeracion'
import CabeceraModeracion from './components/CabeceraModeracion.vue'
import PanelSesionVotacion from './components/PanelSesionVotacion.vue'
import PanelOrdenDelDia from './components/PanelOrdenDelDia.vue'
import PanelRecintoPalabra from './components/PanelRecintoPalabra.vue'
import PanelEventos from './components/PanelEventos.vue'

// Conectamos con el composable reactivo de moderación
const { estado, estadoConexion, estadoGlobal, revision, desactualizado, conectado, cliente } =
  useEstadoModeracion()

/** Cantidad de bancas del padrón activo; sirve de total de referencia del quórum en cabecera. */
const totalConcejales = computed(() => estado.value?.concejales?.length ?? 0)

/**
 * Presidencia vigente, tomada de la sesión abierta o, si todavía no hay sesión,
 * de la preparación en curso. De este modo la autoridad aparece en cabecera desde
 * el mismo momento en que fue cargada, incluso durante PREPARANDO.
 */
const presidencia = computed(
  () => estado.value?.sesion?.presidencia ?? estado.value?.preparacion?.presidencia ?? null,
)

/** Secretaría Legislativa vigente, con el mismo criterio que la Presidencia. */
const secretariaLegislativa = computed(
  () =>
    estado.value?.sesion?.secretaria_legislativa ??
    estado.value?.preparacion?.secretaria_legislativa ??
    null,
)

/**
 * Marca autoritativa de apertura formal de la sesión.
 * Sólo existe con sesión abierta; la cabecera deriva de ella el tiempo transcurrido.
 */
const fechaHoraApertura = computed(() => estado.value?.sesion?.fecha_hora_apertura ?? null)

/**
 * Conserva únicamente el punto elegido como borrador visual entre los cuadrantes.
 * Se crea una copia nueva en cada selección para que volver a elegir el mismo punto
 * también vuelva a precargar el formulario. La colección autoritativa continúa en
 * `estado.orden_del_dia`; esta referencia nunca marca ni consume el punto original.
 */
const puntoSeleccionado = shallowRef<PuntoOrdenDelDiaProyectado | null>(null)

function seleccionarPuntoOrdenDelDia(punto: PuntoOrdenDelDiaProyectado): void {
  puntoSeleccionado.value = { ...punto }
}
</script>

<template>
  <div
    class="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-slate-950 text-slate-100 antialiased select-none"
  >
    <!-- Cabecera compacta: única sede de los datos globales de la pantalla -->
    <CabeceraModeracion
      :estado-conexion="estadoConexion"
      :estado-global="estadoGlobal"
      :revision="revision"
      :desactualizado="desactualizado"
      :quorum="estado?.quorum ?? null"
      :total-concejales="totalConcejales"
      :presidencia="presidencia"
      :secretaria-legislativa="secretariaLegislativa"
      :fecha-hora-apertura="fechaHoraApertura"
    />

    <!-- Área de trabajo principal con grilla 2×2 en desktop (1366×768 y 1920×1080) -->
    <main class="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden p-2 lg:p-3">
      <div
        data-testid="grilla-paneles"
        class="grid flex-1 min-h-0 min-w-0 grid-cols-1 auto-rows-[minmax(45dvh,auto)] gap-2 overflow-y-auto lg:grid-cols-2 lg:grid-rows-2 lg:gap-3 lg:overflow-hidden"
      >
        <!-- Cuadrante 1 (arriba izquierda): Sesión y votación -->
        <PanelSesionVotacion :estado="estado" :punto-preseleccionado="puntoSeleccionado" />

        <!-- Cuadrante 2 (arriba derecha): Orden del Día -->
        <PanelOrdenDelDia :estado="estado" @seleccionar="seleccionarPuntoOrdenDelDia" />

        <!-- Cuadrante 3 (abajo izquierda): Recinto y palabra -->
        <PanelRecintoPalabra :estado="estado" :cliente="cliente" :conectado="conectado" />

        <!-- Cuadrante 4 (abajo derecha): Eventos -->
        <PanelEventos :estado="estado" />
      </div>
    </main>
  </div>
</template>
