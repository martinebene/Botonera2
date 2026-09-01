/**
 * Pruebas de la semántica visual común de una banca (WP-045).
 *
 * La función es la única autoridad de estado visual compartida por Q3 de
 * Moderación y por la Pantalla del Recinto. Estas pruebas fijan la prioridad
 * aprobada por HUMAN_GATE y, sobre todo, el gate de secreto: mientras la
 * recepción está `EN_CURSO` el sentido del voto se descarta aunque el llamador
 * lo entregue.
 */

import { describe, expect, it } from 'vitest'
import {
  calcularPresentacionBanca,
  estilosBanca,
  PALETA_BANCAS,
  resultadoIndividualVisible,
  type EntradaEstadoBanca,
} from '../src/index'

/** Banca presente, sin test, sin palabra y sin votación en curso. */
const BASE: EntradaEstadoBanca = {
  presente: true,
  testActivo: false,
  esOrador: false,
  estadoRecepcion: null,
  votoEmitido: false,
  valorVotoFinal: null,
}

function presentar(cambios: Partial<EntradaEstadoBanca> = {}) {
  return calcularPresentacionBanca({ ...BASE, ...cambios })
}

describe('calcularPresentacionBanca', () => {
  it('presente normal no lleva etiqueta y usa fondo blanco', () => {
    const presentacion = presentar()
    expect(presentacion.estado).toBe('NORMAL')
    expect(presentacion.etiqueta).toBeNull()
    expect(presentacion.familia).toBe('BLANCO')
    expect(PALETA_BANCAS[presentacion.familia].fondo).toBe('#ffffff')
  })

  it('ausente usa gris y una única etiqueta', () => {
    const presentacion = presentar({ presente: false })
    expect(presentacion.estado).toBe('AUSENTE')
    expect(presentacion.etiqueta).toBe('Ausente')
    expect(presentacion.familia).toBe('GRIS')
  })

  it('uso de la palabra usa naranja y su etiqueta', () => {
    const presentacion = presentar({ esOrador: true })
    expect(presentacion.estado).toBe('PALABRA')
    expect(presentacion.etiqueta).toBe('En uso de la palabra')
    expect(presentacion.familia).toBe('NARANJA')
  })

  it('el test usa azul y, por decisión humana, no lleva etiqueta textual', () => {
    const presentacion = presentar({ testActivo: true })
    expect(presentacion.estado).toBe('TEST')
    expect(presentacion.etiqueta).toBeNull()
    expect(presentacion.familia).toBe('AZUL')
    // Sigue siendo anunciable para lectores de pantalla.
    expect(presentacion.etiquetaAccesible).toBe('test de dispositivo activo')
  })

  it('voto emitido usa cian, distinto del azul del test', () => {
    const presentacion = presentar({ estadoRecepcion: 'EN_CURSO', votoEmitido: true })
    expect(presentacion.estado).toBe('VOTO_EMITIDO')
    expect(presentacion.etiqueta).toBe('Voto emitido')
    expect(presentacion.familia).toBe('CIAN')
    expect(PALETA_BANCAS.CIAN.fondo).not.toBe(PALETA_BANCAS.AZUL.fondo)
  })

  it.each([
    ['POSITIVO', 'RESULTADO_POSITIVO', 'Positivo', 'VERDE'],
    ['NEGATIVO', 'RESULTADO_NEGATIVO', 'Negativo', 'ROJO'],
    ['ABSTENCION', 'RESULTADO_ABSTENCION', 'Abstención', 'OCRE'],
  ])('el resultado final %s se muestra tras el cierre', (valor, estado, etiqueta, familia) => {
    const presentacion = presentar({ estadoRecepcion: 'CERRADA', valorVotoFinal: valor })
    expect(presentacion.estado).toBe(estado)
    expect(presentacion.etiqueta).toBe(etiqueta)
    expect(presentacion.familia).toBe(familia)
  })

  it('descarta el sentido del voto mientras la recepción sigue EN_CURSO', () => {
    // Aunque el llamador entregue el sentido por error, el gate lo ignora.
    const presentacion = presentar({
      estadoRecepcion: 'EN_CURSO',
      votoEmitido: true,
      valorVotoFinal: 'POSITIVO',
    })
    expect(presentacion.estado).toBe('VOTO_EMITIDO')
    expect(presentacion.etiqueta).toBe('Voto emitido')
    expect(JSON.stringify(presentacion)).not.toContain('POSITIVO')
    expect(JSON.stringify(presentacion)).not.toContain('Positivo')
  })

  it('sin voto emitido durante EN_CURSO la banca conserva su estado anterior', () => {
    expect(presentar({ estadoRecepcion: 'EN_CURSO' }).estado).toBe('NORMAL')
    expect(presentar({ estadoRecepcion: 'EN_CURSO', presente: false }).estado).toBe('AUSENTE')
  })

  describe('prioridad completa de estados', () => {
    // Cada fila activa simultáneamente varios estados y fija cuál gana.
    it.each([
      [
        'resultado final gana a todo lo demás',
        {
          presente: false,
          testActivo: true,
          esOrador: true,
          estadoRecepcion: 'CERRADA',
          votoEmitido: true,
          valorVotoFinal: 'NEGATIVO',
        },
        'RESULTADO_NEGATIVO',
      ],
      [
        'voto emitido gana a test, palabra y ausencia',
        {
          presente: false,
          testActivo: true,
          esOrador: true,
          estadoRecepcion: 'EN_CURSO',
          votoEmitido: true,
        },
        'VOTO_EMITIDO',
      ],
      [
        'test gana a palabra y ausencia',
        { presente: false, testActivo: true, esOrador: true },
        'TEST',
      ],
      ['palabra gana a ausencia', { presente: false, esOrador: true }, 'PALABRA'],
      ['ausencia gana a presente normal', { presente: false }, 'AUSENTE'],
    ])('%s', (_titulo, cambios, esperado) => {
      expect(presentar(cambios as Partial<EntradaEstadoBanca>).estado).toBe(esperado)
    })
  })

  it('conserva test y palabra subordinados como halo, nunca como segunda etiqueta', () => {
    const presentacion = presentar({
      testActivo: true,
      esOrador: true,
      estadoRecepcion: 'EN_CURSO',
      votoEmitido: true,
    })
    expect(presentacion.estado).toBe('VOTO_EMITIDO')
    expect(presentacion.haloTest).toBe(true)
    expect(presentacion.haloPalabra).toBe(true)
    // La etiqueta sigue siendo una sola: la del estado principal.
    expect(presentacion.etiqueta).toBe('Voto emitido')
  })

  it('no marca halo del estado que ya es principal', () => {
    const soloTest = presentar({ testActivo: true })
    expect(soloTest.haloTest).toBe(false)
    const soloPalabra = presentar({ esOrador: true })
    expect(soloPalabra.haloPalabra).toBe(false)
  })
})

describe('estilosBanca', () => {
  it('traduce la familia en las custom properties que consumen ambas apps', () => {
    const estilos = estilosBanca(presentar({ presente: false }))
    expect(estilos['--fondo-banca']).toBe(PALETA_BANCAS.GRIS.fondo)
    expect(estilos['--borde-banca']).toBe(PALETA_BANCAS.GRIS.borde)
    expect(estilos['--halo-banca']).toBe('transparent')
  })

  it('el halo de test tiene prioridad de dibujo sobre el de palabra', () => {
    const estilos = estilosBanca(
      presentar({ testActivo: true, esOrador: true, presente: false, valorVotoFinal: 'POSITIVO' }),
    )
    expect(estilos['--halo-banca']).toBe(PALETA_BANCAS.AZUL.fondo)
  })

  it('usa naranja cuando solo la palabra queda subordinada', () => {
    const estilos = estilosBanca(presentar({ esOrador: true, valorVotoFinal: 'POSITIVO' }))
    expect(estilos['--halo-banca']).toBe(PALETA_BANCAS.NARANJA.fondo)
  })
})

describe('resultadoIndividualVisible', () => {
  const HORA = Date.parse('2026-09-01T12:00:00Z')

  it.each([
    ['EN_CURSO', null, null, false],
    ['EN_CURSO', 'APROBADA', '2026-09-01T12:00:10Z', false],
    ['CERRADA', null, null, false],
    ['CERRADA', 'EMPATADA', null, true],
    ['CERRADA', 'APROBADA', '2026-09-01T12:00:01Z', true],
    ['CERRADA', 'RECHAZADA', '2026-09-01T12:00:00Z', false],
    ['CERRADA', 'INCONCLUSA', '2026-09-01T11:59:59Z', false],
    ['CERRADA', 'APROBADA', null, false],
  ])(
    '%s / %s / %s produce visibilidad %s',
    (estadoRecepcion, resultado, resultadoVisibleHasta, esperado) => {
      expect(
        resultadoIndividualVisible({
          estadoRecepcion,
          resultado,
          resultadoVisibleHasta,
          ahoraBackend: HORA,
        }),
      ).toBe(esperado)
    },
  )
})
