"""Recursos compartidos que existen exactamente durante el lifespan."""

from dataclasses import dataclass

from fastapi import FastAPI

from botonera2_backend.dominio.estado import EstadoOperativo
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


def crear_recursos_aplicacion() -> RecursosAplicacion:
    """Construye recursos nuevos, vacíos y sin recuperación desde disco."""

    return RecursosAplicacion(
        estado_operativo=EstadoOperativo(),
        ejecutor_mutaciones=EjecutorMutaciones(),
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
