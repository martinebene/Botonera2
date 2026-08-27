<script setup lang="ts">
/**
 * Gestiona el ciclo visual de una votación dentro de una sesión abierta.
 *
 * El componente conserva solamente datos de interfaz: borrador editable, motivo de
 * finalización, advertencia CA-062 y comandos en vuelo. La votación visible, sus votos,
 * conteos y resultado siempre se leen desde `EstadoModeracion`; por eso una recarga o
 * reconexión reconstruye la pantalla sin timers ni cálculos institucionales locales.
 */

import { computed, ref, watch } from 'vue'
import type {
  BaseMayoria,
  Capacidad,
  ClienteModeracion,
  EstadoModeracion,
  PuntoOrdenDelDiaProyectado,
  SolicitudAperturaVotacion,
} from '@botonera2/api-client'
import { traducirMotivos } from '../utils/motivos'
import DialogoConfirmacionApertura from './DialogoConfirmacionApertura.vue'

const props = defineProps<{
  estado: EstadoModeracion
  cliente: ClienteModeracion
  conectado: boolean
  puntoPreseleccionado: PuntoOrdenDelDiaProyectado | null
}>()

type TipoMayoriaFormulario = 'SIMPLE' | 'ESPECIAL'

interface BorradorVotacion {
  numero: string
  tipo: string
  tema: string
  tipoMayoria: TipoMayoriaFormulario
  factor: string
  base: BaseMayoria
}

const borrador = ref<BorradorVotacion>({
  numero: '',
  tipo: '',
  tema: '',
  tipoMayoria: 'SIMPLE',
  factor: '',
  base: 'VOTOS_COMPUTABLES',
})

const motivoFinalizacion = ref('')
const mensajeError = ref<string | null>(null)
const mensajeInformativo = ref<string | null>(null)
const abriendo = ref(false)
const finalizando = ref(false)
const desempatando = ref(false)
const aperturaPendiente = ref<SolicitudAperturaVotacion | null>(null)
const idAperturaSolicitada = ref<string | null>(null)

const tiposConfigurados = computed(() => props.estado.configuracion?.tipos_votacion ?? [])
const votacion = computed(() => props.estado.votacion)
const capacidadNoProyectada: Capacidad = {
  habilitada: false,
  motivos: ['ESTADO_INCOMPATIBLE'],
}

/**
 * Una votación final ya no bloquea una apertura nueva aunque siga siendo la última
 * proyectada. En cambio EN_CURSO, EMPATADA y el estado técnico CERRADA sin resultado
 * continúan siendo incompatibles según las capacidades del backend.
 */
const existeVotacionIncompatible = computed(() => {
  const actual = votacion.value
  if (!actual) return false
  return (
    actual.estado_recepcion === 'EN_CURSO' ||
    actual.resultado === 'EMPATADA' ||
    (actual.estado_recepcion === 'CERRADA' && actual.resultado === null)
  )
})

const mostrarFormulario = computed(
  () => props.estado.estado_global === 'SESION_ABIERTA' && !existeVotacionIncompatible.value,
)

const capacidadAbrir = computed(
  () => props.estado.capacidades.abrir_votacion ?? capacidadNoProyectada,
)
const capacidadFinalizar = computed(
  () => props.estado.capacidades.finalizar_votacion ?? capacidadNoProyectada,
)
const capacidadDesempatar = computed(
  () => props.estado.capacidades.desempatar ?? capacidadNoProyectada,
)

const puedeEnviarApertura = computed(
  () => props.conectado && capacidadAbrir.value.habilitada && !abriendo.value,
)
const puedeFinalizar = computed(
  () => props.conectado && capacidadFinalizar.value.habilitada && !finalizando.value,
)
const puedeDesempatar = computed(
  () => props.conectado && capacidadDesempatar.value.habilitada && !desempatando.value,
)

const motivosAbrir = computed(() => traducirMotivos(capacidadAbrir.value.motivos))
const motivosFinalizar = computed(() => traducirMotivos(capacidadFinalizar.value.motivos))
const motivosDesempatar = computed(() => traducirMotivos(capacidadDesempatar.value.motivos))

const resultadoClase = computed(() => {
  switch (votacion.value?.resultado) {
    case 'APROBADA':
      return 'border-emerald-600 bg-emerald-950/60 text-emerald-200'
    case 'RECHAZADA':
      return 'border-rose-600 bg-rose-950/60 text-rose-200'
    case 'INCONCLUSA':
      return 'border-slate-500 bg-slate-800/80 text-slate-200'
    case 'EMPATADA':
      return 'border-amber-500 bg-amber-950/60 text-amber-200'
    default:
      return 'border-cyan-700 bg-cyan-950/40 text-cyan-200'
  }
})

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

function reiniciarBorradorManual(): void {
  borrador.value = {
    numero: '',
    tipo: tiposConfigurados.value[0] ?? '',
    tema: '',
    tipoMayoria: 'SIMPLE',
    factor: '',
    base: 'VOTOS_COMPUTABLES',
  }
}

/**
 * Copia los seis campos normalizados de Q2. Como el Orden del Día no valida el tipo
 * contra la configuración, un tipo no permitido queda visible en el select como opción
 * deshabilitada hasta que el operador elija uno vigente.
 */
watch(
  () => props.puntoPreseleccionado,
  (punto) => {
    if (!punto) return
    const tipoMayoria: TipoMayoriaFormulario =
      punto.tipo_mayoria === 'ESPECIAL' ? 'ESPECIAL' : 'SIMPLE'
    const basesPermitidas: BaseMayoria[] = ['VOTOS_COMPUTABLES', 'PRESENTES', 'CUERPO']
    const base = basesPermitidas.includes(punto.base as BaseMayoria)
      ? (punto.base as BaseMayoria)
      : 'VOTOS_COMPUTABLES'

    borrador.value = {
      numero: String(punto.nro_votacion),
      tipo: punto.tipo,
      tema: punto.tema,
      tipoMayoria,
      factor: tipoMayoria === 'ESPECIAL' ? String(punto.factor) : '',
      base: tipoMayoria === 'ESPECIAL' ? base : 'VOTOS_COMPUTABLES',
    }
    limpiarMensajes()
    mensajeInformativo.value = 'Punto copiado al borrador. Todos los campos siguen editables.'
  },
)

watch(
  tiposConfigurados,
  (tipos) => {
    if (!borrador.value.tipo && tipos[0]) borrador.value.tipo = tipos[0]
  },
  { immediate: true },
)

/**
 * La respuesta 201 permite recordar qué apertura está esperando proyección, pero no se
 * usa para dibujar una votación optimista. El borrador se limpia recién cuando un snapshot
 * confirma la misma id en EN_CURSO.
 */
watch(
  () => props.estado.votacion,
  (actual) => {
    if (
      actual &&
      actual.id === idAperturaSolicitada.value &&
      actual.estado_recepcion === 'EN_CURSO'
    ) {
      idAperturaSolicitada.value = null
      reiniciarBorradorManual()
      mensajeInformativo.value = null
    }
  },
)

function manejarCambioTipoMayoria(): void {
  if (borrador.value.tipoMayoria === 'SIMPLE') {
    borrador.value.factor = ''
    borrador.value.base = 'VOTOS_COMPUTABLES'
  }
}

function construirSolicitud(): SolicitudAperturaVotacion | null {
  const numeroTexto = borrador.value.numero.trim()
  if (!/^\d+$/.test(numeroTexto)) {
    mensajeError.value = 'El número de votación debe ser un entero estricto mayor o igual a 1.'
    return null
  }

  const numero = Number(numeroTexto)
  if (!Number.isSafeInteger(numero) || numero < 1) {
    mensajeError.value = 'El número de votación debe ser un entero estricto mayor o igual a 1.'
    return null
  }

  const tipo = borrador.value.tipo.trim()
  if (!tiposConfigurados.value.includes(tipo)) {
    mensajeError.value = 'Elegí un tipo de votación de la configuración vigente.'
    return null
  }

  const tema = borrador.value.tema.trim()
  if (!tema) {
    mensajeError.value = 'El tema de la votación no puede quedar vacío.'
    return null
  }

  if (borrador.value.tipoMayoria === 'SIMPLE') {
    return {
      numero_votacion: numero,
      tipo,
      tema,
      tipo_mayoria: 'SIMPLE',
      base: 'VOTOS_COMPUTABLES',
    }
  }

  const factorTexto = borrador.value.factor.trim()
  const patronNumeroDecimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
  const factor = Number(factorTexto)
  if (
    !patronNumeroDecimal.test(factorTexto) ||
    !Number.isFinite(factor) ||
    factor <= 0 ||
    factor > 1
  ) {
    mensajeError.value =
      'El factor especial debe ser un número finito mayor que 0 y menor o igual a 1.'
    return null
  }

  return {
    numero_votacion: numero,
    tipo,
    tema,
    tipo_mayoria: 'ESPECIAL',
    factor,
    base: borrador.value.base,
  }
}

async function enviarApertura(solicitud: SolicitudAperturaVotacion): Promise<void> {
  if (!puedeEnviarApertura.value) {
    mensajeError.value = props.conectado
      ? 'El backend no habilita la apertura en el estado vigente.'
      : 'No se puede abrir una votación sin conexión confirmada.'
    return
  }

  abriendo.value = true
  aperturaPendiente.value = null
  try {
    const respuesta = await props.cliente.abrirVotacion(solicitud)
    idAperturaSolicitada.value = respuesta.id
    mensajeInformativo.value = 'Apertura enviada. Esperando confirmación del estado autoritativo.'
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'No se pudo abrir la votación.')
  } finally {
    abriendo.value = false
  }
}

function solicitarApertura(): void {
  if (!puedeEnviarApertura.value) return
  limpiarMensajes()
  const solicitud = construirSolicitud()
  if (!solicitud) return

  const hayPalabraPendiente =
    (props.estado.palabra?.orador ?? null) !== null || (props.estado.palabra?.cola.length ?? 0) > 0
  if (hayPalabraPendiente) {
    aperturaPendiente.value = { ...solicitud }
    return
  }
  void enviarApertura(solicitud)
}

function cancelarAdvertenciaApertura(): void {
  if (abriendo.value) return
  aperturaPendiente.value = null
}

function confirmarAdvertenciaApertura(): void {
  const solicitud = aperturaPendiente.value
  if (!solicitud || abriendo.value) return
  void enviarApertura(solicitud)
}

async function finalizarVotacion(): Promise<void> {
  const actual = votacion.value
  if (!actual || actual.estado_recepcion !== 'EN_CURSO' || !puedeFinalizar.value) return
  limpiarMensajes()
  const motivo = motivoFinalizacion.value.trim()
  if (!motivo) {
    mensajeError.value = 'Ingresá un motivo antes de finalizar la votación.'
    return
  }

  finalizando.value = true
  try {
    await props.cliente.finalizarVotacion(actual.id, motivo)
    mensajeInformativo.value = 'Finalización enviada. El resultado se adoptará desde el backend.'
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'No se pudo finalizar la votación.')
  } finally {
    finalizando.value = false
  }
}

async function desempatar(sentido: 'POSITIVO' | 'NEGATIVO'): Promise<void> {
  const actual = votacion.value
  if (
    !actual ||
    actual.estado_recepcion !== 'CERRADA' ||
    actual.resultado !== 'EMPATADA' ||
    actual.tipo_mayoria !== 'SIMPLE' ||
    !puedeDesempatar.value
  ) {
    return
  }

  limpiarMensajes()
  desempatando.value = true
  try {
    await props.cliente.desempatar(actual.id, sentido)
    mensajeInformativo.value =
      'Desempate enviado. Esperando el resultado confirmado por el backend.'
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'No se pudo registrar el desempate.')
  } finally {
    desempatando.value = false
  }
}
</script>

<template>
  <section data-testid="gestion-votacion" class="space-y-3 border-t border-slate-800 pt-3">
    <div
      v-if="mensajeError"
      data-testid="alerta-error-votacion"
      class="rounded-lg border border-rose-700 bg-rose-950/70 p-2 text-xs text-rose-200"
      role="alert"
    >
      {{ mensajeError }}
    </div>
    <div
      v-if="mensajeInformativo"
      data-testid="aviso-votacion"
      class="rounded-lg border border-cyan-800 bg-cyan-950/50 p-2 text-xs text-cyan-200"
      role="status"
    >
      {{ mensajeInformativo }}
    </div>

    <!-- Vista de la votación relevante, construida exclusivamente desde el snapshot. -->
    <article
      v-if="votacion"
      data-testid="vista-votacion-proyectada"
      class="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3"
    >
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Votación Nº {{ votacion.numero_votacion }} · {{ votacion.tipo }}
          </p>
          <h4 class="mt-1 font-semibold text-slate-100">{{ votacion.tema }}</h4>
        </div>
        <span
          data-testid="estado-votacion"
          class="rounded border px-2 py-1 text-[11px] font-bold"
          :class="resultadoClase"
        >
          {{ votacion.resultado ?? votacion.estado_recepcion }}
        </span>
      </div>

      <dl class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div class="rounded bg-slate-900 p-2">
          <dt class="text-slate-500">Mayoría</dt>
          <dd class="font-semibold text-slate-200">{{ votacion.tipo_mayoria }}</dd>
        </div>
        <div class="rounded bg-slate-900 p-2">
          <dt class="text-slate-500">Regla</dt>
          <dd class="font-semibold text-slate-200">
            <template v-if="votacion.tipo_mayoria === 'ESPECIAL'">
              {{ votacion.factor }} · {{ votacion.base }}
            </template>
            <template v-else>Positivos &gt; negativos</template>
          </dd>
        </div>
        <div class="rounded bg-slate-900 p-2">
          <dt class="text-slate-500">Quórum actual</dt>
          <dd class="font-semibold text-slate-200">
            {{ estado.quorum?.cantidad_presentes ?? '—' }} / {{ estado.quorum?.requerido ?? '—' }}
          </dd>
        </div>
        <div class="rounded bg-slate-900 p-2">
          <dt class="text-slate-500">Votos recibidos</dt>
          <dd data-testid="cantidad-votos-recibidos" class="font-semibold text-slate-200">
            {{ votacion.cantidad_votos_recibidos }}
          </dd>
        </div>
      </dl>

      <div
        v-if="estado.palabra && (estado.palabra.orador || estado.palabra.cola.length > 0)"
        data-testid="palabra-durante-votacion"
        class="rounded border border-cyan-900 bg-cyan-950/30 p-2 text-xs text-cyan-200"
      >
        <span v-if="estado.palabra.orador">
          Orador: {{ estado.palabra.orador.nombre }} {{ estado.palabra.orador.apellido }}.
        </span>
        <span> {{ estado.palabra.cola.length }} pedido(s) en cola.</span>
      </div>

      <div v-if="votacion.conteos" data-testid="conteos-votacion" class="grid grid-cols-4 gap-2">
        <div class="rounded bg-emerald-950/60 p-2 text-center text-xs text-emerald-200">
          <strong>{{ votacion.conteos.positivos }}</strong
          ><br />Positivos
        </div>
        <div class="rounded bg-rose-950/60 p-2 text-center text-xs text-rose-200">
          <strong>{{ votacion.conteos.negativos }}</strong
          ><br />Negativos
        </div>
        <div class="rounded bg-slate-800 p-2 text-center text-xs text-slate-200">
          <strong>{{ votacion.conteos.abstenciones }}</strong
          ><br />Abstenciones
        </div>
        <div class="rounded bg-cyan-950/60 p-2 text-center text-xs text-cyan-200">
          <strong>{{ votacion.conteos.total }}</strong
          ><br />Total
        </div>
      </div>

      <div
        v-if="votacion.votos_individuales !== null"
        data-testid="votos-individuales"
        class="space-y-1 rounded border border-slate-800 bg-slate-900/60 p-2 text-xs"
      >
        <p class="font-bold uppercase tracking-wider text-slate-400">
          Votos individuales revelados
        </p>
        <div
          v-for="voto in votacion.votos_individuales"
          :key="voto.dni"
          class="flex justify-between gap-2 border-t border-slate-800 pt-1 text-slate-200"
        >
          <span>Banca {{ voto.banca }} · {{ voto.nombre }} {{ voto.apellido }}</span>
          <strong>{{ voto.valor }}</strong>
        </div>
      </div>
      <p
        v-else-if="votacion.estado_recepcion === 'EN_CURSO'"
        data-testid="votos-ocultos"
        class="text-xs italic text-slate-400"
      >
        Los valores individuales todavía no fueron proyectados por el backend.
      </p>

      <div
        v-if="votacion.estado_recepcion === 'EN_CURSO'"
        class="space-y-2 border-t border-slate-800 pt-3"
      >
        <label for="motivo-finalizacion" class="block text-xs font-semibold text-slate-300">
          Motivo para finalizar manualmente
        </label>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            id="motivo-finalizacion"
            v-model="motivoFinalizacion"
            data-testid="input-motivo-finalizacion"
            type="text"
            class="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            placeholder="Motivo obligatorio"
            :disabled="finalizando"
          />
          <button
            type="button"
            data-testid="btn-finalizar-votacion"
            class="rounded-lg border border-rose-700 bg-rose-950 px-3 py-2 text-xs font-bold text-rose-200 disabled:opacity-40"
            :disabled="!puedeFinalizar"
            @click="finalizarVotacion"
          >
            {{ finalizando ? 'Finalizando...' : 'Finalizar votación' }}
          </button>
        </div>
        <p v-for="motivo in motivosFinalizar" :key="motivo" class="text-[11px] text-amber-300">
          {{ motivo }}
        </p>
      </div>

      <div
        v-if="
          votacion.estado_recepcion === 'CERRADA' &&
          votacion.resultado === 'EMPATADA' &&
          votacion.tipo_mayoria === 'SIMPLE'
        "
        data-testid="controles-desempate"
        class="space-y-2 rounded-lg border border-amber-700 bg-amber-950/30 p-3"
      >
        <p class="text-xs text-amber-200">
          Presidencia vigente: <strong>{{ estado.sesion?.presidencia }}</strong>
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            data-testid="btn-desempate-positivo"
            class="flex-1 rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"
            :disabled="!puedeDesempatar"
            @click="desempatar('POSITIVO')"
          >
            POSITIVO
          </button>
          <button
            type="button"
            data-testid="btn-desempate-negativo"
            class="flex-1 rounded bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            :disabled="!puedeDesempatar"
            @click="desempatar('NEGATIVO')"
          >
            NEGATIVO
          </button>
        </div>
        <p v-for="motivo in motivosDesempatar" :key="motivo" class="text-[11px] text-amber-300">
          {{ motivo }}
        </p>
      </div>
    </article>

    <!-- Formulario manual o precargado. Una votación final anterior puede convivir con este borrador. -->
    <form
      v-if="mostrarFormulario"
      data-testid="formulario-votacion"
      class="space-y-3 rounded-xl border border-cyan-900/60 bg-slate-950/60 p-3"
      @submit.prevent="solicitarApertura"
    >
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold uppercase tracking-wider text-cyan-300">Nueva votación</h4>
        <button
          type="button"
          data-testid="btn-limpiar-borrador"
          class="text-[11px] text-slate-400 underline"
          @click="reiniciarBorradorManual"
        >
          Limpiar borrador
        </button>
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label class="text-xs text-slate-300">
          Número
          <input
            v-model="borrador.numero"
            data-testid="input-numero-votacion"
            type="text"
            inputmode="numeric"
            class="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
          />
        </label>
        <label class="text-xs text-slate-300">
          Tipo
          <select
            v-model="borrador.tipo"
            data-testid="select-tipo-votacion"
            class="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
          >
            <option
              v-if="borrador.tipo && !tiposConfigurados.includes(borrador.tipo)"
              :value="borrador.tipo"
              disabled
            >
              {{ borrador.tipo }} (no permitido en esta sesión)
            </option>
            <option v-for="tipo in tiposConfigurados" :key="tipo" :value="tipo">{{ tipo }}</option>
          </select>
        </label>
      </div>

      <label class="block text-xs text-slate-300">
        Tema
        <textarea
          v-model="borrador.tema"
          data-testid="input-tema-votacion"
          rows="2"
          class="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
        />
      </label>

      <fieldset class="space-y-2">
        <legend class="text-xs font-semibold text-slate-300">Tipo de mayoría</legend>
        <div class="flex gap-4 text-xs">
          <label class="flex items-center gap-1">
            <input
              v-model="borrador.tipoMayoria"
              data-testid="radio-mayoria-simple"
              type="radio"
              value="SIMPLE"
              @change="manejarCambioTipoMayoria"
            />
            SIMPLE
          </label>
          <label class="flex items-center gap-1">
            <input
              v-model="borrador.tipoMayoria"
              data-testid="radio-mayoria-especial"
              type="radio"
              value="ESPECIAL"
              @change="manejarCambioTipoMayoria"
            />
            ESPECIAL
          </label>
        </div>
      </fieldset>

      <div
        v-if="borrador.tipoMayoria === 'ESPECIAL'"
        data-testid="campos-mayoria-especial"
        class="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <label class="text-xs text-slate-300">
          Factor (0 &lt; factor ≤ 1)
          <input
            v-model="borrador.factor"
            data-testid="input-factor-mayoria"
            type="text"
            inputmode="decimal"
            class="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
          />
        </label>
        <label class="text-xs text-slate-300">
          Base
          <select
            v-model="borrador.base"
            data-testid="select-base-mayoria"
            class="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
          >
            <option value="VOTOS_COMPUTABLES">VOTOS_COMPUTABLES</option>
            <option value="PRESENTES">PRESENTES</option>
            <option value="CUERPO">CUERPO</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        data-testid="btn-abrir-votacion"
        class="w-full rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 disabled:opacity-40"
        :disabled="!puedeEnviarApertura"
        @click="solicitarApertura"
      >
        {{ abriendo ? 'Abriendo votación...' : 'Abrir votación' }}
      </button>
      <p v-if="!conectado" class="text-[11px] text-amber-300">
        Reconectá el estado en tiempo real para habilitar comandos.
      </p>
      <p v-for="motivo in motivosAbrir" :key="motivo" class="text-[11px] text-amber-300">
        {{ motivo }}
      </p>
    </form>

    <DialogoConfirmacionApertura
      :palabra="estado.palabra"
      :abierto="aperturaPendiente !== null"
      :enviando="abriendo"
      @cancelar="cancelarAdvertenciaApertura"
      @confirmar="confirmarAdvertenciaApertura"
    />
  </section>
</template>
