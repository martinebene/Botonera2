"""Recurso REST ``/api/v1/preparacion`` (WP-005).

Expone los dos comandos del ciclo de preparación definidos por el contrato
(documento 04, sección 6):

- ``POST /api/v1/preparacion``: ``Preparar sala`` desde ``SIN_PREPARAR``;
- ``DELETE /api/v1/preparacion``: cancelar la preparación desde
  ``PREPARANDO``.

Ambos comandos se invocan **sin body** y responden ``204 No Content`` sin
cuerpo cuando completan. Ninguno recibe rutas, configuración, padrón ni
motivo desde el cliente: el backend carga siempre sus archivos canónicos.

La traducción de errores no vive aquí: las excepciones de dominio/técnicas se
propagan y los manejadores registrados en ``api/errores.py`` producen las
respuestas estables ``409 ESTADO_INCOMPATIBLE``, ``503
CONFIGURACION_INVALIDA``, ``503 PADRON_INVALIDO``, ``503
AUDITORIA_NO_DISPONIBLE`` y ``500 ERROR_INTERNO``.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request, Response, status

from botonera2_backend.api.errores import ErrorRespuesta
from botonera2_backend.recursos import obtener_recursos_aplicacion
from botonera2_backend.servicios.preparacion import ServicioPreparacion

enrutador_preparacion = APIRouter(tags=["preparacion"])

# Documentación OpenAPI de las respuestas de error del contrato. El modelo
# ``ErrorRespuesta`` hace visible la forma estable del cuerpo; el código 500
# lo produce el manejador genérico de ``aplicacion.py``.
RESPUESTAS_ERROR_PREPARACION: dict[int | str, dict[str, Any]] = {
    409: {
        "model": ErrorRespuesta,
        "description": "El comando no es válido para el estado global actual "
        "(ESTADO_INCOMPATIBLE).",
    },
    503: {
        "model": ErrorRespuesta,
        "description": "Indisponibilidad técnica: CONFIGURACION_INVALIDA, "
        "PADRON_INVALIDO o AUDITORIA_NO_DISPONIBLE según el caso.",
    },
    500: {
        "model": ErrorRespuesta,
        "description": "Fallo inesperado no clasificado (ERROR_INTERNO).",
    },
}


def _crear_servicio(solicitud: Request) -> ServicioPreparacion:
    """Construye el servicio sobre los recursos únicos del proceso.

    El servicio no guarda estado propio, por lo que crearlo por request es
    seguro: siempre opera sobre el ``EstadoOperativo`` y el
    ``EjecutorMutaciones`` que el lifespan instaló en ``app.state``. Las rutas
    de configuración/padrón y el reloj son los canónicos por defecto.
    """

    recursos = obtener_recursos_aplicacion(solicitud.app)
    return ServicioPreparacion(
        estado_operativo=recursos.estado_operativo,
        ejecutor_mutaciones=recursos.ejecutor_mutaciones,
    )


@enrutador_preparacion.post(
    "/preparacion",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=RESPUESTAS_ERROR_PREPARACION,
)
async def preparar_sala(solicitud: Request) -> Response:
    """Inicia una nueva preparación de sala (CU-01).

    Carga y congela ``config/system.toml`` y ``config/concejales.csv``, crea
    el conjunto de auditoría L1/L2/L3, persiste ``PREPARACION_INICIADA`` y
    recién entonces deja el sistema en ``PREPARANDO`` con todos los
    concejales ausentes. Si algún paso obligatorio falla, no se confirma
    éxito y el sistema permanece en ``SIN_PREPARAR``.
    """

    await _crear_servicio(solicitud).preparar_sala()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@enrutador_preparacion.delete(
    "/preparacion",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=RESPUESTAS_ERROR_PREPARACION,
)
async def cancelar_preparacion(solicitud: Request) -> Response:
    """Cancela la preparación activa (CU-02), sin recibir ni exigir motivo.

    Persiste ``PREPARACION_CANCELADA``, cierra definitivamente los tres CSV
    (que se conservan en disco) y devuelve el sistema a ``SIN_PREPARAR`` con
    el contexto operativo completamente descartado. Si la auditoría no puede
    garantizar esos pasos, no se confirma la cancelación y el estado
    permanece en ``PREPARANDO`` en fallo cerrado.
    """

    await _crear_servicio(solicitud).cancelar_preparacion()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
