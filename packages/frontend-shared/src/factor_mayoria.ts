/**
 * Presentación visual del factor de una mayoría especial (WP-063).
 *
 * El backend transporta el factor como un número real (`0 < factor <= 1`) y ese valor es
 * el único autoritativo: se usa tal cual para calcular la mayoría, para el CSV del Orden
 * del Día, para el DTO y para la auditoría. Lo que este módulo resuelve es exclusivamente
 * **cómo se escribe ese número en pantalla**, y la decisión humana cerrada por WP-063 es:
 *
 * - siempre exactamente dos decimales;
 * - los decimales sobrantes se **truncan**, nunca se redondean (`0.6799` se muestra `0.67`);
 * - el dato real no cambia en ningún momento.
 *
 * Vive en `frontend-shared` porque Moderación y Recinto deben escribir el mismo factor de
 * la misma manera. Si la regla estuviera duplicada, una corrección futura podría aplicarse
 * en una sola interfaz y el operador vería dos textos distintos para un mismo dato.
 *
 * ## Por qué no alcanza con `Math.floor(valor * 100) / 100`
 *
 * Un número decimal como `0.29` no existe exactamente en binario: JavaScript guarda el
 * doble más cercano. Multiplicar por 100 puede caer apenas por debajo del entero esperado
 * (`0.29 * 100 === 28.999999999999996`), y entonces `Math.floor` devolvería `0.28`. Eso
 * violaría el criterio de aceptación 6 del WP: un valor válido no debe degradarse a un
 * centésimo inferior por un artefacto de punto flotante.
 *
 * Por el mismo motivo tampoco sirve `toFixed(20)`: expande la representación binaria real
 * (`0.29` se convierte en `0.28999999999999998046…`) y volvería a truncar mal.
 *
 * La solución es trabajar sobre la conversión estándar `String(valor)`, que en JavaScript
 * produce la representación decimal **más corta que vuelve a leerse como ese mismo
 * número**. Para `0.29` eso es exactamente `"0.29"`, así que truncar sobre ese texto
 * conserva la intención humana del valor cargado.
 */

/** Cantidad de decimales exigida por WP-063 en toda superficie visible. */
const DECIMALES_VISIBLES = 2

/** Reconoce la notación científica que `String()` usa para magnitudes extremas. */
const NOTACION_CIENTIFICA = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/

/**
 * Reescribe un texto en notación científica como notación decimal plana.
 *
 * `String()` recurre a notación exponencial para números muy chicos o muy grandes
 * (`String(1e-7) === '1e-7'`). Ese formato no puede cortarse por posición de coma, así que
 * primero se corre el punto decimal tantos lugares como indique el exponente.
 *
 * Un factor institucional válido nunca llega a este caso, pero la utilidad debe seguir
 * siendo correcta si alguna vez recibe un valor anómalo: es preferible mostrar `0.00` a
 * mostrar un texto con `e-7` adentro.
 *
 * @param texto Representación producida por `String(valor)`.
 * @returns El mismo número escrito sin exponente, o el texto original si no era científico.
 */
function expandirNotacionCientifica(texto: string): string {
  const coincidencia = NOTACION_CIENTIFICA.exec(texto)
  if (!coincidencia) return texto

  const [, signo = '', parteEntera = '0', parteDecimal = '', exponenteTexto = '0'] = coincidencia
  const exponente = Number(exponenteTexto)
  const digitos = `${parteEntera}${parteDecimal}`
  // Posición donde queda el punto decimal después de aplicar el exponente.
  const posicionPunto = parteEntera.length + exponente

  // El número es menor que 1: hay que anteponer ceros hasta alcanzar el primer dígito.
  if (posicionPunto <= 0) return `${signo}0.${'0'.repeat(-posicionPunto)}${digitos}`
  // El número es entero: hay que agregar ceros a la derecha hasta la posición del punto.
  if (posicionPunto >= digitos.length) {
    return `${signo}${digitos}${'0'.repeat(posicionPunto - digitos.length)}`
  }
  return `${signo}${digitos.slice(0, posicionPunto)}.${digitos.slice(posicionPunto)}`
}

/**
 * Formatea un factor de mayoría especial con exactamente dos decimales truncados.
 *
 * Es una función de presentación pura: no valida el factor, no lo normaliza y no debe
 * usarse para construir el valor que se envía al backend. El texto que devuelve sirve para
 * mostrarlo en un rótulo; el valor editable de un formulario debe seguir siendo el real.
 *
 * @param valor Factor real tal como lo entrega el backend.
 * @returns El factor escrito con dos decimales truncados, por ejemplo `0.67` o `1.00`.
 *          Si el valor no es finito (`NaN`, `Infinity`) se devuelve su texto crudo, para
 *          que una anomalía quede visible en lugar de disfrazarse de número válido.
 */
export function formatearFactorMayoria(valor: number): string {
  if (!Number.isFinite(valor)) return String(valor)

  const texto = expandirNotacionCientifica(String(valor))
  const negativo = texto.startsWith('-')
  const sinSigno = texto.replace(/^[+-]/, '')
  const [parteEntera = '0', parteDecimal = ''] = sinSigno.split('.')

  // Truncar es simplemente quedarse con los primeros dígitos: nunca se mira el siguiente
  // para decidir si subir el centésimo, que es exactamente lo que haría un redondeo.
  const decimalesTruncados = parteDecimal
    .slice(0, DECIMALES_VISIBLES)
    .padEnd(DECIMALES_VISIBLES, '0')

  return `${negativo ? '-' : ''}${parteEntera}.${decimalesTruncados}`
}
