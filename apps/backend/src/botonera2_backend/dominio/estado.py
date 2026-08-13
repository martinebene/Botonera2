"""Estado operativo mínimo y volátil de Botonera2.

Este módulo no implementa transiciones. WP-002 solamente establece el estado
que existe al arrancar; los Work Packages posteriores incorporarán las
operaciones de preparación y sesión que tengan autoridad para hacerlo.
"""

from dataclasses import dataclass, field
from enum import StrEnum


class EstadoGlobal(StrEnum):
    """Representa las únicas etapas globales permitidas por el dominio.

    Declarar los valores en un tipo evita que servicios futuros guarden textos
    arbitrarios. Que los tres valores existan aquí no habilita sus transiciones:
    por ahora el runtime solamente crea ``SIN_PREPARAR``.
    """

    SIN_PREPARAR = "SIN_PREPARAR"
    PREPARANDO = "PREPARANDO"
    SESION_ABIERTA = "SESION_ABIERTA"


@dataclass(slots=True)
class EstadoOperativo:
    """Contiene la única fuente de verdad funcional durante una ejecución.

    El objeto vive exclusivamente en memoria y comienza sin ninguna entidad
    activa. Los campos explícitos hacen verificable CA-001 sin inventar todavía
    modelos de preparación, sesión, votación o auditoría. Sus tipos se ampliarán
    en los WPs que definan esas entidades.
    """

    estado_global: EstadoGlobal = field(default=EstadoGlobal.SIN_PREPARAR, init=False)
    preparacion_activa: None = field(default=None, init=False)
    sesion_activa: None = field(default=None, init=False)
    votacion_activa: None = field(default=None, init=False)
    archivos_auditoria_activos: tuple[()] = field(default=(), init=False)
