<script setup lang="ts">
/**
 * Redacción, publicación y cancelación de avisos técnicos (WP-056).
 *
 * Un aviso reemplaza temporalmente una superficie de otra pantalla: el cuadrante 4
 * completo en Moderación y la franja de votación/tema/estado en el Recinto. Este panel es
 * el único lugar desde donde se publican.
 *
 * Reglas del contrato que la interfaz respeta sin reinterpretar:
 *
 * - el destino es `MODERACION`, `RECINTO` o `AMBOS`, y cada uno tiene su ranura propia en
 *   el backend: publicar hacia uno nunca toca al otro;
 * - la duración es opcional. Vacía significa "hasta cancelación manual", y así se rotula
 *   explícitamente para que nadie deba deducirlo de un campo en blanco;
 * - la cancelación es por destino y es idempotente: cancelar un destino sin aviso vigente
 *   no falla, así que el botón no necesita adivinar el estado antes de habilitarse.
 *
 * La vigencia la decide el reloj del backend. Cuando un aviso vence, deja de proyectarse
 * y desaparece de todas las pantallas sin que nadie ejecute un comando; acá sólo se
 * muestra la cuenta restante como información, nunca como autoridad.
 */

import { computed, ref, watch } from 'vue'
import type {
  AvisoTecnicoProyectado,
  ClienteApoyoTecnico,
  DestinoAvisoTecnico,
} from '@botonera2/api-client'
import { extraerMensajeError } from '@botonera2/frontend-shared'

const props = defineProps<{
  /** Aviso vigente en la ranura de Moderación, o `null`. */
  avisoModeracion: AvisoTecnicoProyectado | null
  /** Aviso vigente en la ranura del Recinto, o `null`. */
  avisoRecinto: AvisoTecnicoProyectado | null
  /** Cliente de comandos del plano técnico. */
  cliente: ClienteApoyoTecnico
  /** Sólo una conexión confirmada habilita los comandos. */
  conectado: boolean
  /** Segundos que faltan para el vencimiento de un aviso, o `null` si no vence. */
  segundosRestantes: (aviso: AvisoTecnicoProyectado | null) => number | null
  /**
   * Borrador elegido en la biblioteca de mensajes precargados.
   *
   * Llega con una `marca` incremental porque elegir dos veces el mismo preset debe volver
   * a precargar el formulario: si sólo se comparara texto y destino, la segunda selección
   * pasaría inadvertida y el operador creería que el clic no hizo nada.
   */
  borrador: { texto: string; destino: DestinoAvisoTecnico; marca: number } | null
}>()

/** Texto y destino del borrador; el contrato acepta hasta 500 caracteres en una línea. */
const LARGO_MAXIMO_TEXTO = 500
/** El backend acepta duraciones de 1 a 86400 segundos, o ninguna. */
const DURACION_MINIMA = 1
const DURACION_MAXIMA = 86400

const texto = ref('')
const destino = ref<DestinoAvisoTecnico>('AMBOS')
/**
 * Duración en segundos como texto.
 *
 * Se guarda como cadena y no como número porque el campo vacío es un valor con
 * significado propio —"hasta cancelación manual"— y un `number` lo convertiría en `NaN`
 * o en `0`, que el contrato rechaza. La conversión ocurre una sola vez, al publicar.
 */
const duracion = ref('')

const accionEnVuelo = ref<string | null>(null)
const mensajeError = ref<string | null>(null)

const DESTINOS: readonly { valor: DestinoAvisoTecnico; etiqueta: string }[] = [
  { valor: 'MODERACION', etiqueta: 'Moderación' },
  { valor: 'RECINTO', etiqueta: 'Recinto' },
  { valor: 'AMBOS', etiqueta: 'Ambos' },
]

const textoNormalizado = computed(() => texto.value.trim())
const textoValido = computed(
  () => textoNormalizado.value.length > 0 && textoNormalizado.value.length <= LARGO_MAXIMO_TEXTO,
)

/**
 * `null` representa la ausencia deliberada de vencimiento, no un error de carga.
 *
 * El valor se normaliza a texto antes de interpretarlo porque un `input[type=number]`
 * puede entregar número o cadena según el entorno, y sólo la cadena vacía significa
 * "sin límite". Un valor no entero produce `NaN`, que `duracionValida` rechaza.
 */
const duracionSolicitada = computed<number | null>(() => {
  const ingresado = String(duracion.value ?? '').trim()
  if (ingresado === '') return null
  const valor = Number(ingresado)
  return Number.isInteger(valor) ? valor : Number.NaN
})

const duracionValida = computed(() => {
  const valor = duracionSolicitada.value
  if (valor === null) return true
  return Number.isInteger(valor) && valor >= DURACION_MINIMA && valor <= DURACION_MAXIMA
})

const puedePublicar = computed(
  () =>
    props.conectado && textoValido.value && duracionValida.value && accionEnVuelo.value === null,
)

/** Ejecuta un comando y deja que el snapshot confirme el efecto. */
async function ejecutar(
  accion: string,
  comando: () => Promise<void>,
  mensajePredeterminado: string,
): Promise<void> {
  mensajeError.value = null
  accionEnVuelo.value = accion
  try {
    await comando()
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, mensajePredeterminado)
  } finally {
    accionEnVuelo.value = null
  }
}

function publicar(): void {
  if (!puedePublicar.value) return
  void ejecutar(
    'PUBLICAR',
    () =>
      props.cliente.publicarAviso(textoNormalizado.value, destino.value, duracionSolicitada.value),
    'No se pudo publicar el aviso.',
  )
}

function cancelar(destinoCancelado: DestinoAvisoTecnico): void {
  if (!props.conectado || accionEnVuelo.value !== null) return
  void ejecutar(
    `CANCELAR_${destinoCancelado}`,
    () => props.cliente.cancelarAviso(destinoCancelado),
    'No se pudo cancelar el aviso.',
  )
}

/**
 * Adopta un mensaje precargado en el formulario **sin** publicarlo.
 *
 * Es una decisión explícita del WP: seleccionar un preset nunca dispara una publicación.
 * El operador siempre revisa el texto, el destino y la duración antes de emitirlo. La
 * duración tampoco se toca: no forma parte del preset y debe decidirse en cada emisión.
 */
watch(
  () => props.borrador?.marca ?? null,
  () => {
    const borrador = props.borrador
    if (borrador === null) return
    texto.value = borrador.texto
    destino.value = borrador.destino
    mensajeError.value = null
  },
)

/** Rótulo del vencimiento de un aviso vigente, ya resuelto para la vista. */
function rotuloVigencia(aviso: AvisoTecnicoProyectado): string {
  if (aviso.expira_en === null) return 'Hasta cancelación manual'
  const restantes = props.segundosRestantes(aviso)
  return restantes === null ? 'Hasta cancelación manual' : `Vence en ${restantes} s`
}
</script>

<template>
  <div data-testid="control-avisos" class="space-y-3 text-xs">
    <div class="space-y-1">
      <label for="texto-aviso-tecnico" class="block font-semibold text-slate-300">
        Texto del aviso
      </label>
      <textarea
        id="texto-aviso-tecnico"
        v-model="texto"
        data-testid="input-texto-aviso"
        rows="2"
        :maxlength="LARGO_MAXIMO_TEXTO"
        class="w-full resize-none rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 disabled:opacity-50"
        placeholder="Mensaje que verán las pantallas elegidas"
        :disabled="!conectado"
      />
    </div>

    <div class="space-y-1">
      <label for="destino-aviso-tecnico" class="block font-semibold text-slate-300">Destino</label>
      <select
        id="destino-aviso-tecnico"
        v-model="destino"
        data-testid="select-destino-aviso"
        class="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 disabled:opacity-50"
        :disabled="!conectado"
      >
        <option v-for="opcion in DESTINOS" :key="opcion.valor" :value="opcion.valor">
          {{ opcion.etiqueta }}
        </option>
      </select>
    </div>

    <div class="flex flex-wrap items-end gap-2">
      <div class="space-y-1">
        <label for="duracion-aviso-tecnico" class="block font-semibold text-slate-300">
          Duración (segundos)
        </label>
        <input
          id="duracion-aviso-tecnico"
          v-model="duracion"
          data-testid="input-duracion-aviso"
          type="number"
          inputmode="numeric"
          :min="DURACION_MINIMA"
          :max="DURACION_MAXIMA"
          step="1"
          placeholder="Sin límite"
          class="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 disabled:opacity-50"
          :disabled="!conectado"
        />
      </div>
      <p data-testid="rotulo-duracion" class="pb-2 text-[11px] text-slate-400">
        {{
          duracionSolicitada === null
            ? 'Vacío = permanece hasta cancelarlo manualmente'
            : `Se retira solo a los ${duracion} segundos`
        }}
      </p>
      <button
        type="button"
        data-testid="btn-publicar-aviso"
        class="ml-auto rounded-lg border border-amber-600 bg-amber-950 px-3 py-2 font-bold text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!puedePublicar"
        @click="publicar"
      >
        {{ accionEnVuelo === 'PUBLICAR' ? 'Publicando...' : 'Publicar aviso' }}
      </button>
    </div>

    <p
      v-if="!duracionValida"
      data-testid="duracion-invalida"
      class="rounded border border-amber-800 bg-amber-950/40 px-2 py-1 text-amber-200"
    >
      La duración debe ser un número entero entre {{ DURACION_MINIMA }} y
      {{ DURACION_MAXIMA }} segundos, o quedar vacía.
    </p>

    <!-- Avisos vigentes por ranura. Cada uno se cancela por separado. -->
    <div class="space-y-2">
      <div
        v-for="ranura in [
          {
            destino: 'MODERACION' as DestinoAvisoTecnico,
            aviso: avisoModeracion,
            rotulo: 'Moderación',
          },
          { destino: 'RECINTO' as DestinoAvisoTecnico, aviso: avisoRecinto, rotulo: 'Recinto' },
        ]"
        :key="ranura.destino"
        :data-testid="`ranura-${ranura.destino.toLowerCase()}`"
        class="rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {{ ranura.rotulo }}
          </span>
          <button
            v-if="ranura.aviso"
            type="button"
            :data-testid="`btn-cancelar-${ranura.destino.toLowerCase()}`"
            class="rounded border border-slate-600 bg-slate-900 px-2 py-1 font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!conectado || accionEnVuelo !== null"
            @click="cancelar(ranura.destino)"
          >
            Cancelar
          </button>
        </div>
        <p
          v-if="ranura.aviso"
          :data-testid="`texto-vigente-${ranura.destino.toLowerCase()}`"
          class="mt-0.5 break-words text-slate-200"
        >
          {{ ranura.aviso.texto }}
        </p>
        <p
          v-if="ranura.aviso"
          :data-testid="`vigencia-${ranura.destino.toLowerCase()}`"
          class="text-[11px] text-slate-400"
        >
          {{ rotuloVigencia(ranura.aviso) }}
        </p>
        <p v-else class="mt-0.5 text-slate-500">Sin aviso vigente</p>
      </div>
    </div>

    <p
      v-if="!conectado"
      data-testid="avisos-sin-conexion"
      class="rounded border border-amber-800 bg-amber-950/40 px-2 py-1 text-amber-200"
    >
      Publicar o cancelar avisos requiere conexión confirmada con FastAPI.
    </p>

    <p
      v-if="mensajeError"
      data-testid="error-avisos"
      class="rounded border border-rose-700 bg-rose-950/60 px-2 py-1 text-rose-200"
      role="alert"
    >
      {{ mensajeError }}
    </p>
  </div>
</template>
