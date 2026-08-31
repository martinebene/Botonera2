/**
 * Punto de entrada del código genuinamente común a ambos frontends.
 *
 * Solo se publica aquí lo que necesita ser idéntico en Moderación y Recinto.
 * Hoy es la semántica visual de una banca (WP-045): si viviera duplicada en las
 * dos aplicaciones, cualquier corrección posterior podría aplicarse en una sola
 * y hacer divergir lo que el WP exige mantener unificado.
 */
export {
  calcularPresentacionBanca,
  estilosBanca,
  PALETA_BANCAS,
  type ColoresBanca,
  type EntradaEstadoBanca,
  type EstadoPrincipalBanca,
  type FamiliaCromaticaBanca,
  type PresentacionBanca,
} from './estado_banca'
