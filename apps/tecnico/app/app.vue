<script setup lang="ts">
/**
 * Shell de la SPA de Apoyo Técnico (WP-056, redistribuido por WP-059).
 *
 * Responsabilidades:
 * 1. Abrir las dos suscripciones autoritativas (plano técnico y Moderación para remapeo).
 * 2. Alimentar la cabecera con conexión, estado global y estado de transmisión.
 * 3. Disponer los cinco bloques operativos en una grilla que entra completa a 1366×768 y
 *    a 1920×1080, sin scroll de página.
 * 4. Conectar la biblioteca de mensajes con el formulario de avisos, de modo que elegir
 *    un preset lo precargue sin publicarlo.
 *
 * Sobre el dimensionado: el shell no fija alturas en píxeles. La altura total la aporta
 * `h-dvh`, el reparto lo resuelven Flexbox y CSS Grid con fracciones, y cada panel
 * confina su desborde a su propio cuerpo.
 *
 * La distribución de escritorio la cerró HUMAN_GATE en WP-059 y es la siguiente:
 *
 * ```text
 * ┌───────────────┬───────────────┬───────────────┬───────────────────┐
 * │  Transmisión  │    Remapeo    │   Mensajes    │                   │
 * ├───────────────┴───────────────┴───────────────┤      Eventos      │
 * │                    Avisos                     │                   │
 * └───────────────────────────────────────────────┴───────────────────┘
 * ```
 *
 * Son cuatro columnas visuales, pero **no** cuatro columnas iguales: las tres de la
 * izquierda comparten dos tercios del ancho (2fr cada una) y Eventos conserva el tercio
 * restante (3fr sobre un total de 9fr), que es aproximadamente el mismo ancho que tenía
 * antes. Eventos ocupa además las dos filas: es la única lista que crece sola y necesita
 * todo el alto útil.
 *
 * Las dos filas se reparten con fracciones y no con alturas fijas —9fr arriba y 11fr
 * abajo— porque Avisos es la superficie de trabajo grande del puesto: debe poder
 * redactarse un aviso largo sin que el panel gane scroll, y el textarea crece para ocupar
 * lo que sobra. La proporción está elegida para que a 1366×768 los tres paneles
 * superiores sigan enteros y a 1920×1080 sobre espacio en ambas filas.
 *
 * Por debajo del breakpoint `lg` la grilla se apila en una sola columna y recupera scroll
 * defensivo, que es la misma estrategia adaptable que ya usa Moderación.
 */

import { computed, shallowRef } from 'vue'
import { usePresentacionTecnica } from '@botonera2/frontend-shared'
import GestionRemapeo from '@botonera2/frontend-shared/componentes/GestionRemapeo.vue'
import type { DestinoAvisoTecnico } from '@botonera2/api-client'
import { useEstadoTecnico } from './composables/useEstadoTecnico'
import CabeceraTecnico from './components/CabeceraTecnico.vue'
import PanelTecnico from './components/PanelTecnico.vue'
import ControlTransmision from './components/ControlTransmision.vue'
import ControlAvisos from './components/ControlAvisos.vue'
import BibliotecaMensajes from './components/BibliotecaMensajes.vue'
import ListaEventosTecnicos from './components/ListaEventosTecnicos.vue'

const {
  estado,
  estadoModeracion,
  estadoConexion,
  revision,
  conectado,
  desactualizado,
  cliente,
  clienteModeracion,
} = useEstadoTecnico()

const transmision = computed(() => estado.value?.transmision ?? null)
const avisoModeracion = computed(() => estado.value?.aviso_moderacion ?? null)
const avisoRecinto = computed(() => estado.value?.aviso_recinto ?? null)
const biblioteca = computed(() => estado.value?.biblioteca ?? null)
const eventos = computed(() => estado.value?.eventos_recientes ?? [])

const { segundosTransmision, segundosRestantesAviso } = usePresentacionTecnica(
  computed(() => ({
    transmision: transmision.value,
    avisos: [avisoModeracion.value, avisoRecinto.value],
    generadoEn: estado.value?.generado_en ?? null,
  })),
)

/**
 * Borrador precargado desde la biblioteca.
 *
 * Se pasa como prop y no se publica: `ControlAvisos` decide cuándo adoptarlo. La copia
 * lleva una marca incremental para que volver a elegir el mismo preset también vuelva a
 * precargar el formulario, aunque el texto y el destino sean idénticos.
 */
const borradorSeleccionado = shallowRef<{
  texto: string
  destino: DestinoAvisoTecnico
  marca: number
} | null>(null)
let marcaBorrador = 0

function seleccionarBorrador(mensaje: { texto: string; destino: DestinoAvisoTecnico }): void {
  marcaBorrador += 1
  borradorSeleccionado.value = { ...mensaje, marca: marcaBorrador }
}
</script>

<template>
  <div
    class="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-slate-950 text-slate-100 antialiased"
  >
    <CabeceraTecnico
      :estado-conexion="estadoConexion"
      :estado-global="estado?.estado_global ?? null"
      :revision="revision"
      :desactualizado="desactualizado"
      :estado-transmision="transmision?.estado ?? null"
    />

    <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2">
      <div
        data-testid="grilla-tecnica"
        class="grid min-h-0 min-w-0 flex-1 auto-rows-[minmax(45dvh,auto)] grid-cols-1 gap-2 overflow-y-auto lg:auto-rows-auto lg:grid-cols-[repeat(3,minmax(0,2fr))_minmax(0,3fr)] lg:grid-rows-[minmax(0,9fr)_minmax(0,11fr)] lg:overflow-hidden"
      >
        <PanelTecnico
          titulo="Transmisión"
          subtitulo="Indicador institucional; no controla la señal audiovisual"
          data-testid="panel-transmision"
          class="lg:col-start-1 lg:row-start-1"
        >
          <ControlTransmision
            :transmision="transmision"
            :segundos-restantes="segundosTransmision"
            :cliente="cliente"
            :conectado="conectado"
          />
        </PanelTecnico>

        <PanelTecnico
          titulo="Remapeo de dispositivos"
          subtitulo="Misma operación y capacidades que Moderación"
          data-testid="panel-remapeo-tecnico"
          class="lg:col-start-2 lg:row-start-1"
        >
          <GestionRemapeo
            :estado="estadoModeracion"
            :cliente="clienteModeracion"
            :conectado="conectado"
          />
        </PanelTecnico>

        <!--
          Único panel de los dos tercios izquierdos autorizado a tener scroll interno
          permanente: la biblioteca es una lista que crece con el uso y no puede recortarse.
        -->
        <PanelTecnico
          titulo="Mensajes precargados"
          subtitulo="Persistidos por el backend en CSV"
          data-testid="panel-biblioteca"
          class="lg:col-start-3 lg:row-start-1"
        >
          <BibliotecaMensajes
            :biblioteca="biblioteca"
            :cliente="cliente"
            :conectado="conectado"
            @cargar="seleccionarBorrador"
          />
        </PanelTecnico>

        <!-- Avisos toma la fila inferior completa de las tres columnas izquierdas. -->
        <PanelTecnico
          titulo="Avisos"
          subtitulo="Reemplazan temporalmente una superficie de Moderación o del Recinto"
          data-testid="panel-avisos"
          class="lg:col-span-3 lg:col-start-1 lg:row-start-2"
        >
          <ControlAvisos
            :aviso-moderacion="avisoModeracion"
            :aviso-recinto="avisoRecinto"
            :cliente="cliente"
            :conectado="conectado"
            :borrador="borradorSeleccionado"
            :segundos-restantes="segundosRestantesAviso"
          />
        </PanelTecnico>

        <!-- Eventos ocupa la columna derecha completa: es la única lista que crece sola. -->
        <PanelTecnico
          titulo="Eventos"
          subtitulo="Misma franja segura que ve Moderación"
          data-testid="panel-eventos-tecnico"
          class="lg:col-start-4 lg:row-span-2 lg:row-start-1"
        >
          <ListaEventosTecnicos :eventos="eventos" />
        </PanelTecnico>
      </div>
    </main>
  </div>
</template>
