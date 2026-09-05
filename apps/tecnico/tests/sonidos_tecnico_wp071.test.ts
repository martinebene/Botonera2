/**
 * Sonidos del recinto reproducidos por el puesto de Apoyo Técnico (WP-071).
 *
 * ## Qué demuestra esta suite
 *
 * El objetivo del WP es operativo: poder tomar el audio del salón desde el equipo técnico.
 * Para eso Apoyo Técnico tiene que sonar **exactamente igual** que la Pantalla del Recinto,
 * y tiene que callarse exactamente en los mismos casos.
 *
 * Las pruebas se apoyan en el mismo cableado que arma `app.vue`: la sincronización real
 * (`crearSincronizacionTecnica`, con clientes falsos que no tocan la red) conectada al
 * composable compartido `useSonidosRecinto`. Lo único sustituido es el reproductor, porque
 * lo que acá se verifica es la decisión de sonar, no el audio. La reproducción real en un
 * navegador la demuestra el E2E integrado `sonidos_tecnico_wp071.spec.ts`.
 *
 * Los quince escenarios no se escriben acá: vienen de la tabla canónica compartida que
 * también ejercita la suite del Recinto. Ésa es la forma concreta de comprobar paridad 1:1
 * en lugar de mantener dos listas parecidas.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type Ref } from 'vue'
import { useSonidosRecinto, type MotorSonidosRecinto } from '@botonera2/frontend-shared'
import type {
  ClienteApoyoTecnico,
  ClienteModeracion,
  ClienteRecinto,
  EstadoRecinto,
  Suscripcion,
} from '@botonera2/api-client'
import {
  crearSincronizacionTecnica,
  type SincronizacionTecnica,
} from '../app/composables/useEstadoTecnico'
import { resolverRutaAsset } from '../app/utils/rutas'
import {
  crearEscenariosSonoros,
  eventosCubiertos,
  EVENTOS_SONOROS_RECINTO,
} from '../../../packages/frontend-shared/tests/helpers/escenarios_sonoros'
import {
  crearEstadoRecintoPrueba,
  crearSonidosRecintoPrueba,
} from '../../../packages/frontend-shared/tests/helpers/estado_recinto'

/** Motor de prueba: anota qué le pidieron reproducir y qué configuración adoptó. */
function crearMotorEspia() {
  const reproducidos: string[] = []
  const motor: MotorSonidosRecinto = {
    configurar: () => {},
    reproducir: (evento) => {
      reproducidos.push(evento)
    },
    liberar: () => {},
  }
  return { motor, reproducidos }
}

/**
 * Cliente falso que expone su callback de estado y de conexión.
 *
 * Reproduce la superficie mínima que consume `crearSincronizacionTecnica`: una suscripción
 * cancelable y los tres callbacks del contrato. Ninguna prueba abre un `EventSource` ni
 * emite una petición HTTP.
 */
function crearClienteSuscribible<T>() {
  let alEstado: ((estado: T) => void) | undefined
  let alCambiarConexion: ((conectado: boolean) => void) | undefined
  let activa = true
  const suscripcion: Suscripcion = {
    get activa() {
      return activa
    },
    cancelar: () => {
      activa = false
    },
  }
  const cliente = {
    suscribirEstado: vi.fn((opciones: Record<string, never>) => {
      alEstado = opciones.alEstado as unknown as (estado: T) => void
      alCambiarConexion = opciones.alCambiarConexion as unknown as (conectado: boolean) => void
      return suscripcion
    }),
  }
  return {
    cliente,
    emitir: (estado: T) => alEstado?.(estado),
    cambiarConexion: (conectado: boolean) => alCambiarConexion?.(conectado),
    cancelado: () => !activa,
  }
}

/** Banco de pruebas con el cableado completo del puesto técnico. */
interface BancoTecnico {
  sincronizacion: SincronizacionTecnica
  /** Publica un `EstadoRecinto` por el stream público, como haría el backend. */
  emitirRecinto: (estado: EstadoRecinto) => void
  /** Abre o corta el stream público. */
  conexionRecinto: (conectado: boolean) => void
  /** Número visible de la cuenta regresiva, el mismo que muestra el panel de Transmisión. */
  segundos: Ref<number | null>
  reproducidos: string[]
  recinto: ReturnType<typeof crearClienteSuscribible<EstadoRecinto>>
  tecnico: ReturnType<typeof crearClienteSuscribible<never>>
  moderacion: ReturnType<typeof crearClienteSuscribible<never>>
  detener: () => void
}

const bancos: BancoTecnico[] = []

afterEach(() => {
  while (bancos.length > 0) bancos.pop()?.detener()
})

/**
 * Monta el cableado de `app.vue` sin Nuxt ni DOM.
 *
 * Es deliberadamente el mismo orden de dependencias que la SPA: la sincronización expone
 * `estadoRecinto` y `estadoConexionRecinto`, y esos dos refs —más el número de la cuenta
 * regresiva que ya calcula el panel de Transmisión— son lo único que recibe el composable.
 */
function montarTecnico(): BancoTecnico {
  const tecnico = crearClienteSuscribible<never>()
  const moderacion = crearClienteSuscribible<never>()
  const recinto = crearClienteSuscribible<EstadoRecinto>()
  const espia = crearMotorEspia()
  const segundos = ref<number | null>(null)
  const scope = effectScope()

  const sincronizacion = crearSincronizacionTecnica({
    cliente: tecnico.cliente as unknown as ClienteApoyoTecnico,
    clienteModeracion: moderacion.cliente as unknown as ClienteModeracion,
    clienteRecinto: recinto.cliente as unknown as ClienteRecinto,
  })
  sincronizacion.iniciar()

  scope.run(() => {
    useSonidosRecinto({
      estado: sincronizacion.estadoRecinto,
      estadoConexion: sincronizacion.estadoConexionRecinto,
      segundosCuentaRegresiva: segundos,
      resolverUrl: resolverRutaAsset,
      motor: espia.motor,
    })
  })

  const banco: BancoTecnico = {
    sincronizacion,
    emitirRecinto: recinto.emitir,
    conexionRecinto: recinto.cambiarConexion,
    segundos,
    reproducidos: espia.reproducidos,
    recinto,
    tecnico,
    moderacion,
    detener: () => {
      scope.stop()
      sincronizacion.cancelar()
    },
  }
  bancos.push(banco)
  return banco
}

/**
 * Deja el puesto técnico con el stream público abierto y una baseline ya adoptada.
 *
 * Después de esto, cualquier estado nuevo cuenta como hecho posterior y debe sonar.
 */
function conBaseline(banco: BancoTecnico, baseline: EstadoRecinto): void {
  banco.conexionRecinto(true)
  banco.emitirRecinto(baseline)
  banco.reproducidos.length = 0
}

// =============================================================================
// 1. Paridad 1:1 con la Pantalla del Recinto
// =============================================================================

describe('Paridad sonora con la Pantalla del Recinto', () => {
  const escenarios = crearEscenariosSonoros()

  it('la tabla canónica cubre exactamente los quince eventos del contrato', () => {
    // Si el contrato sumara un evento y nadie escribiera su escenario, esta comparación
    // fallaría antes que cualquier prueba de comportamiento.
    expect([...eventosCubiertos(escenarios)].sort()).toEqual([...EVENTOS_SONOROS_RECINTO].sort())
  })

  for (const escenario of escenarios) {
    it(`reproduce ${escenario.evento} cuando ${escenario.descripcion}`, () => {
      const banco = montarTecnico()
      conBaseline(banco, escenario.previo)

      banco.emitirRecinto(escenario.actual)
      if (escenario.segundos !== undefined) {
        banco.segundos.value = escenario.segundos.previo
        banco.segundos.value = escenario.segundos.actual
      }

      expect(banco.reproducidos).toContain(escenario.evento)
    })
  }

  it('no reproduce ningún evento ajeno al hecho ocurrido', () => {
    // Un escenario representativo alcanza para demostrar la ausencia de ruido: si la
    // pantalla sonorizara de más, aparecerían eventos que el hecho no produjo.
    const escenario = escenarios.find((caso) => caso.evento === 'votacion_abierta')
    expect(escenario).toBeDefined()
    const banco = montarTecnico()
    conBaseline(banco, escenario!.previo)

    banco.emitirRecinto(escenario!.actual)

    expect(banco.reproducidos).toEqual(['votacion_abierta'])
  })
})

// =============================================================================
// 2. Silencio obligatorio: baseline, recarga y reconexión
// =============================================================================

describe('El puesto técnico nunca reproduce historia', () => {
  const sesionAvanzada = crearEstadoRecintoPrueba({
    revision: 42,
    estado_global: 'SESION_ABIERTA',
    sonidos: crearSonidosRecintoPrueba(),
  })

  it('no suena al adoptar el primer snapshot, aunque describa una sesión en curso', () => {
    const banco = montarTecnico()

    banco.conexionRecinto(true)
    banco.emitirRecinto(sesionAvanzada)

    expect(banco.reproducidos).toEqual([])
  })

  it('no suena cuando el estado llega sin el stream público abierto', () => {
    // Es el caso de la recuperación: el cliente pide un snapshot REST antes de reabrir el
    // stream. Ese snapshot describe todo lo ocurrido mientras el puesto estuvo aislado.
    const banco = montarTecnico()
    conBaseline(banco, crearEstadoRecintoPrueba({ revision: 1 }))

    banco.conexionRecinto(false)
    banco.emitirRecinto({ ...sesionAvanzada, revision: 43 })

    expect(banco.reproducidos).toEqual([])
  })

  it('vuelve a sonar recién con el primer hecho posterior a la reconexión', () => {
    const banco = montarTecnico()
    conBaseline(banco, crearEstadoRecintoPrueba({ revision: 1 }))

    banco.conexionRecinto(false)
    banco.emitirRecinto({ ...sesionAvanzada, revision: 43 })
    banco.conexionRecinto(true)
    banco.emitirRecinto({ ...sesionAvanzada, revision: 44, estado_global: 'SIN_PREPARAR' })

    expect(banco.reproducidos).toEqual(['sesion_cerrada'])
  })

  it('no duplica sonido si el backend reenvía la misma revisión', () => {
    const banco = montarTecnico()
    const previo = crearEstadoRecintoPrueba({ revision: 10, estado_global: 'PREPARANDO' })
    conBaseline(banco, previo)
    const abierta = crearEstadoRecintoPrueba({ revision: 11, estado_global: 'SESION_ABIERTA' })

    banco.emitirRecinto(abierta)
    banco.emitirRecinto(abierta)
    banco.emitirRecinto({ ...abierta, revision: 11 })

    expect(banco.reproducidos).toEqual(['sesion_abierta'])
  })
})

// =============================================================================
// 3. Superposición y tic local
// =============================================================================

describe('Superposición y cuenta regresiva', () => {
  it('reproduce los dos eventos de una misma revisión, sin encolarlos ni descartarlos', () => {
    const banco = montarTecnico()
    const previo = crearEstadoRecintoPrueba({
      revision: 5,
      estado_global: 'SESION_ABIERTA',
      concejales: [
        {
          nombre: 'Nombre1',
          apellido: 'Apellido1',
          bloque: 'Bloque Verde',
          banca: 1,
          ruta_imagen: 'assets/bancas/banca-01.png',
          presente: true,
          test_activo: false,
          test_expira_en: null,
        },
      ],
    })
    conBaseline(banco, previo)

    // Una sola revisión con dos hechos simultáneos: arranca la transmisión y la banca 1
    // se ausenta. Los dos sonidos deben salir, en el orden canónico de la detección.
    banco.emitirRecinto({
      ...previo,
      revision: 6,
      concejales: previo.concejales.map((concejal) => ({ ...concejal, presente: false })),
      tecnico: {
        transmision: {
          estado: 'EN_VIVO',
          iniciada_en: '2026-09-05T10:00:00Z',
          en_vivo_desde: '2026-09-05T10:00:00Z',
          cuenta_regresiva_segundos: null,
          segundos_restantes: null,
        },
        aviso: null,
      },
    })

    expect(banco.reproducidos).toEqual(['transmision_iniciada', 'concejal_ausente'])
  })

  it('acompaña cada cambio de segundo con un tic, sin pedir una revisión por segundo', () => {
    const banco = montarTecnico()
    conBaseline(banco, crearEstadoRecintoPrueba({ revision: 1 }))
    const revisionesAntes = banco.recinto.cliente.suscribirEstado.mock.calls.length

    banco.segundos.value = 4
    banco.segundos.value = 3
    banco.segundos.value = 2
    banco.segundos.value = 1

    expect(banco.reproducidos).toEqual([
      'transmision_cuenta_regresiva_tic',
      'transmision_cuenta_regresiva_tic',
      'transmision_cuenta_regresiva_tic',
    ])
    // El tic no abrió ninguna suscripción nueva: el número lo baja el reloj local.
    expect(banco.recinto.cliente.suscribirEstado.mock.calls.length).toBe(revisionesAntes)
  })

  it('no suena al entrar a una cuenta regresiva ya empezada ni al terminarla', () => {
    const banco = montarTecnico()
    conBaseline(banco, crearEstadoRecintoPrueba({ revision: 1 }))

    // Adoptar un snapshot en mitad de la cuenta muestra el número, pero no es un cambio de
    // segundo; y el final de la cuenta ya tiene el sonido de inicio de transmisión.
    banco.segundos.value = 3
    banco.segundos.value = null

    expect(banco.reproducidos).toEqual([])
  })
})

// =============================================================================
// 4. La tercera suscripción es de solo lectura y no altera lo que ya existía
// =============================================================================

describe('Suscripción pública del puesto técnico', () => {
  it('abre una única suscripción a cada una de las tres proyecciones', () => {
    const banco = montarTecnico()

    banco.sincronizacion.iniciar()

    expect(banco.tecnico.cliente.suscribirEstado).toHaveBeenCalledTimes(1)
    expect(banco.moderacion.cliente.suscribirEstado).toHaveBeenCalledTimes(1)
    expect(banco.recinto.cliente.suscribirEstado).toHaveBeenCalledTimes(1)
  })

  it('cancela también la suscripción pública sin borrar el último estado adoptado', () => {
    const banco = montarTecnico()
    conBaseline(banco, crearEstadoRecintoPrueba({ revision: 7 }))

    banco.sincronizacion.cancelar()

    expect(banco.recinto.cancelado()).toBe(true)
    expect(banco.sincronizacion.estadoRecinto.value?.revision).toBe(7)
  })

  it('un corte del canal público no apaga los controles del puesto técnico', () => {
    // Los comandos de transmisión y avisos dependen del canal técnico. Perder el sonido no
    // puede deshabilitar la operación: son dos planos distintos.
    const banco = montarTecnico()
    banco.tecnico.cambiarConexion(true)
    banco.conexionRecinto(true)

    banco.conexionRecinto(false)

    expect(banco.sincronizacion.conectado.value).toBe(true)
    expect(banco.sincronizacion.estadoConexion.value).toBe('CONECTADO')
    expect(banco.sincronizacion.estadoConexionRecinto.value).toBe('DESCONECTADO')
  })

  it('resuelve las rutas de sonido bajo el prefijo público de Apoyo Técnico', () => {
    // Fuera del runtime de Nuxt el resolutor cae a la raíz; lo que se comprueba acá es la
    // normalización, que es la parte propia de esta aplicación.
    expect(resolverRutaAsset('assets/sonidos/sesion-abierta.wav')).toBe(
      '/assets/sonidos/sesion-abierta.wav',
    )
    expect(resolverRutaAsset('/assets/sonidos/sesion-abierta.wav')).toBe(
      '/assets/sonidos/sesion-abierta.wav',
    )
    expect(resolverRutaAsset('')).toBe('')
  })
})
