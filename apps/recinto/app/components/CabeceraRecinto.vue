<script setup lang="ts">
/** Cabecera institucional permanente y estado técnico discreto del canal SSE. */

import { computed } from 'vue'
import type { EstadoConexionRecinto } from '../composables/useEstadoRecinto'

const props = defineProps<{
  estadoConexion: EstadoConexionRecinto
  desactualizado: boolean
}>()

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
  <header class="cabecera-recinto">
    <div class="marca-institucional">
      <span class="marca-sigla" aria-hidden="true">CD</span>
      <div>
        <p>Concejo Deliberante</p>
        <h1>Puerto Madryn</h1>
      </div>
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
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem clamp(1rem, 2.2vw, 2.5rem);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(7, 17, 31, 0.94);
}

.marca-institucional {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.marca-sigla {
  display: grid;
  place-items: center;
  width: 46px;
  aspect-ratio: 1;
  border: 1px solid #38bdf8;
  border-radius: 50%;
  color: #7dd3fc;
  font-weight: 900;
  letter-spacing: -0.08em;
}

.marca-institucional p {
  margin: 0 0 0.1rem;
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.marca-institucional h1 {
  margin: 0;
  font-size: clamp(1.05rem, 2vw, 1.5rem);
  line-height: 1;
}

.estado-conexion {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  max-width: 45vw;
  padding: 0.45rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.7);
  font-size: clamp(0.68rem, 1vw, 0.82rem);
  font-weight: 700;
}

.punto-conexion {
  width: 0.55rem;
  height: 0.55rem;
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
</style>
