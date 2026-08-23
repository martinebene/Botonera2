"""Construcción y ciclo de vida de la aplicación FastAPI."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from botonera2_backend.api.entradas import enrutador_entradas
from botonera2_backend.api.errores import registrar_manejadores_errores
from botonera2_backend.api.orden_del_dia import enrutador_orden_del_dia
from botonera2_backend.api.palabra import enrutador_palabra
from botonera2_backend.api.preparacion import enrutador_preparacion
from botonera2_backend.api.salud import enrutador_salud
from botonera2_backend.api.sesion import enrutador_sesion
from botonera2_backend.api.votaciones import enrutador_votaciones
from botonera2_backend.recursos import (
    crear_recursos_aplicacion,
    descartar_recursos_aplicacion,
    guardar_recursos_aplicacion,
)

REGISTRO = logging.getLogger(__name__)


@asynccontextmanager
async def ciclo_vida(aplicacion: FastAPI) -> AsyncGenerator[None]:
    """Crea al arrancar y descarta al detener los recursos únicos del proceso.

    No se lee ningún archivo ni almacenamiento persistente. Por eso cada entrada
    al contexto representa un arranque limpio en ``SIN_PREPARAR``.
    """

    recursos = crear_recursos_aplicacion()
    guardar_recursos_aplicacion(aplicacion, recursos)
    try:
        yield
    finally:
        descartar_recursos_aplicacion(aplicacion)


async def manejar_error_interno(solicitud: Request, error: Exception) -> JSONResponse:
    """Convierte una excepción inesperada en un fallo HTTP estable y discreto.

    El detalle completo queda en el registro técnico para diagnóstico, pero no
    se devuelve al cliente porque podría revelar información interna. Mantener
    la excepción como error impide que una futura mutación fallida sea comunicada
    como exitosa.
    """

    REGISTRO.exception(
        "Error interno no controlado durante %s %s",
        solicitud.method,
        solicitud.url.path,
        exc_info=error,
    )
    return JSONResponse(
        status_code=500,
        content={
            "codigo": "ERROR_INTERNO",
            "mensaje": "Ocurrió un error interno.",
        },
    )


def crear_aplicacion() -> FastAPI:
    """Construye una aplicación aislada y testeable con su API versionada."""

    aplicacion = FastAPI(
        title="Botonera2 Backend",
        lifespan=ciclo_vida,
    )
    aplicacion.add_exception_handler(Exception, manejar_error_interno)
    # Los manejadores por tipo traducen los errores de dominio/técnicos a las
    # respuestas estables del contrato antes de llegar al genérico anterior.
    registrar_manejadores_errores(aplicacion)
    aplicacion.include_router(enrutador_salud, prefix="/api/v1")
    aplicacion.include_router(enrutador_preparacion, prefix="/api/v1")
    aplicacion.include_router(enrutador_sesion, prefix="/api/v1")
    aplicacion.include_router(enrutador_votaciones, prefix="/api/v1")
    aplicacion.include_router(enrutador_entradas, prefix="/api/v1")
    aplicacion.include_router(enrutador_orden_del_dia, prefix="/api/v1")
    aplicacion.include_router(enrutador_palabra, prefix="/api/v1")
    return aplicacion
