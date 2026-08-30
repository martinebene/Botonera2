<script setup lang="ts">
/** Presenta en una franja compacta los tres valores autoritativos de EstadoQuorum. */

import type { EstadoQuorum } from '@botonera2/api-client'

defineProps<{ quorum: EstadoQuorum | null }>()
</script>

<template>
  <div data-testid="panel-quorum" class="panel-quorum" :class="{ alcanzado: quorum?.alcanzado }">
    <template v-if="quorum">
      <span class="rotulo-panel">Quórum</span>
      <strong data-testid="cantidad-presentes">{{ quorum.cantidad_presentes }}</strong>
      <span>presentes · requerido {{ quorum.requerido }}</span>
      <b data-testid="estado-quorum">
        {{ quorum.alcanzado ? 'Quórum alcanzado' : 'Sin quórum' }}
      </b>
    </template>
    <span v-else class="estado-neutro">Quórum sin información</span>
  </div>
</template>

<style scoped>
.panel-quorum {
  display: flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.38rem 0.58rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.78);
  font-size: clamp(0.58rem, 0.72vw, 0.7rem);
  white-space: nowrap;
}

.rotulo-panel {
  color: #94a3b8;
  font-size: 0.6rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.panel-quorum > strong {
  color: #fbbf24;
  font-size: clamp(1rem, 1.6vw, 1.35rem);
  line-height: 1;
}

.panel-quorum > b {
  padding: 0.22rem 0.42rem;
  border-radius: 999px;
  color: #fde68a;
  background: rgba(120, 53, 15, 0.62);
  font-size: 0.58rem;
  font-weight: 900;
  text-transform: uppercase;
}

.alcanzado > strong {
  color: #34d399;
}

.alcanzado > b {
  color: #a7f3d0;
  background: rgba(6, 78, 59, 0.7);
}

.estado-neutro {
  color: #64748b;
}
</style>
