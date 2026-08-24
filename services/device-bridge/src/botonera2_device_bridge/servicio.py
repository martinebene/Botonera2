"""Servicio orquestador del bridge de dispositivos físicos.

Este módulo implementa `ServicioDeviceBridge`, el componente central que coordina:
1. El descubrimiento periódico de hardware mediante `AdaptadorEntradaFisica`.
2. La resolución estricta de `fingerprint -> devXX` usando `devices.json`.
3. La normalización amplia de teclas físicas mediante `normalizar_tecla`.
4. El envío determinista de pulsaciones hacia FastAPI mediante `ClienteHttpBackend`.
5. El ciclo de vida resiliente del proceso (tolerancia a cero dispositivos iniciales,
   desconexión y reconexión en caliente de hardware, y parada limpia ante señales).

Invariantes críticas:
- Cero asignación automática: Un fingerprint no presente en `devices.json` NUNCA
  recibe un `devXX` ni emite POST al backend.
- Cero reintentos: Cada evento físico `keydown` emite a lo sumo un POST.
- No decide reglas de negocio: El bridge no evalúa presencia, quórum, voto ni palabra.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import TYPE_CHECKING

from botonera2_device_bridge.adaptador_linux import (
    AdaptadorEntradaFisica,
    DispositivoFisico,
    ErrorDispositivoDesconectado,
)
from botonera2_device_bridge.cliente_http import ClienteHttpBackend
from botonera2_device_bridge.configuracion import ConfiguracionBridge
from botonera2_device_bridge.modelos import (
    EventoTeclaFisica,
    RespuestaEnvioBackend,
    SolicitudEntradaLogica,
)
from botonera2_device_bridge.normalizador import normalizar_tecla

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class ServicioDeviceBridge:
    """Orquestador del ciclo de vida y despacho de eventos del bridge físico."""

    def __init__(
        self,
        configuracion: ConfiguracionBridge,
        adaptador: AdaptadorEntradaFisica,
        cliente_http: ClienteHttpBackend,
        mapeo_dispositivos: dict[str, str],
    ) -> None:
        """Inicializa el servicio con sus dependencias inyectables.

        Args:
            configuracion: Parámetros operacionales del bridge.
            adaptador: Adaptador de hardware (evdev real o fake para pruebas).
            cliente_http: Cliente HTTP síncrono para comunicarse con FastAPI.
            mapeo_dispositivos: Diccionario de correspondencia fingerprint -> devXX.
        """
        self.configuracion = configuracion
        self.adaptador = adaptador
        self.cliente_http = cliente_http
        self.mapeo_dispositivos = mapeo_dispositivos

        # Registro de dispositivos abiertos actualmente (indexados por su ruta de sistema)
        self.dispositivos_activos: dict[str, DispositivoFisico] = {}
        self._evento_detencion = threading.Event()
        self._ultimo_escaneo: float = 0.0

    def procesar_evento_tecla(self, evento: EventoTeclaFisica) -> RespuestaEnvioBackend | None:
        """Procesa un único evento físico y, si corresponde, lo despacha al backend.

        Flujo paso a paso:
        1. Ignorar si no es una pulsación (es_bajada == False).
        2. Verificar si el fingerprint está mapeado en devices.json:
           - Si NO está mapeado: Registrar diagnóstico y NO enviar POST.
        3. Normalizar el nombre o código de la tecla física:
           - Si la tecla no es reconocida: Registrar diagnóstico y NO enviar POST.
        4. Transmitir {dispositivo, tecla} al backend mediante un único intento HTTP.
        5. Registrar el resultado funcional o error de red.

        Args:
            evento: Evento de tecla física capturado.

        Returns:
            RespuestaEnvioBackend si se emitió una solicitud HTTP, o None si el evento fue ignorado.
        """
        if not evento.es_bajada:
            logger.debug(
                "Evento ignorado (no es keydown): fp=%s, tecla=%s",
                evento.fingerprint,
                evento.nombre_tecla,
            )
            return None

        # 1. Resolución de dispositivo lógico
        dispositivo_logico = self.mapeo_dispositivos.get(evento.fingerprint)
        if not dispositivo_logico:
            logger.info(
                "Pulsación de dispositivo NO MAPEADO en devices.json: fp='%s', tecla='%s'",
                evento.fingerprint,
                evento.nombre_tecla,
            )
            return None

        # 2. Normalización de tecla
        tecla_normalizada = normalizar_tecla(evento.nombre_tecla)
        if tecla_normalizada is None:
            logger.info(
                "Tecla física desconocida ignorada para %s: '%s'",
                dispositivo_logico,
                evento.nombre_tecla,
            )
            return None

        # 3. Transmisión HTTP al backend
        solicitud = SolicitudEntradaLogica(
            dispositivo=dispositivo_logico,
            tecla=tecla_normalizada,
        )

        logger.debug(
            "Despachando pulsación a FastAPI: %s -> %s (fp=%s)",
            dispositivo_logico,
            tecla_normalizada,
            evento.fingerprint,
        )

        respuesta = self.cliente_http.enviar_pulsacion(solicitud)
        return respuesta

    def ejecutar_ciclo_descubrimiento(self) -> list[DispositivoFisico]:
        """Descubre nuevos dispositivos de entrada y actualiza el registro activo.

        Returns:
            Lista de nuevos dispositivos descubiertos e incorporados en esta iteración.
        """
        nuevos_dispositivos: list[DispositivoFisico] = []
        candidatos = self.adaptador.descubrir_dispositivos()

        for disp in candidatos:
            if disp.ruta not in self.dispositivos_activos:
                self.dispositivos_activos[disp.ruta] = disp
                nuevos_dispositivos.append(disp)

                dev_id = self.mapeo_dispositivos.get(disp.fingerprint)
                if dev_id:
                    logger.info(
                        "Hardware reconocido y MAPEADO: %s -> %s ('%s' en %s)",
                        disp.fingerprint,
                        dev_id,
                        disp.nombre,
                        disp.ruta,
                    )
                else:
                    logger.info(
                        "Hardware reconocido NO MAPEADO: %s ('%s' en %s)",
                        disp.fingerprint,
                        disp.nombre,
                        disp.ruta,
                    )

        return nuevos_dispositivos

    def ejecutar_paso(self) -> list[RespuestaEnvioBackend]:
        """Ejecuta una iteración de lectura y procesamiento de eventos pendientes.

        Returns:
            Lista de respuestas HTTP obtenidas de los eventos procesados en esta iteración.
        """
        respuestas: list[RespuestaEnvioBackend] = []
        rutas_a_remover: list[str] = []

        # Leemos eventos de cada dispositivo activo
        for ruta, disp in list(self.dispositivos_activos.items()):
            try:
                eventos = self.adaptador.leer_eventos(disp)
                for ev in eventos:
                    resp = self.procesar_evento_tecla(ev)
                    if resp is not None:
                        respuestas.append(resp)
            except ErrorDispositivoDesconectado as exc:
                logger.warning(
                    "Detectada desconexión de hardware en %s ('%s'): %s",
                    ruta,
                    disp.nombre,
                    exc,
                )
                rutas_a_remover.append(ruta)

        # Limpiamos dispositivos desconectados
        for ruta in rutas_a_remover:
            disp_removido = self.dispositivos_activos.pop(ruta, None)
            if disp_removido is not None:
                self.adaptador.cerrar_dispositivo(disp_removido)

        return respuestas

    def ejecutar_servicio(
        self,
        evento_detencion: threading.Event | None = None,
        limite_iteraciones: int | None = None,
        pausa_paso_segundos: float = 0.01,
    ) -> None:
        """Bucle principal de ejecución del bridge.

        Tolera el inicio sin hardware conectado y realiza escaneos periódicos
        sin busy-loop agresivo.

        Args:
            evento_detencion: Señal para finalizar limpiamente la ejecución.
            limite_iteraciones: Opcional para pruebas deterministas acotadas.
            pausa_paso_segundos: Intervalo de reposo entre comprobaciones no bloqueantes.
        """
        detener = evento_detencion or self._evento_detencion
        iteracion = 0

        logger.info(
            "Iniciando servicio de bridge físico Linux (URL API: %s, Mapeos: %d)",
            self.configuracion.url_base_api,
            len(self.mapeo_dispositivos),
        )

        try:
            # Escaneo inicial
            self.ejecutar_ciclo_descubrimiento()
            self._ultimo_escaneo = time.monotonic()

            while not detener.is_set():
                if limite_iteraciones is not None and iteracion >= limite_iteraciones:
                    break

                ahora = time.monotonic()
                if (ahora - self._ultimo_escaneo) >= self.configuracion.intervalo_escaneo_segundos:
                    self.ejecutar_ciclo_descubrimiento()
                    self._ultimo_escaneo = ahora

                self.ejecutar_paso()
                iteracion += 1

                # Pausa controlada para evitar consumo de CPU
                detener.wait(timeout=pausa_paso_segundos)

        finally:
            self.detener()
            logger.info("Servicio de bridge físico detenido correctamente.")

    def detener(self) -> None:
        """Detiene el servicio y cierra todos los descriptores de hardware."""
        self._evento_detencion.set()
        self.adaptador.cerrar_todo()
        self.dispositivos_activos.clear()
