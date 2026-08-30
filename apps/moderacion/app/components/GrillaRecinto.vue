<script setup lang="ts">
/**
 * Construye en Moderación la misma geometría física que ve el Recinto público.
 *
 * `filas_bancas` enumera filas desde abajo hacia arriba. Como el DOM se dibuja
 * de arriba hacia abajo, se invierte solamente la colección de filas. Dentro de
 * cada fila se conserva la numeración creciente y cada persona se busca por banca.
 */

import { computed } from 'vue'
import type { ConcejalModeracion } from '@botonera2/api-client'
import BancaConcejal from './BancaConcejal.vue'

interface BancaFisica {
  numero: number
  concejal: ConcejalModeracion | null
}

interface FilaFisica {
  numero: number
  bancas: BancaFisica[]
}

const props = defineProps<{
  /** Lista proyectada; su orden no expresa la ubicación física. */
  concejales: ConcejalModeracion[]
  /** Cantidad de posiciones por fila, enumeradas desde la fila inferior. */
  filasBancas?: number[] | null
}>()

const filasVisuales = computed<FilaFisica[]>(() => {
  if (!props.filasBancas?.length) {
    // SIN_PREPARAR puede no incluir configuración. Para un uso aislado del componente,
    // el fallback conserva una única fila ordenada sin inventar una geometría adicional.
    const bancas = [...props.concejales]
      .sort((primero, segundo) => primero.banca - segundo.banca)
      .map((concejal) => ({ numero: concejal.banca, concejal }))
    return bancas.length > 0 ? [{ numero: 1, bancas }] : []
  }

  const concejalesPorBanca = new Map(props.concejales.map((concejal) => [concejal.banca, concejal]))
  let primeraBanca = 1
  const filasInferiorASuperior = props.filasBancas.map((cantidad, indice) => {
    const bancas = Array.from({ length: cantidad }, (_, desplazamiento) => {
      const numero = primeraBanca + desplazamiento
      return { numero, concejal: concejalesPorBanca.get(numero) ?? null }
    })
    primeraBanca += cantidad
    return { numero: indice + 1, bancas }
  })

  // Nunca se invierte `bancas`: banca 1 debe continuar abajo a la izquierda.
  return filasInferiorASuperior.reverse()
})
</script>

<template>
  <div data-testid="grilla-recinto" class="flex w-full flex-col justify-end gap-1.5 py-1">
    <div
      v-for="fila in filasVisuales"
      :key="fila.numero"
      :data-testid="`fila-bancas-${fila.numero}`"
      :data-fila-fisica="fila.numero"
      class="grid w-full items-stretch gap-1.5 xl:gap-2"
      :style="{ gridTemplateColumns: `repeat(${fila.bancas.length}, minmax(0, 1fr))` }"
    >
      <template v-for="banca in fila.bancas" :key="banca.numero">
        <BancaConcejal v-if="banca.concejal" :concejal="banca.concejal" />
        <div
          v-else
          data-testid="banca-sin-datos"
          :data-banca="banca.numero"
          class="grid min-h-20 place-items-center rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-1 text-center text-[8px] text-slate-500"
        >
          Banca {{ banca.numero }} sin datos
        </div>
      </template>
    </div>

    <div
      v-if="filasVisuales.length === 0"
      data-testid="sin-concejales"
      class="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-400"
    >
      No hay concejales registrados en el padrón activo.
    </div>
  </div>
</template>
