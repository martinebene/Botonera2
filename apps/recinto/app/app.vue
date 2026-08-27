<script setup lang="ts">
/** Conecta la vista pública con la única frontera REST + SSE autorizada. */

import PantallaRecinto from './components/PantallaRecinto.vue'
import { useEstadoRecinto } from './composables/useEstadoRecinto'

const { estado, estadoConexion, desactualizado } = useEstadoRecinto()
</script>

<template>
  <PantallaRecinto
    :estado="estado"
    :estado-conexion="estadoConexion"
    :desactualizado="desactualizado"
  />
</template>
