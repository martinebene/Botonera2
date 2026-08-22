"""Entidades y vocabulario canónico de una votación de Botonera2.

La entidad separa deliberadamente el estado de recepción del resultado
institucional. WP-010 puede cerrar la recepción y conservar votos sin calcular
todavía una mayoría: esa etapa se representa como ``CERRADA`` con
``resultado=None`` conforme a DEC-010.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType


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
    """Indica exclusivamente si la recepción todavía admite votos."""

    EN_CURSO = "EN_CURSO"
    CERRADA = "CERRADA"


class ResultadoVotacion(StrEnum):
    """Enumera las interpretaciones institucionales separadas de la recepción.

    WP-010 no asigna ninguno de estos valores: los declara para expresar el
    modelo aprobado por DEC-010 y mantiene ``resultado=None``. Cada transición
    será responsabilidad del WP que calcule o finalice la votación.
    """

    APROBADA = "APROBADA"
    RECHAZADA = "RECHAZADA"
    EMPATADA = "EMPATADA"
    INCONCLUSA = "INCONCLUSA"


class ValorVotoOrdinario(StrEnum):
    """Representa los tres valores que puede emitir una banca mediante 1/2/3."""

    POSITIVO = "POSITIVO"
    ABSTENCION = "ABSTENCION"
    NEGATIVO = "NEGATIVO"


@dataclass(frozen=True, slots=True)
class VotoOrdinario:
    """Conserva el voto irreversible de un concejal dentro de una votación.

    El DNI vincula el hecho con el padrón congelado y ``frozen=True`` impide
    cambiar su identidad o valor después de aceptarlo. Los intentos posteriores
    se auditan como rechazos, pero nunca reemplazan esta instancia.
    """

    dni: str
    valor: ValorVotoOrdinario


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

    La entidad encapsula los datos constitutivos congelados y mantiene en una
    única instancia el estado evolutivo autorizado. Los votos se indexan por
    DNI para que la unicidad sea estructural y se exponen mediante una vista de
    solo lectura; no existe operación para reemplazarlos o eliminarlos.
    """

    __slots__ = (
        "__datos_constitutivos",
        "__estado",
        "__fecha_hora_cierre",
        "__resultado",
        "__votos_ordinarios",
    )

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
        self.__estado = EstadoVotacion.EN_CURSO
        self.__fecha_hora_cierre: datetime | None = None
        self.__resultado: ResultadoVotacion | None = None
        self.__votos_ordinarios: dict[str, VotoOrdinario] = {}

    @property
    def estado(self) -> EstadoVotacion:
        """Devuelve si la recepción continúa abierta o ya quedó cerrada."""

        return self.__estado

    @property
    def resultado(self) -> ResultadoVotacion | None:
        """Devuelve el resultado institucional, todavía ausente en WP-010."""

        return self.__resultado

    @property
    def fecha_hora_cierre(self) -> datetime | None:
        """Devuelve el único instante de cierre o ``None`` mientras está abierta."""

        return self.__fecha_hora_cierre

    @property
    def votos_ordinarios(self) -> Mapping[str, VotoOrdinario]:
        """Expone los votos por DNI sin permitir editar el diccionario interno.

        ``MappingProxyType`` es una vista viva de solo lectura. Así el historial
        y ``votacion_activa`` observan siempre el mismo conjunto autoritativo,
        pero ningún consumidor puede borrar o sustituir un voto directamente.
        """

        return MappingProxyType(self.__votos_ordinarios)

    def ya_emitio_voto(self, dni_concejal: str) -> bool:
        """Indica si el DNI ya consumió su único voto en esta votación."""

        return dni_concejal in self.__votos_ordinarios

    def registrar_voto(self, voto: VotoOrdinario) -> None:
        """Incorpora el primer voto de un DNI durante una recepción abierta.

        El servicio llama a este método únicamente después de persistir el
        evento L3. Las validaciones internas protegen además la entidad frente a
        un uso incorrecto: nunca se sobrescribe un valor existente.

        Raises:
            ValueError: si la recepción ya cerró o el DNI ya tiene un voto.
        """

        if self.__estado is not EstadoVotacion.EN_CURSO:
            raise ValueError("La recepción de votos ya está cerrada")
        if voto.dni in self.__votos_ordinarios:
            raise ValueError("El concejal ya emitió su voto ordinario")
        self.__votos_ordinarios[voto.dni] = voto

    def cerrar_recepcion(self, fecha_hora_cierre: datetime) -> None:
        """Cierra una sola vez la recepción sin calcular resultado institucional.

        El llamador debe persistir antes el evento de autocierre. Mantener la
        transición encapsulada garantiza que la fecha no pueda regenerarse y
        que WP-010 deje siempre ``resultado=None``.

        Raises:
            ValueError: si la recepción ya había sido cerrada.
        """

        if self.__estado is not EstadoVotacion.EN_CURSO:
            raise ValueError("La recepción de votos ya fue cerrada")
        self.__fecha_hora_cierre = fecha_hora_cierre
        self.__estado = EstadoVotacion.CERRADA

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
