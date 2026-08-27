<script setup lang="ts">
/**
 * Panel de Sesión y Votación (Cuadrante 1 de Moderación).
 *
 * Responsabilidades:
 * 1. Presentar el ciclo de vida institucional completo:
 *    - SIN_PREPARAR: Preparación de sala como acción principal.
 *    - PREPARANDO: Carga y edición de número de sesión, Presidencia y Secretaría Legislativa,
 *      apertura formal de sesión cuando se cumplan las capacidades, o cancelación de la preparación.
 *    - SESION_ABIERTA: Número inmutable, edición de autoridades durante la sesión, resumen de quórum
 *      y cierre formal con advertencia confirmatoria ante palabra pendiente.
 * 2. Gestión robusta de borradores locales (H1): Los campos en edición activa (dirty) no son
 *    sobrescritos por snapshots SSE no relacionados (ej. pulsaciones de presencia o test de teclado).
 *    Al cambiar de estado global, los borradores se resincronizan con el nuevo estado institucional.
 * 3. Validación estricta del número de sesión (M3): Solo se envían enteros positivos (> 0);
 *    los valores inválidos no se transforman silenciosamente y muestran error claro conservando el input.
 * 4. Resumen de quórum en Q1 durante sesión abierta (M1): Presentación compacta del quórum reglamentario.
 * 5. Gate de comandos mutantes: Solo permite emitir mutaciones cuando existe conexión plena (CONECTADO),
 *    la capacidad correspondiente está habilitada por el backend y no hay solicitudes en vuelo.
 * 6. Feedback de errores legibles sin optimismo ficticio ni alteración del estado confirmado.
 * 7. Integrar DialogoConfirmacionCierre para salvaguarda de oradores y pedidos en cola.
 */

import { ref, computed, watch } from 'vue'
import type {
  EstadoModeracion,
  ClienteModeracion,
  PuntoOrdenDelDiaProyectado,
} from '@botonera2/api-client'
import { useEstadoModeracion } from '../composables/useEstadoModeracion'
import PanelContenedor from './PanelContenedor.vue'
import DialogoConfirmacionCierre from './DialogoConfirmacionCierre.vue'
import GestionVotacion from './GestionVotacion.vue'
import { traducirMotivos } from '../utils/motivos'

const props = defineProps<{
  /** Estado autoritativo de moderación recibido desde el backend */
  estado: EstadoModeracion | null
  /** Cliente de API inyectable para pruebas unitarias */
  clienteInyectado?: ClienteModeracion
  /** Copia asistencial elegida en Q2 para precargar el borrador de votación */
  puntoPreseleccionado?: PuntoOrdenDelDiaProyectado | null
}>()

// Consumimos la sincronización compartida de Moderación
const sincronizacion = useEstadoModeracion(props.clienteInyectado)
const cliente = computed(() => props.clienteInyectado ?? sincronizacion.cliente)
const conectado = computed(() => sincronizacion.conectado.value)

// Variables locales para borradores de edición (drafts)
const numeroSesionInput = ref<string>('')
const presidenciaInput = ref<string>('')
const secretariaInput = ref<string>('')

// Banderas de edición local (dirty tracking) por campo (H1)
const numeroSesionDirty = ref(false)
const presidenciaDirty = ref(false)
const secretariaDirty = ref(false)

// Seguimiento del último estado global para detectar transiciones institucionales reales
const ultimoEstadoGlobal = ref<string | null>(null)

// Estado local de operaciones en vuelo y errores
const enviando = ref(false)
const mensajeError = ref<string | null>(null)
const mensajeExito = ref<string | null>(null)

// Control de apertura del diálogo de advertencia de cierre
const mostrarDialogoCierre = ref(false)

/**
 * Conserva el número de sesión como borrador textual aunque el control sea type="number".
 * Vue convierte automáticamente a number cuando se usa v-model sobre ese tipo de input;
 * leer value de HTMLInputElement mantiene la invariancia textual que necesitan la validación
 * estricta y el seguimiento dirty, sin truncar decimales ni transformar valores inválidos.
 */
function manejarInputNumeroSesion(evento: Event): void {
  const entrada = evento.target as HTMLInputElement | null
  if (!entrada) return

  numeroSesionInput.value = entrada.value
  numeroSesionDirty.value = true
}

/**
 * Sincroniza los borradores locales con el estado autoritativo del backend.
 * Reglas de gestión de drafts (H1):
 * - En transiciones institucionales (cambio de estado_global), se resincroniza todo y se limpian los dirty flags.
 * - Dentro del mismo estado global:
 *   - Si un campo no está dirty: se actualiza con el valor confirmado del backend.
 *   - Si un campo está dirty y el snapshot confirma exactamente el valor local tipeado: se limpia el dirty flag.
 *   - Si un campo está dirty y el snapshot trae un valor distinto (ej. por eventos de presencia/test ajenos):
 *     SE CONSERVA el texto que el operador está editando sin pisarlo.
 */
watch(
  () => props.estado,
  (nuevoEstado) => {
    if (!nuevoEstado) {
      numeroSesionInput.value = ''
      presidenciaInput.value = ''
      secretariaInput.value = ''
      numeroSesionDirty.value = false
      presidenciaDirty.value = false
      secretariaDirty.value = false
      ultimoEstadoGlobal.value = null
      return
    }

    const estadoGlobalActual = nuevoEstado.estado_global
    const esTransicionEstado = estadoGlobalActual !== ultimoEstadoGlobal.value

    if (esTransicionEstado) {
      // Transición institucional real: resincronizamos todo y reiniciamos el estado dirty
      ultimoEstadoGlobal.value = estadoGlobalActual
      numeroSesionDirty.value = false
      presidenciaDirty.value = false
      secretariaDirty.value = false

      if (estadoGlobalActual === 'PREPARANDO' && nuevoEstado.preparacion) {
        numeroSesionInput.value =
          nuevoEstado.preparacion.numero_sesion !== null
            ? String(nuevoEstado.preparacion.numero_sesion)
            : ''
        presidenciaInput.value = nuevoEstado.preparacion.presidencia ?? ''
        secretariaInput.value = nuevoEstado.preparacion.secretaria_legislativa ?? ''
      } else if (estadoGlobalActual === 'SESION_ABIERTA' && nuevoEstado.sesion) {
        numeroSesionInput.value = String(nuevoEstado.sesion.numero_sesion)
        presidenciaInput.value = nuevoEstado.sesion.presidencia ?? ''
        secretariaInput.value = nuevoEstado.sesion.secretaria_legislativa ?? ''
      } else {
        numeroSesionInput.value = ''
        presidenciaInput.value = ''
        secretariaInput.value = ''
      }
    } else {
      // Mismo estado global: aplicamos dirty tracking selectivo por campo
      if (estadoGlobalActual === 'PREPARANDO' && nuevoEstado.preparacion) {
        const prep = nuevoEstado.preparacion
        const numConfirmado = prep.numero_sesion !== null ? String(prep.numero_sesion) : ''
        const presConfirmada = prep.presidencia ?? ''
        const secConfirmada = prep.secretaria_legislativa ?? ''

        // Número de sesión
        if (!numeroSesionDirty.value) {
          numeroSesionInput.value = numConfirmado
        } else if (numeroSesionInput.value.trim() === numConfirmado) {
          numeroSesionDirty.value = false
        }

        // Presidencia
        if (!presidenciaDirty.value) {
          presidenciaInput.value = presConfirmada
        } else if (presidenciaInput.value === presConfirmada) {
          presidenciaDirty.value = false
        }

        // Secretaría Legislativa
        if (!secretariaDirty.value) {
          secretariaInput.value = secConfirmada
        } else if (secretariaInput.value === secConfirmada) {
          secretariaDirty.value = false
        }
      } else if (estadoGlobalActual === 'SESION_ABIERTA' && nuevoEstado.sesion) {
        const ses = nuevoEstado.sesion
        // En sesión abierta el número es inmutable
        numeroSesionInput.value = String(ses.numero_sesion)
        const presConfirmada = ses.presidencia ?? ''
        const secConfirmada = ses.secretaria_legislativa ?? ''

        if (!presidenciaDirty.value) {
          presidenciaInput.value = presConfirmada
        } else if (presidenciaInput.value === presConfirmada) {
          presidenciaDirty.value = false
        }

        if (!secretariaDirty.value) {
          secretariaInput.value = secConfirmada
        } else if (secretariaInput.value === secConfirmada) {
          secretariaDirty.value = false
        }
      }
    }
  },
  { immediate: true },
)

/**
 * Valida el número de sesión según las reglas institucionales (M3).
 * Debe ser vacío (opcional en preparación) o un entero positivo estricto (> 0).
 * No trunca decimales ni convierte silenciosamente texto inválido.
 */
function validarNumeroSesion(valor: string): { valido: boolean; numero?: number; error?: string } {
  const texto = valor.trim()
  if (texto === '') {
    return { valido: true }
  }
  // Expresión regular que exige dígitos exclusivamente (sin signos, puntos ni exponentes)
  if (!/^\d+$/.test(texto)) {
    return {
      valido: false,
      error: 'El número de sesión debe ser un número entero positivo mayor a cero.',
    }
  }
  const num = Number(texto)
  if (!Number.isInteger(num) || num <= 0) {
    return {
      valido: false,
      error: 'El número de sesión debe ser un número entero positivo mayor a cero.',
    }
  }
  return { valido: true, numero: num }
}

// Helper para extraer un mensaje de error legible sin recurrir a tipos inseguros
function extraerMensajeError(error: unknown, mensajePorDefecto: string): string {
  if (typeof error === 'object' && error !== null) {
    if ('mensaje' in error && typeof (error as { mensaje: unknown }).mensaje === 'string') {
      return (error as { mensaje: string }).mensaje
    }
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message
    }
  }
  return mensajePorDefecto
}

// =============================================================================
// Capacidades y autorizaciones de comandos
// =============================================================================

const puedePrepararSala = computed(() => {
  return (
    conectado.value &&
    (props.estado?.capacidades?.preparar_sala?.habilitada ?? false) &&
    !enviando.value
  )
})

const motivosPrepararSala = computed(() =>
  traducirMotivos(props.estado?.capacidades?.preparar_sala?.motivos),
)

const puedeActualizarPreparacion = computed(() => {
  return (
    conectado.value &&
    (props.estado?.capacidades?.actualizar_preparacion?.habilitada ?? false) &&
    !enviando.value
  )
})

const puedeCancelarPreparacion = computed(() => {
  return (
    conectado.value &&
    (props.estado?.capacidades?.cancelar_preparacion?.habilitada ?? false) &&
    !enviando.value
  )
})

const puedeAbrirSesion = computed(() => {
  return (
    conectado.value &&
    (props.estado?.capacidades?.abrir_sesion?.habilitada ?? false) &&
    !enviando.value
  )
})

const motivosAbrirSesion = computed(() =>
  traducirMotivos(props.estado?.capacidades?.abrir_sesion?.motivos),
)

const puedeActualizarSesion = computed(() => {
  return (
    conectado.value &&
    (props.estado?.capacidades?.actualizar_sesion?.habilitada ?? false) &&
    !enviando.value &&
    presidenciaInput.value.trim().length > 0 &&
    secretariaInput.value.trim().length > 0
  )
})

const puedeCerrarSesion = computed(() => {
  return (
    conectado.value &&
    (props.estado?.capacidades?.cerrar_sesion?.habilitada ?? false) &&
    !enviando.value
  )
})

const motivosCerrarSesion = computed(() =>
  traducirMotivos(props.estado?.capacidades?.cerrar_sesion?.motivos),
)

// =============================================================================
// Ejecutores de comandos
// =============================================================================

function limpiarMensajes(): void {
  mensajeError.value = null
  mensajeExito.value = null
}

/**
 * Ejecuta el comando de preparar sala (CU-01).
 */
async function ejecutarPrepararSala(): Promise<void> {
  if (!puedePrepararSala.value) return
  limpiarMensajes()
  enviando.value = true

  try {
    await cliente.value.prepararSala()
    // Éxito: el nuevo snapshot SSE reflejará PREPARANDO
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'Error al preparar la sala')
  } finally {
    enviando.value = false
  }
}

/**
 * Guarda los datos institucionales editados durante PREPARANDO.
 */
async function ejecutarActualizarPreparacion(): Promise<void> {
  if (!puedeActualizarPreparacion.value) return
  limpiarMensajes()

  // Validación estricta del número de sesión (M3)
  const validacionNum = validarNumeroSesion(numeroSesionInput.value)
  if (!validacionNum.valido) {
    mensajeError.value = validacionNum.error ?? 'Número de sesión inválido'
    return
  }

  enviando.value = true

  try {
    const datosActualizacion: {
      numero_sesion?: number
      presidencia?: string
      secretaria_legislativa?: string
    } = {
      presidencia: presidenciaInput.value,
      secretaria_legislativa: secretariaInput.value,
    }

    if (validacionNum.numero !== undefined) {
      datosActualizacion.numero_sesion = validacionNum.numero
    }

    await cliente.value.actualizarPreparacion(datosActualizacion)
    mensajeExito.value = 'Datos de preparación enviados correctamente.'
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'Error al actualizar los datos de preparación')
  } finally {
    enviando.value = false
  }
}

/**
 * Cancela la preparación activa devolviendo el sistema a SIN_PREPARAR (CU-02).
 */
async function ejecutarCancelarPreparacion(): Promise<void> {
  if (!puedeCancelarPreparacion.value) return
  limpiarMensajes()
  enviando.value = true

  try {
    await cliente.value.cancelarPreparacion()
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'Error al cancelar la preparación de sala')
  } finally {
    enviando.value = false
  }
}

/**
 * Abre formalmente la sesión desde PREPARANDO (CU-05).
 */
async function ejecutarAbrirSesion(): Promise<void> {
  if (!puedeAbrirSesion.value) return
  limpiarMensajes()
  enviando.value = true

  try {
    await cliente.value.abrirSesion()
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'Error al abrir la sesión formal')
  } finally {
    enviando.value = false
  }
}

/**
 * Actualiza Presidencia y/o Secretaría durante una sesión abierta (CU-06).
 */
async function ejecutarActualizarSesion(): Promise<void> {
  if (!puedeActualizarSesion.value) return
  limpiarMensajes()
  enviando.value = true

  try {
    await cliente.value.actualizarSesion({
      presidencia: presidenciaInput.value.trim(),
      secretaria_legislativa: secretariaInput.value.trim(),
    })
    mensajeExito.value = 'Autoridades actualizadas correctamente.'
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'Error al actualizar las autoridades')
  } finally {
    enviando.value = false
  }
}

/**
 * Inicia el flujo de cierre de sesión: verifica palabra pendiente antes de enviar (CU-07).
 */
function iniciarCerrarSesion(): void {
  if (!puedeCerrarSesion.value) return
  limpiarMensajes()

  // Verificamos si existe palabra pendiente en el estado autoritativo
  const hayOrador =
    props.estado?.palabra?.orador !== null && props.estado?.palabra?.orador !== undefined
  const hayCola = (props.estado?.palabra?.cola?.length ?? 0) > 0

  if (hayOrador || hayCola) {
    // Abrimos el diálogo modal de advertencia confirmatoria
    mostrarDialogoCierre.value = true
  } else {
    // Si no hay orador ni cola, procedemos directamente al cierre normal
    confirmarCerrarSesion()
  }
}

/**
 * Envía el comando de cierre normal de sesión al backend.
 */
async function confirmarCerrarSesion(): Promise<void> {
  mostrarDialogoCierre.value = false
  limpiarMensajes()
  enviando.value = true

  try {
    await cliente.value.cerrarSesion()
  } catch (error: unknown) {
    mensajeError.value = extraerMensajeError(error, 'Error al cerrar la sesión')
  } finally {
    enviando.value = false
  }
}

function cancelarAdvertenciaCierre(): void {
  mostrarDialogoCierre.value = false
}

// Textos e insignias del panel
const textoBadge = computed(() => {
  if (!props.estado) return 'Esperando datos...'
  switch (props.estado.estado_global) {
    case 'SESION_ABIERTA':
      return 'Sesión activa'
    case 'PREPARANDO':
      return 'Preparando sala'
    case 'SIN_PREPARAR':
      return 'Sin preparar'
    default:
      return props.estado.estado_global
  }
})

const claseBadge = computed(() => {
  switch (props.estado?.estado_global) {
    case 'SESION_ABIERTA':
      return 'bg-emerald-950 text-emerald-300 border border-emerald-700'
    case 'PREPARANDO':
      return 'bg-cyan-950 text-cyan-300 border border-cyan-700'
    case 'SIN_PREPARAR':
    default:
      return 'bg-slate-800 text-slate-300 border border-slate-700'
  }
})
</script>

<template>
  <PanelContenedor
    titulo="Sesión y votación"
    subtitulo="Control institucional y ciclo de votaciones"
    data-testid="panel-sesion-votacion"
    :badge="textoBadge"
    :clase-badge="claseBadge"
  >
    <div class="space-y-4 text-sm text-slate-300">
      <!-- Notificaciones de error o éxito de comandos locales -->
      <div
        v-if="mensajeError"
        data-testid="alerta-error-comando"
        class="flex items-center justify-between gap-2 rounded-lg border border-rose-700/80 bg-rose-950/80 p-3 text-xs text-rose-200"
      >
        <div class="flex items-center gap-2">
          <span class="font-bold text-rose-400">Error:</span>
          <span>{{ mensajeError }}</span>
        </div>
        <button
          type="button"
          class="rounded p-1 text-rose-400 hover:bg-rose-900/50"
          @click="limpiarMensajes"
        >
          ✕
        </button>
      </div>

      <div
        v-if="mensajeExito"
        data-testid="alerta-exito-comando"
        class="flex items-center justify-between gap-2 rounded-lg border border-emerald-700/80 bg-emerald-950/80 p-3 text-xs text-emerald-200"
      >
        <div class="flex items-center gap-2">
          <span class="font-bold text-emerald-400">Éxito:</span>
          <span>{{ mensajeExito }}</span>
        </div>
        <button
          type="button"
          class="rounded p-1 text-emerald-400 hover:bg-emerald-900/50"
          @click="limpiarMensajes"
        >
          ✕
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- 1. VISTA: SIN_PREPARAR -->
      <!-- ===================================================================== -->
      <div
        v-if="estado?.estado_global === 'SIN_PREPARAR'"
        data-testid="vista-sin-preparar"
        class="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400 border border-slate-700"
          >
            🏛
          </div>
          <div>
            <h4 class="font-bold text-slate-100">Sala sin preparar</h4>
            <p class="text-xs text-slate-400">
              Inicie la preparación para congelar el padrón, registrar presencias y configurar
              autoridades.
            </p>
          </div>
        </div>

        <!-- Botón principal de Preparar Sala -->
        <div class="pt-2">
          <button
            type="button"
            data-testid="btn-preparar-sala"
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md hover:bg-cyan-500 active:bg-cyan-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!puedePrepararSala"
            @click="ejecutarPrepararSala"
          >
            <span
              v-if="enviando"
              class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"
            />
            <span>{{ enviando ? 'Preparando sala...' : 'Preparar sala' }}</span>
          </button>

          <!-- Motivos de bloqueo si preparar_sala está deshabilitada -->
          <div
            v-if="!puedePrepararSala && motivosPrepararSala.length > 0"
            data-testid="motivos-preparar-sala"
            class="mt-2 space-y-1 rounded bg-slate-900/80 p-2 text-[11px] text-amber-300 border border-slate-800"
          >
            <p v-for="(motivo, idx) in motivosPrepararSala" :key="idx">• {{ motivo }}</p>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 2. VISTA: PREPARANDO -->
      <!-- ===================================================================== -->
      <div
        v-else-if="estado?.estado_global === 'PREPARANDO'"
        data-testid="vista-preparando"
        class="space-y-4 rounded-xl border border-cyan-900/40 bg-slate-950/60 p-4"
      >
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h4 class="font-bold text-slate-100">Etapa de preparación de sala</h4>
          </div>
          <span class="text-xs font-mono text-cyan-400">Padrón congelado</span>
        </div>

        <!-- Formulario de carga y edición de número y autoridades -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <!-- Número de Sesión -->
          <div>
            <label for="prep-numero-sesion" class="block text-xs font-semibold text-slate-300 mb-1">
              Sesión Nº
            </label>
            <input
              id="prep-numero-sesion"
              :value="numeroSesionInput"
              type="number"
              min="1"
              step="1"
              data-testid="input-numero-sesion"
              placeholder="Ej: 42"
              class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
              :disabled="enviando || !conectado"
              @input="manejarInputNumeroSesion"
            />
          </div>

          <!-- Presidencia -->
          <div>
            <label for="prep-presidencia" class="block text-xs font-semibold text-slate-300 mb-1">
              Presidencia
            </label>
            <input
              id="prep-presidencia"
              v-model="presidenciaInput"
              type="text"
              data-testid="input-presidencia"
              placeholder="Nombre de autoridad"
              class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
              :disabled="enviando || !conectado"
              @input="presidenciaDirty = true"
            />
          </div>

          <!-- Secretaría Legislativa -->
          <div>
            <label for="prep-secretaria" class="block text-xs font-semibold text-slate-300 mb-1">
              Secretaría Legislativa
            </label>
            <input
              id="prep-secretaria"
              v-model="secretariaInput"
              type="text"
              data-testid="input-secretaria"
              placeholder="Nombre de autoridad"
              class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
              :disabled="enviando || !conectado"
              @input="secretariaDirty = true"
            />
          </div>
        </div>

        <!-- Botón para guardar/actualizar preparación -->
        <div class="flex justify-end">
          <button
            type="button"
            data-testid="btn-guardar-preparacion"
            class="rounded-lg border border-cyan-700 bg-cyan-950/80 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-900 active:bg-cyan-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!puedeActualizarPreparacion"
            @click="ejecutarActualizarPreparacion"
          >
            Guardar datos de sesión
          </button>
        </div>

        <!-- Acciones institucionales: Abrir sesión y Cancelar preparación -->
        <div class="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              data-testid="btn-cancelar-preparacion"
              class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-slate-700 active:bg-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!puedeCancelarPreparacion"
              @click="ejecutarCancelarPreparacion"
            >
              Cancelar preparación
            </button>

            <button
              type="button"
              data-testid="btn-abrir-sesion"
              class="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md hover:bg-emerald-500 active:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!puedeAbrirSesion"
              @click="ejecutarAbrirSesion"
            >
              <span
                v-if="enviando"
                class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"
              />
              <span>{{ enviando ? 'Abriendo...' : 'Abrir sesión' }}</span>
            </button>
          </div>

          <!-- Motivos de bloqueo de apertura si abrir_sesion está deshabilitada -->
          <div
            v-if="!puedeAbrirSesion && motivosAbrirSesion.length > 0"
            data-testid="motivos-abrir-sesion"
            class="space-y-1 rounded bg-slate-900/90 p-2 text-xs text-amber-300 border border-slate-800"
          >
            <p class="font-bold text-[11px] uppercase tracking-wider text-amber-400">
              Requisitos pendientes para abrir sesión:
            </p>
            <p v-for="(motivo, idx) in motivosAbrirSesion" :key="idx" class="text-slate-300">
              • {{ motivo }}
            </p>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 3. VISTA: SESION_ABIERTA -->
      <!-- ===================================================================== -->
      <div
        v-else-if="estado?.estado_global === 'SESION_ABIERTA'"
        data-testid="vista-sesion-abierta"
        class="space-y-4 rounded-xl border border-emerald-900/40 bg-slate-950/60 p-4"
      >
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <h4 class="font-bold text-slate-100">Sesión formal abierta</h4>
          </div>
          <!-- Número de sesión presentado como dato inmutable -->
          <span
            data-testid="numero-sesion-inmutable"
            class="rounded bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-700"
          >
            Sesión Nº {{ estado.sesion?.numero_sesion }}
          </span>
        </div>

        <!-- Resumen compacto de Quórum en Q1 durante sesión abierta (M1) -->
        <div
          v-if="estado.quorum"
          data-testid="quorum-resumen-sesion"
          class="flex items-center justify-between rounded-lg bg-slate-900/80 px-3 py-2 border border-slate-800 text-xs"
        >
          <div class="flex items-center gap-2">
            <span class="text-slate-400 font-semibold">Quórum en sala:</span>
            <span class="font-bold text-slate-100">
              {{ estado.quorum.cantidad_presentes }} / {{ estado.quorum.requerido }} presentes
            </span>
          </div>
          <span
            data-testid="badge-quorum-resumen-sesion"
            :class="[
              'rounded px-2 py-0.5 text-[11px] font-bold',
              estado.quorum.alcanzado
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                : 'bg-amber-950 text-amber-300 border border-amber-700',
            ]"
          >
            {{ estado.quorum.alcanzado ? 'Quórum legal' : 'Sin quórum' }}
          </span>
        </div>

        <!-- Edición de autoridades durante sesión abierta -->
        <div class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                for="sesion-presidencia"
                class="block text-xs font-semibold text-slate-300 mb-1"
              >
                Presidencia en sesión
              </label>
              <input
                id="sesion-presidencia"
                v-model="presidenciaInput"
                type="text"
                data-testid="input-presidencia-sesion"
                placeholder="Nombre de autoridad"
                class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                :disabled="enviando || !conectado"
                @input="presidenciaDirty = true"
              />
            </div>

            <div>
              <label
                for="sesion-secretaria"
                class="block text-xs font-semibold text-slate-300 mb-1"
              >
                Secretaría Legislativa en sesión
              </label>
              <input
                id="sesion-secretaria"
                v-model="secretariaInput"
                type="text"
                data-testid="input-secretaria-sesion"
                placeholder="Nombre de autoridad"
                class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                :disabled="enviando || !conectado"
                @input="secretariaDirty = true"
              />
            </div>
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              data-testid="btn-actualizar-autoridades"
              class="rounded-lg border border-emerald-700 bg-emerald-950/80 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900 active:bg-emerald-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!puedeActualizarSesion"
              @click="ejecutarActualizarSesion"
            >
              Actualizar autoridades
            </button>
          </div>
        </div>

        <!--
          El ciclo de votación vive en un componente enfocado para que la gestión de
          borradores, CA-062, finalización y desempate no se mezcle con autoridades.
          Recibe la conexión ya resuelta por este panel y adopta siempre la votación
          proyectada en `estado`, sin mantener una copia institucional paralela.
        -->
        <GestionVotacion
          :estado="estado"
          :cliente="cliente"
          :conectado="conectado"
          :punto-preseleccionado="puntoPreseleccionado ?? null"
        />

        <!-- Acción de Cerrar Sesión -->
        <div class="flex flex-col gap-2 pt-3 border-t border-slate-800">
          <div class="flex justify-end">
            <button
              type="button"
              data-testid="btn-cerrar-sesion"
              class="flex items-center gap-1.5 rounded-lg border border-rose-700 bg-rose-950/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-900 active:bg-rose-950 shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!puedeCerrarSesion"
              @click="iniciarCerrarSesion"
            >
              <span
                v-if="enviando"
                class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-rose-400 border-t-transparent"
              />
              <span>{{ enviando ? 'Cerrando sesión...' : 'Cerrar sesión' }}</span>
            </button>
          </div>

          <!-- Motivos de bloqueo si cerrar_sesion está deshabilitada -->
          <div
            v-if="!puedeCerrarSesion && motivosCerrarSesion.length > 0"
            data-testid="motivos-cerrar-sesion"
            class="space-y-1 rounded bg-slate-900/90 p-2 text-xs text-amber-300 border border-slate-800"
          >
            <p v-for="(motivo, idx) in motivosCerrarSesion" :key="idx">• {{ motivo }}</p>
          </div>
        </div>
      </div>

      <!-- Estado inicial de carga si no hay snapshot -->
      <div
        v-else
        class="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg"
      >
        Conectando y esperando estado autoritativo del backend...
      </div>
    </div>

    <!-- Diálogo de confirmación ante cierre de sesión con palabra pendiente -->
    <DialogoConfirmacionCierre
      :palabra="estado?.palabra ?? null"
      :abierto="mostrarDialogoCierre"
      :enviando="enviando"
      @confirmar="confirmarCerrarSesion"
      @cancelar="cancelarAdvertenciaCierre"
    />
  </PanelContenedor>
</template>
