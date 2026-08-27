/**
 * Pruebas DOM del shell público completo.
 *
 * La vista presentacional y sus componentes se montan realmente con Vue Test
 * Utils. El transporte se prueba por separado en la frontera del composable.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BancaPublica from '../app/components/BancaPublica.vue'
import PantallaRecinto from '../app/components/PantallaRecinto.vue'
import { crearConcejalesPublicos, crearEstadoRecintoPrueba } from './datos_prueba'

async function montarPantalla(estado = crearEstadoRecintoPrueba()) {
  return mount(PantallaRecinto, {
    props: { estado, estadoConexion: 'CONECTADO', desactualizado: false },
  })
}

describe('Shell público del Recinto', () => {
  it('distingue ausencia de snapshot y SIN_PREPARAR sin conservar datos funcionales', async () => {
    const wrapper = mount(PantallaRecinto, {
      props: { estado: null, estadoConexion: 'INICIAL', desactualizado: false },
    })
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
    const concejales = crearConcejalesPublicos(12).reverse()
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
    expect(filaInferior.findAll('[data-testid="banca-publica"]')).toHaveLength(5)
    expect(filaInferior.findAll('[data-testid="banca-publica"]')[0]?.text()).toContain('Nombre1')

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
          cuenta_regresiva_hasta: '2026-08-27T10:20:04Z',
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
    expect(wrapper.get('[data-testid="orador-actual"]').text()).toContain('Nombre4 Apellido4')
    expect(wrapper.get('[data-banca="4"] [data-testid="estado-orador"]').exists()).toBe(true)

    const pedidos = wrapper.findAll('[data-testid="cola-palabra"] li')
    expect(pedidos.map((pedido) => pedido.text())).toEqual([
      '1Nombre7 Apellido7Banca 7',
      '2Nombre1 Apellido1Banca 1',
    ])
    expect(wrapper.text()).not.toContain('Tema reservado para WP-026')
    expect(wrapper.findAll('button, input, select, textarea, form')).toHaveLength(0)
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
      props: { concejal: crearConcejalesPublicos(1)[0]!, esOrador: false },
    })
    await banca.get('img').trigger('error')
    expect(banca.get('[data-testid="imagen-fallback"]').text()).toBe('NA')
  })
})
