"""Punto único de serialización para las futuras mutaciones del backend."""

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

ResultadoMutacion = TypeVar("ResultadoMutacion")


class EjecutorMutaciones:
    """Ejecuta de a una las operaciones que puedan cambiar estado.

    Cada instancia posee un único ``asyncio.Lock``. El ``lifespan`` crea un solo
    ejecutor junto con el estado operativo, de modo que todos los servicios del
    proceso compartirán la misma puerta de entrada a las secciones críticas.

    La exclusión abarca toda la espera de la operación recibida. Si esa operación
    lanza una excepción, ``async with`` libera igualmente el lock y la excepción
    se propaga: el llamador nunca recibe un éxito falso ni un resultado parcial
    presentado como confirmado.
    """

    def __init__(self) -> None:
        self._exclusion = asyncio.Lock()

    async def ejecutar(
        self,
        mutacion: Callable[[], Awaitable[ResultadoMutacion]],
    ) -> ResultadoMutacion:
        """Espera el turno exclusivo, ejecuta la mutación y devuelve su resultado.

        La función no decide reglas de negocio ni captura errores. Esto permite
        que servicios futuros validen y auditen dentro de la misma sección
        crítica, mientras el nivel de API transforma cualquier fallo en una
        respuesta HTTP apropiada.
        """

        async with self._exclusion:
            return await mutacion()
