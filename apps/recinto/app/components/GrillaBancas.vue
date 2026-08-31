<script setup lang="ts">
/** Construye la geometría física desde filas_bancas y el número de cada banca. */

import { computed } from 'vue'
import type { ConcejalPublico, VotoPublico } from '@botonera2/api-client'
import BancaPublica from './BancaPublica.vue'

interface BancaFisica {
  numero: number
  concejal: ConcejalPublico | null
  /** Columna donde arranca la banca dentro de la grilla común de la superficie. */
  columna: number
}

interface FilaFisica {
  numero: number
  bancas: BancaFisica[]
}

const props = defineProps<{
  filasBancas: number[] | null
  concejales: ConcejalPublico[]
  bancaOrador: number | null
  /**
   * `estado_recepcion` de la votación relevante; `null` cuando no hay votación.
   *
   * Distingue "ya votó" (recepción abierta) de "votó esto" (recepción cerrada).
   */
  estadoRecepcion: string | null
  /**
   * Contenido de `bancas_voto_emitido`: participación sin sentido durante
   * `EN_CURSO`. El backend lo deja vacío fuera de ese estado.
   */
  bancasVotoEmitido: number[] | null
  /** Votos individuales finales; el backend solo los proyecta tras el cierre. */
  votosIndividuales: VotoPublico[] | null
}>()

/** Conjunto para consultar participación en tiempo constante por banca. */
const bancasEmitidas = computed(() => new Set(props.bancasVotoEmitido ?? []))

/**
 * Sentido final por banca, deliberadamente vacío mientras la recepción sigue
 * abierta: durante `EN_CURSO` la única información autorizada es "ya emitió".
 */
const votoFinalPorBanca = computed(() => {
  if (props.estadoRecepcion === 'EN_CURSO') return new Map<number, string>()
  return new Map((props.votosIndividuales ?? []).map((voto) => [voto.banca, voto.valor]))
})

/**
 * Cantidad de columnas de la grilla común a todas las filas.
 *
 * WP-045 exige que TODAS las tarjetas de una superficie midan lo mismo. Con
 * filas de distinta longitud (por ejemplo `[5, 7]`), repartir cada fila en
 * `1fr` propios haría más anchas las tarjetas de la fila corta. Se usa entonces
 * una única grilla del ancho de la fila más larga y las filas cortas se centran
 * dejando columnas vacías a los costados, sin alterar la disposición física.
 */
const columnasMaximas = computed(() => Math.max(...(props.filasBancas ?? [1])))

const filasVisuales = computed<FilaFisica[]>(() => {
  if (!props.filasBancas?.length) return []

  const porBanca = new Map(props.concejales.map((concejal) => [concejal.banca, concejal]))
  const columnas = columnasMaximas.value
  let primeraBanca = 1
  const filasInferiorASuperior = props.filasBancas.map((cantidad, indice) => {
    // Columna inicial 1-based; el sobrante impar deja la columna extra a la derecha.
    const desplazamientoInicial = Math.floor((columnas - cantidad) / 2)
    const bancas = Array.from({ length: cantidad }, (_, desplazamiento) => {
      const numero = primeraBanca + desplazamiento
      return {
        numero,
        concejal: porBanca.get(numero) ?? null,
        columna: desplazamientoInicial + desplazamiento + 1,
      }
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
      :style="{ gridTemplateColumns: `repeat(${columnasMaximas}, minmax(0, 1fr))` }"
    >
      <template v-for="banca in fila.bancas" :key="banca.numero">
        <BancaPublica
          v-if="banca.concejal"
          :style="{ gridColumn: String(banca.columna) }"
          :concejal="banca.concejal"
          :es-orador="bancaOrador === banca.numero"
          :estado-recepcion="estadoRecepcion"
          :voto-emitido="bancasEmitidas.has(banca.numero)"
          :valor-voto-final="votoFinalPorBanca.get(banca.numero) ?? null"
        />
        <div
          v-else
          class="banca-sin-datos"
          :data-banca="banca.numero"
          :style="{ gridColumn: String(banca.columna) }"
        >
          Banca {{ banca.numero }} sin datos públicos
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.grilla-bancas {
  height: 100%;
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  gap: clamp(0.45rem, 1vh, 0.85rem);
}

.fila-bancas {
  min-height: 0;
  display: grid;
  flex: 1;
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
