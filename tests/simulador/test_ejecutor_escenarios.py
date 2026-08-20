"""Pruebas del ejecutor de escenarios declarativos y grupos concurrentes (WP-007).

Verifica:
- La ejecucion secuencial de escenarios con expectativas exitosas.
- El diagnostico y reporte de discrepancias ante expectativas no satisfechas.
- La ejecucion de pausas temporales.
- La ejecucion concurrente real de pulsaciones simultaneas mediante task groups.
- La salida visible completa (envio, status HTTP, cuerpo literal y discrepancias).
"""

from __future__ import annotations

import io
import json

import httpx
import pytest
from cliente import ClienteBackend
from ejecutor_escenarios import EjecutorEscenarios, imprimir_resultado_envio
from modelos import (
    EscenarioDeclarativo,
    ExpectativaRespuesta,
    PasoConcurrente,
    PasoPausa,
    PasoPulsacion,
    PulsacionLogica,
    RespuestaServidor,
    ResultadoEnvio,
)

pytestmark = pytest.mark.anyio


def test_imprimir_resultado_envio_exitoso() -> None:
    """Verifica que imprimir_resultado_envio muestre el envio, status, body literal y resumen."""
    salida = io.StringIO()
    cuerpo = json.dumps(
        {
            "aceptada": True,
            "dispositivo": "dev01",
            "tecla": "9",
            "motivo": "PRESENCIA_ACTUALIZADA",
        }
    )
    resultado = ResultadoEnvio(
        pulsacion=PulsacionLogica(dispositivo="dev01", tecla="9"),
        respuesta=RespuestaServidor(status_http=200, cuerpo_literal=cuerpo),
        exito_comunicacion=True,
    )

    imprimir_resultado_envio(resultado, salida=salida)
    texto = salida.getvalue()

    assert "[envio] dispositivo=dev01 tecla=9" in texto
    assert "[respuesta] HTTP 200" in texto
    assert cuerpo in texto
    assert "[resumen] aceptada=True motivo=PRESENCIA_ACTUALIZADA" in texto


def test_imprimir_resultado_envio_cuerpo_vacio() -> None:
    """Verifica que un cuerpo vacio quede explicitado como (cuerpo vacio)."""
    salida = io.StringIO()
    resultado = ResultadoEnvio(
        pulsacion=PulsacionLogica(dispositivo="dev05", tecla="8"),
        respuesta=RespuestaServidor(status_http=204, cuerpo_literal=""),
        exito_comunicacion=True,
    )

    imprimir_resultado_envio(resultado, salida=salida)
    texto = salida.getvalue()

    assert "[envio] dispositivo=dev05 tecla=8" in texto
    assert "[respuesta] HTTP 204" in texto
    assert "(cuerpo vacio)" in texto


def test_imprimir_resultado_envio_error_red() -> None:
    """Verifica que un error de red se imprima con mensaje claro."""
    salida = io.StringIO()
    resultado = ResultadoEnvio(
        pulsacion=PulsacionLogica(dispositivo="dev02", tecla="1"),
        respuesta=None,
        error_red="Conexion rechazada",
        exito_comunicacion=False,
    )

    imprimir_resultado_envio(resultado, salida=salida)
    texto = salida.getvalue()

    assert "[envio] dispositivo=dev02 tecla=1" in texto
    assert "[error de conexion] Conexion rechazada" in texto


async def test_ejecutor_escenario_secuencial_exitoso() -> None:
    """Ejecuta un escenario con pulsacion y pausa que cumple todas sus expectativas."""
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

    salida = io.StringIO()
    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_backend)) as cliente_httpx:
        cliente = ClienteBackend(cliente_httpx=cliente_httpx)
        ejecutor = EjecutorEscenarios(cliente=cliente, flujo_salida=salida)

        escenario = EscenarioDeclarativo(
            nombre="test-exitoso",
            precondicion="backend en PREPARANDO",
            pasos=[
                PasoPulsacion(
                    pulsacion=PulsacionLogica(dispositivo="dev01", tecla="9"),
                    esperado=ExpectativaRespuesta(
                        status_http=200,
                        aceptada=True,
                        motivo="PRESENCIA_ACTUALIZADA",
                    ),
                ),
                PasoPausa(milisegundos=20),
            ],
        )

        resumen = await ejecutor.ejecutar_escenario(escenario)

    assert resumen.es_exitoso is True
    assert resumen.total_pulsaciones == 1
    assert resumen.total_pausas == 1
    assert resumen.total_discrepancias == 0
    assert resumen.total_fallos_red == 0

    texto_salida = salida.getvalue()
    assert "EJECUTANDO ESCENARIO: test-exitoso" in texto_salida
    assert "[EXITO] Todas las expectativas fueron satisfechas" in texto_salida


async def test_ejecutor_escenario_con_expectativa_fallada() -> None:
    """Ejecuta un escenario donde el backend devuelve un motivo distinto al esperado."""
    cuerpo_resp = json.dumps(
        {
            "aceptada": False,
            "dispositivo": "dev01",
            "tecla": "4",
            "motivo": "TECLA_NO_HABILITADA",
        }
    )

    def mock_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=cuerpo_resp)

    salida = io.StringIO()
    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_backend)) as cliente_httpx:
        cliente = ClienteBackend(cliente_httpx=cliente_httpx)
        ejecutor = EjecutorEscenarios(cliente=cliente, flujo_salida=salida)

        escenario = EscenarioDeclarativo(
            nombre="test-fallo-esperado",
            precondicion="",
            pasos=[
                PasoPulsacion(
                    pulsacion=PulsacionLogica(dispositivo="dev01", tecla="4"),
                    # Esperaba erroneamente aceptada=True
                    esperado=ExpectativaRespuesta(
                        status_http=200,
                        aceptada=True,
                        motivo="PRESENCIA_ACTUALIZADA",
                    ),
                ),
            ],
        )

        resumen = await ejecutor.ejecutar_escenario(escenario)

    assert resumen.es_exitoso is False
    assert resumen.total_discrepancias >= 2  # Discrepancia en 'aceptada' y 'motivo'
    texto_salida = salida.getvalue()
    assert "[FALLO EXPECTATIVA]" in texto_salida
    assert "[FALLO] Errores de comunicacion o expectativas incumplidas" in texto_salida


async def test_ejecutor_grupo_concurrente_dispara_en_paralelo() -> None:
    """Verifica que las pulsaciones de un paso concurrente se emitan en paralelo."""
    peticiones_procesadas: list[str] = []

    async def mock_backend_concurrente(request: httpx.Request) -> httpx.Response:
        cuerpo = json.loads(request.content)
        dispositivo = cuerpo["dispositivo"]
        peticiones_procesadas.append(dispositivo)
        return httpx.Response(
            200,
            text=json.dumps(
                {
                    "aceptada": True,
                    "dispositivo": dispositivo,
                    "tecla": cuerpo["tecla"],
                    "motivo": "PRESENCIA_ACTUALIZADA",
                }
            ),
        )

    salida = io.StringIO()
    transporte_mock = httpx.MockTransport(mock_backend_concurrente)
    async with httpx.AsyncClient(transport=transporte_mock) as cliente_httpx:
        cliente = ClienteBackend(cliente_httpx=cliente_httpx)
        ejecutor = EjecutorEscenarios(cliente=cliente, flujo_salida=salida)

        paso_concurrente = PasoConcurrente(
            pulsaciones=[
                PasoPulsacion(
                    pulsacion=PulsacionLogica(dispositivo="dev01", tecla="9"),
                    esperado=ExpectativaRespuesta(status_http=200),
                ),
                PasoPulsacion(
                    pulsacion=PulsacionLogica(dispositivo="dev02", tecla="9"),
                    esperado=ExpectativaRespuesta(status_http=200),
                ),
                PasoPulsacion(
                    pulsacion=PulsacionLogica(dispositivo="dev03", tecla="9"),
                    esperado=ExpectativaRespuesta(status_http=200),
                ),
            ]
        )

        escenario = EscenarioDeclarativo(
            nombre="test-concurrencia",
            precondicion="",
            pasos=[paso_concurrente],
        )

        resumen = await ejecutor.ejecutar_escenario(escenario)

    assert resumen.es_exitoso is True
    assert resumen.total_pulsaciones == 3
    assert len(peticiones_procesadas) == 3
    assert set(peticiones_procesadas) == {"dev01", "dev02", "dev03"}
    assert "[grupo concurrente] Disparando 3 pulsaciones simultaneas" in salida.getvalue()
