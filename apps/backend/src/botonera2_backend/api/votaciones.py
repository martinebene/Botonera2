"""Contrato REST plural para abrir votaciones durante una sesión (WP-009).

Pydantic valida el transporte y las combinaciones SIMPLE/ESPECIAL antes de
entrar al servicio. Las precondiciones que dependen del estado, el snapshot y
la auditoría permanecen en ``ServicioVotacion``.
"""

from __future__ import annotations

from datetime import datetime
from math import isfinite
from typing import Annotated, Any, Literal, Self

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from botonera2_backend.api.errores import ErrorRespuesta
from botonera2_backend.dominio.votacion import (
    BaseMayoria,
    DatosAperturaVotacion,
    EstadoVotacion,
    TipoMayoria,
)
from botonera2_backend.recursos import obtener_recursos_aplicacion
from botonera2_backend.servicios.votacion import ServicioVotacion

enrutador_votaciones = APIRouter(tags=["votaciones"])

# ``strict=True`` impide aceptar strings o booleanos. Pydantic conserva la
# conversión válida de un entero JSON a ``float`` (por ejemplo factor=1), y
# ``allow_inf_nan=False`` expresa que una mayoría especial exige un real finito.
type NumeroVotacion = Annotated[int, Field(strict=True, ge=1)]
type FactorNumerico = Annotated[float, Field(strict=True, allow_inf_nan=False)]
type FactorEspecial = Annotated[
    float,
    Field(strict=True, gt=0, le=1, allow_inf_nan=False),
]


def _sanear_numero_no_finito(valor: object) -> object:
    """Convierte NaN/inf en un valor inválido que FastAPI pueda serializar.

    Pydantic rechaza por sí mismo los no finitos, pero FastAPI 0.141.1 incluye
    el valor original en el detalle de validación y luego no puede serializarlo
    como JSON. Transformarlo a un texto deliberadamente inválido conserva el
    422 genérico previo al servicio y evita que ese detalle produzca un 500.
    """

    if isinstance(valor, float) and not isfinite(valor):
        return "número no finito"
    return valor


class _SolicitudBaseVotacion(BaseModel):
    """Campos comunes y normalización textual de toda apertura.

    Los campos extra se prohíben para que una falta de ortografía no parezca
    aceptada. ``strip`` solo retira espacios exteriores; no modifica contenido
    ni mayúsculas/minúsculas del tipo configurado.
    """

    model_config = ConfigDict(extra="forbid")

    numero_votacion: NumeroVotacion
    tipo: Annotated[str, Field(strict=True)]
    tema: Annotated[str, Field(strict=True)]

    @field_validator("tipo", "tema")
    @classmethod
    def normalizar_texto_obligatorio(cls, valor: str) -> str:
        """Retira espacios exteriores y rechaza textos vacíos o blancos."""

        normalizado = valor.strip()
        if not normalizado:
            raise ValueError("el texto no puede quedar vacío")
        return normalizado


class SolicitudVotacionSimple(_SolicitudBaseVotacion):
    """Variante SIMPLE con factor/base opcionales y salida normalizada.

    Un factor omitido, nulo o numéricamente cero es equivalente. Toda base
    distinta de ``VOTOS_COMPUTABLES`` queda fuera del propio esquema de esta
    variante y por eso FastAPI responde 422 antes de invocar el servicio.
    """

    tipo_mayoria: Literal[TipoMayoria.SIMPLE]
    factor: FactorNumerico | None = None
    base: Literal[BaseMayoria.VOTOS_COMPUTABLES] = BaseMayoria.VOTOS_COMPUTABLES

    @model_validator(mode="after")
    def validar_factor_simple(self) -> Self:
        """Admite solamente ausencia, nulo o cero para la mayoría simple."""

        if self.factor is not None and self.factor != 0:
            raise ValueError("SIMPLE solo admite factor omitido, null o cero")
        return self

    @field_validator("factor", mode="before")
    @classmethod
    def sanear_numero_no_finito(cls, valor: object) -> object:
        """Evita que un número no finito contamine el detalle JSON del 422."""

        return _sanear_numero_no_finito(valor)

    def convertir(self) -> DatosAperturaVotacion:
        """Produce el DTO interno con factor y base canónicos explícitos."""

        return DatosAperturaVotacion(
            numero_votacion=self.numero_votacion,
            tipo=self.tipo,
            tema=self.tema,
            tipo_mayoria=TipoMayoria.SIMPLE,
            factor=0.0,
            base=BaseMayoria.VOTOS_COMPUTABLES,
        )


class SolicitudVotacionEspecial(_SolicitudBaseVotacion):
    """Variante ESPECIAL con factor finito y una base canónica obligatoria."""

    tipo_mayoria: Literal[TipoMayoria.ESPECIAL]
    factor: FactorEspecial
    base: BaseMayoria

    @field_validator("factor", mode="before")
    @classmethod
    def sanear_numero_no_finito(cls, valor: object) -> object:
        """Evita que un número no finito contamine el detalle JSON del 422."""

        return _sanear_numero_no_finito(valor)

    def convertir(self) -> DatosAperturaVotacion:
        """Copia la variante ya validada al DTO independiente de FastAPI."""

        return DatosAperturaVotacion(
            numero_votacion=self.numero_votacion,
            tipo=self.tipo,
            tema=self.tema,
            tipo_mayoria=TipoMayoria.ESPECIAL,
            factor=self.factor,
            base=self.base,
        )


# La unión etiquetada genera ``oneOf`` y ``discriminator`` en JSON Schema. El
# valor explícito de ``tipo_mayoria`` selecciona una sola variante y evita
# inferir la regla a partir del factor, tal como exige DEC-009.
type SolicitudAbrirVotacion = Annotated[
    SolicitudVotacionSimple | SolicitudVotacionEspecial,
    Field(discriminator="tipo_mayoria"),
]


class RespuestaVotacion(BaseModel):
    """Representación HTTP mínima y normalizada de la votación creada."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    numero_votacion: int
    tipo: str
    tema: str
    tipo_mayoria: TipoMayoria
    factor: float
    base: BaseMayoria
    estado: EstadoVotacion
    fecha_hora_apertura: datetime


RESPUESTAS_ERROR_VOTACION: dict[int | str, dict[str, Any]] = {
    409: {
        "model": ErrorRespuesta,
        "description": "Estado, quórum o votación pendiente impiden la apertura.",
    },
    422: {
        "description": (
            "Body inválido o tipo descriptivo no permitido por la configuración congelada."
        ),
    },
    503: {
        "model": ErrorRespuesta,
        "description": "No puede garantizarse la auditoría obligatoria.",
    },
    500: {
        "model": ErrorRespuesta,
        "description": "Fallo inesperado no clasificado (ERROR_INTERNO).",
    },
}


def _crear_servicio(solicitud: Request) -> ServicioVotacion:
    """Construye el servicio con el estado y serializador únicos del lifespan."""

    recursos = obtener_recursos_aplicacion(solicitud.app)
    return ServicioVotacion(
        estado_operativo=recursos.estado_operativo,
        ejecutor_mutaciones=recursos.ejecutor_mutaciones,
    )


@enrutador_votaciones.post(
    "/votaciones",
    response_model=RespuestaVotacion,
    status_code=status.HTTP_201_CREATED,
    responses=RESPUESTAS_ERROR_VOTACION,
    summary="Abrir una votación",
)
async def abrir_votacion(
    solicitud: Request,
    apertura: SolicitudAbrirVotacion,
) -> RespuestaVotacion:
    """Valida el body, abre bajo exclusión y devuelve la entidad normalizada."""

    votacion = await _crear_servicio(solicitud).abrir_votacion(apertura.convertir())
    return RespuestaVotacion.model_validate(votacion)
