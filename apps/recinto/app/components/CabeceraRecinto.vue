<script setup lang="ts">
/**
 * Cabecera pública de una sola línea (WP-050).
 *
 * Mantiene las tres zonas probadas en producción —fecha/hora a la izquierda,
 * información institucional al centro y conexión a la derecha— pero condensa
 * todo el contexto central en un único renglón. Antes ocupaba tres renglones
 * (título, sesión + duración y autoridades), lo que robaba altura a las bancas
 * y dejaba un renglón vacío cuando no había autoridades cargadas.
 *
 * El reloj y la duración siguen siendo presentación local. La apertura formal y
 * el contexto de sesión continúan llegando exclusivamente en EstadoRecinto.
 */

import { computed, toRef } from 'vue'
import type { EstadoRecinto } from '@botonera2/api-client'
import type { EstadoConexionRecinto } from '../composables/useEstadoRecinto'
import { useRelojLocal } from '../composables/useRelojLocal'
import { formatearFechaHoraLocal } from '../utils/tiempo'

const props = defineProps<{
  /** Snapshot público vigente, usado solo para el contexto central. */
  estado: EstadoRecinto | null
  estadoConexion: EstadoConexionRecinto
  desactualizado: boolean
}>()

const { ahora, tiempoSesion } = useRelojLocal(toRef(props, 'estado'))
const fechaHoraLocal = computed(() => formatearFechaHoraLocal(ahora.value))
const sesionAbierta = computed(() => props.estado?.estado_global === 'SESION_ABIERTA')
const contextoInstitucional = computed(
  () => props.estado?.sesion ?? props.estado?.preparacion ?? null,
)

const contextoCentral = computed(() => {
  if (sesionAbierta.value && props.estado?.sesion) {
    return `Sesión N.º ${props.estado.sesion.numero_sesion}`
  }
  if (props.estado?.estado_global === 'PREPARANDO') {
    return props.estado.preparacion?.numero_sesion
      ? `Preparando sesión N.º ${props.estado.preparacion.numero_sesion}`
      : 'Sala en preparación'
  }
  return 'Sala sin preparar'
})

const textoAutoridades = computed(() => {
  const contexto = contextoInstitucional.value
  if (!contexto) return ''
  return [
    contexto.presidencia ? `Presidencia: ${contexto.presidencia}` : '',
    contexto.secretaria_legislativa ? `Secretaría: ${contexto.secretaria_legislativa}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

const textoConexion = computed(() => {
  if (props.desactualizado) return 'Reconectando · vista desactualizada'
  const textos: Record<EstadoConexionRecinto, string> = {
    INICIAL: 'Conectando',
    CONECTADO: 'En línea',
    RECONECTANDO: 'Reconectando',
    DESCONECTADO: 'Sin conexión',
  }
  return textos[props.estadoConexion]
})
</script>

<template>
  <header data-testid="cabecera-recinto" class="cabecera-recinto">
    <time data-testid="cabecera-fecha-hora" class="fecha-hora-local">
      {{ fechaHoraLocal }}
    </time>

    <!--
      Renglón único: cada dato es un elemento en línea del mismo flex. Los
      separadores `·` los dibuja CSS (`::before`), no el texto, para que las
      pruebas y los lectores de pantalla sigan leyendo cada dato limpio.

      Los datos ausentes directamente no se renderizan: ya no queda un renglón
      reservado con un espacio duro cuando faltan autoridades.
    -->
    <div data-testid="cabecera-contexto" class="marca-institucional">
      <h1 class="titulo-institucional">Concejo Deliberante de Puerto Madryn</h1>
      <span data-testid="cabecera-sesion" class="dato-cabecera">{{ contextoCentral }}</span>
      <span
        v-if="tiempoSesion"
        data-testid="cabecera-tiempo-sesion"
        class="dato-cabecera tiempo-sesion"
      >
        {{ tiempoSesion }}
      </span>
      <span
        v-if="textoAutoridades"
        data-testid="cabecera-autoridades"
        class="autoridades-cabecera"
        :title="textoAutoridades"
      >
        {{ textoAutoridades }}
      </span>
    </div>

    <div
      data-testid="estado-conexion"
      class="estado-conexion"
      :class="`conexion-${estadoConexion.toLowerCase()}`"
      role="status"
    >
      <span class="punto-conexion" aria-hidden="true" />
      {{ textoConexion }}
    </div>
  </header>
</template>

<style scoped>
/*
  Altura fija y baja, calibrada contra la `topbar` histórica medida en Chromium:
  59 px en 1920×1080 y 47 px en 1366×768. Al ser fija, ningún texto variable
  puede empujar hacia abajo la franja de votación ni el escenario de bancas.
*/
.cabecera-recinto {
  height: clamp(47px, 5.5vh, 60px);
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  padding: 0.35rem clamp(0.75rem, 1.4vw, 1.4rem);
  overflow: hidden;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(7, 17, 31, 0.94);
}

.fecha-hora-local {
  justify-self: start;
  color: #cbd5e1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: clamp(0.68rem, 0.9vw, 0.82rem);
  font-weight: 700;
  white-space: nowrap;
}

/*
  `min-width: 0` es lo que permite que esta columna `auto` se achique en vez de
  aplastar el reloj o la conexión cuando el texto central es largo.
*/
.marca-institucional {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  overflow: hidden;
  white-space: nowrap;
}

/* Separador tipográfico entre datos, idéntico al de producción. */
.marca-institucional > :not(:first-child)::before {
  margin: 0 0.42em;
  color: #475569;
  content: '·';
}

.titulo-institucional {
  min-width: 0;
  flex: 0 1 auto;
  margin: 0;
  overflow: hidden;
  font-size: clamp(0.82rem, 1.4vw, 1.15rem);
  line-height: 1;
  text-overflow: ellipsis;
}

.dato-cabecera {
  flex: 0 0 auto;
  color: #7dd3fc;
  font-size: clamp(0.68rem, 0.95vw, 0.9rem);
  font-weight: 800;
  line-height: 1;
}

.tiempo-sesion {
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/*
  Las autoridades son el dato secundario: se recortan primero (`flex-shrink`
  alto) y nunca pueden generar una segunda fila porque el contenedor es una
  línea `nowrap` de altura fija.
*/
.autoridades-cabecera {
  max-width: min(28vw, 26rem);
  min-width: 0;
  flex: 0 4 auto;
  overflow: hidden;
  color: #94a3b8;
  font-size: clamp(0.56rem, 0.72vw, 0.72rem);
  font-weight: 700;
  line-height: 1;
  text-overflow: ellipsis;
}

.estado-conexion {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  gap: 0.5rem;
  max-width: 45vw;
  padding: 0.28rem 0.6rem;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.7);
  font-size: clamp(0.64rem, 0.85vw, 0.76rem);
  font-weight: 700;
  white-space: nowrap;
}

.punto-conexion {
  width: 0.5rem;
  height: 0.5rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #64748b;
}

.conexion-conectado .punto-conexion {
  background: #34d399;
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.13);
}

.conexion-reconectando .punto-conexion,
.conexion-desconectado .punto-conexion {
  background: #fbbf24;
}

/*
  Adaptación defensiva fuera de las resoluciones canónicas: por debajo de
  720 px el renglón único no entra, así que la marca pasa a su propia fila y la
  cabecera deja de tener altura fija para no recortar información.
*/
@media (max-width: 720px) {
  .cabecera-recinto {
    height: auto;
    grid-template-columns: 1fr auto;
    row-gap: 0.25rem;
    padding-block: 0.4rem;
  }

  .marca-institucional {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .fecha-hora-local,
  .estado-conexion {
    grid-row: 2;
  }
}
</style>
