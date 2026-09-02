/**
 * Ajuste tipográfico determinista de un aviso técnico (WP-056).
 *
 * HUMAN_GATE cerró tres reglas para los avisos que Apoyo Técnico publica sobre
 * Moderación y sobre el Recinto:
 *
 * 1. el aviso nunca tiene scroll propio ni induce scroll en la página;
 * 2. se usa el tamaño de fuente más grande que entre en la superficie disponible;
 * 3. si ni siquiera el tamaño mínimo entra, el texto se recorta con `…` visible.
 *
 * Este módulo resuelve exclusivamente el punto 2 y decide el punto 3, y lo hace como
 * función pura: no toca el DOM, no consulta el reloj y no guarda estado. Quien la llama
 * le pasa una función `entra(tamano)` que sabe medir en su entorno real. Esa separación
 * es lo que permite probar el algoritmo con medidas sintéticas y, a la vez, garantizar
 * que en el navegador no existan bucles de medición: el componente mide, decide una vez
 * y escribe el resultado una sola vez.
 *
 * ### Por qué una búsqueda binaria y no un bucle decreciente
 *
 * Un bucle que baja de a un píxel desde el máximo puede necesitar más de cien
 * mediciones y su costo depende del texto. La búsqueda binaria hace siempre a lo sumo
 * `log2(maximo - minimo) + 2` mediciones —una decena larga en el peor caso real— y
 * termina en una cantidad de pasos conocida de antemano. Eso es lo que vuelve
 * *determinista* el comportamiento exigido a 1366×768 y a 1920×1080.
 *
 * La búsqueda es válida porque `entra` es monótona: si un texto entra con cuerpo `n`,
 * también entra con cualquier cuerpo menor. Es una propiedad del flujo de texto normal
 * y no una suposición sobre una fuente concreta.
 */

/** Parámetros del ajuste. Los tamaños se expresan en píxeles CSS. */
export interface OpcionesAjusteAviso {
  /** Cuerpo mínimo aceptable. Por debajo de él se prefiere recortar con `…`. */
  tamanoMinimo: number
  /** Cuerpo máximo que tiene sentido usar, aunque sobre espacio. */
  tamanoMaximo: number
  /**
   * Mide si el texto entra completo en la superficie con ese cuerpo.
   *
   * Debe ser una consulta sin efectos observables para el usuario: el componente la
   * implementa escribiendo un tamaño de prueba y leyendo el desborde del párrafo.
   */
  entra: (tamanoPx: number) => boolean
}

/** Resultado del ajuste. */
export interface ResultadoAjusteAviso {
  /** Cuerpo elegido, siempre dentro de `[tamanoMinimo, tamanoMaximo]`. */
  tamano: number
  /**
   * `true` cuando el texto no entra ni con el cuerpo mínimo.
   *
   * En ese caso la superficie debe recortar el excedente mostrando `…`: el WP prohíbe
   * cortar en silencio, así que el indicador es parte del contrato de este resultado.
   */
  truncado: boolean
}

/**
 * Elige el mayor cuerpo entero con el que el texto entra completo.
 *
 * @param opciones Rango permitido y función de medición del entorno real.
 * @returns Cuerpo elegido y si hubo que recurrir al recorte con elipsis.
 * @throws RangeError Si el rango recibido no es utilizable (valores no finitos,
 *   mínimo no positivo o máximo menor que el mínimo). Fallar acá es preferible a
 *   devolver un cuerpo arbitrario que después nadie pueda explicar en pantalla.
 */
export function ajustarTamanoAviso({
  tamanoMinimo,
  tamanoMaximo,
  entra,
}: OpcionesAjusteAviso): ResultadoAjusteAviso {
  if (!Number.isFinite(tamanoMinimo) || !Number.isFinite(tamanoMaximo)) {
    throw new RangeError('Los tamaños de ajuste del aviso deben ser números finitos.')
  }
  if (tamanoMinimo <= 0) {
    throw new RangeError('El tamaño mínimo del aviso debe ser mayor que cero.')
  }
  if (tamanoMaximo < tamanoMinimo) {
    throw new RangeError('El tamaño máximo del aviso no puede ser menor que el mínimo.')
  }

  const minimo = Math.floor(tamanoMinimo)
  const maximo = Math.floor(tamanoMaximo)

  // Caso feliz y más frecuente en el Recinto: sobra espacio y se usa el cuerpo máximo.
  if (entra(maximo)) return { tamano: maximo, truncado: false }

  // Ni el cuerpo mínimo alcanza: se conserva el mínimo legible y se avisa del recorte.
  if (!entra(minimo)) return { tamano: minimo, truncado: true }

  // Invariante de la búsqueda: `bajo` siempre entra y `alto` nunca entra.
  let bajo = minimo
  let alto = maximo
  while (alto - bajo > 1) {
    const medio = Math.floor((bajo + alto) / 2)
    if (entra(medio)) bajo = medio
    else alto = medio
  }
  return { tamano: bajo, truncado: false }
}

/**
 * Calcula cuántas líneas completas entran en una superficie con un cuerpo dado.
 *
 * Sólo se usa cuando el texto debe recortarse: es el número de líneas que conserva el
 * recorte con `…`. Devuelve como mínimo `1` para que un aviso jamás quede invisible,
 * incluso si la superficie es más baja que una línea.
 *
 * @param altoDisponible Alto útil de la superficie, en píxeles.
 * @param tamanoFuente Cuerpo aplicado, en píxeles.
 * @param interlineado Factor de interlineado aplicado por la hoja de estilos.
 */
export function lineasVisiblesAviso(
  altoDisponible: number,
  tamanoFuente: number,
  interlineado: number,
): number {
  const altoLinea = tamanoFuente * interlineado
  if (!Number.isFinite(altoDisponible) || !Number.isFinite(altoLinea) || altoLinea <= 0) return 1
  return Math.max(1, Math.floor(altoDisponible / altoLinea))
}
