"""Temporizador único que publica solamente en deadlines relevantes."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from contextlib import suppress

from botonera2_backend.servicios.proyecciones import ServicioProyecciones
from botonera2_backend.servicios.publicacion import CoordinadorPublicacion
from botonera2_backend.servicios.serializacion import EjecutorMutaciones


class ServicioFronterasTemporales:
    """Espera test, revelado y expiración pública sin realizar polling.

    Existe una sola instancia/tarea por lifespan. Cada cambio funcional la
    despierta para recalcular la frontera más cercana; cada deadline completado
    publica una revisión bajo el lock compartido. ``esperar`` es inyectable
    para que las pruebas controlen el tiempo sin aguardar segundos reales.
    """

    def __init__(
        self,
        servicio_proyecciones: ServicioProyecciones,
        ejecutor_mutaciones: EjecutorMutaciones,
        coordinador: CoordinadorPublicacion,
        *,
        esperar: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._proyecciones = servicio_proyecciones
        self._ejecutor = ejecutor_mutaciones
        self._coordinador = coordinador
        self._esperar = esperar

    async def ejecutar(self) -> None:
        """Mantiene el ciclo hasta que el lifespan cancela esta tarea."""

        suscripcion = self._coordinador.suscribir()
        try:
            while True:
                revision, demora = await self._ejecutor.leer_coherente(
                    lambda: (
                        self._coordinador.revision,
                        self._proyecciones.demora_hasta_proxima_frontera(),
                    )
                )
                if demora is None:
                    await suscripcion.esperar_revision_superior(revision)
                    continue

                cambio = asyncio.create_task(suscripcion.esperar_revision_superior(revision))
                tiempo = asyncio.create_task(self._esperar_demora(demora))
                try:
                    completadas, pendientes = await asyncio.wait(
                        (cambio, tiempo),
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    for tarea in pendientes:
                        tarea.cancel()
                    for tarea in pendientes:
                        with suppress(asyncio.CancelledError):
                            await tarea

                    # Si simultáneamente llegó una mutación, esa publicación ya
                    # reconstruirá el payload con el reloj vigente. Solo se crea
                    # una revisión temporal adicional cuando el timer fue la
                    # única causa del despertar.
                    if tiempo in completadas and cambio not in completadas:
                        await self._ejecutor.publicar_frontera_temporal()
                finally:
                    for tarea in (cambio, tiempo):
                        if not tarea.done():
                            tarea.cancel()
                        with suppress(asyncio.CancelledError):
                            await tarea
        finally:
            suscripcion.cancelar()

    async def _esperar_demora(self, demora: float) -> None:
        """Convierte el ``Awaitable`` inyectable en una coroutine tipada."""

        await self._esperar(demora)
