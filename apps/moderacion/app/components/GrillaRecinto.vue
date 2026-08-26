<script setup lang="ts">
/**
 * Componente que dispone el mapa de bancas del recinto según la configuración del sistema.
 *
 * Responsabilidades:
 * 1. Ordenar los concejales proyectados por número de banca.
 * 2. Agrupar las bancas en filas dinámicas según el parámetro de configuración `filas_bancas`.
 * 3. Adaptarse flexiblemente a distintas cantidades y disposiciones de bancas sin asumir
 *    un número rígido de 12 concejales ni una estructura fija de 3/4/5 en el código.
 * 4. Renderizar cada banca delegando en el componente `BancaConcejal`.
 */

import { computed } from 'vue'
import type { ConcejalModeracion } from '@botonera2/api-client'
import BancaConcejal from './BancaConcejal.vue'

const props = defineProps<{
  /** Lista completa de concejales proyectados */
  concejales: ConcejalModeracion[]
  /** Distribución de bancas por fila configurada en el backend (ej: [3, 4, 5]) */
  filasBancas?: number[] | null
}>()

// Ordenamos la lista de concejales de menor a mayor por su número de banca
const concejalesOrdenados = computed(() => {
  return [...props.concejales].sort((a, b) => a.banca - b.banca)
})

// Agrupamos los concejales en filas según el esquema proyectado
const filasCalculadas = computed(() => {
  const lista = concejalesOrdenados.value
  if (!props.filasBancas || props.filasBancas.length === 0) {
    // Si no hay configuración explícita de filas, se disponen en una única colección flexible
    return [lista]
  }

  const filas: ConcejalModeracion[][] = []
  let indiceActual = 0

  for (const cantidadFila of props.filasBancas) {
    if (indiceActual >= lista.length) {
      break
    }
    const concejalesDeFila = lista.slice(indiceActual, indiceActual + cantidadFila)
    if (concejalesDeFila.length > 0) {
      filas.push(concejalesDeFila)
    }
    indiceActual += cantidadFila
  }

  // Si quedaron concejales fuera de la partición declarada, los agregamos en una fila adicional
  if (indiceActual < lista.length) {
    filas.push(lista.slice(indiceActual))
  }

  return filas
})
</script>

<template>
  <div data-testid="grilla-recinto" class="flex flex-col gap-3 w-full py-1">
    <div
      v-for="(fila, indiceFila) in filasCalculadas"
      :key="indiceFila"
      :data-testid="`fila-bancas-${indiceFila + 1}`"
      class="flex flex-wrap items-stretch justify-center gap-2 lg:gap-3 w-full"
    >
      <BancaConcejal v-for="concejal in fila" :key="concejal.banca" :concejal="concejal" />
    </div>

    <!-- Mensaje informativo si no hay concejales en la proyección -->
    <div
      v-if="concejales.length === 0"
      data-testid="sin-concejales"
      class="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg"
    >
      No hay concejales registrados en el padrón activo.
    </div>
  </div>
</template>
