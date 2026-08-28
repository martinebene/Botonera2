<script setup lang="ts">
/** Presenta el DTO público sin recalcular mayoría, conteos ni resultado. */

import { computed } from 'vue'
import type { VotacionPublica } from '@botonera2/api-client'

const props = defineProps<{ votacion: VotacionPublica }>()

const etiquetasResultado: Record<string, string> = {
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  EMPATADA: 'Empatada',
  INCONCLUSA: 'Inconclusa',
}

const etiquetasBase: Record<string, string> = {
  VOTOS_COMPUTABLES: 'votos computables',
  PRESENTES: 'presentes',
  CUERPO: 'cuerpo completo',
}

const enCurso = computed(() => props.votacion.estado_recepcion === 'EN_CURSO')
const resultadoHumano = computed(() =>
  props.votacion.resultado ? etiquetasResultado[props.votacion.resultado] : null,
)
const mayoriaHumana = computed(() => {
  if (props.votacion.tipo_mayoria === 'SIMPLE') return 'Mayoría simple'
  const base = etiquetasBase[props.votacion.base] ?? props.votacion.base
  return `Mayoría especial · factor ${props.votacion.factor} · base ${base}`
})
const conteosVisibles = computed(() => (enCurso.value ? null : props.votacion.conteos))

function etiquetaSentido(sentido: string): string {
  return sentido === 'POSITIVO' ? 'Positivo' : sentido === 'NEGATIVO' ? 'Negativo' : sentido
}
</script>

<template>
  <article data-testid="votacion-publica" class="panel-votacion">
    <div class="datos-votacion">
      <div class="cabecera-votacion">
        <span class="numero-votacion">Votación N.º {{ votacion.numero_votacion }}</span>
        <span
          data-testid="estado-votacion"
          class="estado-votacion"
          :class="`estado-${(votacion.resultado ?? votacion.estado_recepcion).toLowerCase()}`"
        >
          {{ enCurso ? 'En curso' : (resultadoHumano ?? 'Recepción cerrada') }}
        </span>
      </div>
      <p class="tipo-votacion">{{ votacion.tipo }} · {{ mayoriaHumana }}</p>
      <h3 data-testid="tema-votacion" :title="votacion.tema">{{ votacion.tema }}</h3>
      <p
        v-if="votacion.resultado === 'EMPATADA'"
        data-testid="espera-desempate"
        class="espera-desempate"
      >
        En espera del desempate de Presidencia
      </p>
    </div>

    <dl v-if="conteosVisibles" data-testid="conteos-votacion" class="conteos-votacion">
      <div class="conteo-positivo">
        <dt>Positivos</dt>
        <dd>{{ conteosVisibles.positivos }}</dd>
      </div>
      <div class="conteo-negativo">
        <dt>Negativos</dt>
        <dd>{{ conteosVisibles.negativos }}</dd>
      </div>
      <div class="conteo-abstencion">
        <dt>Abstenciones</dt>
        <dd>{{ conteosVisibles.abstenciones }}</dd>
      </div>
      <div class="conteo-total">
        <dt>Total</dt>
        <dd>{{ conteosVisibles.total }}</dd>
      </div>
    </dl>

    <div
      v-if="votacion.voto_presidencial"
      data-testid="voto-presidencial"
      class="voto-presidencial"
    >
      <span>Desempate presidencial</span>
      <strong>{{ votacion.voto_presidencial.presidencia }}</strong>
      <b>{{ etiquetaSentido(votacion.voto_presidencial.sentido) }}</b>
    </div>
  </article>
</template>

<style scoped>
.panel-votacion {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: stretch;
  gap: clamp(0.65rem, 1vw, 1rem);
  margin-bottom: clamp(0.55rem, 1vh, 0.85rem);
  padding: clamp(0.65rem, 1vw, 0.9rem);
  border: 1px solid rgba(56, 189, 248, 0.36);
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(8, 47, 73, 0.82), rgba(15, 23, 42, 0.92));
}

.datos-votacion {
  min-width: 0;
}

.cabecera-votacion {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.numero-votacion,
.estado-votacion,
.voto-presidencial span {
  font-size: clamp(0.56rem, 0.72vw, 0.68rem);
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.numero-votacion {
  color: #7dd3fc;
}

.estado-votacion {
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
  color: #dbeafe;
  background: rgba(30, 64, 175, 0.72);
}

.estado-aprobada {
  color: #a7f3d0;
  background: rgba(6, 95, 70, 0.82);
}
.estado-rechazada {
  color: #fecaca;
  background: rgba(153, 27, 27, 0.82);
}
.estado-empatada {
  color: #fde68a;
  background: rgba(146, 64, 14, 0.82);
}
.estado-inconclusa {
  color: #ddd6fe;
  background: rgba(91, 33, 182, 0.78);
}

.estado-aprobada,
.estado-rechazada,
.estado-empatada,
.estado-inconclusa {
  padding: 0.3rem 0.65rem;
  font-size: clamp(0.72rem, 0.92vw, 0.9rem);
}

.tipo-votacion {
  margin: 0.35rem 0 0;
  overflow: hidden;
  color: #94a3b8;
  font-size: clamp(0.6rem, 0.8vw, 0.72rem);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.datos-votacion h3 {
  display: -webkit-box;
  margin: 0.25rem 0 0;
  overflow: hidden;
  font-size: clamp(0.8rem, 1.2vw, 1.05rem);
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.espera-desempate {
  margin: 0.35rem 0 0;
  color: #fde68a;
  font-size: 0.7rem;
  font-weight: 800;
}

.conteos-votacion {
  display: grid;
  grid-template-columns: repeat(4, minmax(62px, 1fr));
  gap: 0.35rem;
  margin: 0;
}

.conteos-votacion div {
  display: grid;
  align-content: center;
  min-width: 0;
  padding: 0.42rem;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.78);
  text-align: center;
}

.conteos-votacion dt {
  overflow: hidden;
  color: #94a3b8;
  font-size: 0.52rem;
  font-weight: 800;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

.conteos-votacion dd {
  margin: 0.12rem 0 0;
  font-size: clamp(1rem, 1.8vw, 1.45rem);
  font-weight: 900;
}

.conteo-positivo dd {
  color: #34d399;
}
.conteo-negativo dd {
  color: #f87171;
}
.conteo-abstencion dd {
  color: #fbbf24;
}
.conteo-total dd {
  color: #e2e8f0;
}

.voto-presidencial {
  display: grid;
  align-content: center;
  min-width: 155px;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(192, 132, 252, 0.5);
  border-radius: 12px;
  background: rgba(88, 28, 135, 0.38);
}

.voto-presidencial span {
  color: #d8b4fe;
}
.voto-presidencial strong {
  margin-top: 0.2rem;
  font-size: 0.76rem;
}
.voto-presidencial b {
  margin-top: 0.18rem;
  color: #f5d0fe;
  font-size: 0.8rem;
}

@media (max-width: 1450px), (max-height: 820px) {
  .panel-votacion {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .voto-presidencial {
    grid-column: 1 / -1;
    grid-template-columns: auto 1fr auto;
    gap: 0.6rem;
  }
}

@media (max-width: 1050px) {
  .panel-votacion {
    grid-template-columns: 1fr;
  }
  .conteos-votacion {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
