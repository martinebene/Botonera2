"""Recursos compartidos que existen exactamente durante el lifespan."""

import os
from dataclasses import dataclass
from pathlib import Path

from fastapi import FastAPI

from botonera2_backend.dominio.estado import EstadoOperativo
from botonera2_backend.servicios.apoyo_tecnico import (
    RUTA_MENSAJES_TECNICOS_POR_DEFECTO,
    leer_biblioteca_mensajes_tecnicos,
)
from botonera2_backend.servicios.cliente_bridge import ClienteControlBridge
from botonera2_backend.servicios.proyecciones import ServicioProyecciones
from botonera2_backend.servicios.publicacion import CoordinadorPublicacion
from botonera2_backend.servicios.serializacion import EjecutorMutaciones

NOMBRE_RECURSOS = "recursos_botonera2"


@dataclass(frozen=True, slots=True)
class RecursosAplicacion:
    """Agrupa el estado único y la puerta única para modificarlo.

    El contenedor es inmutable para impedir que una ruta reemplace por accidente
    alguno de esos recursos. El estado contenido sí podrá evolucionar, pero las
    futuras mutaciones deberán hacerlo mediante ``ejecutor_mutaciones``.
    """

    estado_operativo: EstadoOperativo
    ejecutor_mutaciones: EjecutorMutaciones
    coordinador_publicacion: CoordinadorPublicacion
    servicio_proyecciones: ServicioProyecciones
    cliente_control_bridge: ClienteControlBridge


def crear_recursos_aplicacion(
    *,
    ruta_mensajes_tecnicos: Path = RUTA_MENSAJES_TECNICOS_POR_DEFECTO,
) -> RecursosAplicacion:
    """Construye recursos nuevos y sin recuperación del estado operativo.

    La única lectura de disco es la biblioteca de mensajes precargados de
    Apoyo Técnico (WP-055), que es configuración persistente y no estado de
    sesión: RN-GLOBAL-03 prohíbe restaurar presencia, votaciones o sesión
    después de una caída, no impide releer un archivo de configuración.

    Un CSV inválido no impide arrancar: la biblioteca queda marcada como no
    disponible y solamente se rechazan sus propias escrituras.
    """

    estado_operativo = EstadoOperativo()
    estado_operativo.biblioteca_mensajes_tecnicos = leer_biblioteca_mensajes_tecnicos(
        ruta_mensajes_tecnicos
    )
    coordinador = CoordinadorPublicacion()
    # La llamada ocurre todavía dentro del lock del ejecutor. Por eso el número
    # de revisión y la memoria proyectada pertenecen a la misma frontera.
    ejecutor = EjecutorMutaciones(coordinador.publicar)
    servicio_proyecciones = ServicioProyecciones(
        estado_operativo,
        ejecutor,
        coordinador,
    )
    cliente_control_bridge = ClienteControlBridge(
        url_base=os.getenv("BOTONERA2_BRIDGE_CONTROL_URL", "http://127.0.0.1:8765"),
        timeout_segundos=float(os.getenv("BOTONERA2_BRIDGE_CONTROL_TIMEOUT", "3.0")),
    )
    return RecursosAplicacion(
        estado_operativo=estado_operativo,
        ejecutor_mutaciones=ejecutor,
        coordinador_publicacion=coordinador,
        servicio_proyecciones=servicio_proyecciones,
        cliente_control_bridge=cliente_control_bridge,
    )


def guardar_recursos_aplicacion(
    aplicacion: FastAPI,
    recursos: RecursosAplicacion,
) -> None:
    """Asocia los recursos compartidos con una aplicación durante su vida útil."""

    setattr(aplicacion.state, NOMBRE_RECURSOS, recursos)


def obtener_recursos_aplicacion(aplicacion: FastAPI) -> RecursosAplicacion:
    """Devuelve el contenedor único asociado por el lifespan.

    FastAPI expone ``app.state`` como un almacén dinámico, por eso se valida el
    tipo al recuperarlo. Un acceso fuera del lifespan es un error de programación
    y se informa inmediatamente en lugar de fabricar una segunda instancia.
    """

    recursos = getattr(aplicacion.state, NOMBRE_RECURSOS, None)
    if not isinstance(recursos, RecursosAplicacion):
        raise RuntimeError("Los recursos de la aplicación no están disponibles")
    return recursos


def descartar_recursos_aplicacion(aplicacion: FastAPI) -> None:
    """Elimina la referencia a los recursos al finalizar el proceso simulado."""

    delattr(aplicacion.state, NOMBRE_RECURSOS)
