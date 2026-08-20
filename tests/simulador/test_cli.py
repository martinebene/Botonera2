"""Pruebas de la interfaz de linea de comandos (CLI) del simulador (WP-007).

Verifica:
- El parseo de argumentos (`pulsacion`, `--escenario`, `--url`, `--timeout`).
- Los codigos de salida deterministas en modo de pulsacion unica:
  * 0 cuando se recibe respuesta HTTP 2xx (incluso rechazos funcionales DTO 200).
  * 1 ante errores de sintaxis, fallos de red o codigos HTTP 4xx/5xx.
- Los codigos de salida en modo escenario (0 para exito, 1 para discrepancias o errores).
- La deteccion de argumentos incompatibles (pulsacion + escenario).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import httpx
import pytest
from simulador import construir_argumentos_cli, ejecutar_simulador_async

pytestmark = pytest.mark.anyio


def test_construir_argumentos_cli_por_defecto() -> None:
    """Verifica los valores por defecto al no pasar argumentos."""
    parser = construir_argumentos_cli()
    args = parser.parse_args([])

    assert args.pulsacion is None
    assert args.ruta_escenario is None
    assert args.url_base == "http://127.0.0.1:8000"
    assert args.timeout_segundos == 10.0


def test_construir_argumentos_cli_pulsacion_y_url() -> None:
    """Verifica el parseo de pulsacion posicional y URL base personalizada."""
    parser = construir_argumentos_cli()
    args = parser.parse_args(["5-9", "--url", "http://backend.local:9000", "--timeout", "5.0"])

    assert args.pulsacion == "5-9"
    assert args.ruta_escenario is None
    assert args.url_base == "http://backend.local:9000"
    assert args.timeout_segundos == 5.0


def test_construir_argumentos_cli_escenario() -> None:
    """Verifica el parseo de la opcion -e / --escenario."""
    parser = construir_argumentos_cli()
    args = parser.parse_args(["-e", "ruta/a/escenario.json"])

    assert args.pulsacion is None
    assert args.ruta_escenario == "ruta/a/escenario.json"


async def test_cli_pulsacion_unica_exitosa_retorna_cero(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verifica que una respuesta HTTP 200 (incluso con aceptada=false) retorne codigo 0."""
    cuerpo = json.dumps(
        {
            "aceptada": False,
            "dispositivo": "dev01",
            "tecla": "4",
            "motivo": "TECLA_NO_HABILITADA",
        }
    )

    def mock_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=cuerpo)

    # Inyectar transporte mockeado para evitar peticiones de red reales
    transporte_mock = httpx.MockTransport(mock_backend)

    class ClienteAsyncMock(httpx.AsyncClient):
        def __init__(self, *args: object, **kwargs: object) -> None:
            kwargs_dict = dict(kwargs)
            kwargs_dict["transport"] = transporte_mock
            super().__init__(*args, **kwargs_dict)

    monkeypatch.setattr("cliente.httpx.AsyncClient", ClienteAsyncMock)

    parser = construir_argumentos_cli()
    args = parser.parse_args(["1-4"])

    codigo = await ejecutar_simulador_async(args)
    assert codigo == 0


async def test_cli_pulsacion_unica_error_http_retorna_uno(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verifica que una respuesta HTTP 422 o 503 devuelva codigo no cero (1)."""

    def mock_422(request: httpx.Request) -> httpx.Response:
        return httpx.Response(422, text='{"detail": "Unprocessable Entity"}')

    transporte_mock = httpx.MockTransport(mock_422)

    class ClienteAsyncMock(httpx.AsyncClient):
        def __init__(self, *args: object, **kwargs: object) -> None:
            kwargs_dict = dict(kwargs)
            kwargs_dict["transport"] = transporte_mock
            super().__init__(*args, **kwargs_dict)

    monkeypatch.setattr("cliente.httpx.AsyncClient", ClienteAsyncMock)

    parser = construir_argumentos_cli()
    args = parser.parse_args(["1-9"])

    codigo = await ejecutar_simulador_async(args)
    assert codigo == 1


async def test_cli_pulsacion_error_sintaxis_retorna_uno() -> None:
    """Verifica que una pulsacion con formato invalido retorne codigo 1 de inmediato."""
    parser = construir_argumentos_cli()
    args = parser.parse_args(["invalido_sin_guion"])

    codigo = await ejecutar_simulador_async(args)
    assert codigo == 1


async def test_cli_escenario_incompatible_con_pulsacion() -> None:
    """Verifica que pasar ambos argumentos devuelva codigo 1."""
    args = argparse.Namespace(
        pulsacion="1-9",
        ruta_escenario="algun_escenario.json",
        url_base="http://127.0.0.1:8000",
        timeout_segundos=10.0,
    )
    codigo = await ejecutar_simulador_async(args)
    assert codigo == 1


async def test_cli_escenario_archivo_inexistente_retorna_uno() -> None:
    """Verifica que un archivo de escenario inexistente retorne codigo 1."""
    parser = construir_argumentos_cli()
    args = parser.parse_args(["--escenario", "no_existe_archivo_12345.json"])

    codigo = await ejecutar_simulador_async(args)
    assert codigo == 1


async def test_cli_escenario_exitoso_retorna_cero(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifica que un escenario cuyos pasos pasan retorne codigo 0."""
    archivo_escenario = tmp_path / "escenario_test.json"
    archivo_escenario.write_text(
        json.dumps(
            {
                "nombre": "escenario-prueba",
                "precondicion": "",
                "pasos": [
                    {
                        "entrada": "1-9",
                        "esperado": {
                            "status_http": 200,
                            "aceptada": True,
                            "motivo": "PRESENCIA_ACTUALIZADA",
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    cuerpo = json.dumps(
        {
            "aceptada": True,
            "dispositivo": "dev01",
            "tecla": "9",
            "motivo": "PRESENCIA_ACTUALIZADA",
        }
    )

    def mock_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=cuerpo)

    transporte_mock = httpx.MockTransport(mock_backend)

    class ClienteAsyncMock(httpx.AsyncClient):
        def __init__(self, *args: object, **kwargs: object) -> None:
            kwargs_dict = dict(kwargs)
            kwargs_dict["transport"] = transporte_mock
            super().__init__(*args, **kwargs_dict)

    monkeypatch.setattr("cliente.httpx.AsyncClient", ClienteAsyncMock)

    parser = construir_argumentos_cli()
    args = parser.parse_args(["--escenario", str(archivo_escenario)])

    codigo = await ejecutar_simulador_async(args)
    assert codigo == 0
