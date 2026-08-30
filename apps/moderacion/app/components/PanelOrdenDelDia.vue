<script setup lang="ts">
/**
 * Panel operativo del Orden del Día (Cuadrante 2).
 *
 * El archivo seleccionado es un dato visual transitorio. Se envía sin parsearlo al
 * backend y la lista renderizada siempre proviene de `EstadoModeracion`. Así un error
 * de carga no borra una colección válida ni instala una respuesta optimista local.
 *
 * La existencia de puntos define dos vistas mutuamente excluyentes: carga compacta o
 * colección confirmada. Al quitar, los puntos permanecen visibles hasta que un snapshot
 * vacío llegue desde backend. Seleccionar un punto emite una copia para precargar Q1,
 * sin marcarlo como tratado ni modificar la colección autoritativa.
 */

import { computed, ref } from 'vue'
import type {
  ClienteModeracion,
  EstadoModeracion,
  PuntoOrdenDelDiaProyectado,
} from '@botonera2/api-client'
import { useEstadoModeracion } from '../composables/useEstadoModeracion'
import { traducirMotivos } from '../utils/motivos'
import PanelContenedor from './PanelContenedor.vue'

const props = defineProps<{
  estado: EstadoModeracion | null
  /** Frontera inyectable que permite pruebas DOM sin red real. */
  clienteInyectado?: ClienteModeracion
}>()

const emit = defineEmits<{
  seleccionar: [punto: PuntoOrdenDelDiaProyectado]
}>()

const sincronizacion = useEstadoModeracion(props.clienteInyectado)
const cliente = computed(() => props.clienteInyectado ?? sincronizacion.cliente)
const conectado = computed(() => sincronizacion.conectado.value)
const archivoSeleccionado = ref<File | null>(null)
const nombreArchivo = ref('')
const inputArchivo = ref<HTMLInputElement | null>(null)
const cargando = ref(false)
const descartando = ref(false)
const mensajeError = ref<string | null>(null)
const mensajeInformativo = ref<string | null>(null)

const capacidadCargar = computed(() => props.estado?.capacidades.cargar_orden_del_dia)
const capacidadDescartar = computed(() => props.estado?.capacidades.descartar_orden_del_dia)
// Las fixtures heredadas de WP-022 todavía no incluían esta proyección opcional.
const puntosOrdenDelDia = computed(() => props.estado?.orden_del_dia ?? [])
const tieneOrdenDelDia = computed(() => puntosOrdenDelDia.value.length > 0)
const solicitudEnCurso = computed(() => cargando.value || descartando.value)
const puedeCargar = computed(
  () =>
    conectado.value &&
    (capacidadCargar.value?.habilitada ?? false) &&
    archivoSeleccionado.value !== null &&
    !solicitudEnCurso.value,
)
const puedeDescartar = computed(
  () =>
    tieneOrdenDelDia.value &&
    conectado.value &&
    (capacidadDescartar.value?.habilitada ?? false) &&
    !solicitudEnCurso.value,
)
const motivosCargar = computed(() => traducirMotivos(capacidadCargar.value?.motivos))
const motivosDescartar = computed(() => traducirMotivos(capacidadDescartar.value?.motivos))

function extraerMensajeError(error: unknown, mensajePorDefecto: string): string {
  if (typeof error === 'object' && error !== null) {
    if (
      'mensajeBackend' in error &&
      typeof (error as { mensajeBackend: unknown }).mensajeBackend === 'string'
    ) {
      return (error as { mensajeBackend: string }).mensajeBackend
    }
    if ('mensaje' in error && typeof (error as { mensaje: unknown }).mensaje === 'string') {
      return (error as { mensaje: string }).mensaje
    }
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message
    }
  }
  return mensajePorDefecto
}

function limpiarMensajes(): void {
  mensajeError.value = null
  mensajeInformativo.value = null
}

function manejarSeleccionArchivo(evento: Event): void {
  const entrada = evento.target as HTMLInputElement | null
  const archivo = entrada?.files?.[0] ?? null
  archivoSeleccionado.value = archivo
  nombreArchivo.value = archivo?.name ?? ''
  limpiarMensajes()
}

async function cargarOrdenDelDia(): Promise<void> {
  const archivo = archivoSeleccionado.value
  if (!puedeCargar.value || !archivo) return
  limpiarMensajes()
  cargando.value = true
  try {
    await cliente.value.cargarOrdenDelDia(archivo)
    archivoSeleccionado.value = null
    nombreArchivo.value = ''
    if (inputArchivo.value) inputArchivo.value.value = ''
    mensajeInformativo.value =
      'Archivo enviado. La lista cambiará cuando el backend proyecte la colección confirmada.'
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'No se pudo cargar el Orden del Día.')
  } finally {
    cargando.value = false
  }
}

async function descartarOrdenDelDia(): Promise<void> {
  if (!puedeDescartar.value) return
  limpiarMensajes()
  descartando.value = true
  try {
    await cliente.value.descartarOrdenDelDia()
    mensajeInformativo.value =
      'Descarte enviado. La colección visible se conservará hasta el próximo estado confirmado.'
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'No se pudo descartar el Orden del Día.')
  } finally {
    descartando.value = false
  }
}

function seleccionarPunto(punto: PuntoOrdenDelDiaProyectado): void {
  emit('seleccionar', { ...punto })
  mensajeInformativo.value = `Punto Nº ${punto.nro_votacion} copiado al borrador de votación.`
  mensajeError.value = null
}
</script>

<template>
  <PanelContenedor
    titulo="Orden del Día"
    :subtitulo="tieneOrdenDelDia ? 'Puntos confirmados por backend' : 'Carga CSV compacta'"
    data-testid="panel-orden-del-dia"
    :badge="puntosOrdenDelDia.length ? `${puntosOrdenDelDia.length} puntos` : 'Sin cargar'"
    :contenido-con-scroll-propio="true"
  >
    <div class="flex h-full min-h-0 flex-col gap-2 text-sm text-slate-300">
      <!--
        La carga solo existe con colección vacía. No se ofrece reemplazo directo:
        para elegir otro CSV el operador debe quitar primero el estado confirmado.
      -->
      <div
        v-if="!tieneOrdenDelDia"
        data-testid="carga-orden-dia"
        class="shrink-0 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5"
      >
        <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <div class="min-w-0 flex-1">
            <label for="archivo-orden-dia" class="block text-xs font-semibold text-slate-300">
              Archivo CSV canónico
            </label>
            <input
              id="archivo-orden-dia"
              ref="inputArchivo"
              data-testid="input-archivo-orden-dia"
              type="file"
              accept=".csv,text/csv"
              class="mt-1 block w-full text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100"
              :disabled="solicitudEnCurso"
              @change="manejarSeleccionArchivo"
            />
          </div>
          <button
            type="button"
            data-testid="btn-cargar-orden-dia"
            class="shrink-0 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"
            :disabled="!puedeCargar"
            @click="cargarOrdenDelDia"
          >
            {{ cargando ? 'Cargando...' : 'Cargar' }}
          </button>
        </div>
        <p v-if="nombreArchivo" class="mt-1 truncate text-[11px] text-slate-400">
          Seleccionado: {{ nombreArchivo }}
        </p>
        <p v-if="!conectado" class="text-[11px] text-amber-300">
          Los comandos quedan deshabilitados hasta recuperar la conexión confirmada.
        </p>
        <p
          v-for="motivo in motivosCargar"
          :key="`cargar-${motivo}`"
          class="text-[11px] text-amber-300"
        >
          {{ motivo }}
        </p>
      </div>

      <div
        v-if="mensajeError"
        data-testid="alerta-error-orden-dia"
        role="alert"
        class="rounded border border-rose-700 bg-rose-950/70 p-2 text-xs text-rose-200"
      >
        {{ mensajeError }}
      </div>
      <div
        v-if="mensajeInformativo"
        data-testid="aviso-orden-dia"
        role="status"
        class="rounded border border-cyan-800 bg-cyan-950/50 p-2 text-xs text-cyan-200"
      >
        {{ mensajeInformativo }}
      </div>

      <!--
        La acción queda fuera del listado scrolleable. Durante el request no se oculta
        nada: solo un snapshot vacío puede reemplazar esta vista por la carga compacta.
      -->
      <div v-if="tieneOrdenDelDia" class="flex min-h-0 flex-1 flex-col gap-2">
        <div class="flex shrink-0 items-start justify-between gap-3">
          <div class="min-w-0">
            <p v-if="!conectado" class="text-[11px] text-amber-300">
              Los comandos quedan deshabilitados hasta recuperar la conexión confirmada.
            </p>
            <p
              v-for="motivo in motivosDescartar"
              :key="`descartar-${motivo}`"
              class="text-[11px] text-amber-300"
            >
              {{ motivo }}
            </p>
          </div>
          <button
            type="button"
            data-testid="btn-quitar-orden-dia"
            class="shrink-0 rounded-lg border border-rose-700 bg-rose-950 px-3 py-1.5 text-xs font-semibold text-rose-200 disabled:opacity-40"
            :disabled="!puedeDescartar"
            @click="descartarOrdenDelDia"
          >
            {{ descartando ? 'Quitando...' : 'Quitar Orden del Día' }}
          </button>
        </div>

        <div data-testid="lista-orden-dia" class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          <!-- La clave incluye el índice porque el contrato permite números repetidos. -->
          <button
            v-for="(punto, indice) in puntosOrdenDelDia"
            :key="`${punto.nro_votacion}-${indice}`"
            type="button"
            data-testid="punto-orden-dia"
            class="block w-full rounded border border-slate-800 bg-slate-950/60 px-2.5 py-2 text-left text-xs hover:border-cyan-700 hover:bg-cyan-950/20"
            @click="seleccionarPunto(punto)"
          >
            <span class="flex items-center justify-between gap-2">
              <strong class="text-slate-200">#{{ punto.nro_votacion }} · {{ punto.tipo }}</strong>
              <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                {{ punto.tipo_mayoria }}
              </span>
            </span>
            <span class="mt-0.5 block text-slate-400">{{ punto.tema }}</span>
            <span
              v-if="punto.tipo_mayoria === 'ESPECIAL'"
              class="mt-0.5 block text-[10px] text-slate-500"
            >
              Factor {{ punto.factor }} · Base {{ punto.base }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </PanelContenedor>
</template>
