<script setup lang="ts">
/**
 * Panel de Sesión y Votación (Cuadrante 1).
 *
 * En este WP (WP-021), establece la identidad visual, contenedor con scroll interno
 * y placeholder descriptivo para los futuros controles de preparación de sala,
 * apertura de sesión, configuración de autoridades y gestión de votaciones.
 */

import type { EstadoModeracion } from '@botonera2/api-client'
import PanelContenedor from './PanelContenedor.vue'

defineProps<{
  /** Estado de moderación recibido desde el backend */
  estado: EstadoModeracion | null
}>()
</script>

<template>
  <PanelContenedor
    titulo="Sesión y votación"
    subtitulo="Control institucional y ciclo de votaciones"
    data-testid="panel-sesion-votacion"
    :badge="
      estado
        ? estado.estado_global === 'SESION_ABIERTA'
          ? 'Sesión activa'
          : estado.estado_global === 'PREPARANDO'
            ? 'Preparando'
            : 'Sin preparar'
        : 'Esperando estado...'
    "
    :clase-badge="
      estado?.estado_global === 'SESION_ABIERTA'
        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
        : 'bg-slate-800 text-slate-300 border border-slate-700'
    "
  >
    <div class="space-y-4 text-sm text-slate-300">
      <!-- Indicador informativo del estado activo -->
      <div v-if="estado" class="rounded border border-slate-800 bg-slate-950/60 p-3">
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-slate-400">Estado institucional:</span>
            <p class="font-semibold text-slate-100">{{ estado.estado_global }}</p>
          </div>
          <div v-if="estado.sesion">
            <span class="text-slate-400">Sesión Nº:</span>
            <p class="font-semibold text-slate-100">{{ estado.sesion.numero_sesion }}</p>
          </div>
          <div v-else-if="estado.preparacion">
            <span class="text-slate-400">Sesión en preparación Nº:</span>
            <p class="font-semibold text-slate-100">
              {{ estado.preparacion.numero_sesion ?? 'Sin asignar' }}
            </p>
          </div>
          <div v-if="estado.sesion?.presidencia || estado.preparacion?.presidencia">
            <span class="text-slate-400">Presidencia:</span>
            <p class="font-semibold text-slate-100">
              {{ estado.sesion?.presidencia || estado.preparacion?.presidencia }}
            </p>
          </div>
          <div
            v-if="
              estado.sesion?.secretaria_legislativa || estado.preparacion?.secretaria_legislativa
            "
          >
            <span class="text-slate-400">Secretaría:</span>
            <p class="font-semibold text-slate-100">
              {{
                estado.sesion?.secretaria_legislativa || estado.preparacion?.secretaria_legislativa
              }}
            </p>
          </div>
        </div>
      </div>

      <!-- Placeholder descriptivo de funciones futuras -->
      <div class="rounded-lg border border-dashed border-slate-800 p-4 text-center">
        <p class="font-medium text-slate-300">Área de controles de sesión y votación</p>
        <p class="mt-1 text-xs text-slate-400">
          Los controles interactivos para preparar sala, abrir/cerrar sesión, formular votaciones y
          desempate presidencial se integrarán en los Work Packages posteriores.
        </p>
      </div>
    </div>
  </PanelContenedor>
</template>
