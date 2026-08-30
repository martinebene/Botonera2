<script setup lang="ts">
/**
 * Cabecera pública compacta de tres zonas.
 *
 * El reloj y la duración son presentación local. La apertura formal y el
 * contexto de sesión continúan llegando exclusivamente en EstadoRecinto.
 */

import { computed } from 'vue'
import type { EstadoRecinto } from '@botonera2/api-client'
import type { EstadoConexionRecinto } from '../composables/useEstadoRecinto'
import { useRelojLocal } from '../composables/useRelojLocal'
import { calcularTiempoSesion, formatearFechaHoraLocal } from '../utils/tiempo'

const props = defineProps<{
  /** Snapshot público vigente, usado solo para el contexto central. */
  estado: EstadoRecinto | null
  estadoConexion: EstadoConexionRecinto
  desactualizado: boolean
}>()

const { ahora } = useRelojLocal()
const fechaHoraLocal = computed(() => formatearFechaHoraLocal(ahora.value))
const sesionAbierta = computed(() => props.estado?.estado_global === 'SESION_ABIERTA')
const tiempoSesion = computed(() =>
  calcularTiempoSesion(
    sesionAbierta.value ? (props.estado?.sesion?.fecha_hora_apertura ?? null) : null,
    ahora.value,
  ),
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

    <div data-testid="cabecera-contexto" class="marca-institucional">
      <h1>Concejo Deliberante de Puerto Madryn</h1>
      <p>
        <span data-testid="cabecera-sesion">{{ contextoCentral }}</span>
        <span v-if="tiempoSesion" data-testid="cabecera-tiempo-sesion" class="tiempo-sesion">
          · {{ tiempoSesion }}
        </span>
      </p>
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
.cabecera-recinto {
  min-height: 54px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  padding: 0.45rem clamp(0.75rem, 1.4vw, 1.4rem);
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

.marca-institucional {
  min-width: 0;
  text-align: center;
}

.marca-institucional h1 {
  margin: 0;
  overflow: hidden;
  font-size: clamp(0.82rem, 1.4vw, 1.15rem);
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.marca-institucional p {
  margin: 0.16rem 0 0;
  color: #7dd3fc;
  font-size: clamp(0.62rem, 0.82vw, 0.76rem);
  font-weight: 800;
}

.tiempo-sesion {
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.estado-conexion {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  gap: 0.5rem;
  max-width: 45vw;
  padding: 0.32rem 0.62rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.7);
  font-size: clamp(0.64rem, 0.85vw, 0.76rem);
  font-weight: 700;
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

@media (max-width: 720px) {
  .cabecera-recinto {
    grid-template-columns: 1fr auto;
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
