# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false, reportOptionalMemberAccess=false
# pyright: reportInvalidTypeForm=false

"""Adaptador de hardware Linux para captura de eventos físicos mediante evdev.

Este módulo desacopla el acceso a los descriptores de `/dev/input/event*` del
resto del servicio mediante la abstracción `AdaptadorEntradaFisica`.

Responsabilidades:
1. `AdaptadorEvdevLinux`: Implementación concreta basada en `evdev` para Linux Mint / Linux.
   - Enumera dispositivos con `evdev.list_devices()`.
   - Abre únicamente candidatos que posean la capacidad `EV_KEY`.
   - Extrae metadatos y genera el fingerprint canónico.
   - Lee eventos en modo no bloqueante.
   - FILTRO ESTRICTO DE KEYDOWN: Solo emite eventos cuando `event.type == EV_KEY` y
     `event.value == 1`. Ignora `keyup` (`value == 0`) y repeat/hold (`value == 2`).
   - Detecta desconexiones físicas (cuando `dev.read()` lanza `OSError` por `ENODEV`)
     y limpia descriptores.
2. `AdaptadorFalso`: Implementación simulada en memoria para pruebas unitarias deterministas
   en entornos de CI sin hardware real ni permisos especiales.
"""

from __future__ import annotations

import contextlib
import logging
from dataclasses import dataclass
from typing import Any, Protocol

try:
    import evdev
    from evdev import ecodes
except ImportError:  # pragma: no cover
    # Permite importar y utilizar AdaptadorFalso en entornos donde evdev no estuviera presente
    evdev = None  # type: ignore[assignment]
    ecodes = None  # type: ignore[assignment]

from botonera2_device_bridge.fingerprint import construir_fingerprint_linux
from botonera2_device_bridge.modelos import EventoTeclaFisica

logger = logging.getLogger(__name__)


class ErrorDispositivoDesconectado(Exception):
    """Excepción lanzada cuando un dispositivo físico se desconecta o su descriptor se invalida."""


@dataclass
class DispositivoFisico:
    """Información y manejador de un dispositivo de entrada abierto.

    Atributos:
        ruta: Ruta en el sistema de archivos (ej: '/dev/input/event1').
        fingerprint: Fingerprint canónico persistente derivado del hardware.
        nombre: Nombre descriptivo del hardware (ej: 'USB Keyboard').
        manejador: Instancia subyacente (ej: InputDevice de evdev o fake).
    """

    ruta: str
    fingerprint: str
    nombre: str
    manejador: Any = None


class AdaptadorEntradaFisica(Protocol):
    """Protocolo que desacopla la lectura de hardware físico del bridge."""

    def descubrir_dispositivos(self) -> list[DispositivoFisico]:
        """Escanea y abre los dispositivos de entrada compatibles disponibles."""
        ...

    def leer_eventos(self, dispositivo: DispositivoFisico) -> list[EventoTeclaFisica]:
        """Lee los eventos pendientes de un dispositivo abierto.

        Raises:
            ErrorDispositivoDesconectado: Si el dispositivo fue desconectado.
        """
        ...

    def cerrar_dispositivo(self, dispositivo: DispositivoFisico) -> None:
        """Cierra el descriptor asociado al dispositivo."""
        ...

    def cerrar_todo(self) -> None:
        """Cierra todos los descriptores abiertos."""
        ...


class AdaptadorEvdevLinux:
    """Adaptador real para Linux basado en la librería evdev."""

    def __init__(self) -> None:
        if evdev is None:  # pragma: no cover
            raise RuntimeError(
                "La librería 'evdev' no está disponible. Verifique que esté instalada bajo Linux."
            )
        self._dispositivos_abiertos: dict[str, evdev.InputDevice] = {}

    def descubrir_dispositivos(self) -> list[DispositivoFisico]:
        """Lista las rutas /dev/input/event* y abre aquellas con capacidad EV_KEY."""
        candidatos: list[DispositivoFisico] = []
        try:
            rutas = evdev.list_devices()
        except PermissionError as exc:
            logger.error(
                "Permiso denegado en /dev/input: %s. "
                "Asegúrese de pertenecer al grupo 'input' o configurar udev.",
                exc,
            )
            return []
        except Exception as exc:
            logger.warning("Error al listar dispositivos /dev/input: %s", exc)
            return []

        for ruta in rutas:
            # Si ya lo tenemos abierto y sigue activo, no lo abrimos de nuevo
            if ruta in self._dispositivos_abiertos:
                continue

            try:
                dev = evdev.InputDevice(ruta)
            except PermissionError as exc:
                logger.warning("Permiso denegado al abrir %s: %s", ruta, exc)
                continue
            except (OSError, FileNotFoundError) as exc:
                logger.debug("No se pudo abrir %s: %s", ruta, exc)
                continue

            # Verificar si el dispositivo admite pulsaciones de teclas (EV_KEY)
            try:
                capacidades = dev.capabilities()
            except Exception as exc:
                logger.debug("No se pudieron leer capacidades de %s: %s", ruta, exc)
                with contextlib.suppress(Exception):
                    dev.close()
                continue

            tiene_teclas = ecodes.EV_KEY in capacidades or 1 in capacidades

            if not tiene_teclas:
                # Ignoramos dispositivos sin teclas (como ratones sin botones, acelerómetros, etc.)
                with contextlib.suppress(Exception):
                    dev.close()
                continue

            # Extraemos metadatos para construir el fingerprint persistente
            info = dev.info
            vendor = info.vendor
            product = info.product
            version = info.version
            phys = dev.phys or ""
            uniq = dev.uniq or ""
            name = dev.name or ""

            fp = construir_fingerprint_linux(
                vendor=vendor,
                product=product,
                version=version,
                phys=phys,
                uniq=uniq,
                name=name,
            )

            self._dispositivos_abiertos[ruta] = dev
            candidatos.append(
                DispositivoFisico(
                    ruta=ruta,
                    fingerprint=fp,
                    nombre=name,
                    manejador=dev,
                )
            )

            logger.info(
                "Dispositivo detectado en %s: '%s' [fingerprint: %s]",
                ruta,
                name,
                fp,
            )

        return candidatos

    def leer_eventos(self, dispositivo: DispositivoFisico) -> list[EventoTeclaFisica]:
        """Lee eventos de evdev en modo no bloqueante y filtra estrictamente keydown."""
        dev = self._dispositivos_abiertos.get(dispositivo.ruta)
        if dev is None:
            return []

        eventos_resultado: list[EventoTeclaFisica] = []

        try:
            # dev.read() devuelve un generador de eventos disponibles en el búfer
            for evento in dev.read():
                # Filtrar solo eventos de tipo tecla
                if evento.type != ecodes.EV_KEY:
                    continue

                # REGLA CRÍTICA DE KEYDOWN:
                # evento.value == 1 -> bajada (keydown)
                # evento.value == 0 -> subida (keyup)
                # evento.value == 2 -> repetición/autorepeat (hold)
                if evento.value != 1:
                    continue

                # Resolver nombre textual de la tecla
                nombre_tecla = ""
                codigo_o_lista = ecodes.KEY.get(evento.code)
                if isinstance(codigo_o_lista, list):
                    nombre_tecla = str(codigo_o_lista[0])
                elif isinstance(codigo_o_lista, str):
                    nombre_tecla = codigo_o_lista
                else:
                    nombre_tecla = str(evento.code)

                eventos_resultado.append(
                    EventoTeclaFisica(
                        fingerprint=dispositivo.fingerprint,
                        codigo_tecla=evento.code,
                        nombre_tecla=nombre_tecla,
                        es_bajada=True,
                        descripcion_dispositivo=dispositivo.nombre,
                    )
                )

        except BlockingIOError:
            # No hay eventos disponibles en este momento
            return []
        except (OSError, Exception) as exc:
            # Desconexión física del hardware (ej: error ENODEV número 19)
            logger.warning(
                "Dispositivo en %s desconectado o error de lectura: %s",
                dispositivo.ruta,
                exc,
            )
            self.cerrar_dispositivo(dispositivo)
            raise ErrorDispositivoDesconectado(
                f"Dispositivo {dispositivo.ruta} ({dispositivo.nombre}) desconectado: {exc}"
            ) from exc

        return eventos_resultado

    def cerrar_dispositivo(self, dispositivo: DispositivoFisico) -> None:
        """Cierra el descriptor evdev y lo remueve del registro."""
        dev = self._dispositivos_abiertos.pop(dispositivo.ruta, None)
        if dev is not None:
            try:
                dev.close()
            except Exception as exc:
                logger.debug("Error cerrando descriptor %s: %s", dispositivo.ruta, exc)

    def cerrar_todo(self) -> None:
        """Cierra todos los descriptores evdev abiertos."""
        for ruta, dev in list(self._dispositivos_abiertos.items()):
            try:
                dev.close()
            except Exception as exc:
                logger.debug("Error cerrando %s: %s", ruta, exc)
        self._dispositivos_abiertos.clear()


class AdaptadorFalso:
    """Adaptador de pruebas puramente en memoria para CI y tests sin hardware real."""

    def __init__(self) -> None:
        self.dispositivos_disponibles: list[DispositivoFisico] = []
        self.eventos_pendientes: dict[str, list[EventoTeclaFisica]] = {}
        self.dispositivos_cerrados: list[str] = []
        self.dispositivos_a_desconectar: set[str] = set()

    def agregar_dispositivo(
        self,
        ruta: str,
        fingerprint: str,
        nombre: str = "Teclado Falso",
    ) -> DispositivoFisico:
        """Registra un dispositivo simulado para ser descubierto."""
        disp = DispositivoFisico(ruta=ruta, fingerprint=fingerprint, nombre=nombre)
        self.dispositivos_disponibles.append(disp)
        self.eventos_pendientes[ruta] = []
        return disp

    def simular_evento(self, ruta: str, evento: EventoTeclaFisica) -> None:
        """Encola un evento de tecla física en la cola de lectura del dispositivo simulado."""
        if ruta not in self.eventos_pendientes:
            self.eventos_pendientes[ruta] = []
        self.eventos_pendientes[ruta].append(evento)

    def simular_desconexion(self, ruta: str) -> None:
        """Marca un dispositivo para fallar con ErrorDispositivoDesconectado al leer."""
        self.dispositivos_a_desconectar.add(ruta)

    def descubrir_dispositivos(self) -> list[DispositivoFisico]:
        """Devuelve los dispositivos disponibles que no hayan sido cerrados."""
        return [
            d for d in self.dispositivos_disponibles if d.ruta not in self.dispositivos_cerrados
        ]

    def leer_eventos(self, dispositivo: DispositivoFisico) -> list[EventoTeclaFisica]:
        """Devuelve los eventos encolados o simula la desconexión."""
        if dispositivo.ruta in self.dispositivos_a_desconectar:
            self.dispositivos_a_desconectar.remove(dispositivo.ruta)
            self.cerrar_dispositivo(dispositivo)
            raise ErrorDispositivoDesconectado(
                f"Dispositivo falso desconectado en {dispositivo.ruta}"
            )

        cola = self.eventos_pendientes.get(dispositivo.ruta, [])
        # Vaciamos la cola y devolvemos los eventos
        self.eventos_pendientes[dispositivo.ruta] = []
        return cola

    def cerrar_dispositivo(self, dispositivo: DispositivoFisico) -> None:
        """Marca el dispositivo simulado como cerrado."""
        if dispositivo.ruta not in self.dispositivos_cerrados:
            self.dispositivos_cerrados.append(dispositivo.ruta)
        self.eventos_pendientes.pop(dispositivo.ruta, None)

    def cerrar_todo(self) -> None:
        """Cierra todos los dispositivos simulados."""
        for d in self.dispositivos_disponibles:
            self.cerrar_dispositivo(d)
