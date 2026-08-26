<script setup lang="ts">
/**
 * Componente que representa visualmente una banca individual en el panel de Recinto.
 *
 * Responsabilidades:
 * 1. Mostrar la identidad del concejal (nombre, apellido, bloque político).
 * 2. Cargar la fotografía institucional desde ruta_imagen con fallback visual seguro.
 * 3. Reflejar con alto contraste el estado de presencia (presente/ausente) en modo solo lectura.
 * 4. Resaltar temporalmente el estado de prueba de teclado físico (test_activo).
 * 5. Mostrar el identificador lógico del dispositivo asignado como dato técnico de diagnóstico.
 *
 * Invariantes respetados:
 * - NO contiene botones, checkboxes ni interacciones que permitan alternar presencia.
 * - NO hardcodea asociaciones entre número de banca y nombres de archivo de imagen.
 * - El test activo es puramente visual y no altera localmente presencia ni quórum.
 */

import { ref, computed } from 'vue'
import type { ConcejalModeracion } from '@botonera2/api-client'
import { resolverRutaAsset } from '../utils/rutas'

const props = defineProps<{
  /** Datos completos de la banca y concejal proyectados por el backend */
  concejal: ConcejalModeracion
}>()

// Control reactivo para saber si la imagen institucional falló al cargarse
const errorCargaImagen = ref(false)

// Resuelve la URL pública de la imagen institucional respetando el baseURL de la app
const urlImagen = computed(() => resolverRutaAsset(props.concejal.ruta_imagen))

// Manejador del evento de error al cargar la imagen
function manejarErrorImagen(): void {
  errorCargaImagen.value = true
}

// Iniciales del concejal para mostrar en el fallback si la imagen no carga
const iniciales = computed(() => {
  const n = props.concejal.nombre?.charAt(0) || ''
  const a = props.concejal.apellido?.charAt(0) || ''
  return `${n}${a}`.toUpperCase() || '?'
})
</script>

<template>
  <div
    data-testid="banca-concejal"
    :data-banca="concejal.banca"
    class="relative flex flex-col justify-between rounded-lg border p-2.5 transition-all duration-200 select-none min-w-[120px] max-w-[170px] flex-1"
    :class="[
      // Resaltado de presencia
      concejal.presente
        ? 'border-emerald-700/80 bg-emerald-950/30 text-slate-100 shadow-sm shadow-emerald-950/40'
        : 'border-slate-800 bg-slate-950/70 text-slate-400 opacity-75',
      // Resaltado llamativo cuando el test físico está activo
      concejal.test_activo ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950' : '',
    ]"
  >
    <!-- Cabecera de la banca: número de banca y dispositivo lógico -->
    <div class="flex items-center justify-between gap-1 text-[10px] font-mono leading-none mb-1.5">
      <span
        data-testid="numero-banca"
        class="rounded px-1.5 py-0.5 font-bold"
        :class="
          concejal.presente
            ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700/60'
            : 'bg-slate-900 text-slate-400 border border-slate-800'
        "
      >
        Banca {{ concejal.banca }}
      </span>

      <!-- Identificador lógico secundario para diagnóstico técnico -->
      <span
        data-testid="dispositivo-banca"
        class="text-slate-400 text-[9px] font-mono tracking-tight"
        :title="`Dispositivo lógico: ${concejal.dispositivo_votacion}`"
      >
        {{ concejal.dispositivo_votacion }}
      </span>
    </div>

    <!-- Cuerpo: Fotografía o avatar fallback -->
    <div
      class="relative mx-auto my-1 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 shadow-inner"
    >
      <img
        v-if="!errorCargaImagen && urlImagen"
        :src="urlImagen"
        :alt="`${concejal.nombre} ${concejal.apellido}`"
        data-testid="imagen-concejal"
        class="h-full w-full object-cover"
        @error="manejarErrorImagen"
      />
      <!-- Fallback visual ante ausencia o error de carga de la imagen -->
      <div
        v-else
        data-testid="fallback-imagen"
        class="flex h-full w-full items-center justify-center bg-slate-800 text-xs font-bold text-slate-300"
        :title="`${concejal.nombre} ${concejal.apellido}`"
      >
        <span>{{ iniciales }}</span>
      </div>

      <!-- Badge flotante de señal de test activo -->
      <span
        v-if="concejal.test_activo"
        data-testid="badge-test-activo"
        class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-slate-950 animate-bounce shadow-md"
        title="Test físico activo"
      >
        !
      </span>
    </div>

    <!-- Identidad: Nombre, apellido y bloque político -->
    <div class="mt-1 text-center min-w-0">
      <p
        data-testid="nombre-concejal"
        class="truncate text-xs font-semibold leading-tight"
        :class="concejal.presente ? 'text-slate-100' : 'text-slate-400'"
        :title="`${concejal.nombre} ${concejal.apellido}`"
      >
        {{ concejal.nombre }} {{ concejal.apellido }}
      </p>
      <p
        v-if="concejal.bloque"
        data-testid="bloque-concejal"
        class="truncate text-[10px] text-slate-400 mt-0.5 leading-none"
        :title="concejal.bloque"
      >
        {{ concejal.bloque }}
      </p>
    </div>

    <!-- Pie: Indicador de presencia en solo lectura y señal de test -->
    <div class="mt-2 flex flex-col gap-1 items-center">
      <!-- Indicador visual de presencia institucional -->
      <div
        data-testid="estado-presencia"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider w-full justify-center"
        :class="
          concejal.presente
            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80'
            : 'bg-slate-900 text-slate-400 border border-slate-800'
        "
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="concejal.presente ? 'bg-emerald-400' : 'bg-slate-400'"
        />
        <span>{{ concejal.presente ? 'Presente' : 'Ausente' }}</span>
      </div>

      <!-- Indicador textual de test activo cuando corresponda -->
      <div
        v-if="concejal.test_activo"
        data-testid="indicador-test"
        class="w-full text-center rounded bg-amber-950/90 text-amber-200 border border-amber-500 py-0.5 text-[8px] font-bold uppercase tracking-wider animate-pulse"
      >
        Test de teclado
      </div>
    </div>
  </div>
</template>
