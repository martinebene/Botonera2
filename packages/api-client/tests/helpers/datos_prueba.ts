/**
 * Payloads de prueba tipados para los tests de @botonera2/api-client.
 */

import type { EstadoModeracion, EstadoRecinto } from '../../src/tipos'

export function crearMockEstadoModeracion(
  revision = 1,
  estadoGlobal: EstadoModeracion['estado_global'] = 'PREPARANDO',
): EstadoModeracion {
  return {
    revision,
    generado_en: new Date().toISOString(),
    estado_global: estadoGlobal,
    preparacion: {
      numero_sesion: 1,
      presidencia: 'Presidente Test',
      secretaria_legislativa: 'Secretario Test',
      fecha_hora_inicio: new Date().toISOString(),
    },
    sesion: null,
    configuracion: {
      quorum: 7,
      filas_bancas: [6, 6],
      tipos_votacion: ['General', 'Particular'],
      duracion_test_segundos: 5,
      revelado_votos_moderacion_segundos: 4,
      cuenta_regresiva_recinto_segundos: 4,
      resultado_publico_recinto_segundos: 6,
    },
    concejales: [
      {
        dni: '12345678',
        nombre: 'Concejal',
        apellido: 'Uno',
        bloque: 'Bloque A',
        banca: 1,
        dispositivo_votacion: 'dev01',
        ruta_imagen: '/img/1.png',
        presente: true,
        test_activo: false,
        test_expira_en: null,
      },
    ],
    quorum: {
      cantidad_presentes: 1,
      requerido: 7,
      alcanzado: false,
    },
    votacion: null,
    palabra: {
      cola: [],
      orador: null,
    },
    orden_del_dia: [],
    eventos_recientes: [],
    auditoria: {
      activa: true,
      disponible: true,
      fallado: false,
      cerrado: false,
      motivo: null,
    },
    remapeo: null,
    capacidades: {
      preparar_sala: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      actualizar_preparacion: { habilitada: true, motivos: [] },
      cancelar_preparacion: { habilitada: true, motivos: [] },
      abrir_sesion: { habilitada: false, motivos: ['QUORUM_INSUFICIENTE'] },
      actualizar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cerrar_sesion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      cargar_orden_del_dia: { habilitada: true, motivos: [] },
      descartar_orden_del_dia: { habilitada: true, motivos: [] },
      abrir_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      finalizar_votacion: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      desempatar: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      otorgar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      quitar_palabra: { habilitada: false, motivos: ['ESTADO_INCOMPATIBLE'] },
      iniciar_remapeo: { habilitada: true, motivos: [] },
      confirmar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
      cancelar_remapeo: { habilitada: false, motivos: ['REMAPEO_NO_COINCIDE'] },
    },
  }
}

export function crearMockEstadoRecinto(
  revision = 1,
  estadoGlobal: EstadoRecinto['estado_global'] = 'PREPARANDO',
): EstadoRecinto {
  return {
    revision,
    generado_en: new Date().toISOString(),
    estado_global: estadoGlobal,
    preparacion: {
      numero_sesion: 1,
      presidencia: 'Presidente Test',
      secretaria_legislativa: 'Secretario Test',
      fecha_hora_inicio: new Date().toISOString(),
    },
    sesion: null,
    filas_bancas: [1],
    concejales: [
      {
        nombre: 'Concejal',
        apellido: 'Uno',
        bloque: 'Bloque A',
        banca: 1,
        ruta_imagen: '/img/1.png',
        presente: true,
        test_activo: false,
        test_expira_en: null,
      },
    ],
    quorum: {
      cantidad_presentes: 1,
      requerido: 7,
      alcanzado: false,
    },
    votacion: null,
    palabra: {
      cola: [],
      orador: null,
    },
  }
}
