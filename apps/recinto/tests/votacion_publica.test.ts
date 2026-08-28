/**
 * Regresión DOM de secreto, revelado y deadlines del Recinto.
 *
 * Los relojes falsos permiten recorrer fronteras temporales sin esperas reales
 * y verifican contenido, no solamente clases CSS.
 */

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PantallaRecinto from '../app/components/PantallaRecinto.vue'
import {
  crearConcejalesPublicos,
  crearEstadoRecintoPrueba,
  crearVotacionPublicaPrueba,
} from './datos_prueba'

const HORA_BASE = '2026-08-28T10:00:00Z'

function crearSesionConVotacion(
  votacion: ReturnType<typeof crearVotacionPublicaPrueba> | null,
  parcial: Parameters<typeof crearEstadoRecintoPrueba>[0] = {},
) {
  return crearEstadoRecintoPrueba({
    revision: 1,
    generado_en: HORA_BASE,
    estado_global: 'SESION_ABIERTA',
    sesion: {
      fecha_hora_inicio_preparacion: '2026-08-28T09:30:00Z',
      fecha_hora_apertura: '2026-08-28T09:45:00Z',
      numero_sesion: 59,
      presidencia: 'Ana Presidencia',
      secretaria_legislativa: 'Luis Secretaría',
    },
    filas_bancas: [2, 2],
    concejales: crearConcejalesPublicos(4),
    quorum: { cantidad_presentes: 3, requerido: 3, alcanzado: true },
    palabra: { orador: null, cola: [] },
    votacion,
    ...parcial,
  })
}

function montar(estado: ReturnType<typeof crearEstadoRecintoPrueba>): VueWrapper {
  return mount(PantallaRecinto, {
    props: { estado, estadoConexion: 'CONECTADO', desactualizado: false },
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Experiencia pública de votación', () => {
  it('distingue sesión sin votación y EN_CURSO sin revelar payloads impropios', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(HORA_BASE)
    const wrapper = montar(crearSesionConVotacion(null))
    expect(wrapper.find('[data-testid="votacion-publica"]').exists()).toBe(false)

    await wrapper.setProps({
      estado: crearSesionConVotacion(
        crearVotacionPublicaPrueba({
          tema: 'Expediente secreto durante la recepción',
          // El backend normal no envía estos campos. La prueba demuestra que
          // la capa visual tampoco los utiliza si recibe un payload inválido.
          votos_individuales: [
            { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
          ],
          conteos: { positivos: 99, negativos: 0, abstenciones: 0, total: 99 },
        }),
      ),
    })

    expect(wrapper.get('[data-testid="estado-votacion"]').text()).toBe('En curso')
    expect(wrapper.get('[data-testid="tema-votacion"]').text()).toContain('Expediente secreto')
    expect(wrapper.find('[data-testid="countdown-votacion"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="conteos-votacion"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="voto-banca"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Positivo')
    expect(wrapper.text()).not.toContain('99')
    wrapper.unmount()
  })

  it('deriva el countdown del deadline, avanza y no se reinicia por otra revisión', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(HORA_BASE)
    const deadline = '2026-08-28T10:00:04Z'
    const wrapper = montar(
      crearSesionConVotacion(crearVotacionPublicaPrueba({ cuenta_regresiva_hasta: deadline })),
    )

    expect(wrapper.get('[data-testid="countdown-votacion"]').text()).toContain('4')
    vi.advanceTimersByTime(1250)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="countdown-votacion"]').text()).toContain('3')

    await wrapper.setProps({
      estado: crearSesionConVotacion(
        crearVotacionPublicaPrueba({ cuenta_regresiva_hasta: deadline }),
        { revision: 2, generado_en: '2026-08-28T10:00:01.250Z' },
      ),
    })
    expect(wrapper.get('[data-testid="countdown-votacion"]').text()).toContain('3')

    vi.advanceTimersByTime(3000)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="countdown-votacion"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="estado-votacion"]').text()).toBe('En curso')
    expect(wrapper.find('[data-testid="voto-banca"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('no revive un countdown vencido al recibir una baseline posterior', () => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-08-28T10:00:10Z')
    const wrapper = montar(
      crearSesionConVotacion(
        crearVotacionPublicaPrueba({ cuenta_regresiva_hasta: '2026-08-28T10:00:04Z' }),
        { generado_en: '2026-08-28T10:00:10Z' },
      ),
    )
    expect(wrapper.find('[data-testid="countdown-votacion"]').exists()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })

  it('asocia votos por banca y conserva presencia, test, orador y conteos backend', () => {
    vi.useFakeTimers()
    vi.setSystemTime(HORA_BASE)
    const concejales = crearConcejalesPublicos(4)
    concejales[0]!.test_activo = true
    const wrapper = montar(
      crearSesionConVotacion(
        crearVotacionPublicaPrueba({
          estado_recepcion: 'CERRADA',
          resultado: 'APROBADA',
          fecha_hora_cierre: HORA_BASE,
          resultado_visible_hasta: '2026-08-28T10:00:10Z',
          votos_individuales: [
            { nombre: 'Nombre3', apellido: 'Apellido3', banca: 3, valor: 'ABSTENCION' },
            { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
            { nombre: 'Nombre2', apellido: 'Apellido2', banca: 2, valor: 'NEGATIVO' },
          ],
          // Los valores deliberadamente no coinciden con la lista corta: la
          // UI debe presentar el DTO de conteos, no recontar votos.
          conteos: { positivos: 8, negativos: 2, abstenciones: 1, total: 11 },
        }),
        {
          concejales,
          palabra: {
            orador: { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1 },
            cola: [{ nombre: 'Nombre4', apellido: 'Apellido4', banca: 4 }],
          },
        },
      ),
    )

    expect(wrapper.get('[data-testid="estado-votacion"]').text()).toBe('Aprobada')
    expect(wrapper.get('[data-banca="1"] [data-testid="voto-banca"]').text()).toBe('Positivo')
    expect(wrapper.get('[data-banca="2"] [data-testid="voto-banca"]').text()).toBe('Negativo')
    expect(wrapper.get('[data-banca="3"] [data-testid="voto-banca"]').text()).toBe('Abstención')
    expect(wrapper.find('[data-banca="4"] [data-testid="voto-banca"]').exists()).toBe(false)
    expect(wrapper.get('[data-banca="1"] [data-testid="estado-test"]').text()).toBe('Test activo')
    expect(wrapper.get('[data-banca="1"] [data-testid="estado-orador"]').exists()).toBe(true)
    expect(wrapper.get('[data-banca="2"] [data-testid="estado-presencia"]').text()).toBe('Ausente')
    expect(wrapper.get('[data-testid="conteos-votacion"]').text()).toContain('Positivos8')
    expect(wrapper.get('[data-testid="conteos-votacion"]').text()).toContain('Total11')
    expect(wrapper.get('[data-testid="estado-quorum"]').text()).toBe('Quórum alcanzado')
    expect(wrapper.get('[data-testid="orador-actual"]').text()).toContain('Nombre1 Apellido1')
    wrapper.unmount()
  })

  it.each([
    ['RECHAZADA', 'Rechazada'],
    ['INCONCLUSA', 'Inconclusa'],
  ])('muestra %s sin inventar una explicación causal', (resultado, etiqueta) => {
    vi.useFakeTimers()
    vi.setSystemTime(HORA_BASE)
    const wrapper = montar(
      crearSesionConVotacion(
        crearVotacionPublicaPrueba({
          estado_recepcion: 'CERRADA',
          resultado,
          resultado_visible_hasta: '2026-08-28T10:00:10Z',
          votos_individuales: [],
          conteos: { positivos: 0, negativos: 0, abstenciones: 0, total: 0 },
        }),
      ),
    )
    expect(wrapper.get('[data-testid="estado-votacion"]').text()).toBe(etiqueta)
    expect(wrapper.text()).not.toContain('pérdida')
    expect(wrapper.text()).not.toContain('manual')
    wrapper.unmount()
  })

  it('mantiene EMPATADA sin expiración y conserva votos ordinarios visibles', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(HORA_BASE)
    const wrapper = montar(
      crearSesionConVotacion(
        crearVotacionPublicaPrueba({
          estado_recepcion: 'CERRADA',
          resultado: 'EMPATADA',
          resultado_visible_hasta: null,
          votos_individuales: [
            { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
            { nombre: 'Nombre2', apellido: 'Apellido2', banca: 2, valor: 'NEGATIVO' },
          ],
          conteos: { positivos: 1, negativos: 1, abstenciones: 0, total: 2 },
        }),
      ),
    )

    expect(wrapper.get('[data-testid="estado-votacion"]').text()).toBe('Empatada')
    expect(wrapper.get('[data-testid="espera-desempate"]').text()).toContain('Presidencia')
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="estado-votacion"]').text()).toBe('Empatada')
    expect(wrapper.findAll('[data-testid="voto-banca"]')).toHaveLength(2)
    wrapper.unmount()
  })

  it('muestra el voto presidencial separado y no altera bancas ni conteos', () => {
    vi.useFakeTimers()
    vi.setSystemTime(HORA_BASE)
    const votos = [
      { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
      { nombre: 'Nombre2', apellido: 'Apellido2', banca: 2, valor: 'NEGATIVO' },
    ]
    const wrapper = montar(
      crearSesionConVotacion(
        crearVotacionPublicaPrueba({
          estado_recepcion: 'CERRADA',
          resultado: 'RECHAZADA',
          resultado_visible_hasta: '2026-08-28T10:00:10Z',
          votos_individuales: votos,
          conteos: { positivos: 1, negativos: 1, abstenciones: 0, total: 2 },
          voto_presidencial: { presidencia: 'Ana Presidencia', sentido: 'NEGATIVO' },
        }),
      ),
    )

    const presidencial = wrapper.get('[data-testid="voto-presidencial"]')
    expect(presidencial.text()).toContain('Ana Presidencia')
    expect(presidencial.text()).toContain('Negativo')
    expect(wrapper.findAll('[data-testid="voto-banca"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="conteos-votacion"]').text()).toContain('Total2')
    expect(wrapper.find('[data-banca="3"] [data-testid="voto-banca"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('expira desde resultado_visible_hasta, reemplaza con una nueva votación y limpia SIN_PREPARAR', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(HORA_BASE)
    const wrapper = montar(
      crearSesionConVotacion(
        crearVotacionPublicaPrueba({
          estado_recepcion: 'CERRADA',
          resultado: 'APROBADA',
          resultado_visible_hasta: '2026-08-28T10:00:02Z',
          votos_individuales: [
            { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1, valor: 'POSITIVO' },
          ],
          conteos: { positivos: 1, negativos: 0, abstenciones: 0, total: 1 },
        }),
      ),
    )

    expect(wrapper.get('[data-testid="estado-votacion"]').text()).toBe('Aprobada')
    vi.advanceTimersByTime(2250)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="votacion-publica"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="voto-banca"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="panel-quorum"]').exists()).toBe(true)

    await wrapper.setProps({
      estado: crearSesionConVotacion(
        crearVotacionPublicaPrueba({
          id: 'votacion-2',
          numero_votacion: 2,
          tema: 'Nueva votación inmediata',
          cuenta_regresiva_hasta: '2026-08-28T10:00:06Z',
        }),
        { revision: 2, generado_en: '2026-08-28T10:00:02.250Z' },
      ),
    })
    expect(wrapper.get('[data-testid="tema-votacion"]').text()).toContain('Nueva votación')
    expect(wrapper.find('[data-testid="voto-banca"]').exists()).toBe(false)

    await wrapper.setProps({
      estado: crearEstadoRecintoPrueba({ revision: 0, estado_global: 'SIN_PREPARAR' }),
    })
    expect(wrapper.get('[data-testid="estado-sin-preparar"]').exists()).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })

  it('no muestra un resultado ya vencido y cancela el ticker al desmontar', () => {
    vi.useFakeTimers()
    vi.setSystemTime(HORA_BASE)
    const vencido = montar(
      crearSesionConVotacion(
        crearVotacionPublicaPrueba({
          estado_recepcion: 'CERRADA',
          resultado: 'INCONCLUSA',
          resultado_visible_hasta: '2026-08-28T09:59:59Z',
        }),
      ),
    )
    expect(vencido.find('[data-testid="votacion-publica"]').exists()).toBe(false)
    vencido.unmount()

    const conTimer = montar(
      crearSesionConVotacion(
        crearVotacionPublicaPrueba({ cuenta_regresiva_hasta: '2026-08-28T10:00:04Z' }),
      ),
    )
    expect(vi.getTimerCount()).toBe(1)
    conTimer.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
