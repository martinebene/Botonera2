"""Errores de dominio compartidos por las operaciones del backend.

Este módulo reúne las excepciones que representan incumplimientos de las
reglas de negocio (no fallos técnicos de infraestructura). La capa de API las
traduce a respuestas HTTP con códigos estables, de modo que los clientes
puedan decidir por ``codigo`` sin comparar textos variables.
"""

from __future__ import annotations


class ErrorEstadoIncompatible(Exception):
    """La operación solicitada no es válida para el estado global actual.

    Por ejemplo: preparar la sala cuando el sistema no está en
    ``SIN_PREPARAR``, o cancelar la preparación cuando no hay una activa.
    Corresponde al código estable ``ESTADO_INCOMPATIBLE`` con HTTP 409.
    """


class ErrorQuorumInsuficiente(Exception):
    """No puede abrirse una sesión o votación porque no se alcanzó quórum."""


class ErrorNumeroSesionRequerido(Exception):
    """No puede abrirse la sesión sin un número externo informado."""


class ErrorPresidenciaRequerida(Exception):
    """No puede abrirse la sesión sin Presidencia informada."""


class ErrorSecretariaLegislativaRequerida(Exception):
    """No puede abrirse la sesión sin Secretaría Legislativa informada."""


class ErrorVotacionPendiente(Exception):
    """Una operación incompatible encontró una votación pendiente.

    Protege tanto una segunda apertura como el cierre de sesión de WP-008. Los
    servicios que la detectan no finalizan ni modifican la entidad existente.
    """


class ErrorTipoVotacionNoPermitido(Exception):
    """El tipo recibido no integra el snapshot congelado de la sesión.

    El texto ya cumplió el contrato técnico de Pydantic; el rechazo es
    funcional y corresponde a HTTP 422 con ``TIPO_VOTACION_NO_PERMITIDO``.
    """
