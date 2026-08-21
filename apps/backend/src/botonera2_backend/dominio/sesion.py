"""Contexto autoritativo de una sesión formal abierta (WP-008)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from botonera2_backend.dominio.preparacion import Preparacion


@dataclass(frozen=True, slots=True)
class ActualizacionDatosInstitucionales:
    """Describe exactamente qué campos incluyó un PATCH institucional.

    Un texto vacío durante preparación se normaliza a ``None``, por lo que el
    valor por sí solo no alcanza para distinguir "limpiar" de "campo omitido".
    Las banderas conservan esa diferencia sin trasladar modelos Pydantic al
    dominio. El número no aparece en ``PATCH /sesion``; por eso la misma
    estructura puede reutilizarse dejando ``incluye_numero_sesion=False``.
    """

    incluye_numero_sesion: bool = False
    numero_sesion: int | None = None
    incluye_presidencia: bool = False
    presidencia: str | None = None
    incluye_secretaria_legislativa: bool = False
    secretaria_legislativa: str | None = None


@dataclass(frozen=True, slots=True)
class Sesion:
    """Representa la sesión abierta sin copiar el estado vivo de preparación.

    ``contexto_operativo`` es exactamente el objeto que existía como
    ``preparacion_activa``. La composición permite cambiar el significado
    reglamentario del ciclo sin recrear configuración, padrón, presencias,
    expiraciones ni escritor. Una vez instalada esta entidad, el estado global
    borra la referencia de preparación y esta sesión queda como único camino
    autoritativo hacia esos datos.

    ``fecha_hora_apertura`` registra cuándo se confirmó la transición formal.
    No reemplaza ``fecha_hora_inicio``, que sigue identificando el comienzo del
    conjunto de auditoría.
    """

    contexto_operativo: Preparacion
    fecha_hora_apertura: datetime

    @property
    def numero_sesion(self) -> int:
        """Devuelve el número obligatorio e inmutable de la sesión abierta."""

        numero = self.contexto_operativo.numero_sesion
        if numero is None:
            raise RuntimeError("Sesión abierta sin número de sesión")
        return numero

    @property
    def presidencia(self) -> str:
        """Devuelve la Presidencia vigente, siempre informada en sesión."""

        presidencia = self.contexto_operativo.presidencia
        if presidencia is None:
            raise RuntimeError("Sesión abierta sin Presidencia")
        return presidencia

    @property
    def secretaria_legislativa(self) -> str:
        """Devuelve la Secretaría Legislativa vigente, siempre informada."""

        secretaria = self.contexto_operativo.secretaria_legislativa
        if secretaria is None:
            raise RuntimeError("Sesión abierta sin Secretaría Legislativa")
        return secretaria
