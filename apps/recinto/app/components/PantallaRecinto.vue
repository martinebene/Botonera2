<script setup lang="ts">
/**
 * Vista pública compacta; representa sus props y nunca emite comandos.
 *
 * WP-056 suma el plano técnico sin alterar la geometría validada en WP-054:
 *
 * - la columna derecha se divide verticalmente en 1/5 para el indicador de transmisión
 *   y 4/5 para los pedidos de palabra. Las dos porciones son fracciones de grilla, no
 *   alturas en píxeles, así que la proporción se conserva en cualquier resolución;
 * - un aviso dirigido al Recinto reemplaza **toda** la franja superior de
 *   votación/tema/estado, sin tocar la cabecera, las bancas ni la columna derecha;
 * - al vencer o cancelarse el aviso, el backend republica y la franja original vuelve
 *   sola. La pantalla no guarda ni restaura nada por su cuenta.
 */

import { computed, toRefs } from 'vue'
import type { EstadoRecinto } from '@botonera2/api-client'
import { usePresentacionTecnica } from '@botonera2/frontend-shared'
import AvisoSuperficie from '@botonera2/frontend-shared/componentes/AvisoSuperficie.vue'
import type { EstadoConexionRecinto } from '../composables/useEstadoRecinto'
import { usePresentacionVotacion } from '../composables/usePresentacionVotacion'
import BloqueTransmisionPublico from './BloqueTransmisionPublico.vue'
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

const sesionAbierta = computed(() => estado.value?.estado_global === 'SESION_ABIERTA')
const bancaOrador = computed(() => estado.value?.palabra?.orador?.banca ?? null)
const { votacion: votacionPresentada, segundosCuentaRegresiva } = usePresentacionVotacion(estado)
const estadoRecepcionVotacion = computed(() => votacionPresentada.value?.estado_recepcion ?? null)
/**
 * Participación sin sentido (WP-045).
 *
 * El backend garantiza que solo viene poblada mientras la recepción está
 * `EN_CURSO`; la pantalla se limita a transportarla hasta cada banca.
 */
const bancasVotoEmitido = computed(() => votacionPresentada.value?.bancas_voto_emitido ?? null)

/**
 * Total de bancas del padrón activo, denominador del indicador de quórum.
 *
 * Sale del propio snapshot público: `concejales` ya contiene exactamente las
 * bancas de la preparación vigente. No hizo falta agregar un campo al contrato
 * ni consultar otra fuente para mostrar `presentes/total` (WP-054).
 */
const totalConcejales = computed(() => estado.value?.concejales.length ?? 0)
const votosIndividualesVisibles = computed(() => {
  const votacion = votacionPresentada.value
  if (votacion?.estado_recepcion === 'EN_CURSO') return null
  return votacion?.votos_individuales ?? null
})

/**
 * Porción técnica del snapshot público.
 *
 * `EstadoRecinto.tecnico.aviso` sólo puede traer un aviso dirigido a RECINTO o a AMBOS:
 * el backend separa las ranuras por destino, de modo que un aviso publicado únicamente
 * hacia Moderación jamás viaja en este payload. La pantalla pública no vuelve a filtrar.
 */
const transmision = computed(() => estado.value?.tecnico?.transmision ?? null)
const avisoTecnico = computed(() => estado.value?.tecnico?.aviso ?? null)

const { segundosTransmision } = usePresentacionTecnica(
  computed(() => ({
    transmision: transmision.value,
    // El Recinto no cronometra el aviso: su desaparición la publica el backend. Pasar la
    // lista vacía mantiene el reloj local apagado cuando no hay transmisión en cuenta.
    avisos: [],
    generadoEn: estado.value?.generado_en ?? null,
  })),
)
</script>

<template>
  <div class="aplicacion-recinto">
    <CabeceraRecinto
      :estado="estado"
      :estado-conexion="estadoConexion"
      :desactualizado="desactualizado"
    />

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
      <!--
        Primera franja de la grilla. Su alto lo fija `grid-template-rows` y está
        reservado incluso sin votación, por lo que ningún texto variable puede desplazar
        las bancas. Mientras hay un aviso de Apoyo Técnico dirigido al Recinto, esa misma
        celda la ocupa el aviso: es un reemplazo real (`v-if`/`v-else`) y no una capa
        superpuesta, de modo que la franja original no queda por detrás ocupando espacio.
      -->
      <AvisoSuperficie
        v-if="avisoTecnico"
        :texto="avisoTecnico.texto"
        data-testid="aviso-tecnico-recinto"
        rotulo="Aviso de Apoyo Técnico"
      />
      <!--
        Franja normal: tres renglones de votación a la izquierda y quórum grande a la
        derecha, con la relación espacial probada en producción.
      -->
      <section v-else data-testid="franja-votacion-quorum" class="franja-votacion-quorum">
        <PanelVotacionPublica :votacion="votacionPresentada" />
        <IndicadorQuorumPublico :quorum="estado.quorum" :total="totalConcejales" />
      </section>

      <div data-testid="zona-principal-recinto" class="zona-principal-recinto">
        <section data-testid="area-bancas-publica" class="escenario-bancas">
          <div class="envoltura-grilla">
            <GrillaBancas
              :filas-bancas="estado.filas_bancas"
              :concejales="estado.concejales"
              :banca-orador="bancaOrador"
              :estado-recepcion="estadoRecepcionVotacion"
              :bancas-voto-emitido="bancasVotoEmitido"
              :votos-individuales="votosIndividualesVisibles"
            />
            <div
              v-if="segundosCuentaRegresiva !== null"
              data-testid="countdown-votacion"
              class="countdown-votacion"
              role="status"
              aria-live="polite"
            >
              <!--
                La cuenta regresiva acompaña a una votación que ya está
                `EN_CURSO`: es el tiempo que resta para votar, no una espera
                previa. El rótulo anterior (`Comienza en`) sugería lo contrario
                y HUMAN_GATE lo corrigió en WP-054.
              -->
              <span>Votación en curso</span>
              <strong>{{ segundosCuentaRegresiva }}</strong>
            </div>
          </div>
        </section>

        <aside data-testid="columna-palabra-publica" class="columna-palabra-publica">
          <BloqueTransmisionPublico
            :transmision="transmision"
            :segundos-restantes="segundosTransmision"
          />
          <PanelPalabraPublico :palabra="estado.palabra" />
        </aside>
      </div>
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
  margin: 0 0 0.16rem;
  color: #38bdf8;
  font-size: clamp(0.52rem, 0.68vw, 0.65rem);
  font-weight: 900;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

/*
  Dos filas, no tres (WP-050).

  La franja inferior de eventos dejó de dibujarse, así que su altura completa
  —hasta 144 px en Full HD— pasa a la zona principal. La primera fila conserva
  su alto reservado incluso sin votación: es lo que impide que un tema largo o
  un cambio de estado desplacen las bancas.
*/
.contenido-recinto {
  min-height: 0;
  display: grid;
  grid-template-rows:
    clamp(118px, 16vh, 172px)
    minmax(0, 1fr);
  flex: 1;
  gap: clamp(0.45rem, 0.75vw, 0.75rem);
  padding: clamp(0.45rem, 0.75vw, 0.75rem);
  overflow: hidden;
}

/*
  Ancho de quórum calibrado contra producción: allí la caja mide 220 px en
  1920×1080 y 164 px en 1366×768 (≈12 % del ancho). El `clamp` reproduce esas
  dos medidas y devuelve al renglón del tema el ancho que sobraba.
*/
.franja-votacion-quorum {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(150px, 12vw, 224px);
  gap: clamp(0.45rem, 0.7vw, 0.7rem);
  overflow: hidden;
}

/*
  Palabra a la derecha con el mismo ancho relativo que producción
  (`flex: 0 0 20vw`): 384 px en 1920×1080 y 273 px en 1366×768. El resto del
  ancho queda para las bancas, que siguen siendo la superficie dominante.
*/
.zona-principal-recinto {
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(230px, 20vw, 384px);
  gap: clamp(0.5rem, 0.8vw, 0.8rem);
  overflow: hidden;
}

.escenario-bancas {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: clamp(0.55rem, 0.8vw, 0.8rem);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(7, 17, 31, 0.58);
}

.contenido-preparando .escenario-bancas {
  border-color: rgba(251, 191, 36, 0.32);
}

.envoltura-grilla {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex: 1;
  overflow: hidden;
}

.countdown-votacion {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-content: center;
  justify-items: center;
  border: 1px solid rgba(125, 211, 252, 0.5);
  border-radius: 16px;
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

/*
  División vertical acordada por HUMAN_GATE (WP-056): un quinto superior para el
  indicador de transmisión y cuatro quintos inferiores para los pedidos de palabra.

  Se expresa con fracciones (`1fr` sobre `4fr`) y no con alturas fijas para que la
  proporción se mantenga igual a 1366×768 y a 1920×1080. `minmax(0, …)` es lo que
  permite que ambos hijos recorten su propio contenido en lugar de crecer y empujar la
  columna, que es la condición para que la lista de pedidos no gane scroll horizontal.
*/
.columna-palabra-publica {
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 4fr);
  gap: clamp(0.35rem, 0.6vw, 0.6rem);
  overflow: hidden;
}

@keyframes pulso {
  70% {
    box-shadow: 0 0 0 1.2rem rgba(56, 189, 248, 0);
  }
}

@media (max-width: 900px) {
  .contenido-recinto {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .franja-votacion-quorum {
    min-height: 250px;
    grid-template-columns: 1fr;
  }

  .zona-principal-recinto {
    min-height: 620px;
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .columna-palabra-publica {
    min-height: 260px;
    /* Debajo de 900 px la columna se apila y la proporción 1/5 dejaría el indicador
       ilegible, así que el bloque de transmisión toma el alto que necesita. */
    grid-template-rows: auto minmax(0, 1fr);
  }
}
</style>
