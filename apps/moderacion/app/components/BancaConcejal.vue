<script setup lang="ts">
/**
 * Tarjeta compacta de una banca para el operador de Moderación.
 *
 * Comparte con Recinto la jerarquía foto → banca → identidad → bloque → presencia,
 * pero conserva debajo los datos técnicos exclusivos del operador. El componente
 * representa el snapshot recibido: no emite comandos ni modifica presencia o test.
 */

import { computed, ref, watch } from 'vue'
import type { ConcejalModeracion } from '@botonera2/api-client'
import { resolverRutaAsset } from '../utils/rutas'

const props = defineProps<{
  /** Datos completos de la banca y concejal proyectados por el backend. */
  concejal: ConcejalModeracion
  /** Señal derivada de `palabra.orador.banca`; nunca se conserva localmente. */
  esOrador?: boolean
}>()

const errorCargaImagen = ref(false)
const urlImagen = computed(() => resolverRutaAsset(props.concejal.ruta_imagen))

/**
 * Identifica la fotografía que corresponde a la baseline vigente.
 *
 * No alcanza con observar solamente la URL: una preparación nueva puede cambiar la
 * persona de una banca y reutilizar una ruta. La clave completa permite olvidar un
 * error local anterior cuando el snapshot cambia la identidad o la imagen.
 */
const claveImagen = computed(
  () =>
    `${props.concejal.dni}|${props.concejal.nombre}|${props.concejal.apellido}|${props.concejal.ruta_imagen}`,
)

const iniciales = computed(() => {
  const inicialNombre = props.concejal.nombre?.charAt(0) || ''
  const inicialApellido = props.concejal.apellido?.charAt(0) || ''
  return `${inicialNombre}${inicialApellido}`.toUpperCase() || '?'
})

function manejarErrorImagen(): void {
  errorCargaImagen.value = true
}

watch(claveImagen, () => {
  errorCargaImagen.value = false
})
</script>

<template>
  <article
    data-testid="banca-concejal"
    :data-banca="concejal.banca"
    :data-presente="concejal.presente"
    :data-orador="esOrador"
    class="banca-concejal-moderacion relative flex h-full min-h-0 min-w-0 flex-col items-center overflow-hidden rounded-lg border p-1.5 text-center transition-all duration-200 select-none xl:p-2"
    :class="[
      concejal.presente
        ? 'border-emerald-700/80 bg-emerald-950/30 text-slate-100 shadow-sm shadow-emerald-950/40'
        : 'border-slate-700 bg-slate-950/70 text-slate-300 opacity-75',
      concejal.test_activo ? 'ring-2 ring-amber-400 ring-inset' : '',
      esOrador
        ? 'outline-2 outline-offset-[-2px] outline-cyan-300 shadow-lg shadow-cyan-900/60'
        : '',
    ]"
    :aria-label="`Banca ${concejal.banca}, ${concejal.nombre} ${concejal.apellido}, ${concejal.presente ? 'presente' : 'ausente'}`"
  >
    <!-- La foto encabeza la jerarquía común; la banca se superpone sin ocupar otra fila. -->
    <div
      class="foto-banca-moderacion relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-inner xl:h-12 xl:w-12"
    >
      <img
        v-if="!errorCargaImagen && urlImagen"
        data-testid="imagen-concejal"
        :data-ruta-imagen="concejal.ruta_imagen"
        :src="urlImagen"
        :alt="`${concejal.nombre} ${concejal.apellido}`"
        class="h-full w-full object-cover"
        :class="{ 'grayscale opacity-60': !concejal.presente }"
        @error="manejarErrorImagen"
      />
      <div
        v-else
        data-testid="fallback-imagen"
        class="flex h-full w-full items-center justify-center bg-slate-800 text-xs font-bold text-slate-300"
        :title="`${concejal.nombre} ${concejal.apellido}`"
      >
        {{ iniciales }}
      </div>

      <span
        data-testid="numero-banca"
        class="absolute inset-x-0 bottom-0 bg-slate-950/90 px-0.5 py-px text-[7px] font-black leading-tight text-sky-100 xl:text-[8px]"
      >
        Banca {{ concejal.banca }}
      </span>

      <!-- El test continúa como señal técnica, separado de la presencia institucional. -->
      <span
        v-if="concejal.test_activo"
        data-testid="badge-test-activo"
        class="absolute top-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[7px] font-black text-slate-950 shadow-md"
        title="Test físico activo"
      >
        !
      </span>

      <span
        v-if="esOrador"
        data-testid="estado-orador"
        class="absolute top-0 left-0 rounded-br bg-cyan-300 px-1 py-px text-[6px] font-black uppercase text-slate-950"
      >
        Orador
      </span>
    </div>

    <div class="identidad-banca-moderacion mt-1 min-w-0 w-full">
      <p
        data-testid="nombre-concejal"
        class="truncate text-[9px] font-semibold leading-tight xl:text-[10px]"
        :class="concejal.presente ? 'text-slate-100' : 'text-slate-300'"
        :title="`${concejal.nombre} ${concejal.apellido}`"
      >
        {{ concejal.nombre }} {{ concejal.apellido }}
      </p>
      <p
        v-if="concejal.bloque"
        data-testid="bloque-concejal"
        class="mt-0.5 truncate text-[8px] leading-none text-slate-400"
        :title="concejal.bloque"
      >
        {{ concejal.bloque }}
      </p>
    </div>

    <!-- Presencia textual común: nunca depende solamente del color. -->
    <div class="estados-banca-moderacion mt-1 flex w-full flex-col items-center gap-1">
      <div
        data-testid="estado-presencia"
        class="inline-flex w-full items-center justify-center gap-1 rounded-full border px-1 py-px text-[7px] font-bold uppercase tracking-wide xl:text-[8px]"
        :class="
          concejal.presente
            ? 'border-emerald-700/80 bg-emerald-950 text-emerald-300'
            : 'border-slate-600 bg-slate-800 text-slate-200'
        "
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="concejal.presente ? 'bg-emerald-400' : 'bg-slate-400'"
        />
        <span>{{ concejal.presente ? 'Presente' : 'Ausente' }}</span>
      </div>

      <!-- Datos exclusivos de Moderación quedan debajo y en menor jerarquía. -->
      <span
        data-testid="dispositivo-banca"
        class="w-full truncate font-mono text-[7px] leading-none text-slate-500"
        :title="`Dispositivo lógico: ${concejal.dispositivo_votacion}`"
      >
        Disp. {{ concejal.dispositivo_votacion }}
      </span>
      <div
        v-if="concejal.test_activo"
        data-testid="indicador-test"
        class="w-full rounded border border-amber-500 bg-amber-950/90 py-px text-[7px] font-bold uppercase tracking-wide text-amber-200"
      >
        Test de teclado
      </div>
    </div>
  </article>
</template>

<style scoped>
/*
 * En las pantallas de menor altura Q3 comparte una fila del shell con otros
 * cuadrantes. La tarjeta pasa a dos columnas para conservar foto, identidad,
 * presencia, dispositivo y test sin imponer una altura mayor que la fila física.
 */
@media (max-height: 850px) {
  .banca-concejal-moderacion {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.15rem 0.35rem;
    padding: 0.25rem;
  }

  .foto-banca-moderacion {
    grid-row: 1 / -1;
    width: 2rem;
    height: 2rem;
  }

  .identidad-banca-moderacion,
  .estados-banca-moderacion {
    margin-top: 0;
  }

  .estados-banca-moderacion {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-content: start;
    gap: 0.15rem;
  }

  .estados-banca-moderacion [data-testid='indicador-test'] {
    grid-column: 1 / -1;
  }
}
</style>
