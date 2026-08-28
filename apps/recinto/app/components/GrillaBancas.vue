<script setup lang="ts">
/** Construye la geometría física desde filas_bancas y el número de cada banca. */

import { computed } from 'vue'
import type { ConcejalPublico, VotoPublico } from '@botonera2/api-client'
import BancaPublica from './BancaPublica.vue'

interface BancaFisica {
  numero: number
  concejal: ConcejalPublico | null
}

interface FilaFisica {
  numero: number
  bancas: BancaFisica[]
}

const props = defineProps<{
  filasBancas: number[] | null
  concejales: ConcejalPublico[]
  bancaOrador: number | null
  votosIndividuales: VotoPublico[] | null
}>()

const votosPorBanca = computed(
  () => new Map((props.votosIndividuales ?? []).map((voto) => [voto.banca, voto])),
)

const filasVisuales = computed<FilaFisica[]>(() => {
  if (!props.filasBancas?.length) return []

  const porBanca = new Map(props.concejales.map((concejal) => [concejal.banca, concejal]))
  let primeraBanca = 1
  const filasInferiorASuperior = props.filasBancas.map((cantidad, indice) => {
    const bancas = Array.from({ length: cantidad }, (_, desplazamiento) => {
      const numero = primeraBanca + desplazamiento
      return { numero, concejal: porBanca.get(numero) ?? null }
    })
    primeraBanca += cantidad
    return { numero: indice + 1, bancas }
  })

  // CSS dibuja de arriba hacia abajo. Invertimos solo la colección de filas,
  // nunca el orden interno: banca 1 sigue abajo a la izquierda y cada fila
  // conserva numeración izquierda → derecha.
  return filasInferiorASuperior.reverse()
})
</script>

<template>
  <section data-testid="grilla-bancas" class="grilla-bancas" aria-label="Disposición de bancas">
    <p v-if="filasVisuales.length === 0" class="sin-disposicion" role="status">
      Disposición de bancas no disponible.
    </p>

    <div
      v-for="fila in filasVisuales"
      :key="fila.numero"
      :data-testid="`fila-fisica-${fila.numero}`"
      :data-fila-fisica="fila.numero"
      class="fila-bancas"
      :style="{ gridTemplateColumns: `repeat(${fila.bancas.length}, minmax(0, 1fr))` }"
    >
      <template v-for="banca in fila.bancas" :key="banca.numero">
        <BancaPublica
          v-if="banca.concejal"
          :concejal="banca.concejal"
          :es-orador="bancaOrador === banca.numero"
          :voto="votosPorBanca.get(banca.numero) ?? null"
        />
        <div v-else class="banca-sin-datos" :data-banca="banca.numero">
          Banca {{ banca.numero }} sin datos públicos
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.grilla-bancas {
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  gap: clamp(0.45rem, 1vh, 0.85rem);
}

.fila-bancas {
  display: grid;
  gap: clamp(0.4rem, 0.75vw, 0.8rem);
  width: 100%;
}

.banca-sin-datos,
.sin-disposicion {
  display: grid;
  place-items: center;
  min-height: 90px;
  margin: 0;
  border: 1px dashed #64748b;
  border-radius: 14px;
  color: #94a3b8;
  text-align: center;
  font-size: 0.75rem;
}

@media (max-width: 900px) {
  .grilla-bancas {
    min-width: 720px;
  }
}
</style>
