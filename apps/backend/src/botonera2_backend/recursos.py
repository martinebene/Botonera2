"""Recursos compartidos que existen exactamente durante el lifespan."""

import os
from dataclasses import dataclass

from fastapi import FastAPI

from botonera2_backend.dominio.estado import EstadoOperativo
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


def crear_recursos_aplicacion() -> RecursosAplicacion:
    """Construye recursos nuevos, vacíos y sin recuperación desde disco."""

    estado_operativo = EstadoOperativo()
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
