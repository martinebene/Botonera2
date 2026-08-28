<script setup lang="ts">
/** Vista pública completa; representa sus props y nunca emite comandos. */

import { computed, toRefs } from 'vue'
import type { EstadoRecinto } from '@botonera2/api-client'
import type { EstadoConexionRecinto } from '../composables/useEstadoRecinto'
import { usePresentacionVotacion } from '../composables/usePresentacionVotacion'
import CabeceraRecinto from './CabeceraRecinto.vue'
import GrillaBancas from './GrillaBancas.vue'
import IndicadorQuorumPublico from './IndicadorQuorumPublico.vue'
import PanelPalabraPublico from './PanelPalabraPublico.vue'
import PanelVotacionPublica from './PanelVotacionPublica.vue'

const props = defineProps<{
  estado: EstadoRecinto | null
  estadoConexion: EstadoConexionRecinto
  desactualizado: boolean
}>()
const { estado, estadoConexion, desactualizado } = toRefs(props)

const contextoInstitucional = computed(
  () => estado.value?.sesion ?? estado.value?.preparacion ?? null,
)
const sesionAbierta = computed(() => estado.value?.estado_global === 'SESION_ABIERTA')
const bancaOrador = computed(() => estado.value?.palabra?.orador?.banca ?? null)
const { votacion: votacionPresentada, segundosCuentaRegresiva } = usePresentacionVotacion(estado)
const votosIndividualesVisibles = computed(() => {
  const votacion = votacionPresentada.value
  if (votacion?.estado_recepcion === 'EN_CURSO') return null
  return votacion?.votos_individuales ?? null
})
</script>

<template>
  <div class="aplicacion-recinto">
    <CabeceraRecinto :estado-conexion="estadoConexion" :desactualizado="desactualizado" />

    <main v-if="!estado" class="estado-inicial" data-testid="estado-inicial">
      <div class="pulso-carga" aria-hidden="true" />
      <h2>
        {{
          estadoConexion === 'DESCONECTADO' ? 'Recinto sin conexión' : 'Conectando con el recinto'
        }}
      </h2>
      <p>Esperando el primer estado público confirmado.</p>
    </main>

    <main
      v-else-if="estado.estado_global === 'SIN_PREPARAR'"
      class="estado-sin-preparar"
      data-testid="estado-sin-preparar"
    >
      <span class="isotipo-neutro" aria-hidden="true">CD</span>
      <p class="sobrelinea">Pantalla del Recinto</p>
      <h2>Sala sin preparar</h2>
      <p>La próxima sesión todavía no fue preparada.</p>
    </main>

    <main v-else class="contenido-recinto" :class="{ 'contenido-preparando': !sesionAbierta }">
      <section class="escenario-bancas">
        <header class="contexto-sesion">
          <div>
            <p data-testid="estado-global-visible" class="sobrelinea">
              {{ sesionAbierta ? 'Sesión abierta' : 'Sala en preparación' }}
            </p>
            <h2 data-testid="titulo-contexto">
              <template v-if="sesionAbierta && estado.sesion">
                Sesión N.º {{ estado.sesion.numero_sesion }}
              </template>
              <template v-else-if="estado.preparacion?.numero_sesion">
                Preparando sesión N.º {{ estado.preparacion.numero_sesion }}
              </template>
              <template v-else>Preparación del recinto</template>
            </h2>
          </div>

          <dl v-if="contextoInstitucional" class="autoridades" data-testid="autoridades">
            <div v-if="contextoInstitucional.presidencia">
              <dt>Presidencia</dt>
              <dd>{{ contextoInstitucional.presidencia }}</dd>
            </div>
            <div v-if="contextoInstitucional.secretaria_legislativa">
              <dt>Secretaría Legislativa</dt>
              <dd>{{ contextoInstitucional.secretaria_legislativa }}</dd>
            </div>
          </dl>
        </header>

        <PanelVotacionPublica v-if="votacionPresentada" :votacion="votacionPresentada" />

        <div class="envoltura-grilla">
          <GrillaBancas
            :filas-bancas="estado.filas_bancas"
            :concejales="estado.concejales"
            :banca-orador="bancaOrador"
            :votos-individuales="votosIndividualesVisibles"
          />
          <div
            v-if="segundosCuentaRegresiva !== null"
            data-testid="countdown-votacion"
            class="countdown-votacion"
            role="status"
            aria-live="polite"
          >
            <span>Comienza en</span>
            <strong>{{ segundosCuentaRegresiva }}</strong>
          </div>
        </div>
      </section>

      <aside class="paneles-publicos">
        <IndicadorQuorumPublico :quorum="estado.quorum" />
        <PanelPalabraPublico :palabra="estado.palabra" />
      </aside>
    </main>
  </div>
</template>

<style scoped>
.aplicacion-recinto {
  height: 100dvh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 48% 105%, rgba(14, 116, 144, 0.2), transparent 38%),
    linear-gradient(155deg, #07111f 0%, #0b1729 48%, #07101d 100%);
}

.estado-inicial,
.estado-sin-preparar {
  min-height: 0;
  display: grid;
  flex: 1;
  place-content: center;
  justify-items: center;
  padding: 2rem;
  text-align: center;
}

.estado-inicial h2,
.estado-sin-preparar h2 {
  margin: 0.65rem 0 0.35rem;
  font-size: clamp(1.6rem, 4vw, 3.2rem);
}

.estado-inicial p,
.estado-sin-preparar > p:last-child {
  margin: 0;
  color: #94a3b8;
}

.pulso-carga,
.isotipo-neutro {
  width: 5rem;
  height: 5rem;
  border: 1px solid rgba(125, 211, 252, 0.55);
  border-radius: 50%;
}

.pulso-carga {
  box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.35);
  animation: pulso 1.6s infinite;
}

.isotipo-neutro {
  display: grid;
  place-items: center;
  color: #7dd3fc;
  font-size: 1.4rem;
  font-weight: 900;
}

.sobrelinea {
  margin: 0 0 0.32rem;
  color: #38bdf8;
  font-size: clamp(0.62rem, 0.85vw, 0.76rem);
  font-weight: 900;
  letter-spacing: 0.17em;
  text-transform: uppercase;
}

.contenido-recinto {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(250px, 20vw, 360px);
  flex: 1;
  gap: clamp(0.8rem, 1.4vw, 1.4rem);
  padding: clamp(0.8rem, 1.4vw, 1.4rem);
  overflow: hidden;
}

.escenario-bancas {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: clamp(0.85rem, 1.4vw, 1.35rem);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  background: rgba(7, 17, 31, 0.58);
}

.contenido-preparando .escenario-bancas {
  border-color: rgba(251, 191, 36, 0.32);
}

.contexto-sesion {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: clamp(0.65rem, 1.2vh, 1rem);
}

.contexto-sesion h2 {
  margin: 0;
  font-size: clamp(1.25rem, 2.3vw, 2rem);
  line-height: 1;
}

.autoridades {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem 1.4rem;
  margin: 0;
  text-align: right;
}

.autoridades dt {
  color: #64748b;
  font-size: 0.58rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.autoridades dd {
  max-width: 22rem;
  margin: 0.15rem 0 0;
  overflow: hidden;
  color: #e2e8f0;
  font-size: clamp(0.7rem, 1vw, 0.9rem);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.envoltura-grilla {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex: 1;
  overflow: auto;
}

.countdown-votacion {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-content: center;
  justify-items: center;
  border: 1px solid rgba(125, 211, 252, 0.5);
  border-radius: 18px;
  color: #f8fafc;
  background: rgba(2, 8, 23, 0.78);
  backdrop-filter: blur(3px);
  pointer-events: none;
}

.countdown-votacion span {
  color: #bae6fd;
  font-size: clamp(0.8rem, 1.4vw, 1.2rem);
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.countdown-votacion strong {
  margin-top: 0.2rem;
  font-size: clamp(4rem, 12vw, 9rem);
  line-height: 0.9;
  text-shadow: 0 0 32px rgba(56, 189, 248, 0.45);
}

.paneles-publicos {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(0.8rem, 1.4vw, 1.3rem);
}

@keyframes pulso {
  70% {
    box-shadow: 0 0 0 1.2rem rgba(56, 189, 248, 0);
  }
}

@media (max-width: 900px) {
  .contenido-recinto {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .escenario-bancas {
    min-height: 620px;
  }

  .paneles-publicos {
    display: grid;
    grid-template-columns: minmax(220px, 0.4fr) minmax(320px, 1fr);
    min-height: 260px;
  }
}

@media (max-width: 620px) {
  .contexto-sesion,
  .autoridades {
    align-items: flex-start;
    flex-direction: column;
    text-align: left;
  }

  .paneles-publicos {
    display: flex;
  }
}
</style>
