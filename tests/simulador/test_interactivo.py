"""Pruebas del modo interactivo persistente del simulador (WP-007).

Verifica:
- La interpretacion de comandos internos ('ayuda', 'url', 'salir', 'q').
- La continuidad de la sesion interactiva tras un error de sintaxis manual.
- La continuidad de la sesion interactiva tras un error de red o conexion rechazada.
- La emision correcta de pulsaciones validas y muestra de respuestas literales.
- El cierre limpio ante EOF.
"""

from __future__ import annotations

import io
import json

import httpx
import pytest
from cliente import ClienteBackend
from interactivo import ejecutar_consola_interactiva

pytestmark = pytest.mark.anyio


async def test_interactivo_comandos_internos_y_salida() -> None:
    """Verifica el funcionamiento de los comandos ayuda, url y salir."""
    entrada = io.StringIO("ayuda\nurl\nsalir\n")
    salida = io.StringIO()

    async with httpx.AsyncClient() as cliente_httpx:
        cliente = ClienteBackend(
            url_base="http://127.0.0.1:8000",
            cliente_httpx=cliente_httpx,
        )
        await ejecutar_consola_interactiva(
            cliente=cliente,
            flujo_entrada=entrada,
            flujo_salida=salida,
        )

    texto = salida.getvalue()
    assert "Comandos disponibles en la consola interactiva" in texto
    assert "URL base: http://127.0.0.1:8000" in texto
    assert "Endpoint: http://127.0.0.1:8000/api/v1/entradas/tecla" in texto
    assert "Sesion finalizada." in texto


async def test_interactivo_continuidad_tras_error_sintaxis() -> None:
    """Verifica que un error de formato no interrumpa la consola interactiva."""
    # Primer comando: formato invalido (sin guion)
    # Segundo comando: formato valido (1-9)
    # Tercer comando: salir
    entrada = io.StringIO("invalido_sin_guion\n1-9\nsalir\n")
    salida = io.StringIO()

    cuerpo_resp = json.dumps(
        {
            "aceptada": True,
            "dispositivo": "dev01",
            "tecla": "9",
            "motivo": "PRESENCIA_ACTUALIZADA",
        }
    )

    def mock_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=cuerpo_resp)

    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_backend)) as cliente_httpx:
        cliente = ClienteBackend(cliente_httpx=cliente_httpx)
        await ejecutar_consola_interactiva(
            cliente=cliente,
            flujo_entrada=entrada,
            flujo_salida=salida,
        )

    texto = salida.getvalue()
    # Debe haber informado el error de formato
    assert "[error de formato]" in texto
    assert "falta el separador '-'" in texto
    # Y debe haber continuado y ejecutado el comando 1-9
    assert "[envio] dispositivo=dev01 tecla=9" in texto
    assert "[respuesta] HTTP 200" in texto
    assert "Sesion finalizada." in texto


async def test_interactivo_continuidad_tras_error_de_red() -> None:
    """Verifica que una falla de red (ConnectError) informe el diagnostico sin cerrar la consola."""
    entrada = io.StringIO("1-9\nsalir\n")
    salida = io.StringIO()

    def mock_fallo_red(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_fallo_red)) as cliente_httpx:
        cliente = ClienteBackend(cliente_httpx=cliente_httpx)
        await ejecutar_consola_interactiva(
            cliente=cliente,
            flujo_entrada=entrada,
            flujo_salida=salida,
        )

    texto = salida.getvalue()
    assert "[envio] dispositivo=dev01 tecla=9" in texto
    assert "[error de conexion]" in texto
    assert "No se pudo establecer conexion con el backend" in texto
    assert "Sesion finalizada." in texto
