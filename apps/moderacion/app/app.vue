<script setup lang="ts">
/**
 * Vista principal y Shell de la aplicación de Moderación de Botonera2.
 *
 * Responsabilidades:
 * 1. Inicializar y consumir la frontera reactiva de sincronización (useEstadoModeracion).
 * 2. Renderizar la cabecera operacional permanente con estado de conexión, estado global y revisión.
 * 3. Disponer los cuatro cuadrantes funcionales en una grilla 2×2 para resoluciones Full HD (1920×1080)
 *    y 1366×768, con adaptación fluida para resoluciones menores.
 * 4. Garantizar que el crecimiento interno de cualquier panel quede confinado a su propio scroll
 *    sin deformar ni empujar la altura de los demás paneles.
 */

import { shallowRef } from 'vue'
import type { PuntoOrdenDelDiaProyectado } from '@botonera2/api-client'
import { useEstadoModeracion } from './composables/useEstadoModeracion'
import CabeceraModeracion from './components/CabeceraModeracion.vue'
import PanelSesionVotacion from './components/PanelSesionVotacion.vue'
import PanelOrdenDelDia from './components/PanelOrdenDelDia.vue'
import PanelRecintoPalabra from './components/PanelRecintoPalabra.vue'
import PanelEventos from './components/PanelEventos.vue'

// Conectamos con el composable reactivo de moderación
const { estado, estadoConexion, estadoGlobal, revision, desactualizado } = useEstadoModeracion()

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
    class="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-slate-950 text-slate-100 antialiased select-none"
  >
    <!-- Cabecera de estado técnico e institucional -->
    <CabeceraModeracion
      :estado-conexion="estadoConexion"
      :estado-global="estadoGlobal"
      :revision="revision"
      :desactualizado="desactualizado"
    />

    <!-- Área de trabajo principal con grilla 2×2 en desktop (1920×1080 y 1366×768) -->
    <main class="flex flex-1 min-h-0 min-w-0 flex-col p-3 lg:p-4 overflow-hidden">
      <div
        data-testid="grilla-paneles"
        class="grid flex-1 min-h-0 min-w-0 grid-cols-1 lg:grid-cols-2 grid-rows-none lg:grid-rows-2 gap-3 lg:gap-4 overflow-y-auto lg:overflow-hidden"
      >
        <!-- Cuadrante 1 (arriba izquierda): Sesión y votación -->
        <div class="h-[360px] lg:h-auto min-h-0 min-w-0">
          <PanelSesionVotacion :estado="estado" :punto-preseleccionado="puntoSeleccionado" />
        </div>

        <!-- Cuadrante 2 (arriba derecha): Orden del Día -->
        <div class="h-[360px] lg:h-auto min-h-0 min-w-0">
          <PanelOrdenDelDia :estado="estado" @seleccionar="seleccionarPuntoOrdenDelDia" />
        </div>

        <!-- Cuadrante 3 (abajo izquierda): Recinto y palabra -->
        <div class="h-[360px] lg:h-auto min-h-0 min-w-0">
          <PanelRecintoPalabra :estado="estado" />
        </div>

        <!-- Cuadrante 4 (abajo derecha): Eventos -->
        <div class="h-[360px] lg:h-auto min-h-0 min-w-0">
          <PanelEventos :estado="estado" />
        </div>
      </div>
    </main>
  </div>
</template>
