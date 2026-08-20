"""Pruebas del cliente HTTP asincrono del simulador (WP-007).

Verifica:
- La composicion segura de URLs sin duplicar barras.
- El envio del payload JSON exacto al endpoint `/api/v1/entradas/tecla`.
- La preservacion intacta del cuerpo literal devuelto por el backend.
- La captura controlada de errores de red (ConnectError, Timeout) sin tracebacks.
- El funcionamiento con codigos de estado HTTP exitosos (200) y de error (422, 503, 500).
"""

from __future__ import annotations

import json

import httpx
import pytest
from cliente import ClienteBackend, componer_url_entradas
from modelos import PulsacionLogica

pytestmark = pytest.mark.anyio


def test_componer_url_entradas() -> None:
    """Verifica que la URL del endpoint se componga limpiamente en cualquier formato."""
    assert (
        componer_url_entradas("http://127.0.0.1:8000")
        == "http://127.0.0.1:8000/api/v1/entradas/tecla"
    )
    assert (
        componer_url_entradas("http://127.0.0.1:8000/")
        == "http://127.0.0.1:8000/api/v1/entradas/tecla"
    )
    assert (
        componer_url_entradas("http://localhost:8080/prefix")
        == "http://localhost:8080/prefix/api/v1/entradas/tecla"
    )


async def test_cliente_envia_payload_exacto_y_preserva_cuerpo_literal() -> None:
    """Verifica que el cliente envie payload JSON exacto y reciba el body literal."""
    peticiones_recibidas: list[httpx.Request] = []
    cuerpo_simulado = json.dumps(
        {
            "aceptada": True,
            "dispositivo": "dev05",
            "tecla": "9",
            "motivo": "PRESENCIA_ACTUALIZADA",
        }
    )

    def manejador_mock(request: httpx.Request) -> httpx.Response:
        peticiones_recibidas.append(request)
        return httpx.Response(200, text=cuerpo_simulado)

    transporte = httpx.MockTransport(manejador_mock)
    async with httpx.AsyncClient(transport=transporte) as cliente_httpx:
        cliente = ClienteBackend(
            url_base="http://test-server:8000",
            cliente_httpx=cliente_httpx,
        )

        pulsacion = PulsacionLogica(dispositivo="dev05", tecla="9")
        resultado = await cliente.enviar_pulsacion(pulsacion)

    # 1. Comprobar que se envio la peticion correcta
    assert len(peticiones_recibidas) == 1
    req = peticiones_recibidas[0]
    assert req.method == "POST"
    assert str(req.url) == "http://test-server:8000/api/v1/entradas/tecla"
    assert json.loads(req.content) == {"dispositivo": "dev05", "tecla": "9"}

    # 2. Comprobar resultado del cliente
    assert resultado.exito_comunicacion is True
    assert resultado.error_red is None
    assert resultado.respuesta is not None
    assert resultado.respuesta.status_http == 200
    assert resultado.respuesta.cuerpo_literal == cuerpo_simulado
    assert resultado.es_exitoso_para_cli is True


async def test_cliente_preserva_cuerpo_no_json_y_cuerpo_vacio() -> None:
    """Verifica que cuerpos de error no JSON o vacios se preserven literalmente."""

    # Caso 1: Error 503 con texto plano
    def mock_503(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="Servicio de auditoria temporalmente no disponible")

    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_503)) as cliente_httpx:
        cliente = ClienteBackend(cliente_httpx=cliente_httpx)
        res = await cliente.enviar_pulsacion(PulsacionLogica(dispositivo="dev01", tecla="9"))

    assert res.exito_comunicacion is True
    assert res.respuesta is not None
    assert res.respuesta.status_http == 503
    assert res.respuesta.cuerpo_literal == "Servicio de auditoria temporalmente no disponible"
    assert res.es_exitoso_para_cli is False  # 503 no es 2xx

    # Caso 2: Cuerpo completamente vacio
    def mock_vacio(request: httpx.Request) -> httpx.Response:
        return httpx.Response(204, text="")

    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_vacio)) as cliente_httpx:
        cliente = ClienteBackend(cliente_httpx=cliente_httpx)
        res_vacio = await cliente.enviar_pulsacion(PulsacionLogica(dispositivo="dev01", tecla="9"))

    assert res_vacio.respuesta is not None
    assert res_vacio.respuesta.status_http == 204
    assert res_vacio.respuesta.cuerpo_literal == ""
    assert res_vacio.es_exitoso_para_cli is True


async def test_cliente_maneja_error_de_conexion_sin_excepcion() -> None:
    """Verifica que un ConnectError devuelva ResultadoEnvio con exito_comunicacion=False."""

    def mock_conexion_fallida(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    transporte = httpx.MockTransport(mock_conexion_fallida)
    async with httpx.AsyncClient(transport=transporte) as cliente_httpx:
        cliente = ClienteBackend(
            url_base="http://127.0.0.1:9999",
            cliente_httpx=cliente_httpx,
        )
        res = await cliente.enviar_pulsacion(PulsacionLogica(dispositivo="dev01", tecla="9"))

    assert res.exito_comunicacion is False
    assert res.respuesta is None
    assert res.error_red is not None
    assert "No se pudo establecer conexion" in res.error_red
    assert res.es_exitoso_para_cli is False


async def test_cliente_maneja_timeout_sin_excepcion() -> None:
    """Verifica que un TimeoutException devuelva ResultadoEnvio con exito_comunicacion=False."""

    def mock_timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Socket timeout")

    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_timeout)) as cliente_httpx:
        cliente = ClienteBackend(
            url_base="http://127.0.0.1:8000",
            timeout_segundos=2.5,
            cliente_httpx=cliente_httpx,
        )
        res = await cliente.enviar_pulsacion(PulsacionLogica(dispositivo="dev01", tecla="9"))

    assert res.exito_comunicacion is False
    assert res.respuesta is None
    assert res.error_red is not None
    assert "Tiempo de espera agotado" in res.error_red
    assert res.es_exitoso_para_cli is False
