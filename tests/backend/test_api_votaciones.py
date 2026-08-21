"""Pruebas HTTP y OpenAPI de ``POST /api/v1/votaciones`` (WP-009)."""

from __future__ import annotations

import csv
import json
import math
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest
from botonera2_backend.aplicacion import crear_aplicacion
from botonera2_backend.auditoria import NivelAuditoria
from botonera2_backend.dominio.votacion import BaseMayoria, EstadoVotacion, TipoMayoria
from botonera2_backend.recursos import obtener_recursos_aplicacion
from conftest import (
    LINEA_LOGS,
    LINEA_QUORUM,
    LINEA_TYPES,
    TOML_CANONICO,
    escribir_padron,
    escribir_system_toml,
    filas_padron_valido,
)
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.anyio


def preparar_archivos(directorio: Path, *, quorum: int = 1) -> Path:
    """Escribe configuración/padrón canónicos y devuelve la ruta del TOML."""

    carpeta = directorio / "config"
    carpeta.mkdir(parents=True, exist_ok=True)
    contenido = TOML_CANONICO.replace(
        LINEA_LOGS,
        f'logs_dir = "{directorio / "logs"}"',
    ).replace(LINEA_QUORUM, f"quorum = {quorum}")
    ruta_toml = escribir_system_toml(carpeta / "system.toml", contenido)
    escribir_padron(carpeta / "concejales.csv", filas_padron_valido())
    return ruta_toml


@asynccontextmanager
async def cliente_abierto(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    *,
    quorum: int = 1,
) -> AsyncGenerator[tuple[AsyncClient, FastAPI, Path]]:
    """Entrega una aplicación real con sesión abierta y quórum configurado."""

    ruta_toml = preparar_archivos(tmp_path, quorum=quorum)
    monkeypatch.chdir(tmp_path)
    aplicacion = crear_aplicacion()
    async with aplicacion.router.lifespan_context(aplicacion):
        transporte = ASGITransport(app=aplicacion)
        async with AsyncClient(transport=transporte, base_url="http://pruebas") as cliente:
            assert (await cliente.post("/api/v1/preparacion")).status_code == 204
            assert (
                await cliente.patch(
                    "/api/v1/preparacion",
                    json={
                        "numero_sesion": 59,
                        "presidencia": "Presidencia",
                        "secretaria_legislativa": "Secretaría",
                    },
                )
            ).status_code == 204
            if quorum == 1:
                assert (
                    await cliente.post(
                        "/api/v1/entradas/tecla",
                        json={"dispositivo": "D-01", "tecla": "9"},
                    )
                ).status_code == 200
            assert (await cliente.post("/api/v1/sesion")).status_code == (
                204 if quorum == 1 else 409
            )
            yield cliente, aplicacion, ruta_toml


def cuerpo_simple(**cambios: Any) -> dict[str, Any]:
    """Devuelve el body SIMPLE mínimo con cambios puntuales para parametrizar."""

    cuerpo: dict[str, Any] = {
        "numero_votacion": 37,
        "tipo": "Mocion",
        "tema": "Tratamiento del proyecto X",
        "tipo_mayoria": "SIMPLE",
    }
    cuerpo.update(cambios)
    return cuerpo


def cuerpo_especial(**cambios: Any) -> dict[str, Any]:
    """Devuelve un body ESPECIAL válido sobre CUERPO."""

    cuerpo: dict[str, Any] = {
        "numero_votacion": 38,
        "tipo": "Despacho HA",
        "tema": "Tratamiento del proyecto Y",
        "tipo_mayoria": "ESPECIAL",
        "factor": 0.6666666667,
        "base": "CUERPO",
    }
    cuerpo.update(cambios)
    return cuerpo


@pytest.mark.parametrize(
    "campos_adicionales",
    [
        {},
        {"factor": None},
        {"factor": 0},
        {"base": "VOTOS_COMPUTABLES"},
    ],
    ids=["minima-factor-omitido", "factor-null", "factor-cero", "base-explicita"],
)
async def test_simple_valida_y_responde_representacion_normalizada(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    campos_adicionales: dict[str, Any],
) -> None:
    """SIMPLE siempre publica factor cero y base VOTOS_COMPUTABLES."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, aplicacion, _ruta):
        respuesta = await cliente.post(
            "/api/v1/votaciones",
            json=cuerpo_simple(**campos_adicionales),
        )

        assert respuesta.status_code == 201
        cuerpo = respuesta.json()
        assert cuerpo["id"]
        assert cuerpo["numero_votacion"] == 37
        assert cuerpo["tipo"] == "Mocion"
        assert cuerpo["tema"] == "Tratamiento del proyecto X"
        assert cuerpo["tipo_mayoria"] == TipoMayoria.SIMPLE
        assert cuerpo["factor"] == 0
        assert cuerpo["base"] == BaseMayoria.VOTOS_COMPUTABLES
        assert cuerpo["estado"] == EstadoVotacion.EN_CURSO
        datetime.fromisoformat(cuerpo["fecha_hora_apertura"])

        estado = obtener_recursos_aplicacion(aplicacion).estado_operativo
        sesion = estado.sesion_activa
        assert sesion is not None
        assert sesion.votaciones == [estado.votacion_activa]
        assert sesion.votaciones[0] is estado.votacion_activa


@pytest.mark.parametrize(
    "cambios",
    [
        {"factor": 0.1},
        {"factor": ""},
        {"factor": True},
        {"factor": "0"},
        {"factor": -0.1},
        {"base": "PRESENTES"},
        {"base": "CUERPO"},
    ],
    ids=[
        "factor-positivo",
        "factor-vacio",
        "factor-bool",
        "factor-texto",
        "factor-negativo",
        "presentes",
        "cuerpo",
    ],
)
async def test_simple_rechaza_combinaciones_incoherentes_sin_auditar(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    cambios: dict[str, Any],
) -> None:
    """Los 422 de Pydantic ocurren antes del servicio y no crean evento institucional."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, aplicacion, _ruta):
        cantidad = len(filas_auditoria(aplicacion))
        respuesta = await cliente.post("/api/v1/votaciones", json=cuerpo_simple(**cambios))

        assert respuesta.status_code == 422
        assert len(filas_auditoria(aplicacion)) == cantidad
        assert obtener_recursos_aplicacion(aplicacion).estado_operativo.votacion_activa is None


@pytest.mark.parametrize(
    ("base", "factor"),
    [
        ("VOTOS_COMPUTABLES", 0.5),
        ("PRESENTES", 0.75),
        ("CUERPO", 1),
    ],
)
async def test_especial_acepta_las_tres_bases_y_factor_uno(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    base: str,
    factor: float,
) -> None:
    """ESPECIAL conserva factor finito y cualquiera de las bases canónicas."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, _aplicacion, _ruta):
        respuesta = await cliente.post(
            "/api/v1/votaciones",
            json=cuerpo_especial(base=base, factor=factor),
        )

        assert respuesta.status_code == 201
        assert respuesta.json()["tipo_mayoria"] == "ESPECIAL"
        assert respuesta.json()["factor"] == factor
        assert respuesta.json()["base"] == base


@pytest.mark.parametrize(
    "factor",
    [None, 0, -0.1, 1.0001, True, "0.5"],
    ids=["null", "cero", "negativo", "mayor-uno", "bool", "texto"],
)
async def test_especial_rechaza_factores_invalidos(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    factor: Any,
) -> None:
    """ESPECIAL exige un real estricto dentro de ``0 < factor <= 1``."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, _aplicacion, _ruta):
        respuesta = await cliente.post(
            "/api/v1/votaciones",
            json=cuerpo_especial(factor=factor),
        )
        assert respuesta.status_code == 422


async def test_especial_rechaza_factor_y_base_omitidos(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Los dos campos condicionales son obligatorios para ESPECIAL."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, _aplicacion, _ruta):
        sin_factor = cuerpo_especial()
        sin_factor.pop("factor")
        sin_base = cuerpo_especial()
        sin_base.pop("base")
        assert (await cliente.post("/api/v1/votaciones", json=sin_factor)).status_code == 422
        assert (await cliente.post("/api/v1/votaciones", json=sin_base)).status_code == 422


@pytest.mark.parametrize("representacion", ["NaN", "Infinity", "-Infinity"])
async def test_especial_rechaza_numeros_no_finitos(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    representacion: str,
) -> None:
    """Incluso si el parser JSON admite extensiones no estándar, Pydantic las rechaza."""

    contenido = (
        '{"numero_votacion":38,"tipo":"Despacho HA","tema":"Tema",'
        f'"tipo_mayoria":"ESPECIAL","factor":{representacion},"base":"CUERPO"'
        "}"
    )
    cuerpo_parseado = json.loads(contenido)
    assert not math.isfinite(cuerpo_parseado["factor"])

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, _aplicacion, _ruta):
        respuesta = await cliente.post(
            "/api/v1/votaciones",
            content=contenido,
            headers={"content-type": "application/json"},
        )
        assert respuesta.status_code == 422
        detalle = respuesta.json()["detail"]
        assert any(
            error["loc"][-1] == "factor" and error["type"] == "float_type" for error in detalle
        )
        assert all(error["type"] != "json_invalid" for error in detalle)


async def test_simple_rechaza_numero_no_finito_con_422_serializable(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """El saneamiento técnico también conserva el rechazo normal para SIMPLE."""

    contenido = (
        '{"numero_votacion":37,"tipo":"Mocion","tema":"Tema","tipo_mayoria":"SIMPLE","factor":NaN}'
    )
    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, _aplicacion, _ruta):
        respuesta = await cliente.post(
            "/api/v1/votaciones",
            content=contenido,
            headers={"content-type": "application/json"},
        )
        assert respuesta.status_code == 422


@pytest.mark.parametrize(
    "numero",
    [0, -1, True, False, 1.5, "1"],
    ids=["cero", "negativo", "true", "false", "decimal", "texto"],
)
async def test_numero_votacion_es_entero_positivo_estricto(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    numero: Any,
) -> None:
    """No se coercionan booleanos, decimales ni texto a número institucional."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, _aplicacion, _ruta):
        respuesta = await cliente.post(
            "/api/v1/votaciones",
            json=cuerpo_simple(numero_votacion=numero),
        )
        assert respuesta.status_code == 422


@pytest.mark.parametrize(
    "cambios",
    [
        {"tipo": ""},
        {"tipo": "   "},
        {"tema": ""},
        {"tema": "   "},
        {"campo_extra": "no permitido"},
    ],
    ids=["tipo-vacio", "tipo-blanco", "tema-vacio", "tema-blanco", "extra"],
)
async def test_textos_obligatorios_y_campos_extra_devuelven_422(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    cambios: dict[str, Any],
) -> None:
    """El body se normaliza con strip y no admite datos fuera del contrato."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, _aplicacion, _ruta):
        respuesta = await cliente.post("/api/v1/votaciones", json=cuerpo_simple(**cambios))
        assert respuesta.status_code == 422


@pytest.mark.parametrize("campo", ["numero_votacion", "tipo", "tema", "tipo_mayoria"])
async def test_campos_principales_omitidos_devuelven_422(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    campo: str,
) -> None:
    """Número, tipo, tema y tipo de mayoría forman parte obligatoria del body."""

    cuerpo = cuerpo_simple()
    cuerpo.pop(campo)
    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, _aplicacion, _ruta):
        assert (await cliente.post("/api/v1/votaciones", json=cuerpo)).status_code == 422


async def test_tipo_se_normaliza_y_valida_contra_snapshot_sin_releer_toml(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Espacios exteriores son válidos y cambios en disco no afectan la sesión."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, aplicacion, ruta_toml):
        ruta_toml.write_text(
            TOML_CANONICO.replace(LINEA_TYPES, 'types = ["Tipo Nuevo"]'),
            encoding="utf-8",
        )
        respuesta = await cliente.post(
            "/api/v1/votaciones",
            json=cuerpo_simple(tipo="  Mocion  ", tema="  Tema normalizado  "),
        )
        assert respuesta.status_code == 201
        assert respuesta.json()["tipo"] == "Mocion"
        assert respuesta.json()["tema"] == "Tema normalizado"
        estado = obtener_recursos_aplicacion(aplicacion).estado_operativo
        assert estado.votacion_activa is not None


async def test_tipo_no_permitido_devuelve_error_estable_y_audita_rechazo(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un texto técnicamente válido pero ajeno al snapshot es un 422 funcional."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, aplicacion, _ruta):
        respuesta = await cliente.post(
            "/api/v1/votaciones",
            json=cuerpo_simple(tipo="mocion"),
        )
        assert respuesta.status_code == 422
        assert respuesta.json()["codigo"] == "TIPO_VOTACION_NO_PERMITIDO"
        assert filas_auditoria(aplicacion)[-1][2:5] == [
            "L2",
            "VOTACION",
            "COMANDO_VOTACION_RECHAZADO",
        ]


async def test_estados_y_quorum_se_traducen_a_conflictos_estables(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La API expone ESTADO_INCOMPATIBLE y QUORUM_INSUFICIENTE sin mutar."""

    preparar_archivos(tmp_path, quorum=2)
    monkeypatch.chdir(tmp_path)
    aplicacion = crear_aplicacion()
    async with aplicacion.router.lifespan_context(aplicacion):
        transporte = ASGITransport(app=aplicacion)
        async with AsyncClient(transport=transporte, base_url="http://pruebas") as cliente:
            sin_preparar = await cliente.post("/api/v1/votaciones", json=cuerpo_simple())
            assert sin_preparar.status_code == 409
            assert sin_preparar.json()["codigo"] == "ESTADO_INCOMPATIBLE"

            await cliente.post("/api/v1/preparacion")
            preparando = await cliente.post("/api/v1/votaciones", json=cuerpo_simple())
            assert preparando.status_code == 409
            assert preparando.json()["codigo"] == "ESTADO_INCOMPATIBLE"
            await cliente.patch(
                "/api/v1/preparacion",
                json={
                    "numero_sesion": 59,
                    "presidencia": "Presidencia",
                    "secretaria_legislativa": "Secretaría",
                },
            )
            await cliente.post(
                "/api/v1/entradas/tecla",
                json={"dispositivo": "D-01", "tecla": "9"},
            )
            assert (await cliente.post("/api/v1/sesion")).status_code == 409
            await cliente.post(
                "/api/v1/entradas/tecla",
                json={"dispositivo": "D-02", "tecla": "9"},
            )
            assert (await cliente.post("/api/v1/sesion")).status_code == 204

            await cliente.post(
                "/api/v1/entradas/tecla",
                json={"dispositivo": "D-02", "tecla": "9"},
            )
            sin_quorum = await cliente.post("/api/v1/votaciones", json=cuerpo_simple())
            assert sin_quorum.status_code == 409
            assert sin_quorum.json()["codigo"] == "QUORUM_INSUFICIENTE"
            await cliente.post(
                "/api/v1/entradas/tecla",
                json={"dispositivo": "D-02", "tecla": "9"},
            )
            assert (
                await cliente.post("/api/v1/votaciones", json=cuerpo_simple())
            ).status_code == 201


async def test_segunda_apertura_guard_cierre_y_ausencia_de_edicion(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La votación pendiente bloquea POST/DELETE y no existe un PATCH de metadatos."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, aplicacion, _ruta):
        primera = await cliente.post("/api/v1/votaciones", json=cuerpo_simple())
        segunda = await cliente.post("/api/v1/votaciones", json=cuerpo_simple(numero_votacion=99))
        cierre = await cliente.delete("/api/v1/sesion")
        edicion_coleccion = await cliente.patch("/api/v1/votaciones", json={"tema": "Otro"})
        edicion_entidad = await cliente.patch(
            f"/api/v1/votaciones/{primera.json()['id']}",
            json={"tema": "Otro"},
        )

        assert primera.status_code == 201
        assert segunda.status_code == 409
        assert segunda.json()["codigo"] == "VOTACION_PENDIENTE"
        assert cierre.status_code == 409
        assert cierre.json()["codigo"] == "VOTACION_PENDIENTE"
        assert edicion_coleccion.status_code == 405
        assert edicion_entidad.status_code == 404
        estado = obtener_recursos_aplicacion(aplicacion).estado_operativo
        assert estado.sesion_activa is not None
        assert len(estado.sesion_activa.votaciones) == 1


async def test_auditoria_indisponible_devuelve_503_sin_publicar(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La API conserva fallo cerrado y no responde 201 ante writer cerrado."""

    async with cliente_abierto(tmp_path, monkeypatch) as (cliente, aplicacion, _ruta):
        estado = obtener_recursos_aplicacion(aplicacion).estado_operativo
        sesion = estado.sesion_activa
        assert sesion is not None
        sesion.contexto_operativo.escritor_auditoria.cerrar()
        respuesta = await cliente.post("/api/v1/votaciones", json=cuerpo_simple())

        assert respuesta.status_code == 503
        assert respuesta.json()["codigo"] == "AUDITORIA_NO_DISPONIBLE"
        assert sesion.votaciones == []
        assert estado.votacion_activa is None


def filas_auditoria(aplicacion: FastAPI) -> list[list[str]]:
    """Lee el CSV L1 del contexto activo para comprobar efectos institucionales."""

    estado = obtener_recursos_aplicacion(aplicacion).estado_operativo
    contexto = estado.contexto_operativo_activo()
    assert contexto is not None
    ruta = contexto.escritor_auditoria.rutas[NivelAuditoria.L1]
    with ruta.open(encoding="utf-8-sig", newline="") as archivo:
        return list(csv.reader(archivo, delimiter=";"))


def test_openapi_expone_union_discriminada_respuesta_y_errores() -> None:
    """El contrato canónico publica POST plural, enums, 201 y errores aplicables."""

    especificacion = crear_aplicacion().openapi()
    ruta = especificacion["paths"]["/api/v1/votaciones"]
    assert set(ruta) == {"post"}
    operacion = ruta["post"]
    assert set(("201", "409", "422", "503", "500")) <= set(operacion["responses"])
    esquema_body = operacion["requestBody"]["content"]["application/json"]["schema"]
    assert len(esquema_body["oneOf"]) == 2
    assert esquema_body["discriminator"]["propertyName"] == "tipo_mayoria"
    assert set(esquema_body["discriminator"]["mapping"]) == {"SIMPLE", "ESPECIAL"}

    esquemas = especificacion["components"]["schemas"]
    respuesta = esquemas["RespuestaVotacion"]
    assert set(respuesta["properties"]) == {
        "id",
        "numero_votacion",
        "tipo",
        "tema",
        "tipo_mayoria",
        "factor",
        "base",
        "estado",
        "fecha_hora_apertura",
    }
    assert set(esquemas["BaseMayoria"]["enum"]) == {
        "VOTOS_COMPUTABLES",
        "PRESENTES",
        "CUERPO",
    }
    assert set(esquemas["TipoMayoria"]["enum"]) == {"SIMPLE", "ESPECIAL"}
    assert "/api/v1/votaciones/{id}" not in especificacion["paths"]
