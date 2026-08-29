<script setup lang="ts">
/**
 * Panel de Recinto y Palabra (Cuadrante 3 de Moderación).
 *
 * Responsabilidades:
 * 1. Disponer las bancas del recinto según la configuración de filas (filas_bancas) y padrón activo.
 * 2. Reflejar presencia física y test temporal de teclado en modo solo lectura.
 * 3. Integrar los controles autoritativos de palabra y el flujo de remapeo físico.
 *
 * Quórum (WP-036): este cuadrante ya no presenta el resumen global de quórum ni el conteo
 * de presentes. Ese dato es único y global, y vive exclusivamente en la cabecera compacta,
 * de modo que no se repita en dos lugares que podrían llegar a divergir visualmente.
 * La presencia individual de cada concejal se sigue viendo en su propia banca.
 *
 * Invariantes respetados:
 * - NO incluye controles de presencia manual ni atajos de teclado para marcar presencia.
 * - NO modifica localmente quórum ni presencia ante tests de teclado.
 * - Resuelve imágenes exclusivamente desde ruta_imagen sin hardcodeo de nombres de archivo.
 */

import {
  crearClienteModeracion,
  type ClienteModeracion,
  type EstadoModeracion,
} from '@botonera2/api-client'
import PanelContenedor from './PanelContenedor.vue'
import GrillaRecinto from './GrillaRecinto.vue'
import GestionPalabra from './GestionPalabra.vue'
import GestionRemapeo from './GestionRemapeo.vue'

const props = defineProps<{
  /** Estado autoritativo de moderación recibido desde el backend */
  estado: EstadoModeracion | null
  /** Cliente compartido por la aplicación; la inyección mantiene tests deterministas. */
  cliente?: ClienteModeracion
  /** Solo una conexión confirmada habilita los comandos del cuadrante. */
  conectado?: boolean
}>()

// El fallback permite renderizar el componente aislado en SSR sin abrir una
// suscripción ni duplicar la frontera de sincronización de la aplicación.
const clienteEfectivo = props.cliente ?? crearClienteModeracion()
</script>

<template>
  <PanelContenedor
    titulo="Recinto y palabra"
    subtitulo="Bancas, palabra y coordinación de dispositivos"
    data-testid="panel-recinto-palabra"
  >
    <div class="space-y-3 text-sm text-slate-300">
      <!-- Cola/orador y comandos: toda transición llega luego desde REST/SSE. -->
      <GestionPalabra :estado="estado" :cliente="clienteEfectivo" :conectado="conectado ?? false" />

      <!-- Flujo físico coordinado por FastAPI, nunca por acceso directo al bridge. -->
      <GestionRemapeo
        v-if="estado && estado.estado_global !== 'SIN_PREPARAR'"
        :estado="estado"
        :cliente="clienteEfectivo"
        :conectado="conectado ?? false"
      />

      <!-- Mapa y disposición de bancas del recinto -->
      <div
        v-if="estado && estado.concejales && estado.concejales.length > 0"
        class="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5"
      >
        <div
          class="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2 px-1 text-xs"
        >
          <span class="font-bold text-slate-300 uppercase tracking-wider text-[11px]"
            >Distribución de bancas</span
          >
          <span class="text-[11px] text-slate-400 font-mono"
            >Solo lectura · Acreditación física</span
          >
        </div>
        <GrillaRecinto
          :concejales="estado.concejales"
          :filas-bancas="estado.configuracion?.filas_bancas"
        />
      </div>

      <!-- Estado inicial mientras no hay datos -->
      <div
        v-if="!estado"
        class="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg"
      >
        Conectando y esperando estado autoritativo del backend...
      </div>
    </div>
  </PanelContenedor>
</template>
