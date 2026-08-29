<script setup lang="ts">
/**
 * Aplicación principal del Simulador Web de Dispositivos Lógicos (Botonera2).
 *
 * Responsabilidades:
 * 1. Inicializar la sincronización diagnóstica mediante useSimulador().
 * 2. Renderizar la cabecera operacional con aclaración de entradas directas a FastAPI.
 * 3. Renderizar el panel general de indicadores globales (sin datos por dispositivo).
 * 4. Presentar los 12 dispositivos lógicos (dev01..dev12) visibles simultáneamente
 *    en resolución Full HD (1920×1080) sin requerir scroll vertical ni horizontal.
 * 5. Presentar el log global de pulsaciones autoscrolleable en la parte inferior.
 */

import { DISPOSITIVOS_SIMULADOR } from './types/simulador'
import { useSimulador } from './composables/useSimulador'
import CabeceraSimulador from './components/CabeceraSimulador.vue'
import PanelGeneralSimulador from './components/PanelGeneralSimulador.vue'
import TarjetaDispositivo from './components/TarjetaDispositivo.vue'
import LogPulsaciones from './components/LogPulsaciones.vue'

const {
  estadoConexion,
  estadoGlobal,
  revision,
  quorumResumen,
  sesionResumen,
  votacionResumen,
  ultimaLatenciaMs,
  desactualizado,
  ultimoError,
  peticionesEnVuelo,
  entradasLog,
  enviarPulsacion,
  limpiarLog,
} = useSimulador()

function manejarPulsacion(evento: { dispositivo: string; tecla: string; nombre: string }): void {
  void enviarPulsacion(evento.dispositivo, evento.tecla, evento.nombre)
}
</script>

<template>
  <div
    class="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-slate-950 text-slate-100 antialiased select-none"
  >
    <!-- 1. Cabecera con identidad de simulador y advertencia de entradas directas -->
    <CabeceraSimulador />

    <!-- 2. Panel general compacto con métricas e indicadores globales -->
    <PanelGeneralSimulador
      :estado-conexion="estadoConexion"
      :estado-global="estadoGlobal"
      :revision="revision"
      :quorum-resumen="quorumResumen"
      :sesion-resumen="sesionResumen"
      :votacion-resumen="votacionResumen"
      :ultima-latencia-ms="ultimaLatenciaMs"
      :desactualizado="desactualizado"
      :ultimo-error="ultimoError"
    />

    <!-- 3. Grilla principal de 12 dispositivos lógicos dev01..dev12 -->
    <main
      data-testid="area-dispositivos"
      class="flex flex-1 min-h-0 min-w-0 flex-col p-2.5 sm:p-3 overflow-y-auto lg:overflow-hidden"
    >
      <div
        data-testid="grilla-dispositivos"
        class="grid flex-1 min-h-0 min-w-0 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 grid-rows-none xl:grid-rows-2 gap-2.5"
      >
        <TarjetaDispositivo
          v-for="dispositivo in DISPOSITIVOS_SIMULADOR"
          :key="dispositivo"
          :dispositivo="dispositivo"
          :peticiones-en-vuelo="peticionesEnVuelo"
          @pulsar="manejarPulsacion"
        />
      </div>
    </main>

    <!-- 4. Log global autoscrolleable con respuestas de FastAPI -->
    <LogPulsaciones :entradas="entradasLog" @limpiar="limpiarLog" />
  </div>
</template>
