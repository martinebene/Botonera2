"""Estado operativo mínimo y volátil de Botonera2.

WP-002 estableció el estado que existe al arrancar; WP-005 amplió los tipos
dejados deliberadamente abiertos para representar la preparación activa y las
rutas de auditoría vigentes. Las transiciones las ejecutan los servicios de
dominio bajo el serializador único, nunca este módulo.
"""

from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path

from botonera2_backend.dominio.preparacion import Preparacion


class EstadoGlobal(StrEnum):
    """Representa las únicas etapas globales permitidas por el dominio.

    Declarar los valores en un tipo evita que servicios futuros guarden textos
    arbitrarios. Que los tres valores existan aquí no habilita sus transiciones:
    cada una es responsabilidad del Work Package que la implementa.
    """

    SIN_PREPARAR = "SIN_PREPARAR"
    PREPARANDO = "PREPARANDO"
    SESION_ABIERTA = "SESION_ABIERTA"


@dataclass(slots=True)
class EstadoOperativo:
    """Contiene la única fuente de verdad funcional durante una ejecución.

    El objeto vive exclusivamente en memoria y comienza sin ninguna entidad
    activa. Los campos se mutan únicamente desde servicios que se ejecutan
    bajo el ``EjecutorMutaciones`` global, de modo que ningún observador
    concurrente puede ver una transición a mitad de camino.

    Atributos:
        estado_global: etapa actual del ciclo de vida (RN-GLOBAL-01).
        preparacion_activa: contexto de la preparación en curso, o ``None``
            cuando no hay ninguna. WP-005 lo instala al preparar la sala y lo
            descarta al cancelar; los WPs de sesión lo extenderán.
        sesion_activa: reservado para el WP de apertura de sesión.
        votacion_activa: reservado para el WP de votaciones.
        archivos_auditoria_activos: rutas de los tres CSV del conjunto de
            auditoría vigente, en orden L1, L2, L3; tupla vacía cuando no hay
            auditoría abierta. Es una vista derivada del escritor que vive en
            ``preparacion_activa``: se expone aquí para que CA-001 (backend
            recién iniciado, sin auditoría abierta) sea verificable sin
            conocer el modelo de preparación.
    """

    estado_global: EstadoGlobal = field(default=EstadoGlobal.SIN_PREPARAR, init=False)
    preparacion_activa: Preparacion | None = field(default=None, init=False)
    sesion_activa: None = field(default=None, init=False)
    votacion_activa: None = field(default=None, init=False)
    archivos_auditoria_activos: tuple[Path, ...] = field(default=(), init=False)
