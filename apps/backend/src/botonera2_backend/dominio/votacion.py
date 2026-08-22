"""Entidades y vocabulario canónico de una votación de Botonera2.

La entidad separa deliberadamente el estado de recepción del resultado
institucional. El cierre y la aplicación del resultado son dos transiciones
distintas: entre ambas existe ``CERRADA`` con ``resultado=None`` conforme a
DEC-010, aunque el flujo normal las encadena bajo una sola sección crítica.
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
    congelado. La elección se almacena al abrir y WP-011 la consume al cerrar.
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

    El resultado ordinario puede asignar ``APROBADA``, ``RECHAZADA`` o
    ``EMPATADA``. ``INCONCLUSA`` permanece en el vocabulario para otros flujos,
    pero no es una salida válida del cálculo por completitud.
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
class ConteosVotosOrdinarios:
    """Resume los votos almacenados sin convertirse en otra fuente de verdad.

    La estructura se construye de nuevo desde ``Votacion.votos_ordinarios`` en
    cada cálculo. Sirve para transportar los tres conteos y sus dos sumas
    derivadas hacia la auditoría, pero nunca conserva ni reemplaza votos.
    """

    positivos: int
    negativos: int
    abstenciones: int

    @property
    def votos_emitidos(self) -> int:
        """Cuenta todos los votos ordinarios, incluidas las abstenciones."""

        return self.positivos + self.negativos + self.abstenciones

    @property
    def votos_computables(self) -> int:
        """Cuenta solo positivos y negativos, como exige esa base."""

        return self.positivos + self.negativos


@dataclass(frozen=True, slots=True)
class CalculoResultadoVotacion:
    """Describe una decisión calculada que todavía no fue aplicada.

    Separar el cálculo de la mutación permite persistir primero el hecho
    institucional. ``denominador`` y ``cociente`` se completan para mayorías
    especiales; el cociente queda ausente en el caso documentado de
    ``VOTOS_COMPUTABLES=0`` para demostrar que no hubo división por cero.
    """

    resultado: ResultadoVotacion
    conteos: ConteosVotosOrdinarios
    denominador: int | None
    cociente: float | None


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
        """Devuelve el resultado institucional o ``None`` antes de aplicarlo."""

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
        que el resultado continúe en ``None`` hasta su auditoría separada.

        Raises:
            ValueError: si la recepción ya había sido cerrada.
        """

        if self.__estado is not EstadoVotacion.EN_CURSO:
            raise ValueError("La recepción de votos ya fue cerrada")
        self.__fecha_hora_cierre = fecha_hora_cierre
        self.__estado = EstadoVotacion.CERRADA

    def calcular_resultado_ordinario(
        self,
        *,
        cantidad_total_cuerpo: int,
    ) -> CalculoResultadoVotacion:
        """Calcula, sin mutar, el resultado ordinario de una votación cerrada.

        La única fuente de los conteos es el mapa de votos de esta instancia.
        Para ``CUERPO`` el llamador aporta la cantidad del padrón congelado de
        la sesión; nunca se relee configuración ni se consulta presencia actual.
        La comparación especial usa directamente ``cociente >= factor`` sin
        redondeo, epsilon ni tolerancia.

        Args:
            cantidad_total_cuerpo: total de concejales del padrón congelado.

        Returns:
            El resultado y los datos exactos que explican su cálculo, todavía
            sin modificar ``resultado``.

        Raises:
            ValueError: si la recepción sigue abierta, ya existe un resultado o
                el contexto recibido viola una invariante constitutiva.
        """

        self._validar_resultado_ordinario_pendiente()
        conteos = self._contar_votos_ordinarios()

        if self.tipo_mayoria is TipoMayoria.SIMPLE:
            if conteos.positivos > conteos.negativos:
                resultado = ResultadoVotacion.APROBADA
            elif conteos.positivos < conteos.negativos:
                resultado = ResultadoVotacion.RECHAZADA
            else:
                resultado = ResultadoVotacion.EMPATADA
            return CalculoResultadoVotacion(
                resultado=resultado,
                conteos=conteos,
                denominador=None,
                cociente=None,
            )

        if self.base is BaseMayoria.VOTOS_COMPUTABLES:
            denominador = conteos.votos_computables
        elif self.base is BaseMayoria.PRESENTES:
            # PRESENTES es una denominación institucional: técnicamente son
            # quienes lograron votar, incluidas las abstenciones. No se mira el
            # mapa dinámico de presencia al momento de calcular.
            denominador = conteos.votos_emitidos
        elif self.base is BaseMayoria.CUERPO:
            denominador = cantidad_total_cuerpo
        else:  # pragma: no cover - el enum cerrado hace defensiva esta rama.
            raise ValueError("Base de mayoría especial desconocida")

        if denominador == 0:
            if self.base is not BaseMayoria.VOTOS_COMPUTABLES:
                raise ValueError("La base especial no puede tener denominador cero")
            return CalculoResultadoVotacion(
                resultado=ResultadoVotacion.RECHAZADA,
                conteos=conteos,
                denominador=0,
                cociente=None,
            )
        if denominador < 0:
            raise ValueError("El denominador de una mayoría no puede ser negativo")

        cociente = conteos.positivos / denominador
        resultado = (
            ResultadoVotacion.APROBADA if cociente >= self.factor else ResultadoVotacion.RECHAZADA
        )
        return CalculoResultadoVotacion(
            resultado=resultado,
            conteos=conteos,
            denominador=denominador,
            cociente=cociente,
        )

    def aplicar_resultado_ordinario(self, resultado: ResultadoVotacion) -> None:
        """Aplica una sola vez un resultado ordinario previamente auditado.

        Este método no vuelve a contar votos ni modifica cierre, datos
        constitutivos o votos. Sus validaciones protegen la entidad aun si un
        servicio interno intenta usarla fuera de la transición autorizada.

        Raises:
            ValueError: si la votación no está ``CERRADA + None``, se intenta
                producir ``INCONCLUSA`` o una ESPECIAL intenta quedar empatada.
        """

        self._validar_resultado_ordinario_pendiente()
        if resultado not in (
            ResultadoVotacion.APROBADA,
            ResultadoVotacion.RECHAZADA,
            ResultadoVotacion.EMPATADA,
        ):
            raise ValueError("El flujo ordinario no admite ese resultado")
        if self.tipo_mayoria is TipoMayoria.ESPECIAL and resultado is ResultadoVotacion.EMPATADA:
            raise ValueError("Una mayoría especial no puede quedar EMPATADA")
        self.__resultado = resultado

    def _validar_resultado_ordinario_pendiente(self) -> None:
        """Exige la etapa intermedia exacta autorizada por DEC-010."""

        if self.__estado is not EstadoVotacion.CERRADA:
            raise ValueError("Solo una votación cerrada puede recibir resultado")
        if self.__resultado is not None:
            raise ValueError("La votación ya posee un resultado irreversible")

    def _contar_votos_ordinarios(self) -> ConteosVotosOrdinarios:
        """Deriva los conteos directamente de los votos de esta instancia."""

        positivos = 0
        negativos = 0
        abstenciones = 0
        for voto in self.__votos_ordinarios.values():
            if voto.valor is ValorVotoOrdinario.POSITIVO:
                positivos += 1
            elif voto.valor is ValorVotoOrdinario.NEGATIVO:
                negativos += 1
            else:
                abstenciones += 1
        return ConteosVotosOrdinarios(
            positivos=positivos,
            negativos=negativos,
            abstenciones=abstenciones,
        )

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
