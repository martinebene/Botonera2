"""Pruebas de integración del ServicioDeviceBridge.

Verifica:
1. Evento físico reconocido + fingerprint mapeado -> Único POST exacto {dispositivo, tecla}.
2. DECISIÓN HUMANA 4.B: Teclas reconocidas no funcionales actualmente (4, 5, 6, 0, ENTER, etc.)
   también se transmiten al backend cuando provienen de un dispositivo mapeado.
3. Tecla física no reconocida en el catálogo -> Cero POST.
4. Fingerprint físico no mapeado en devices.json -> Cero POST, no asigna devXX automáticamente.
5. Eventos no-keydown (keyup, hold) -> Cero POST.
6. Múltiples pulsaciones -> Despacho independiente de cada una.
7. Tolerancia a inicio con cero hardware.
8. Descubrimiento dinámico de hardware conectado posteriormente.
9. Manejo de desconexión en caliente y limpieza de recursos.
10. Parada limpia del servicio.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

import pytest
from botonera2_device_bridge.adaptador_linux import AdaptadorFalso
from botonera2_device_bridge.cliente_http import ClienteHttpBackend
from botonera2_device_bridge.configuracion import ConfiguracionBridge
from botonera2_device_bridge.modelos import EventoTeclaFisica
from botonera2_device_bridge.servicio import ServicioDeviceBridge

FINGERPRINT_DEV01 = "lin|vendor=1111|product=2222|version=0001|phys=usb-1|uniq=|name=Teclado 1"
FINGERPRINT_DEV02 = "lin|vendor=3333|product=4444|version=0001|phys=usb-2|uniq=|name=Teclado 2"
FINGERPRINT_DESCONOCIDO = "lin|vendor=9999|product=9999|version=0001|phys=usb-9|uniq=|name=Ajeno"


class FakeClienteHttp(ClienteHttpBackend):
    """Cliente HTTP falso que registra las peticiones sin realizar llamadas de red."""

    def __init__(self) -> None:
        super().__init__(url_base="http://fake:8000", timeout_segundos=1.0)
        self.peticiones_enviadas: list[dict[str, str]] = []
        self.proxima_respuesta_aceptada: bool = True
        self.proximo_motivo: str = "PRESENCIA_ACTUALIZADA"

    def enviar_pulsacion(self, solicitud: Any) -> Any:
        from botonera2_device_bridge.modelos import RespuestaEnvioBackend

        self.peticiones_enviadas.append(
            {
                "dispositivo": solicitud.dispositivo,
                "tecla": solicitud.tecla,
            }
        )
        return RespuestaEnvioBackend(
            aceptada=self.proxima_respuesta_aceptada,
            codigo_http=200,
            motivo=self.proximo_motivo,
            cuerpo={"aceptada": self.proxima_respuesta_aceptada, "motivo": self.proximo_motivo},
        )


@pytest.fixture
def entorno_bridge() -> tuple[ServicioDeviceBridge, AdaptadorFalso, FakeClienteHttp]:
    """Crea una instancia de ServicioDeviceBridge con dependencias simuladas."""
    mapeo = {
        FINGERPRINT_DEV01: "dev01",
        FINGERPRINT_DEV02: "dev02",
    }
    configuracion = ConfiguracionBridge(
        url_base_api="http://fake:8000",
        timeout_http_segundos=1.0,
        ruta_devices_json=Path("fake/devices.json"),
        intervalo_escaneo_segundos=0.1,
    )
    adaptador = AdaptadorFalso()
    cliente_http = FakeClienteHttp()

    servicio = ServicioDeviceBridge(
        configuracion=configuracion,
        adaptador=adaptador,
        cliente_http=cliente_http,
        mapeo_dispositivos=mapeo,
    )
    return servicio, adaptador, cliente_http


def test_pulsacion_reconocida_y_mapeada_envia_un_post(
    entorno_bridge: tuple[ServicioDeviceBridge, AdaptadorFalso, FakeClienteHttp],
) -> None:
    """Demuestra que una tecla válida de dispositivo mapeado emite un POST con devXX."""
    servicio, adaptador, cliente_http = entorno_bridge

    adaptador.agregar_dispositivo("/dev/input/event0", FINGERPRINT_DEV01)
    servicio.ejecutar_ciclo_descubrimiento()

    evento = EventoTeclaFisica(
        fingerprint=FINGERPRINT_DEV01,
        codigo_tecla=2,
        nombre_tecla="KEY_1",
        es_bajada=True,
    )
    adaptador.simular_evento("/dev/input/event0", evento)

    respuestas = servicio.ejecutar_paso()
    assert len(respuestas) == 1
    assert len(cliente_http.peticiones_enviadas) == 1
    assert cliente_http.peticiones_enviadas[0] == {"dispositivo": "dev01", "tecla": "1"}


def test_decision_4b_teclas_no_funcionales_reconocidas_se_transmiten(
    entorno_bridge: tuple[ServicioDeviceBridge, AdaptadorFalso, FakeClienteHttp],
) -> None:
    """Demuestra la Decisión Humana 4.B: teclas como '4', '0', 'ENTER', '+' se envían al backend."""
    servicio, adaptador, cliente_http = entorno_bridge

    adaptador.agregar_dispositivo("/dev/input/event0", FINGERPRINT_DEV01)
    servicio.ejecutar_ciclo_descubrimiento()

    teclas_a_probar = [
        ("KEY_4", "4"),
        ("KEY_5", "5"),
        ("KEY_6", "6"),
        ("KEY_0", "0"),
        ("KEY_ENTER", "ENTER"),
        ("KEY_KPPLUS", "+"),
        ("KEY_KPMINUS", "-"),
    ]

    for ev_nombre, _tecla_esperada in teclas_a_probar:
        evento = EventoTeclaFisica(
            fingerprint=FINGERPRINT_DEV01,
            codigo_tecla=10,
            nombre_tecla=ev_nombre,
            es_bajada=True,
        )
        adaptador.simular_evento("/dev/input/event0", evento)

    respuestas = servicio.ejecutar_paso()
    assert len(respuestas) == len(teclas_a_probar)
    assert len(cliente_http.peticiones_enviadas) == len(teclas_a_probar)

    for i, (_, tecla_esperada) in enumerate(teclas_a_probar):
        assert cliente_http.peticiones_enviadas[i] == {
            "dispositivo": "dev01",
            "tecla": tecla_esperada,
        }


def test_fingerprint_no_mapeado_no_envia_post(
    entorno_bridge: tuple[ServicioDeviceBridge, AdaptadorFalso, FakeClienteHttp],
) -> None:
    """Demuestra que un dispositivo no registrado en devices.json nunca emite POST."""
    servicio, adaptador, cliente_http = entorno_bridge

    adaptador.agregar_dispositivo("/dev/input/event9", FINGERPRINT_DESCONOCIDO)
    servicio.ejecutar_ciclo_descubrimiento()

    evento = EventoTeclaFisica(
        fingerprint=FINGERPRINT_DESCONOCIDO,
        codigo_tecla=2,
        nombre_tecla="KEY_1",
        es_bajada=True,
    )
    adaptador.simular_evento("/dev/input/event9", evento)

    respuestas = servicio.ejecutar_paso()
    assert len(respuestas) == 0
    assert len(cliente_http.peticiones_enviadas) == 0


def test_tecla_desconocida_no_envia_post(
    entorno_bridge: tuple[ServicioDeviceBridge, AdaptadorFalso, FakeClienteHttp],
) -> None:
    """Demuestra que una tecla no catalogada (ej: KEY_F1) no genera POST."""
    servicio, adaptador, cliente_http = entorno_bridge

    adaptador.agregar_dispositivo("/dev/input/event0", FINGERPRINT_DEV01)
    servicio.ejecutar_ciclo_descubrimiento()

    evento = EventoTeclaFisica(
        fingerprint=FINGERPRINT_DEV01,
        codigo_tecla=59,
        nombre_tecla="KEY_F1",
        es_bajada=True,
    )
    adaptador.simular_evento("/dev/input/event0", evento)

    respuestas = servicio.ejecutar_paso()
    assert len(respuestas) == 0
    assert len(cliente_http.peticiones_enviadas) == 0


def test_eventos_no_keydown_se_ignoran(
    entorno_bridge: tuple[ServicioDeviceBridge, AdaptadorFalso, FakeClienteHttp],
) -> None:
    """Demuestra que keyup o autorepeat (es_bajada=False) son ignorados."""
    servicio, adaptador, cliente_http = entorno_bridge

    adaptador.agregar_dispositivo("/dev/input/event0", FINGERPRINT_DEV01)
    servicio.ejecutar_ciclo_descubrimiento()

    evento_keyup = EventoTeclaFisica(
        fingerprint=FINGERPRINT_DEV01,
        codigo_tecla=2,
        nombre_tecla="KEY_1",
        es_bajada=False,
    )
    adaptador.simular_evento("/dev/input/event0", evento_keyup)

    respuestas = servicio.ejecutar_paso()
    assert len(respuestas) == 0
    assert len(cliente_http.peticiones_enviadas) == 0


def test_tolerancia_cero_hardware_inicial_y_redescubrimiento(
    entorno_bridge: tuple[ServicioDeviceBridge, AdaptadorFalso, FakeClienteHttp],
) -> None:
    """Demuestra que el servicio puede iniciar sin dispositivos y detectarlos cuando se conectan."""
    servicio, adaptador, cliente_http = entorno_bridge

    # Inicio con 0 dispositivos
    servicio.ejecutar_ciclo_descubrimiento()
    assert len(servicio.dispositivos_activos) == 0

    respuestas = servicio.ejecutar_paso()
    assert len(respuestas) == 0

    # Conexión posterior
    adaptador.agregar_dispositivo("/dev/input/event0", FINGERPRINT_DEV01)
    nuevos = servicio.ejecutar_ciclo_descubrimiento()
    assert len(nuevos) == 1
    assert len(servicio.dispositivos_activos) == 1

    # Emisión de evento en el hardware recién conectado
    adaptador.simular_evento(
        "/dev/input/event0",
        EventoTeclaFisica(
            fingerprint=FINGERPRINT_DEV01,
            codigo_tecla=2,
            nombre_tecla="KEY_9",
            es_bajada=True,
        ),
    )
    respuestas = servicio.ejecutar_paso()
    assert len(respuestas) == 1
    assert len(cliente_http.peticiones_enviadas) == 1
    assert cliente_http.peticiones_enviadas[0] == {"dispositivo": "dev01", "tecla": "9"}


def test_recuperacion_desconexion_hardware(
    entorno_bridge: tuple[ServicioDeviceBridge, AdaptadorFalso, FakeClienteHttp],
) -> None:
    """Demuestra que cuando un hardware se desconecta, se remueve de activos limpiamente."""
    servicio, adaptador, _cliente_http = entorno_bridge

    adaptador.agregar_dispositivo("/dev/input/event0", FINGERPRINT_DEV01)
    servicio.ejecutar_ciclo_descubrimiento()
    assert len(servicio.dispositivos_activos) == 1

    # Simulamos desconexión física
    adaptador.simular_desconexion("/dev/input/event0")

    # Al ejecutar el paso, la excepción de desconexión es capturada y el dispositivo es removido
    respuestas = servicio.ejecutar_paso()
    assert len(respuestas) == 0
    assert len(servicio.dispositivos_activos) == 0
    assert "/dev/input/event0" in adaptador.dispositivos_cerrados


def test_ejecucion_servicio_bucle_y_parada_limpia(
    entorno_bridge: tuple[ServicioDeviceBridge, AdaptadorFalso, FakeClienteHttp],
) -> None:
    """Demuestra la ejecución acotada del bucle de servicio y parada limpia."""
    servicio, adaptador, _cliente_http = entorno_bridge

    adaptador.agregar_dispositivo("/dev/input/event0", FINGERPRINT_DEV01)

    evento_parar = threading.Event()

    # Ejecutar con límite de 3 iteraciones
    servicio.ejecutar_servicio(
        evento_detencion=evento_parar,
        limite_iteraciones=3,
        pausa_paso_segundos=0.001,
    )

    # Verifica que al terminar se hayan cerrado todos los recursos
    assert len(servicio.dispositivos_activos) == 0
    assert "/dev/input/event0" in adaptador.dispositivos_cerrados
