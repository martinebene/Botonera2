"""Pruebas integradas del lifespan y de la API técnica."""

from copy import deepcopy

import pytest
from botonera2_backend.aplicacion import crear_aplicacion
from botonera2_backend.dominio.estado import EstadoGlobal
from botonera2_backend.recursos import (
    NOMBRE_RECURSOS,
    obtener_recursos_aplicacion,
)
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.anyio


async def test_lifespan_crea_una_instancia_y_la_descarta_al_finalizar() -> None:
    """Los recursos solamente están disponibles dentro del ciclo de vida."""

    aplicacion = crear_aplicacion()
    assert not hasattr(aplicacion.state, NOMBRE_RECURSOS)

    async with aplicacion.router.lifespan_context(aplicacion):
        recursos = obtener_recursos_aplicacion(aplicacion)
        assert recursos is obtener_recursos_aplicacion(aplicacion)
        assert recursos.estado_operativo.estado_global is EstadoGlobal.SIN_PREPARAR

    assert not hasattr(aplicacion.state, NOMBRE_RECURSOS)


async def test_reinicio_crea_un_estado_operativo_nuevo() -> None:
    """Dos ciclos de vida no comparten ni reconstruyen el estado en memoria."""

    aplicacion = crear_aplicacion()

    async with aplicacion.router.lifespan_context(aplicacion):
        estado_anterior = obtener_recursos_aplicacion(aplicacion).estado_operativo

    async with aplicacion.router.lifespan_context(aplicacion):
        estado_nuevo = obtener_recursos_aplicacion(aplicacion).estado_operativo

    assert estado_nuevo is not estado_anterior
    assert estado_nuevo.estado_global is EstadoGlobal.SIN_PREPARAR


async def test_health_responde_sin_modificar_estado() -> None:
    """El health check es una consulta técnica y no una operación funcional."""

    aplicacion = crear_aplicacion()

    async with aplicacion.router.lifespan_context(aplicacion):
        recursos = obtener_recursos_aplicacion(aplicacion)
        estado_antes = deepcopy(recursos.estado_operativo)
        transporte = ASGITransport(app=aplicacion)

        async with AsyncClient(transport=transporte, base_url="http://pruebas") as cliente:
            respuesta = await cliente.get("/api/v1/health")

        assert respuesta.status_code == 200
        assert respuesta.json() == {"estado": "ok"}
        assert recursos.estado_operativo == estado_antes
        assert recursos is obtener_recursos_aplicacion(aplicacion)


async def test_error_inesperado_no_expone_detalles_internos() -> None:
    """La API informa un fallo estable sin filtrar el texto de la excepción."""

    aplicacion = crear_aplicacion()

    async def provocar_error() -> None:
        raise RuntimeError("detalle que no debe llegar al cliente")

    aplicacion.add_api_route("/error-sintetico", provocar_error, methods=["GET"])

    async with aplicacion.router.lifespan_context(aplicacion):
        transporte = ASGITransport(app=aplicacion, raise_app_exceptions=False)
        async with AsyncClient(transport=transporte, base_url="http://pruebas") as cliente:
            respuesta = await cliente.get("/error-sintetico")

    assert respuesta.status_code == 500
    assert respuesta.json() == {
        "codigo": "ERROR_INTERNO",
        "mensaje": "Ocurrió un error interno.",
    }
    assert "detalle" not in respuesta.text


def test_factory_construye_aplicaciones_independientes() -> None:
    """La factory no comparte el almacén de estado entre aplicaciones."""

    primera: FastAPI = crear_aplicacion()
    segunda: FastAPI = crear_aplicacion()

    assert primera is not segunda
    assert primera.state is not segunda.state
