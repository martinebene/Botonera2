"""Temporizador único que publica solamente en deadlines relevantes."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

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
                    completadas, _ = await asyncio.wait(
                        (cambio, tiempo),
                        return_when=asyncio.FIRST_COMPLETED,
                    )
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

                    # ``return_exceptions`` convierte la cancelación interna de
                    # una hija en un resultado que podemos reconocer. En cambio,
                    # si el lifespan cancela esta tarea padre mientras espera el
                    # ``gather``, asyncio cancela el propio gather y propaga su
                    # ``CancelledError``. Así el cleanup de las hijas nunca puede
                    # consumir por accidente la cancelación externa del servicio.
                    resultados = await asyncio.gather(
                        cambio,
                        tiempo,
                        return_exceptions=True,
                    )
                    for resultado in resultados:
                        if isinstance(resultado, BaseException) and not isinstance(
                            resultado,
                            asyncio.CancelledError,
                        ):
                            # Las cancelaciones esperadas son parte del cleanup;
                            # cualquier otro fallo de una hija sigue siendo un
                            # error real y conserva la propagación previa.
                            raise resultado
        finally:
            suscripcion.cancelar()

    async def _esperar_demora(self, demora: float) -> None:
        """Convierte el ``Awaitable`` inyectable en una coroutine tipada."""

        await self._esperar(demora)
