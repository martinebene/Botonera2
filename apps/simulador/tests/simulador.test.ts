/**
 * Pruebas unitarias e integradas de componentes para el Simulador Web (@botonera2/simulador).
 *
 * Cobertura obligatoria de WP-034:
 * 1. Renderizado simultáneo de las 12 tarjetas dev01..dev12.
 * 2. Seis acciones funcionales por tarjeta con mapeo exacto a 1/2/3/7/8/9.
 * 3. Body exacto { dispositivo, tecla } emitido a POST /api/v1/entradas/tecla.
 * 4. Fiel reflejo de aceptación funcional (status 200, aceptada=true, motivo).
 * 5. Fiel reflejo de rechazo funcional (status 200, aceptada=false, motivo).
 * 6. Gestión de errores de transporte de red.
 * 7. Cero retries o replays automáticos (exactamente un intento por pulsación).
 * 8. Concurrencia entre dispositivos (dev01 y dev02 pueden emitir simultáneamente sin bloqueo mutuo).
 * 9. Etiqueta neutra "Pres. / Aus." sin reflejar presencia/ausencia en la tarjeta.
 * 10. Ausencia de datos individuales en tarjetas (sin concejal, banca, presencia, votos ni diagnóstico individual).
 * 11. Panel general con estados de conexión (CONECTADO, RECONECTANDO, DESCONECTADO), quórum y votación.
 * 12. Log global acotado en memoria con autoscroll y acción de limpieza.
 * 13. Acción inválida que igualmente se envía a FastAPI para observar su rechazo real.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  ErrorHttp,
  ErrorTransporte,
  type ClienteSimulador,
  type EstadoModeracion,
  type RespuestaTecla,
} from '@botonera2/api-client'
import PanelGeneralSimulador from '../app/components/PanelGeneralSimulador.vue'
import TarjetaDispositivo from '../app/components/TarjetaDispositivo.vue'
import LogPulsaciones from '../app/components/LogPulsaciones.vue'
import App from '../app/app.vue'
import { useSimulador } from '../app/composables/useSimulador'
import { DISPOSITIVOS_SIMULADOR } from '../app/types/simulador'

/**
 * Fabrica un EstadoModeracion mínimo para pruebas del panel general.
 */
function fabricarEstadoModeracionPrueba(
  sobreescrituras: Partial<EstadoModeracion> = {},
): EstadoModeracion {
  return {
    estado_global: 'SESION_ABIERTA',
    revision: 10,
    sesion: {
      fecha_hora_inicio: '2026-08-29T10:00:00Z',
      numero_sesion: 5,
      presidencia: 'Presidencia de Prueba',
      secretaria_legislativa: 'Secretaría de Prueba',
    },
    preparacion: null,
    configuracion: {
      total_bancas: 12,
      filas_bancas: [6, 6],
      modo_seguro: true,
      mayoria_simple_estricta: true,
    },
    quorum: {
      cantidad_presentes: 9,
      requerido: 7,
      alcanzado: true,
    },
    concejales: [],
    votacion: {
      id: 'vot-01',
      numero_votacion: 3,
      tipo: 'PROYECTO_ORDENANZA',
      tema: 'Presupuesto Municipal 2027',
      tipo_mayoria: 'SIMPLE',
      factor: 0,
      base: 'VOTOS_COMPUTABLES',
      estado_recepcion: 'EN_CURSO',
      fecha_hora_apertura: '2026-08-29T10:30:00Z',
      cantidad_votos_recibidos: 5,
      total_votantes_esperados: 9,
      votos_individuales: {},
      conteos: {
        positivos: 4,
        negativos: 1,
        abstenciones: 0,
        total_emitidos: 5,
      },
      voto_presidencial: null,
      resultado: null,
      motivo_inconclusa: null,
      tiempo_transcurrido_segundos: 45,
    },
    palabra: {
      en_uso: null,
      solicitudes: [],
    },
    orden_del_dia: [],
    eventos_recientes: [],
    auditoria: {
      archivos: [],
      tamano_bytes: 1024,
      ultimo_evento: '2026-08-29T10:35:00Z',
    },
    remapeo: null,
    capacidades: {
      puede_preparar: false,
      puede_abrir_sesion: false,
      puede_cerrar_sesion: true,
      puede_abrir_votacion: false,
      puede_finalizar_votacion: true,
      puede_desempatar: false,
      iniciar_remapeo: false,
      confirmar_remapeo: false,
      cancelar_remapeo: false,
    },
    ...sobreescrituras,
  }
}

describe('Simulador Web de Dispositivos Lógicos (WP-034)', () => {
  describe('Tarjeta individual de dispositivo (TarjetaDispositivo.vue)', () => {
    it('muestra exactamente devXX y seis botones con etiquetas y teclas mapeadas', () => {
      const wrapper = mount(TarjetaDispositivo, {
        props: {
          dispositivo: 'dev05',
          peticionesEnVuelo: {},
        },
      })

      // Identificador visible
      expect(wrapper.get('[data-testid="titulo-dev05"]').text()).toContain('dev05')

      // Seis botones presentes
      const botones = wrapper.findAll('button')
      expect(botones).toHaveLength(6)

      // Verificación de los 6 mapeos canónicos
      expect(wrapper.get('[data-testid="btn-dev05-1"]').text()).toContain('Afirmativo')
      expect(wrapper.get('[data-testid="btn-dev05-2"]').text()).toContain('Abstención')
      expect(wrapper.get('[data-testid="btn-dev05-3"]').text()).toContain('Negativo')
      expect(wrapper.get('[data-testid="btn-dev05-7"]').text()).toContain('Palabra')
      expect(wrapper.get('[data-testid="btn-dev05-8"]').text()).toContain('Test')
      expect(wrapper.get('[data-testid="btn-dev05-9"]').text()).toContain('Pres. / Aus.')

      // La etiqueta de presencia es neutra
      expect(wrapper.get('[data-testid="btn-dev05-9"]').text()).not.toContain('Presente')
      expect(wrapper.get('[data-testid="btn-dev05-9"]').text()).not.toContain('Ausente')
    })

    it('no muestra datos individuales institucionales en la tarjeta', () => {
      const wrapper = mount(TarjetaDispositivo, {
        props: {
          dispositivo: 'dev01',
          peticionesEnVuelo: {},
        },
      })

      const texto = wrapper.text()
      // Ausencia de concejal, banca, presencia, voto y latencia en la tarjeta
      expect(texto).not.toContain('Banca')
      expect(texto).not.toContain('Concejal')
      expect(texto).not.toContain('DNI')
      expect(texto).not.toContain('ms')
      expect(texto).not.toContain('ACEPTADA')
      expect(texto).not.toContain('RECHAZADA')
    })

    it('distingue afirmativo, abstención y negativo sin depender exclusivamente de color', () => {
      const wrapper = mount(TarjetaDispositivo, {
        props: {
          dispositivo: 'dev01',
          peticionesEnVuelo: {},
        },
      })

      // Cada botón contiene un símbolo textual explícito (✓, ○, ✗)
      expect(wrapper.get('[data-testid="btn-dev01-1"]').text()).toContain('✓')
      expect(wrapper.get('[data-testid="btn-dev01-2"]').text()).toContain('○')
      expect(wrapper.get('[data-testid="btn-dev01-3"]').text()).toContain('✗')
    })

    it('emite el evento pulsar con dispositivo, tecla y nombre al hacer click', async () => {
      const wrapper = mount(TarjetaDispositivo, {
        props: {
          dispositivo: 'dev07',
          peticionesEnVuelo: {},
        },
      })

      await wrapper.get('[data-testid="btn-dev07-9"]').trigger('click')

      expect(wrapper.emitted('pulsar')).toBeTruthy()
      expect(wrapper.emitted('pulsar')?.[0]).toEqual([
        {
          dispositivo: 'dev07',
          tecla: '9',
          nombre: 'Pres. / Aus.',
        },
      ])
    })

    it('bloquea temporalmente el botón si la petición exacta está en vuelo', () => {
      const wrapper = mount(TarjetaDispositivo, {
        props: {
          dispositivo: 'dev03',
          peticionesEnVuelo: { 'dev03-1': true },
        },
      })

      const botonVotacion = wrapper.get<HTMLButtonElement>('[data-testid="btn-dev03-1"]')
      const botonPresencia = wrapper.get<HTMLButtonElement>('[data-testid="btn-dev03-9"]')

      // El botón con petición en vuelo está deshabilitado
      expect(botonVotacion.element.disabled).toBe(true)
      // Los demás botones del mismo dispositivo siguen habilitados
      expect(botonPresencia.element.disabled).toBe(false)
    })
  })

  describe('Panel general de diagnóstico (PanelGeneralSimulador.vue)', () => {
    it('representa fielmente los tres estados de conexión (CONECTADO, RECONECTANDO, DESCONECTADO)', () => {
      const wrapperConectado = mount(PanelGeneralSimulador, {
        props: {
          estadoConexion: 'CONECTADO',
          estadoGlobal: 'SESION_ABIERTA',
          revision: 12,
          quorumResumen: '8 presentes (Quórum alcanzado)',
          sesionResumen: 'Sesión N° 4',
          votacionResumen: 'Votación N° 1 (EN_CURSO): Proyecto A',
          ultimaLatenciaMs: 35,
          desactualizado: false,
          ultimoError: null,
        },
      })
      expect(wrapperConectado.find('[data-testid="indicador-conexion-conectado"]').exists()).toBe(
        true,
      )
      expect(wrapperConectado.find('[data-testid="indicador-latencia"]').text()).toBe('35 ms')

      const wrapperReconectando = mount(PanelGeneralSimulador, {
        props: {
          estadoConexion: 'RECONECTANDO',
          estadoGlobal: 'SESION_ABIERTA',
          revision: 12,
          quorumResumen: '8 presentes',
          sesionResumen: 'Sesión N° 4',
          votacionResumen: 'Sin votación activa',
          ultimaLatenciaMs: null,
          desactualizado: true,
          ultimoError: null,
        },
      })
      expect(
        wrapperReconectando.find('[data-testid="indicador-conexion-reconectando"]').exists(),
      ).toBe(true)
      expect(wrapperReconectando.find('[data-testid="aviso-desactualizado"]').exists()).toBe(true)

      const wrapperDesconectado = mount(PanelGeneralSimulador, {
        props: {
          estadoConexion: 'DESCONECTADO',
          estadoGlobal: null,
          revision: null,
          quorumResumen: 'Sin datos',
          sesionResumen: 'Sin datos',
          votacionResumen: 'Sin votación activa',
          ultimaLatenciaMs: null,
          desactualizado: false,
          ultimoError: new Error('Fallo de red'),
        },
      })
      expect(
        wrapperDesconectado.find('[data-testid="indicador-conexion-desconectado"]').exists(),
      ).toBe(true)
      expect(wrapperDesconectado.find('[data-testid="aviso-error-tecnico"]').text()).toContain(
        'Fallo de red',
      )
    })
  })

  describe('Log global de pulsaciones (LogPulsaciones.vue)', () => {
    it('muestra el historial con todos los campos de diagnóstico y permite limpiarlo', async () => {
      const entradas = [
        {
          id: '1',
          timestamp: '10:30:00',
          dispositivo: 'dev01',
          accion: 'Pres. / Aus.',
          tecla: '9',
          statusHttp: 200,
          aceptada: true,
          motivo: 'PRESENCIA_ACTUALIZADA',
          latenciaMs: 25,
        },
        {
          id: '2',
          timestamp: '10:30:05',
          dispositivo: 'dev02',
          accion: 'Afirmativo',
          tecla: '1',
          statusHttp: 200,
          aceptada: false,
          motivo: 'TECLA_NO_HABILITADA',
          latenciaMs: 18,
        },
      ]

      const wrapper = mount(LogPulsaciones, {
        props: { entradas },
      })

      expect(wrapper.get('[data-testid="contador-entradas-log"]').text()).toContain('2 eventos')

      // Entrada 1: Aceptada
      const entrada1 = wrapper.get('[data-testid="entrada-log-dev01-9"]')
      expect(entrada1.text()).toContain('dev01')
      expect(entrada1.text()).toContain('HTTP 200')
      expect(entrada1.text()).toContain('ACEPTADA')
      expect(entrada1.text()).toContain('PRESENCIA_ACTUALIZADA')
      expect(entrada1.text()).toContain('25 ms')

      // Entrada 2: Rechazada
      const entrada2 = wrapper.get('[data-testid="entrada-log-dev02-1"]')
      expect(entrada2.text()).toContain('dev02')
      expect(entrada2.text()).toContain('RECHAZADA')
      expect(entrada2.text()).toContain('TECLA_NO_HABILITADA')
      expect(entrada2.text()).toContain('18 ms')

      // Emisión del evento limpiar
      await wrapper.get('[data-testid="btn-limpiar-log"]').trigger('click')
      expect(wrapper.emitted('limpiar')).toBeTruthy()
    })
  })

  describe('Composable useSimulador: lógica de transporte, concurrencia y cero retries', () => {
    it('emite POST /api/v1/entradas/tecla con el body exacto y registra aceptación funcional', async () => {
      const respuestaMock: RespuestaTecla = {
        aceptada: true,
        dispositivo: 'dev01',
        tecla: '9',
        motivo: 'PRESENCIA_ACTUALIZADA',
        concejal: null,
        resultado: null,
      }

      const clienteMock = {
        obtenerEstado: vi.fn().mockResolvedValue(fabricarEstadoModeracionPrueba()),
        suscribirEstado: vi.fn().mockReturnValue({ cancelar: vi.fn() }),
        enviarTecla: vi.fn().mockResolvedValue(respuestaMock),
      } as unknown as ClienteSimulador

      const simulador = useSimulador({ cliente: clienteMock })

      await simulador.enviarPulsacion('dev01', '9', 'Pres. / Aus.')

      // Se llamó a enviarTecla exactamente 1 vez (cero retries)
      expect(clienteMock.enviarTecla).toHaveBeenCalledTimes(1)
      expect(clienteMock.enviarTecla).toHaveBeenCalledWith({
        dispositivo: 'dev01',
        tecla: '9',
      })

      // El log contiene la entrada
      expect(simulador.entradasLog.value).toHaveLength(1)
      const entrada = simulador.entradasLog.value[0]
      expect(entrada.dispositivo).toBe('dev01')
      expect(entrada.tecla).toBe('9')
      expect(entrada.aceptada).toBe(true)
      expect(entrada.motivo).toBe('PRESENCIA_ACTUALIZADA')
      expect(entrada.statusHttp).toBe(200)
    })

    it('permite enviar acciones aunque sean inválidas y registra fielmente el rechazo de FastAPI', async () => {
      const rechazoMock: RespuestaTecla = {
        aceptada: false,
        dispositivo: 'dev05',
        tecla: '1',
        motivo: 'TECLA_NO_HABILITADA',
        concejal: null,
        resultado: null,
      }

      const clienteMock = {
        obtenerEstado: vi.fn(),
        suscribirEstado: vi.fn().mockReturnValue({ cancelar: vi.fn() }),
        enviarTecla: vi.fn().mockResolvedValue(rechazoMock),
      } as unknown as ClienteSimulador

      const simulador = useSimulador({ cliente: clienteMock })

      // Se envía tecla 1 aunque no haya votación
      await simulador.enviarPulsacion('dev05', '1', 'Afirmativo')

      expect(clienteMock.enviarTecla).toHaveBeenCalledWith({ dispositivo: 'dev05', tecla: '1' })
      expect(simulador.entradasLog.value).toHaveLength(1)
      expect(simulador.entradasLog.value[0].aceptada).toBe(false)
      expect(simulador.entradasLog.value[0].motivo).toBe('TECLA_NO_HABILITADA')
    })

    it('soporta concurrencia real entre dos dispositivos sin bloqueo global', async () => {
      let resolverDev01: ((valor: RespuestaTecla) => void) | null = null
      const promesaDev01 = new Promise<RespuestaTecla>((resolver) => {
        resolverDev01 = resolver
      })

      const respuestaDev02: RespuestaTecla = {
        aceptada: true,
        dispositivo: 'dev02',
        tecla: '9',
        motivo: 'PRESENCIA_ACTUALIZADA',
        concejal: null,
        resultado: null,
      }

      const clienteMock = {
        obtenerEstado: vi.fn(),
        suscribirEstado: vi.fn().mockReturnValue({ cancelar: vi.fn() }),
        enviarTecla: vi.fn().mockImplementation((solicitud: { dispositivo: string }) => {
          if (solicitud.dispositivo === 'dev01') {
            return promesaDev01
          }
          return Promise.resolve(respuestaDev02)
        }),
      } as unknown as ClienteSimulador

      const simulador = useSimulador({ cliente: clienteMock })

      // Disparamos la pulsación de dev01 (que queda pendiente en la promesa)
      const envio1 = simulador.enviarPulsacion('dev01', '9', 'Pres. / Aus.')

      // Comprobamos que dev01 está en vuelo pero dev02 NO está bloqueado
      expect(simulador.peticionesEnVuelo.value['dev01-9']).toBe(true)
      expect(simulador.peticionesEnVuelo.value['dev02-9']).toBeFalsy()

      // dev02 puede enviar y completar mientras dev01 aún sigue en vuelo
      await simulador.enviarPulsacion('dev02', '9', 'Pres. / Aus.')

      expect(clienteMock.enviarTecla).toHaveBeenCalledTimes(2)
      expect(simulador.entradasLog.value).toHaveLength(1)
      expect(simulador.entradasLog.value[0].dispositivo).toBe('dev02')

      // Ahora resolvemos dev01
      resolverDev01!({
        aceptada: true,
        dispositivo: 'dev01',
        tecla: '9',
        motivo: 'PRESENCIA_ACTUALIZADA',
        concejal: null,
        resultado: null,
      })
      await envio1

      expect(simulador.entradasLog.value).toHaveLength(2)
      expect(simulador.entradasLog.value[1].dispositivo).toBe('dev01')
      expect(simulador.peticionesEnVuelo.value['dev01-9']).toBe(false)
    })

    it('registra errores HTTP estructurados (ej. 422) y fallos de transporte sin romper la UI', async () => {
      const error422 = new ErrorHttp(422, {
        codigo: 'CUERPO_INVALIDO',
        mensaje: 'Error de validación',
      })
      const errorRed = new ErrorTransporte('Conexión rechazada', new Error())

      const clienteMock = {
        obtenerEstado: vi.fn(),
        suscribirEstado: vi.fn().mockReturnValue({ cancelar: vi.fn() }),
        enviarTecla: vi.fn().mockRejectedValueOnce(error422).mockRejectedValueOnce(errorRed),
      } as unknown as ClienteSimulador

      const simulador = useSimulador({ cliente: clienteMock })

      // Intento 1: Error 422
      await simulador.enviarPulsacion('dev01', '9', 'Pres. / Aus.')
      expect(simulador.entradasLog.value[0].statusHttp).toBe(422)
      expect(simulador.entradasLog.value[0].motivo).toBe('CUERPO_INVALIDO')

      // Intento 2: Error de transporte
      await simulador.enviarPulsacion('dev02', '8', 'Test')
      expect(simulador.entradasLog.value[1].errorTecnico).toContain('Conexión rechazada')
      expect(simulador.entradasLog.value[1].aceptada).toBe(false)
    })

    it('acota el log a la cantidad máxima configurada y permite limpiarlo', async () => {
      const clienteMock = {
        obtenerEstado: vi.fn(),
        suscribirEstado: vi.fn().mockReturnValue({ cancelar: vi.fn() }),
        enviarTecla: vi.fn().mockResolvedValue({
          aceptada: true,
          dispositivo: 'dev01',
          tecla: '9',
          motivo: 'OK',
          concejal: null,
          resultado: null,
        }),
      } as unknown as ClienteSimulador

      const simulador = useSimulador({ cliente: clienteMock, limiteLog: 3 })

      await simulador.enviarPulsacion('dev01', '9', 'P1')
      await simulador.enviarPulsacion('dev01', '9', 'P2')
      await simulador.enviarPulsacion('dev01', '9', 'P3')
      await simulador.enviarPulsacion('dev01', '9', 'P4')

      // El límite era 3, por lo que P1 fue descartado
      expect(simulador.entradasLog.value).toHaveLength(3)
      expect(simulador.entradasLog.value[0].accion).toBe('P2')
      expect(simulador.entradasLog.value[2].accion).toBe('P4')

      // Limpiar vacía completamente el array
      simulador.limpiarLog()
      expect(simulador.entradasLog.value).toHaveLength(0)
    })
  })

  describe('Aplicación y Shell completo (app.vue)', () => {
    it('renderiza cabecera, panel general, los 12 dispositivos dev01..dev12 y el log en pantalla', async () => {
      const wrapper = mount(App)

      // 1. Cabecera con distintivo de simulador
      expect(wrapper.find('[data-testid="cabecera-simulador"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="badge-simulador"]').text()).toContain('Simulador')

      // 2. Panel general
      expect(wrapper.find('[data-testid="panel-general"]').exists()).toBe(true)

      // 3. 12 tarjetas de dispositivos dev01..dev12
      for (const dev of DISPOSITIVOS_SIMULADOR) {
        expect(wrapper.find(`[data-testid="tarjeta-${dev}"]`).exists()).toBe(true)
      }
      expect(DISPOSITIVOS_SIMULADOR).toHaveLength(12)

      // 4. Log global
      expect(wrapper.find('[data-testid="seccion-log-pulsaciones"]').exists()).toBe(true)
    })
  })
})
