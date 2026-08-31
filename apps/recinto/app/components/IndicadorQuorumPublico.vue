<script setup lang="ts">
/** Presenta el quórum grande de la franja superior sin recalcularlo. */

import type { EstadoQuorum } from '@botonera2/api-client'

defineProps<{ quorum: EstadoQuorum | null }>()
</script>

<template>
  <div data-testid="panel-quorum" class="panel-quorum" :class="{ alcanzado: quorum?.alcanzado }">
    <template v-if="quorum">
      <span class="rotulo-panel">Quórum</span>
      <strong data-testid="cantidad-presentes">{{ quorum.cantidad_presentes }}</strong>
      <span class="detalle-quorum">Presentes · requiere {{ quorum.requerido }}</span>
      <b data-testid="estado-quorum">
        {{ quorum.alcanzado ? 'Quórum alcanzado' : 'Sin quórum' }}
      </b>
    </template>
    <span v-else class="estado-neutro">Quórum sin información</span>
  </div>
</template>

<style scoped>
.panel-quorum {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  align-items: center;
  justify-items: center;
  gap: 0.1rem;
  padding: clamp(0.42rem, 0.7vw, 0.7rem);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 14px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.78);
  text-align: center;
  white-space: nowrap;
}

.rotulo-panel {
  color: #94a3b8;
  font-size: clamp(0.58rem, 0.85vw, 0.78rem);
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.panel-quorum > strong {
  color: #fbbf24;
  font-size: clamp(2.8rem, 7.5vh, 5.2rem);
  line-height: 0.9;
}

.panel-quorum > b {
  max-width: 100%;
  padding: 0.18rem 0.42rem;
  overflow: hidden;
  border-radius: 999px;
  color: #fde68a;
  background: rgba(120, 53, 15, 0.62);
  font-size: 0.58rem;
  font-weight: 900;
  text-transform: uppercase;
}

.detalle-quorum {
  max-width: 100%;
  overflow: hidden;
  color: #cbd5e1;
  font-size: clamp(0.56rem, 0.78vw, 0.72rem);
  font-weight: 700;
  text-overflow: ellipsis;
}

.alcanzado > strong {
  color: #34d399;
}

.alcanzado > b {
  color: #a7f3d0;
  background: rgba(6, 78, 59, 0.7);
}

.estado-neutro {
  align-self: center;
  grid-row: 1 / -1;
  color: #64748b;
}
</style>
