"""Persistencia durable de la auditoría institucional en tres CSV acumulativos.

Este módulo se ocupa solamente de archivos: no conoce estados de sala, votaciones
ni códigos concretos de eventos. Los Work Packages funcionales posteriores
decidirán cuándo registrar cada hecho y ejecutarán este escritor dentro del
serializador global del backend.
"""

from __future__ import annotations

import csv
import os
from collections.abc import Callable, Mapping
from contextlib import suppress
from datetime import datetime, timedelta
from enum import StrEnum
from pathlib import Path
from types import MappingProxyType
from typing import TextIO

ENCABEZADO_CSV = ("seq", "timestamp", "level", "tag", "event_code", "message")
FORMATO_CARPETA = "%Y-%m-%d"
FORMATO_NOMBRE = "%Y-%m-%d_%H-%M-%S"
FORMATO_TIMESTAMP = "%Y-%m-%d %H:%M:%S"


class NivelAuditoria(StrEnum):
    """Representa la profundidad institucional de un evento de auditoría.

    El valor textual coincide con el que se persiste en la columna ``level``.
    La jerarquía es acumulativa: los niveles más importantes también aparecen
    en los archivos que contienen mayor detalle.
    """

    L1 = "L1"
    L2 = "L2"
    L3 = "L3"


class ErrorAuditoria(RuntimeError):
    """Indica que la auditoría no pudo garantizar su contrato de persistencia."""


class ErrorEscritorNoDisponible(ErrorAuditoria):
    """Indica que un escritor cerrado o fallado ya no admite nuevos eventos."""


class _ColisionNominal(Exception):
    """Señala internamente que al menos un nombre del conjunto ya estaba ocupado."""


def _abrir_archivo_exclusivo(ruta: Path) -> TextIO:
    """Crea un archivo nuevo sin posibilidad de reemplazar uno histórico.

    El modo ``x`` delega en el sistema operativo la comprobación exclusiva. Esto
    evita la carrera que existiría al preguntar primero ``exists()`` y abrir
    después. ``utf-8-sig`` escribe el BOM requerido al crear cada archivo.
    """

    return ruta.open(mode="x", encoding="utf-8-sig", newline="")


class EscritorAuditoriaCsv:
    """Administra un conjunto irreversible de archivos L1, L2 y L3.

    Cada instancia corresponde a una única preparación/sesión. El objeto no
    incorpora un lock propio: debe utilizarse bajo el serializador global del
    backend para que el orden de llamadas sea también el orden institucional.

    Una llamada exitosa a :meth:`registrar_evento` garantiza que la fila fue
    escrita, vaciada y sincronizada en todos sus archivos destino. Si cualquiera
    de esos pasos falla, el objeto queda en fallo cerrado y nunca vuelve a
    aceptar escrituras, aunque el sistema operativo haya alcanzado a persistir
    una parte del evento en algún archivo.
    """

    def __init__(
        self,
        directorio_base: Path,
        fecha_hora_inicio: datetime,
        *,
        reloj: Callable[[], datetime] = datetime.now,
        sincronizar: Callable[[int], None] = os.fsync,
    ) -> None:
        """Crea y sincroniza los tres CSV correspondientes al primer nombre libre.

        ``fecha_hora_inicio`` es la hora local real de inicio. Puede desplazarse
        solo la marca nominal de los nombres para resolver colisiones. ``reloj``
        permite usar la hora local real por defecto e inyectar una hora controlada
        en pruebas. Un error de creación o sincronización se informa mediante
        :class:`ErrorAuditoria` y no entrega un escritor parcialmente utilizable.
        """

        self._reloj = reloj
        self._sincronizar = sincronizar
        self._archivos: dict[NivelAuditoria, TextIO] = {}
        self._rutas: dict[NivelAuditoria, Path] = {}
        self._secuencia = 0
        self._cerrado = False
        self._fallado = False

        try:
            self._crear_conjunto(Path(directorio_base), fecha_hora_inicio)
            self._persistir_encabezados()
        except Exception as error:
            self._fallado = True
            self._cerrar_archivos_sin_ocultar_error()
            if isinstance(error, ErrorAuditoria):
                raise
            raise ErrorAuditoria("No se pudo crear un conjunto de auditoría durable") from error

    @property
    def rutas(self) -> Mapping[NivelAuditoria, Path]:
        """Devuelve una vista inmutable de las rutas nominales del conjunto."""

        return MappingProxyType(self._rutas)

    @property
    def fallado(self) -> bool:
        """Informa si una operación previa volvió no confiable al escritor."""

        return self._fallado

    @property
    def cerrado(self) -> bool:
        """Informa si se ejecutó el cierre explícito e irreversible."""

        return self._cerrado

    def registrar_evento(
        self,
        nivel: NivelAuditoria,
        etiqueta: str,
        codigo_evento: str,
        mensaje: str,
    ) -> int:
        """Persiste un evento en todos los niveles que le corresponden.

        La hora se obtiene al iniciar la llamada y se limita a segundos mediante
        el formato canónico. El ``seq`` se confirma internamente solo después de
        sincronizar todos los destinos. Se devuelve ese número para facilitar la
        trazabilidad del llamador.

        Raises:
            ErrorEscritorNoDisponible: si el conjunto fue cerrado o ya falló.
            ErrorAuditoria: si falla escritura, ``flush`` o ``fsync``. Ante este
                error el escritor queda permanentemente en fallo cerrado.
        """

        self._verificar_disponible()
        siguiente_secuencia = self._secuencia + 1

        try:
            fila = (
                siguiente_secuencia,
                self._reloj().strftime(FORMATO_TIMESTAMP),
                nivel.value,
                etiqueta,
                codigo_evento,
                mensaje,
            )
            destinos = self._destinos_para(nivel)
            # Cada archivo completa las tres etapas antes de pasar al siguiente.
            # Si una etapa falla, nunca se retorna éxito y el conjunto deja de ser
            # utilizable. Esa es la atomicidad lógica posible entre varios CSV.
            for archivo in destinos:
                csv.writer(archivo, delimiter=";", lineterminator="\n").writerow(fila)
                archivo.flush()
                self._sincronizar(archivo.fileno())
        except Exception as error:
            self._fallado = True
            raise ErrorAuditoria(
                f"No se pudo persistir completamente el evento seq={siguiente_secuencia}"
            ) from error

        self._secuencia = siguiente_secuencia
        return siguiente_secuencia

    def cerrar(self) -> None:
        """Cierra todos los archivos y vuelve irreversible el conjunto.

        El estado se marca como cerrado antes de tocar los descriptores. Por eso,
        incluso si el sistema operativo informa un error al cerrar, ninguna
        llamada posterior puede reabrir ni seguir modificando estos CSV. Invocar
        el método otra vez es seguro y no produce efectos.
        """

        if self._cerrado:
            return
        self._cerrado = True

        errores: list[Exception] = []
        for archivo in self._archivos.values():
            try:
                archivo.close()
            except Exception as error:
                errores.append(error)

        if errores:
            self._fallado = True
            raise ErrorAuditoria(
                "No se pudieron cerrar todos los archivos de auditoría"
            ) from errores[0]

    def _crear_conjunto(self, directorio_base: Path, fecha_hora_inicio: datetime) -> None:
        """Busca segundo a segundo y reserva de forma exclusiva los tres nombres."""

        marca_nominal = fecha_hora_inicio.replace(microsecond=0)
        while True:
            carpeta = directorio_base / marca_nominal.strftime(FORMATO_CARPETA)
            carpeta.mkdir(parents=True, exist_ok=True)
            rutas_candidatas = {
                nivel: carpeta / f"{marca_nominal.strftime(FORMATO_NOMBRE)}-{nivel.value}.csv"
                for nivel in NivelAuditoria
            }

            try:
                self._reservar_rutas(rutas_candidatas)
            except _ColisionNominal:
                marca_nominal += timedelta(seconds=1)
                continue

            self._rutas = rutas_candidatas
            return

    def _reservar_rutas(self, rutas: Mapping[NivelAuditoria, Path]) -> None:
        """Abre un conjunto candidato y revierte solo los archivos recién creados."""

        abiertos: dict[NivelAuditoria, TextIO] = {}
        try:
            for nivel, ruta in rutas.items():
                abiertos[nivel] = _abrir_archivo_exclusivo(ruta)
        except FileExistsError as error:
            # Un archivo preexistente pertenece a otra preparación o a una reserva
            # concurrente. Solo se eliminan los que esta tentativa creó con éxito.
            for archivo in abiertos.values():
                archivo.close()
            for nivel in abiertos:
                rutas[nivel].unlink()
            raise _ColisionNominal from error
        except Exception:
            for archivo in abiertos.values():
                archivo.close()
            raise

        self._archivos = abiertos

    def _persistir_encabezados(self) -> None:
        """Escribe y sincroniza el encabezado antes de exponer el escritor."""

        for archivo in self._archivos.values():
            csv.writer(archivo, delimiter=";", lineterminator="\n").writerow(ENCABEZADO_CSV)
            archivo.flush()
            self._sincronizar(archivo.fileno())

    def _destinos_para(self, nivel: NivelAuditoria) -> tuple[TextIO, ...]:
        """Traduce la jerarquia acumulativa al orden estable L1, L2, L3."""

        cantidad = int(nivel.value[1])
        niveles_destino = list(NivelAuditoria)[:cantidad]
        return tuple(self._archivos[nivel_destino] for nivel_destino in niveles_destino)

    def _verificar_disponible(self) -> None:
        """Rechaza escrituras que podrian producir una falsa confirmacion."""

        if self._cerrado:
            raise ErrorEscritorNoDisponible("El conjunto de auditoria ya esta cerrado")
        if self._fallado:
            raise ErrorEscritorNoDisponible("El escritor de auditoria esta en fallo cerrado")

    def _cerrar_archivos_sin_ocultar_error(self) -> None:
        """Libera descriptores durante una inicialización fallida sin tapar su causa."""

        for archivo in self._archivos.values():
            with suppress(Exception):
                archivo.close()
