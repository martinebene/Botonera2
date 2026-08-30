<script setup lang="ts">
/** Tarjeta pública de una banca, sin DNI, dispositivo ni interacción mutante. */

import { computed, ref, watch } from 'vue'
import type { ConcejalPublico, VotoPublico } from '@botonera2/api-client'
import { resolverRutaAsset } from '../utils/rutas'

const props = defineProps<{
  concejal: ConcejalPublico
  esOrador: boolean
  voto: VotoPublico | null
}>()

const imagenFallida = ref(false)
const urlImagen = computed(() => resolverRutaAsset(props.concejal.ruta_imagen))
const claveImagen = computed(
  () =>
    `${props.concejal.nombre}|${props.concejal.apellido}|${props.concejal.banca}|${props.concejal.ruta_imagen}`,
)
const iniciales = computed(() =>
  `${props.concejal.nombre.charAt(0)}${props.concejal.apellido.charAt(0)}`.toUpperCase(),
)
const presentacionVoto = computed(() => {
  const presentaciones: Record<string, { texto: string; clase: string }> = {
    POSITIVO: { texto: 'Positivo', clase: 'etiqueta-voto-positivo' },
    NEGATIVO: { texto: 'Negativo', clase: 'etiqueta-voto-negativo' },
    ABSTENCION: { texto: 'Abstención', clase: 'etiqueta-voto-abstencion' },
  }
  return props.voto ? (presentaciones[props.voto.valor] ?? null) : null
})

// Una baseline puede cambiar ruta o persona aun reutilizando la misma banca.
// La clave completa evita conservar un error local que ya no pertenece al snapshot.
watch(claveImagen, () => {
  imagenFallida.value = false
})
</script>

<template>
  <article
    data-testid="banca-publica"
    :data-banca="concejal.banca"
    :data-presente="concejal.presente"
    class="banca-publica"
    :class="{
      'banca-ausente': !concejal.presente,
      'banca-test': concejal.test_activo,
      'banca-orador': esOrador,
    }"
    :aria-label="`Banca ${concejal.banca}, ${concejal.nombre} ${concejal.apellido}, ${concejal.presente ? 'presente' : 'ausente'}${presentacionVoto ? `, voto ${presentacionVoto.texto}` : ''}`"
  >
    <div class="foto-concejal">
      <img
        v-if="urlImagen && !imagenFallida"
        data-testid="imagen-concejal"
        :data-ruta-imagen="concejal.ruta_imagen"
        :src="urlImagen"
        :alt="`${concejal.nombre} ${concejal.apellido}`"
        @error="imagenFallida = true"
      />
      <div v-else data-testid="imagen-fallback" class="imagen-fallback" aria-hidden="true">
        {{ iniciales || '?' }}
      </div>
      <span data-testid="numero-banca" class="numero-banca">Banca {{ concejal.banca }}</span>
    </div>

    <div class="identidad-concejal">
      <strong :title="`${concejal.nombre} ${concejal.apellido}`">
        {{ concejal.nombre }} <span>{{ concejal.apellido }}</span>
      </strong>
      <small v-if="concejal.bloque" :title="concejal.bloque">{{ concejal.bloque }}</small>
    </div>

    <div class="estados-banca">
      <span data-testid="estado-presencia" class="etiqueta-estado etiqueta-presencia">
        {{ concejal.presente ? 'Presente' : 'Ausente' }}
      </span>
      <span
        v-if="concejal.test_activo"
        data-testid="estado-test"
        class="etiqueta-estado etiqueta-test"
      >
        Test activo
      </span>
      <span v-if="esOrador" data-testid="estado-orador" class="etiqueta-estado etiqueta-orador">
        En uso de la palabra
      </span>
      <span
        v-if="presentacionVoto"
        data-testid="voto-banca"
        class="etiqueta-estado etiqueta-voto"
        :class="presentacionVoto.clase"
      >
        {{ presentacionVoto.texto }}
      </span>
    </div>
  </article>
</template>

<style scoped>
.banca-publica {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(58px, 34%) minmax(0, 1fr);
  grid-template-rows: 1fr auto;
  gap: 0.5rem 0.65rem;
  min-height: clamp(105px, 13vh, 148px);
  padding: clamp(0.55rem, 1vw, 0.85rem);
  overflow: hidden;
  border: 2px solid rgba(52, 211, 153, 0.5);
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(15, 49, 55, 0.96), rgba(10, 27, 43, 0.96));
  box-shadow: 0 14px 28px rgba(2, 8, 23, 0.24);
}

.banca-ausente {
  opacity: 0.78;
  border-color: rgba(100, 116, 139, 0.46);
  background: linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.96));
}

.banca-test {
  border-color: #fbbf24;
  box-shadow:
    0 0 0 3px rgba(251, 191, 36, 0.2),
    0 14px 28px rgba(2, 8, 23, 0.28);
}

.banca-orador {
  border-color: #38bdf8;
  box-shadow:
    0 0 0 4px rgba(56, 189, 248, 0.22),
    0 0 32px rgba(14, 165, 233, 0.18);
}

.foto-concejal {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #1e293b;
  aspect-ratio: 4 / 5;
}

.foto-concejal img,
.imagen-fallback {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banca-ausente .foto-concejal img {
  filter: grayscale(1);
  opacity: 0.46;
}

.imagen-fallback {
  display: grid;
  place-items: center;
  color: #cbd5e1;
  background: linear-gradient(145deg, #334155, #172033);
  font-size: clamp(1rem, 2vw, 1.55rem);
  font-weight: 900;
}

.numero-banca {
  position: absolute;
  left: 0.35rem;
  bottom: 0.35rem;
  display: grid;
  place-items: center;
  min-width: 1.7rem;
  min-height: 1.35rem;
  padding: 0.18rem 0.38rem;
  border-radius: 999px;
  color: #e0f2fe;
  background: rgba(2, 8, 23, 0.86);
  font-size: 0.58rem;
  font-weight: 900;
}

.identidad-concejal {
  min-width: 0;
  align-self: center;
}

.identidad-concejal strong,
.identidad-concejal small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.identidad-concejal strong {
  color: #f8fafc;
  font-size: clamp(0.72rem, 1.15vw, 1rem);
  line-height: 1.15;
}

.identidad-concejal strong span {
  display: block;
  color: #bae6fd;
}

.identidad-concejal small {
  margin-top: 0.4rem;
  color: #94a3b8;
  font-size: clamp(0.58rem, 0.8vw, 0.72rem);
  white-space: nowrap;
}

.estados-banca {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
}

.etiqueta-estado {
  padding: 0.2rem 0.42rem;
  border-radius: 999px;
  font-size: clamp(0.52rem, 0.68vw, 0.66rem);
  font-weight: 900;
  letter-spacing: 0.035em;
  text-transform: uppercase;
}

.etiqueta-presencia {
  color: #a7f3d0;
  background: rgba(6, 78, 59, 0.75);
}

.banca-ausente .etiqueta-presencia {
  color: #e2e8f0;
  background: rgba(71, 85, 105, 0.82);
}

.etiqueta-test {
  color: #422006;
  background: #fbbf24;
}

.etiqueta-orador {
  color: #082f49;
  background: #7dd3fc;
}

.etiqueta-voto {
  flex-basis: 100%;
  border: 1px solid currentColor;
  text-align: center;
}

.etiqueta-voto-positivo {
  color: #a7f3d0;
  background: rgba(6, 95, 70, 0.92);
}

.etiqueta-voto-negativo {
  color: #fecaca;
  background: rgba(153, 27, 27, 0.92);
}

.etiqueta-voto-abstencion {
  color: #422006;
  background: #fbbf24;
}

@media (max-height: 820px) {
  .banca-publica {
    min-height: 96px;
    grid-template-columns: minmax(48px, 30%) minmax(0, 1fr);
    padding: 0.45rem;
  }
}
</style>
