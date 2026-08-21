"""Entidades y vocabulario canónico de una votación de Botonera2.

WP-009 solo abre votaciones. Por eso este módulo reconoce todos los estados
conceptuales ya documentados, pero la única construcción habilitada comienza
en ``EN_CURSO`` y todavía no incorpora votos, resultados ni datos de cierre.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class TipoMayoria(StrEnum):
    """Distingue la regla de decisión declarada por Moderación.

    El tipo es autoritativo: nunca se deduce una mayoría simple o especial a
    partir del factor. Los valores coinciden con el contrato REST de DEC-009.
    """

    SIMPLE = "SIMPLE"
    ESPECIAL = "ESPECIAL"


class BaseMayoria(StrEnum):
    """Representa el denominador conceptual de una regla de mayoría.

    ``VOTOS_COMPUTABLES`` cuenta positivos y negativos. ``PRESENTES`` es el
    término institucional para quienes emitieron voto ordinario en esa
    votación, incluidas abstenciones. ``CUERPO`` es el total del padrón
    congelado. WP-009 almacena la elección, pero no calcula ningún resultado.
    """

    VOTOS_COMPUTABLES = "VOTOS_COMPUTABLES"
    PRESENTES = "PRESENTES"
    CUERPO = "CUERPO"


class EstadoVotacion(StrEnum):
    """Enumera los estados conceptuales aprobados para una votación.

    Los WPs posteriores serán propietarios de las transiciones fuera de
    ``EN_CURSO``. Declararlos ahora evita que esos trabajos deban reemplazar el
    tipo de la entidad para representar resultados ya previstos.
    """

    EN_CURSO = "EN_CURSO"
    APROBADA = "APROBADA"
    RECHAZADA = "RECHAZADA"
    EMPATADA = "EMPATADA"
    INCONCLUSA = "INCONCLUSA"


@dataclass(frozen=True, slots=True)
class DatosAperturaVotacion:
    """Transporta al servicio los datos ya normalizados de una apertura.

    La capa Pydantic valida el body discriminado y convierte omisiones de una
    mayoría simple en ``factor=0`` y ``base=VOTOS_COMPUTABLES``. Esta estructura
    desacopla el servicio de FastAPI sin duplicar el modelo HTTP.
    """

    numero_votacion: int
    tipo: str
    tema: str
    tipo_mayoria: TipoMayoria
    factor: float
    base: BaseMayoria


@dataclass(frozen=True, slots=True)
class DatosConstitutivosVotacion:
    """Agrupa los metadatos que nunca cambian después de abrir.

    ``frozen=True`` impide reasignar cualquiera de estos campos. Separarlos del
    estado evolutivo permite que futuros WPs agreguen votos, cierre o desempate
    sin volver editables los datos que identifican la decisión institucional.
    """

    id: str
    numero_votacion: int
    tipo: str
    tema: str
    tipo_mayoria: TipoMayoria
    factor: float
    base: BaseMayoria
    fecha_hora_apertura: datetime


class Votacion:
    """Representa una única votación publicada en historial y estado activo.

    La entidad encapsula un objeto constitutivo congelado y mantiene ``estado``
    separado para las transiciones que implementarán WPs posteriores. Las
    propiedades son de solo lectura: no existe setter ni comando de servicio
    capaz de editar los metadatos una vez creada la entidad.
    """

    __slots__ = ("__datos_constitutivos", "estado")

    def __init__(
        self,
        *,
        id: str,
        numero_votacion: int,
        tipo: str,
        tema: str,
        tipo_mayoria: TipoMayoria,
        factor: float,
        base: BaseMayoria,
        fecha_hora_apertura: datetime,
    ) -> None:
        """Crea una votación exclusivamente en el estado inicial ``EN_CURSO``."""

        self.__datos_constitutivos = DatosConstitutivosVotacion(
            id=id,
            numero_votacion=numero_votacion,
            tipo=tipo,
            tema=tema,
            tipo_mayoria=tipo_mayoria,
            factor=factor,
            base=base,
            fecha_hora_apertura=fecha_hora_apertura,
        )
        self.estado = EstadoVotacion.EN_CURSO

    @property
    def id(self) -> str:
        """Devuelve el identificador técnico opaco generado por backend."""

        return self.__datos_constitutivos.id

    @property
    def numero_votacion(self) -> int:
        """Devuelve el número institucional externo, sin imponer secuencia."""

        return self.__datos_constitutivos.numero_votacion

    @property
    def tipo(self) -> str:
        """Devuelve el tipo descriptivo validado contra la sesión congelada."""

        return self.__datos_constitutivos.tipo

    @property
    def tema(self) -> str:
        """Devuelve el tema libre normalizado al abrir."""

        return self.__datos_constitutivos.tema

    @property
    def tipo_mayoria(self) -> TipoMayoria:
        """Devuelve la regla SIMPLE o ESPECIAL declarada explícitamente."""

        return self.__datos_constitutivos.tipo_mayoria

    @property
    def factor(self) -> float:
        """Devuelve el factor normalizado; SIMPLE siempre expone cero."""

        return self.__datos_constitutivos.factor

    @property
    def base(self) -> BaseMayoria:
        """Devuelve una de las tres bases canónicas de DEC-009."""

        return self.__datos_constitutivos.base

    @property
    def fecha_hora_apertura(self) -> datetime:
        """Devuelve la hora civil inmutable en que se abrió la votación."""

        return self.__datos_constitutivos.fecha_hora_apertura
