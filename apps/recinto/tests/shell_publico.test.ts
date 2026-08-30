/**
 * Pruebas DOM del shell público completo.
 *
 * La vista presentacional y sus componentes se montan realmente con Vue Test
 * Utils. El transporte se prueba por separado en la frontera del composable.
 */

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import BancaPublica from '../app/components/BancaPublica.vue'
import PantallaRecinto from '../app/components/PantallaRecinto.vue'
import { crearConcejalesPublicos, crearEstadoRecintoPrueba } from './datos_prueba'

const montados: VueWrapper[] = []

async function montarPantalla(estado = crearEstadoRecintoPrueba()) {
  const wrapper = mount(PantallaRecinto, {
    props: { estado, estadoConexion: 'CONECTADO', desactualizado: false },
  })
  montados.push(wrapper)
  return wrapper
}

afterEach(() => {
  while (montados.length > 0) montados.pop()?.unmount()
})

describe('Shell público del Recinto', () => {
  it('distingue ausencia de snapshot y SIN_PREPARAR sin conservar datos funcionales', async () => {
    const wrapper = mount(PantallaRecinto, {
      props: { estado: null, estadoConexion: 'INICIAL', desactualizado: false },
    })
    montados.push(wrapper)
    expect(wrapper.get('[data-testid="estado-inicial"]').text()).toContain('Conectando')

    await wrapper.setProps({
      estado: crearEstadoRecintoPrueba({
        estado_global: 'SIN_PREPARAR',
        filas_bancas: null,
        concejales: [],
        quorum: null,
        palabra: null,
      }),
    })

    expect(wrapper.get('[data-testid="estado-sin-preparar"]').text()).toContain('Sala sin preparar')
    expect(wrapper.find('[data-testid="grilla-bancas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="panel-quorum"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="panel-palabra"]').exists()).toBe(false)
  })

  it('renderiza PREPARANDO con filas [5,7], asociación por banca y estados inequívocos', async () => {
    const concejales = crearConcejalesPublicos(12)
      .filter((concejal) => concejal.banca !== 4)
      .reverse()
    const wrapper = await montarPantalla(
      crearEstadoRecintoPrueba({
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-27T10:00:00Z',
          numero_sesion: 25,
          presidencia: 'María Presidencia',
          secretaria_legislativa: null,
        },
        filas_bancas: [5, 7],
        concejales,
        quorum: { cantidad_presentes: 6, requerido: 7, alcanzado: false },
      }),
    )

    expect(wrapper.get('[data-testid="estado-global-visible"]').text()).toContain('preparación')
    expect(wrapper.get('[data-testid="titulo-contexto"]').text()).toContain('25')
    expect(wrapper.get('[data-testid="autoridades"]').text()).toContain('María Presidencia')
    expect(wrapper.get('[data-testid="estado-quorum"]').text()).toBe('Sin quórum')

    const filas = wrapper.findAll('.fila-bancas')
    expect(filas).toHaveLength(2)
    const filaSuperior = wrapper.get('[data-testid="fila-fisica-2"]')
    expect(filaSuperior.findAll('[data-testid="banca-publica"]')).toHaveLength(7)
    expect(filaSuperior.find('[data-banca="6"]').exists()).toBe(true)
    expect(filaSuperior.find('[data-banca="12"]').exists()).toBe(true)
    const filaInferior = wrapper.get('[data-testid="fila-fisica-1"]')
    expect(filaInferior.findAll('[data-banca]')).toHaveLength(5)
    expect(filaInferior.findAll('[data-testid="banca-publica"]')[0]?.text()).toContain('Nombre1')
    expect(filaInferior.get('[data-banca="4"]').text()).toContain('sin datos públicos')
    expect(filaInferior.get('[data-banca="5"]').text()).toContain('Nombre5')

    const bancaDos = wrapper.get('[data-banca="2"]')
    expect(bancaDos.get('[data-testid="estado-presencia"]').text()).toBe('Ausente')
    expect(bancaDos.find('[data-ruta-imagen="assets/bancas/banca-02.png"]').exists()).toBe(true)
    expect(wrapper.get('[data-banca="3"] [data-testid="estado-test"]').text()).toBe('Test activo')
  })

  it('muestra sesión, autoridades, quórum, orador y cola FIFO aun con votación', async () => {
    const wrapper = await montarPantalla(
      crearEstadoRecintoPrueba({
        estado_global: 'SESION_ABIERTA',
        sesion: {
          fecha_hora_inicio_preparacion: '2026-08-27T10:00:00Z',
          fecha_hora_apertura: '2026-08-27T10:15:00Z',
          numero_sesion: 59,
          presidencia: 'Ana Presidencia',
          secretaria_legislativa: 'Luis Secretaría',
        },
        filas_bancas: [3, 4, 5],
        concejales: crearConcejalesPublicos(12),
        quorum: { cantidad_presentes: 8, requerido: 7, alcanzado: true },
        palabra: {
          orador: { nombre: 'Nombre4', apellido: 'Apellido4', banca: 4 },
          cola: [
            { nombre: 'Nombre7', apellido: 'Apellido7', banca: 7 },
            { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1 },
          ],
        },
        votacion: {
          id: 'votacion-en-curso',
          numero_votacion: 2,
          tipo: 'Despacho',
          tema: 'Tema reservado para WP-026',
          tipo_mayoria: 'SIMPLE',
          factor: 0,
          base: 'VOTOS_COMPUTABLES',
          estado_recepcion: 'EN_CURSO',
          resultado: null,
          fecha_hora_apertura: '2026-08-27T10:20:00Z',
          fecha_hora_cierre: null,
          cuenta_regresiva_hasta: null,
          resultado_visible_hasta: null,
          votos_individuales: null,
          conteos: null,
          voto_presidencial: null,
        },
      }),
    )

    expect(wrapper.get('[data-testid="titulo-contexto"]').text()).toContain('59')
    expect(wrapper.get('[data-testid="autoridades"]').text()).toContain('Ana Presidencia')
    expect(wrapper.get('[data-testid="autoridades"]').text()).toContain('Luis Secretaría')
    expect(wrapper.get('[data-testid="estado-quorum"]').text()).toBe('Quórum alcanzado')
    expect(wrapper.get('[data-banca="4"] [data-testid="estado-orador"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="panel-palabra"]').text()).not.toContain('Nombre4 Apellido4')
    expect(wrapper.get('[data-testid="cabecera-sesion"]').text()).toContain('59')
    expect(wrapper.get('[data-testid="cabecera-tiempo-sesion"]').exists()).toBe(true)

    const pedidos = wrapper.findAll('[data-testid="cola-palabra"] li')
    expect(pedidos.map((pedido) => pedido.text())).toEqual([
      '1Nombre7 Apellido7Banca 7',
      '2Nombre1 Apellido1Banca 1',
    ])
    expect(wrapper.get('[data-testid="tema-votacion"]').text()).toContain(
      'Tema reservado para WP-026',
    )
    expect(wrapper.findAll('button, input, select, textarea, form')).toHaveLength(0)
  })

  it('mueve y limpia el resaltado del orador con cada baseline', async () => {
    const estadoBase = crearEstadoRecintoPrueba({
      estado_global: 'SESION_ABIERTA',
      sesion: {
        fecha_hora_inicio_preparacion: '2026-08-27T10:00:00Z',
        fecha_hora_apertura: '2026-08-27T10:15:00Z',
        numero_sesion: 59,
        presidencia: 'Presidencia',
        secretaria_legislativa: 'Secretaría',
      },
      filas_bancas: [2],
      concejales: crearConcejalesPublicos(2),
      quorum: { cantidad_presentes: 1, requerido: 1, alcanzado: true },
      palabra: {
        orador: { nombre: 'Nombre1', apellido: 'Apellido1', banca: 1 },
        cola: [],
      },
    })
    const wrapper = await montarPantalla(estadoBase)

    expect(wrapper.get('[data-banca="1"]').find('[data-testid="estado-orador"]').exists()).toBe(
      true,
    )
    expect(wrapper.get('[data-banca="2"]').find('[data-testid="estado-orador"]').exists()).toBe(
      false,
    )

    await wrapper.setProps({
      estado: {
        ...estadoBase,
        revision: 2,
        palabra: {
          orador: { nombre: 'Nombre2', apellido: 'Apellido2', banca: 2 },
          cola: [],
        },
      },
    })
    expect(wrapper.get('[data-banca="1"]').find('[data-testid="estado-orador"]').exists()).toBe(
      false,
    )
    expect(wrapper.get('[data-banca="2"]').find('[data-testid="estado-orador"]').exists()).toBe(
      true,
    )

    await wrapper.setProps({
      estado: { ...estadoBase, revision: 3, palabra: { orador: null, cola: [] } },
    })
    expect(wrapper.find('[data-testid="estado-orador"]').exists()).toBe(false)
  })

  it('conserva la vista al reconectar, adopta SIN_PREPARAR y degrada imagen rota', async () => {
    const wrapper = await montarPantalla(
      crearEstadoRecintoPrueba({
        estado_global: 'PREPARANDO',
        preparacion: {
          fecha_hora_inicio: '2026-08-27T10:00:00Z',
          numero_sesion: null,
          presidencia: null,
          secretaria_legislativa: null,
        },
        filas_bancas: [1],
        concejales: crearConcejalesPublicos(1),
        quorum: { cantidad_presentes: 1, requerido: 1, alcanzado: true },
      }),
    )
    await wrapper.setProps({ estadoConexion: 'RECONECTANDO', desactualizado: true })

    expect(wrapper.get('[data-testid="estado-conexion"]').text()).toContain('desactualizada')
    expect(wrapper.get('[data-banca="1"]').exists()).toBe(true)

    await wrapper.setProps({
      estado: crearEstadoRecintoPrueba({ revision: 0, estado_global: 'SIN_PREPARAR' }),
    })
    expect(wrapper.get('[data-testid="estado-sin-preparar"]').exists()).toBe(true)
    expect(wrapper.find('[data-banca="1"]').exists()).toBe(false)

    const banca = mount(BancaPublica, {
      props: { concejal: crearConcejalesPublicos(1)[0]!, esOrador: false, voto: null },
    })
    await banca.get('img').trigger('error')
    expect(banca.get('[data-testid="imagen-fallback"]').text()).toBe('NA')
  })

  it('unifica ausencia y reinicia una imagen fallida al cambiar persona o ruta', async () => {
    const concejalAusente = {
      ...crearConcejalesPublicos(1)[0]!,
      presente: false,
      test_activo: true,
    }
    const banca = mount(BancaPublica, {
      props: { concejal: concejalAusente, esOrador: true, voto: null },
    })

    expect(banca.element.classList.contains('banca-ausente')).toBe(true)
    expect(banca.get('[data-testid="numero-banca"]').text()).toBe('Banca 1')
    expect(banca.get('[data-testid="estado-presencia"]').text()).toBe('Ausente')
    expect(banca.get('[data-testid="estado-test"]').text()).toBe('Test activo')
    expect(banca.get('[data-testid="estado-orador"]').exists()).toBe(true)

    await banca.get('[data-testid="imagen-concejal"]').trigger('error')
    expect(banca.get('[data-testid="imagen-fallback"]').text()).toBe('NA')

    // Se reutiliza deliberadamente la misma ruta: el cambio de persona también
    // debe invalidar el error visual perteneciente a la baseline anterior.
    await banca.setProps({
      concejal: {
        ...concejalAusente,
        nombre: 'Otra',
        apellido: 'Persona',
        presente: true,
      },
    })
    expect(banca.find('[data-testid="imagen-concejal"]').exists()).toBe(true)
    expect(banca.find('[data-testid="imagen-fallback"]').exists()).toBe(false)
    expect(banca.get('[data-testid="estado-presencia"]').text()).toBe('Presente')
    expect(concejalAusente.presente).toBe(false)
  })
})
