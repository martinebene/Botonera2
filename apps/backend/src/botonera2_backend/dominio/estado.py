"""Estado operativo único y volátil de Botonera2.

WP-002 estableció el estado que existe al arrancar; WP-005 incorporó la
preparación, WP-008 agregó el contexto real de sesión y WP-009 tipa la votación
activa. Las transiciones las ejecutan los servicios de dominio bajo el
serializador único, nunca este módulo.
"""

from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path

from botonera2_backend.dominio.preparacion import Preparacion
from botonera2_backend.dominio.remapeo import OperacionRemapeo
from botonera2_backend.dominio.sesion import Sesion
from botonera2_backend.dominio.votacion import Votacion


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
        preparacion_activa: contexto publicado solamente en ``PREPARANDO``.
        sesion_activa: contexto real publicado solamente en
            ``SESION_ABIERTA``. Compone el mismo objeto operativo que nació en
            la preparación, sin duplicar sus datos.
        votacion_activa: única votación pendiente publicada. Es la misma
            instancia almacenada en el historial de ``Sesion``; ``None`` indica
            que una nueva apertura puede ser evaluada.
        archivos_auditoria_activos: rutas de los tres CSV del conjunto de
            auditoría vigente, en orden L1, L2, L3; tupla vacía cuando no hay
            auditoría abierta. Es una vista derivada del escritor que vive en
            el contexto activo: se expone aquí para que CA-001 (backend recién
            iniciado, sin auditoría abierta) sea verificable sin conocer el
            modelo interno.
    """

    estado_global: EstadoGlobal = field(default=EstadoGlobal.SIN_PREPARAR, init=False)
    preparacion_activa: Preparacion | None = field(default=None, init=False)
    sesion_activa: Sesion | None = field(default=None, init=False)
    votacion_activa: Votacion | None = field(default=None, init=False)
    archivos_auditoria_activos: tuple[Path, ...] = field(default=(), init=False)
    remapeo_activo: OperacionRemapeo | None = field(default=None, init=False)
    remapeos_finalizados: dict[str, OperacionRemapeo] = field(
        default_factory=lambda: {}, init=False
    )

    def contexto_operativo_activo(self) -> Preparacion | None:
        """Devuelve el único contexto con presencia, test y auditoría activos.

        Durante ``PREPARANDO`` la referencia está en ``preparacion_activa``.
        Durante ``SESION_ABIERTA`` la sesión compone el mismo objeto. Centralizar
        esta selección permite que entradas 8/9 reutilicen una sola lógica sin
        mantener dos mapas de presencia ni dos escritores.
        """

        if self.estado_global is EstadoGlobal.PREPARANDO:
            return self.preparacion_activa
        if self.estado_global is EstadoGlobal.SESION_ABIERTA and self.sesion_activa is not None:
            return self.sesion_activa.contexto_operativo
        return None
