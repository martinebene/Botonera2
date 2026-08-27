<script setup lang="ts">
/** Presenta los tres valores autoritativos de EstadoQuorum sin recalcularlos. */

import type { EstadoQuorum } from '@botonera2/api-client'

defineProps<{ quorum: EstadoQuorum | null }>()
</script>

<template>
  <section data-testid="panel-quorum" class="panel-lateral panel-quorum">
    <p class="rotulo-panel">Quórum</p>
    <div v-if="quorum" class="datos-quorum" :class="{ alcanzado: quorum.alcanzado }">
      <strong data-testid="cantidad-presentes">{{ quorum.cantidad_presentes }}</strong>
      <span>presentes</span>
      <p>
        Requerido: <b>{{ quorum.requerido }}</b>
      </p>
      <div data-testid="estado-quorum" class="estado-quorum">
        {{ quorum.alcanzado ? 'Quórum alcanzado' : 'Sin quórum' }}
      </div>
    </div>
    <p v-else class="estado-neutro">Sin información de quórum</p>
  </section>
</template>

<style scoped>
.panel-lateral {
  padding: clamp(0.85rem, 1.4vw, 1.25rem);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.78);
}

.rotulo-panel {
  margin: 0 0 0.6rem;
  color: #94a3b8;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.datos-quorum strong {
  color: #fbbf24;
  font-size: clamp(2rem, 4vw, 3.7rem);
  line-height: 0.9;
}

.datos-quorum > span {
  margin-left: 0.45rem;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.datos-quorum p {
  margin: 0.7rem 0;
  color: #94a3b8;
  font-size: 0.78rem;
}

.estado-quorum {
  padding: 0.55rem;
  border-radius: 10px;
  color: #fde68a;
  background: rgba(120, 53, 15, 0.62);
  text-align: center;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}

.alcanzado strong {
  color: #34d399;
}

.alcanzado .estado-quorum {
  color: #a7f3d0;
  background: rgba(6, 78, 59, 0.7);
}

.estado-neutro {
  margin: 0;
  color: #64748b;
  font-size: 0.8rem;
}
</style>
