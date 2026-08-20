"""Pruebas unitarias del modulo de parseo y sintaxis del simulador (WP-007).

Verifica exhaustivamente:
- Parsing de sintaxis compacta `<numero>-<tecla>` (ej: `5-9`, `12-8`, `5--`, `3-+`, `4-enter`).
- Rechazo local de entradas invalidas (sin guion, sin dispositivo numerico, tecla vacia).
- Aceptacion de dispositivos fuera del padron y de teclas no funcionales.
- Validacion de escenarios declarativos en JSON (pasos validos, invalidos, pausas, concurrencia).
- Evaluacion de expectativas opcionales (`status_http`, `aceptada`, `motivo`).
- Formateo de lineas de resumen interpretadas.
"""

from __future__ import annotations

import json

import pytest
from modelos import (
    ExpectativaRespuesta,
    PasoConcurrente,
    PasoPausa,
    PasoPulsacion,
    PulsacionLogica,
    RespuestaServidor,
)
from parseador import (
    ErrorFormatoEscenario,
    ErrorSintaxisEntrada,
    evaluar_expectativas,
    formatear_resumen_respuesta,
    normalizar_identificador_dispositivo,
    parsear_escenario_json,
    parsear_expectativa,
    parsear_sintaxis_manual,
)


def test_normalizar_identificador_dispositivo() -> None:
    """Verifica que los enteros se normalicen a formato devNN con al menos dos digitos."""
    assert normalizar_identificador_dispositivo("0") == "dev00"
    assert normalizar_identificador_dispositivo("5") == "dev05"
    assert normalizar_identificador_dispositivo("12") == "dev12"
    assert normalizar_identificador_dispositivo("99") == "dev99"
    assert normalizar_identificador_dispositivo("100") == "dev100"

    # Errores en identificadores no numericos
    with pytest.raises(ErrorSintaxisEntrada, match="debe ser un numero entero"):
        normalizar_identificador_dispositivo("dev05")

    with pytest.raises(ErrorSintaxisEntrada, match="debe ser un numero entero"):
        normalizar_identificador_dispositivo("-5")

    with pytest.raises(ErrorSintaxisEntrada, match="debe ser un numero entero"):
        normalizar_identificador_dispositivo("abc")


def test_parsear_sintaxis_manual_casos_validos() -> None:
    """Comprueba el parseo de combinaciones validas segun la sintaxis <numero>-<tecla> (WP-007)."""
    # Caso 1: 5-9 -> dev05, 9
    p1 = parsear_sintaxis_manual("5-9")
    assert p1 == PulsacionLogica(dispositivo="dev05", tecla="9")

    # Caso 2: 12-8 -> dev12, 8
    p2 = parsear_sintaxis_manual("12-8")
    assert p2 == PulsacionLogica(dispositivo="dev12", tecla="8")

    # Caso 3: 5-- -> dev05, '-' (el primer guion es separador, el segundo es la tecla)
    p3 = parsear_sintaxis_manual("5--")
    assert p3 == PulsacionLogica(dispositivo="dev05", tecla="-")

    # Caso 4: Signos y operadores (3-+, 8-., 1-/)
    p4 = parsear_sintaxis_manual("3-+")
    assert p4 == PulsacionLogica(dispositivo="dev03", tecla="+")

    p5 = parsear_sintaxis_manual("8-.")
    assert p5 == PulsacionLogica(dispositivo="dev08", tecla=".")

    # Caso 5: Teclas con nombres textuales (4-enter, 7-numlock)
    p6 = parsear_sintaxis_manual("4-enter")
    assert p6 == PulsacionLogica(dispositivo="dev04", tecla="enter")

    p7 = parsear_sintaxis_manual("7-numlock")
    assert p7 == PulsacionLogica(dispositivo="dev07", tecla="numlock")

    # Caso 6: Dispositivo fuera del padron (99-9) y tecla sin semantica (1-4)
    p8 = parsear_sintaxis_manual("99-9")
    assert p8 == PulsacionLogica(dispositivo="dev99", tecla="9")

    p9 = parsear_sintaxis_manual("1-4")
    assert p9 == PulsacionLogica(dispositivo="dev01", tecla="4")


def test_parsear_sintaxis_manual_casos_invalidos() -> None:
    """Verifica que las entradas mal formadas sean rechazadas con mensaje explicativo."""
    # Entrada vacia o solo espacios
    with pytest.raises(ErrorSintaxisEntrada, match="vacia"):
        parsear_sintaxis_manual("")

    with pytest.raises(ErrorSintaxisEntrada, match="vacia"):
        parsear_sintaxis_manual("   ")

    # Sin guion separador
    with pytest.raises(ErrorSintaxisEntrada, match="falta el separador '-'"):
        parsear_sintaxis_manual("59")

    # Sin numero de dispositivo antes del guion
    with pytest.raises(ErrorSintaxisEntrada, match="falta el numero de dispositivo"):
        parsear_sintaxis_manual("-9")

    # Sin tecla despues del guion
    with pytest.raises(ErrorSintaxisEntrada, match="falta la tecla"):
        parsear_sintaxis_manual("5-")

    # Dispositivo con prefijo dev explicito (invalido en la sintaxis compacta)
    with pytest.raises(ErrorSintaxisEntrada, match="debe ser un numero entero"):
        parsear_sintaxis_manual("dev05-9")

    # Dispositivo no numerico
    with pytest.raises(ErrorSintaxisEntrada, match="debe ser un numero entero"):
        parsear_sintaxis_manual("abc-9")


def test_parsear_expectativa_opcional() -> None:
    """Verifica el parseo de expectativas opcionales y tipos validos."""
    exp1 = parsear_expectativa(
        {
            "status_http": 200,
            "aceptada": True,
            "motivo": "PRESENCIA_ACTUALIZADA",
        }
    )
    assert exp1.status_http == 200
    assert exp1.aceptada is True
    assert exp1.motivo == "PRESENCIA_ACTUALIZADA"
    assert exp1.tiene_expectativas is True

    # Expectativa parcial (solo status_http)
    exp2 = parsear_expectativa({"status_http": 503})
    assert exp2.status_http == 503
    assert exp2.aceptada is None
    assert exp2.motivo is None
    assert exp2.tiene_expectativas is True

    # Expectativa vacia
    exp3 = parsear_expectativa({})
    assert exp3.tiene_expectativas is False

    # Errores de tipo
    with pytest.raises(ErrorFormatoEscenario, match="'status_http'.*entero"):
        parsear_expectativa({"status_http": "200"})

    with pytest.raises(ErrorFormatoEscenario, match="'aceptada'.*booleano"):
        parsear_expectativa({"aceptada": "true"})

    with pytest.raises(ErrorFormatoEscenario, match="'motivo'.*texto"):
        parsear_expectativa({"motivo": 123})


def test_parsear_escenario_json_valido() -> None:
    """Verifica que un JSON de escenario valido se estructure correctamente."""
    datos = {
        "nombre": "prueba-completa",
        "precondicion": "backend en PREPARANDO",
        "pasos": [
            {
                "entrada": "1-9",
                "esperado": {
                    "status_http": 200,
                    "aceptada": True,
                    "motivo": "PRESENCIA_ACTUALIZADA",
                },
            },
            {"pausa_ms": 150},
            {"pausa_segundos": 0.5},
            {
                "concurrentes": [
                    {"entrada": "2-9"},
                    {"dispositivo": "dev03", "tecla": "4", "esperado": {"status_http": 200}},
                ]
            },
        ],
    }

    escenario = parsear_escenario_json(datos)
    assert escenario.nombre == "prueba-completa"
    assert escenario.precondicion == "backend en PREPARANDO"
    assert len(escenario.pasos) == 4

    # Paso 1: Pulsacion
    p1 = escenario.pasos[0]
    assert isinstance(p1, PasoPulsacion)
    assert p1.pulsacion == PulsacionLogica(dispositivo="dev01", tecla="9")
    assert p1.esperado is not None
    assert p1.esperado.status_http == 200
    assert p1.esperado.aceptada is True
    assert p1.esperado.motivo == "PRESENCIA_ACTUALIZADA"

    # Paso 2: Pausa ms
    p2 = escenario.pasos[1]
    assert isinstance(p2, PasoPausa)
    assert p2.milisegundos == 150

    # Paso 3: Pausa segundos convertida a ms
    p3 = escenario.pasos[2]
    assert isinstance(p3, PasoPausa)
    assert p3.milisegundos == 500

    # Paso 4: Grupo concurrente
    p4 = escenario.pasos[3]
    assert isinstance(p4, PasoConcurrente)
    assert len(p4.pulsaciones) == 2
    assert p4.pulsaciones[0].pulsacion == PulsacionLogica(dispositivo="dev02", tecla="9")
    assert p4.pulsaciones[1].pulsacion == PulsacionLogica(dispositivo="dev03", tecla="4")
    assert p4.pulsaciones[1].esperado is not None
    assert p4.pulsaciones[1].esperado.status_http == 200


def test_parsear_escenario_json_errores() -> None:
    """Verifica rechazos controlados ante escenarios mal estructurados."""
    # No es JSON
    with pytest.raises(ErrorFormatoEscenario, match="JSON valido"):
        parsear_escenario_json("{invalido")

    # No es un dict raiz
    with pytest.raises(ErrorFormatoEscenario, match="objeto raíz"):
        parsear_escenario_json("[]")

    # Sin pasos
    with pytest.raises(ErrorFormatoEscenario, match="lista 'pasos'"):
        parsear_escenario_json({"nombre": "foo"})

    # Lista de pasos vacia
    with pytest.raises(ErrorFormatoEscenario, match="no puede estar vacia"):
        parsear_escenario_json({"nombre": "foo", "pasos": []})

    # Paso sin entrada ni campos validos
    with pytest.raises(ErrorFormatoEscenario, match="campo 'entrada'"):
        parsear_escenario_json({"nombre": "foo", "pasos": [{"otro": "campo"}]})

    # Pausa negativa
    with pytest.raises(ErrorFormatoEscenario, match="'pausa_ms' invalido"):
        parsear_escenario_json({"nombre": "foo", "pasos": [{"pausa_ms": -10}]})

    # Grupo concurrente vacio
    with pytest.raises(ErrorFormatoEscenario, match="lista no vacia"):
        parsear_escenario_json({"nombre": "foo", "pasos": [{"concurrentes": list[object]()}]})


def test_evaluar_expectativas_cumplidas() -> None:
    """Verifica que una respuesta coincidente no genere discrepancias."""
    cuerpo = json.dumps(
        {
            "aceptada": True,
            "motivo": "PRESENCIA_ACTUALIZADA",
            "dispositivo": "dev01",
            "tecla": "9",
        }
    )
    resp = RespuestaServidor(status_http=200, cuerpo_literal=cuerpo)
    esperado = ExpectativaRespuesta(status_http=200, aceptada=True, motivo="PRESENCIA_ACTUALIZADA")

    discrepancias = evaluar_expectativas(resp, esperado)
    assert len(discrepancias) == 0


def test_evaluar_expectativas_incumplidas() -> None:
    """Verifica la deteccion precisa de discrepancias en status, aceptada y motivo."""
    cuerpo = json.dumps(
        {
            "aceptada": False,
            "motivo": "TECLA_NO_HABILITADA",
        }
    )
    resp = RespuestaServidor(status_http=200, cuerpo_literal=cuerpo)

    # Esperaba aceptada=True y motivo=PRESENCIA_ACTUALIZADA
    esperado = ExpectativaRespuesta(status_http=200, aceptada=True, motivo="PRESENCIA_ACTUALIZADA")
    discrepancias = evaluar_expectativas(resp, esperado)

    assert len(discrepancias) == 2
    campos_fallados = [d.campo for d in discrepancias]
    assert "aceptada" in campos_fallados
    assert "motivo" in campos_fallados


def test_evaluar_expectativas_con_cuerpo_no_json() -> None:
    """Verifica el diagnostico cuando se espera JSON y se recibe HTML o texto plano."""
    resp = RespuestaServidor(status_http=500, cuerpo_literal="Internal Server Error")
    esperado = ExpectativaRespuesta(status_http=200, aceptada=True, motivo="PRESENCIA_ACTUALIZADA")

    discrepancias = evaluar_expectativas(resp, esperado)
    assert len(discrepancias) >= 2  # Fallo de status_http + fallo de json_invalido
    campos = [d.campo for d in discrepancias]
    assert "status_http" in campos
    assert "json_invalido" in campos


def test_formatear_resumen_respuesta() -> None:
    """Verifica la extraccion de lineas de resumen legible."""
    cuerpo_presencia = json.dumps(
        {
            "aceptada": True,
            "motivo": "PRESENCIA_ACTUALIZADA",
            "concejal": {"nombre": "Juan", "apellido": "Perez", "banca": 3},
            "resultado": {
                "tipo": "PRESENCIA",
                "presente": True,
                "presentes": 1,
                "quorum_alcanzado": False,
            },
        }
    )
    resumen = formatear_resumen_respuesta(cuerpo_presencia)
    assert resumen is not None
    assert "aceptada=True" in resumen
    assert "motivo=PRESENCIA_ACTUALIZADA" in resumen
    assert "Juan Perez" in resumen
    assert "banca=3" in resumen

    # No JSON devuelve None
    assert formatear_resumen_respuesta("No es un JSON") is None
    assert formatear_resumen_respuesta("") is None
