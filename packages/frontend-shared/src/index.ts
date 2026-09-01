/**
 * Punto de entrada del código genuinamente común a ambos frontends.
 *
 * Solo se publica aquí lo que necesita ser idéntico en Moderación y Recinto.
 * Hoy incluye la semántica visual de una banca (WP-045) y el cálculo temporal
 * backend-backend de la duración de sesión (WP-047). Si estas reglas vivieran
 * duplicadas, una corrección posterior podría aplicarse en una sola interfaz.
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

export { calcularDuracionEnSnapshot, convertirMarcaBackend, formatearDuracion } from './tiempo'
