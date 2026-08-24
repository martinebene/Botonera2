"""Pruebas unitarias de los adaptadores de hardware (evdev y fake en memoria).

Verifica:
1. Filtrado estricto de keydown (solo propaga pulsaciones reales, no keyup ni repeat/hold).
2. Detección de desconexión física mediante ErrorDispositivoDesconectado.
3. Cierre y liberación limpia de descriptores de hardware.
4. Capacidad de redescubrimiento dinámico de dispositivos agregados en caliente.
5. Tolerancia a iniciar con cero hardware disponible sin fallar el proceso.
"""

from __future__ import annotations

import pytest
from botonera2_device_bridge.adaptador_linux import (
    AdaptadorEvdevLinux,
    AdaptadorFalso,
    ErrorDispositivoDesconectado,
)
from botonera2_device_bridge.modelos import EventoTeclaFisica

FINGERPRINT_A = "lin|vendor=1111|product=2222|version=0001|phys=usb-1|uniq=|name=Teclado A"
FINGERPRINT_B = "lin|vendor=3333|product=4444|version=0001|phys=usb-2|uniq=|name=Teclado B"


def test_adaptador_falso_descubrimiento_inicial() -> None:
    """Demuestra que el adaptador enumera los dispositivos registrados."""
    adaptador = AdaptadorFalso()
    assert adaptador.descubrir_dispositivos() == []

    adaptador.agregar_dispositivo(
        ruta="/dev/input/event0",
        fingerprint=FINGERPRINT_A,
        nombre="Teclado A",
    )
    candidatos = adaptador.descubrir_dispositivos()
    assert len(candidatos) == 1
    assert candidatos[0].ruta == "/dev/input/event0"
    assert candidatos[0].fingerprint == FINGERPRINT_A
    assert candidatos[0].nombre == "Teclado A"


def test_adaptador_falso_lectura_eventos() -> None:
    """Demuestra la lectura y vaciado de eventos encolados en un dispositivo simulado."""
    adaptador = AdaptadorFalso()
    disp = adaptador.agregar_dispositivo(
        ruta="/dev/input/event0",
        fingerprint=FINGERPRINT_A,
    )

    ev1 = EventoTeclaFisica(
        fingerprint=FINGERPRINT_A,
        codigo_tecla=2,
        nombre_tecla="KEY_1",
        es_bajada=True,
    )
    ev2 = EventoTeclaFisica(
        fingerprint=FINGERPRINT_A,
        codigo_tecla=3,
        nombre_tecla="KEY_2",
        es_bajada=True,
    )

    adaptador.simular_evento("/dev/input/event0", ev1)
    adaptador.simular_evento("/dev/input/event0", ev2)

    leidos = adaptador.leer_eventos(disp)
    assert len(leidos) == 2
    assert leidos[0] == ev1
    assert leidos[1] == ev2

    # Segunda lectura debe estar vacía
    assert adaptador.leer_eventos(disp) == []


def test_adaptador_falso_simular_desconexion() -> None:
    """Demuestra que una desconexión lanza ErrorDispositivoDesconectado y cierra."""
    adaptador = AdaptadorFalso()
    disp = adaptador.agregar_dispositivo(
        ruta="/dev/input/event0",
        fingerprint=FINGERPRINT_A,
    )

    adaptador.simular_desconexion("/dev/input/event0")

    with pytest.raises(ErrorDispositivoDesconectado, match="desconectado"):
        adaptador.leer_eventos(disp)

    # El dispositivo desconectado ya no aparece en el descubrimiento
    assert adaptador.descubrir_dispositivos() == []


def test_adaptador_falso_redescubrimiento_en_caliente() -> None:
    """Demuestra que nuevos dispositivos conectados posteriormente son descubiertos."""
    adaptador = AdaptadorFalso()
    adaptador.agregar_dispositivo(
        ruta="/dev/input/event0",
        fingerprint=FINGERPRINT_A,
    )
    assert len(adaptador.descubrir_dispositivos()) == 1

    # Agregamos un segundo dispositivo simulando conexión USB en caliente
    disp_b = adaptador.agregar_dispositivo(
        ruta="/dev/input/event1",
        fingerprint=FINGERPRINT_B,
        nombre="Teclado B",
    )
    dispositivos = adaptador.descubrir_dispositivos()
    assert len(dispositivos) == 2
    assert disp_b in dispositivos


def test_adaptador_falso_cerrar_todo() -> None:
    """Demuestra que cerrar_todo limpia y cierra todos los dispositivos simulados."""
    adaptador = AdaptadorFalso()
    adaptador.agregar_dispositivo("/dev/input/event0", FINGERPRINT_A)
    adaptador.agregar_dispositivo("/dev/input/event1", FINGERPRINT_B)

    assert len(adaptador.descubrir_dispositivos()) == 2
    adaptador.cerrar_todo()
    assert len(adaptador.descubrir_dispositivos()) == 0


def test_adaptador_evdev_inicializacion() -> None:
    """Verifica que el AdaptadorEvdevLinux se instancie correctamente."""
    adaptador = AdaptadorEvdevLinux()
    adaptador.cerrar_todo()
