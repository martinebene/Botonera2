"""Servicio serializado para pulsaciones lógicas durante la preparación.

WP-006 delimita este servicio a ``SIN_PREPARAR`` y ``PREPARANDO``. La ruta
recibe un dispositivo lógico, nunca un fingerprint físico, y resuelve la
identidad únicamente contra el padrón congelado dentro de ``Preparacion``.

La parte más importante del flujo es el orden: cada operación válida en
``PREPARANDO`` registra primero la pulsación, luego registra el resultado
obligatorio y recién entonces muta presencia o test. Todo el método se ejecuta
mediante el ``EjecutorMutaciones`` ya existente; el servicio no crea otro lock.
"""

from __future__ import annotations

import time
from collections.abc import Callable

from botonera2_backend.auditoria import NivelAuditoria
from botonera2_backend.configuracion.modelos import Concejal
from botonera2_backend.dominio.entrada import (
    IdentidadConcejal,
    Pulsacion,
    RespuestaEntrada,
    ResultadoPresencia,
    ResultadoTest,
)
from botonera2_backend.dominio.estado import EstadoGlobal, EstadoOperativo
from botonera2_backend.dominio.preparacion import Preparacion
from botonera2_backend.servicios.serializacion import EjecutorMutaciones

TECLA_TEST = "8"
TECLA_PRESENCIA = "9"

MOTIVO_PRESENCIA_ACTUALIZADA = "PRESENCIA_ACTUALIZADA"
MOTIVO_TEST_ACTIVADO = "TEST_ACTIVADO"
MOTIVO_SIN_PREPARAR = "SIN_PREPARAR"
MOTIVO_DISPOSITIVO_NO_ASIGNADO = "DISPOSITIVO_NO_ASIGNADO"
MOTIVO_TECLA_NO_HABILITADA = "TECLA_NO_HABILITADA"

ETIQUETA_INPUT = "INPUT"
ETIQUETA_PRESENCIA = "PRESENCIA"
CODIGO_PULSACION_RECIBIDA = "PULSACION_RECIBIDA"
CODIGO_PULSACION_RECHAZADA = "PULSACION_RECHAZADA"
CODIGO_CONCEJAL_PRESENTE = "CONCEJAL_PRESENTE"
CODIGO_CONCEJAL_AUSENTE = "CONCEJAL_AUSENTE"
CODIGO_TEST_DISPOSITIVO_ACTIVADO = "TEST_DISPOSITIVO_ACTIVADO"


class ServicioEntradaTecla:
    """Procesa pulsaciones lógicas sobre el estado operativo único.

    El servicio no conserva estado funcional propio. Recibe por constructor el
    ``EstadoOperativo`` y el ``EjecutorMutaciones`` compartidos, igual que el
    servicio de preparación. El reloj monotónico es una dependencia inyectable
    solo para poder probar expiraciones de test de forma determinista; en
    producción se usa ``time.monotonic``.
    """

    def __init__(
        self,
        estado_operativo: EstadoOperativo,
        ejecutor_mutaciones: EjecutorMutaciones,
        *,
        reloj_monotono: Callable[[], float] = time.monotonic,
    ) -> None:
        self._estado = estado_operativo
        self._ejecutor = ejecutor_mutaciones
        self._reloj_monotono = reloj_monotono

    async def procesar_pulsacion(self, pulsacion: Pulsacion) -> RespuestaEntrada:
        """Procesa una pulsación en el mismo serializador que el resto del backend.

        Incluso la respuesta sin efecto de ``SIN_PREPARAR`` pasa por el ejecutor:
        así una preparación concurrente no puede quedar intercalada a mitad de
        la decisión. El método bajo lock tampoco espera tareas externas, por lo
        que el orden de adquisición del lock es el orden oficial de entradas y
        de sus secuencias de auditoría.

        Raises:
            ErrorAuditoria: si algún evento obligatorio no puede persistirse. La
                excepción conserva el fallo cerrado del writer y la API la
                traduce a ``503 AUDITORIA_NO_DISPONIBLE``.
            RuntimeError: si se rompe la invariante interna de ``PREPARANDO``.
        """

        return await self._ejecutor.ejecutar(lambda: self._procesar_pulsacion_bajo_lock(pulsacion))

    async def _procesar_pulsacion_bajo_lock(self, pulsacion: Pulsacion) -> RespuestaEntrada:
        """Ejecuta la decisión completa con la exclusión ya tomada."""

        if self._estado.estado_global is EstadoGlobal.SIN_PREPARAR:
            # No existe preparación ni writer en este estado. Por contrato, una
            # pulsación válida se rechaza normalmente sin crear ni buscar CSV.
            return RespuestaEntrada(
                aceptada=False,
                dispositivo=pulsacion.dispositivo,
                tecla=pulsacion.tecla,
                motivo=MOTIVO_SIN_PREPARAR,
                concejal=None,
                resultado=None,
            )

        if self._estado.estado_global is not EstadoGlobal.PREPARANDO:
            # La semántica de SESION_ABIERTA pertenece a WP-008 y a los WPs de
            # votación. No inventamos aquí qué teclas tendrían efecto allí.
            raise RuntimeError("La entrada lógica de WP-006 solo procesa PREPARANDO y SIN_PREPARAR")

        preparacion = self._estado.preparacion_activa
        if preparacion is None:
            raise RuntimeError("Estado PREPARANDO sin preparación activa")

        # Toda pulsación de transporte válida durante una preparación queda
        # registrada antes de consultar el padrón o decidir si la tecla sirve.
        self._registrar_pulsacion_recibida(preparacion, pulsacion)

        concejal = self._buscar_concejal(preparacion, pulsacion.dispositivo)
        if concejal is None:
            self._registrar_pulsacion_rechazada(
                preparacion, pulsacion, MOTIVO_DISPOSITIVO_NO_ASIGNADO
            )
            return self._respuesta_rechazo(pulsacion, MOTIVO_DISPOSITIVO_NO_ASIGNADO, concejal=None)

        identidad = self._crear_identidad(concejal)
        if pulsacion.tecla not in (TECLA_TEST, TECLA_PRESENCIA):
            self._registrar_pulsacion_rechazada(preparacion, pulsacion, MOTIVO_TECLA_NO_HABILITADA)
            return self._respuesta_rechazo(
                pulsacion, MOTIVO_TECLA_NO_HABILITADA, concejal=identidad
            )

        if pulsacion.tecla == TECLA_PRESENCIA:
            return self._procesar_presencia(preparacion, pulsacion, concejal.dni, identidad)

        return self._procesar_test(preparacion, pulsacion, concejal.dni, identidad)

    def _procesar_presencia(
        self,
        preparacion: Preparacion,
        pulsacion: Pulsacion,
        dni: str,
        identidad: IdentidadConcejal,
    ) -> RespuestaEntrada:
        """Audita y alterna presencia, derivando presentes y quórum al final."""

        nuevo_valor = not preparacion.presencias[dni]
        codigo_evento = CODIGO_CONCEJAL_PRESENTE if nuevo_valor else CODIGO_CONCEJAL_AUSENTE
        mensaje = self._mensaje_presencia(identidad, nuevo_valor)

        # Si esta escritura falla, el writer queda en fallo cerrado y la
        # asignación siguiente no se ejecuta. La presencia anterior permanece.
        preparacion.escritor_auditoria.registrar_evento(
            NivelAuditoria.L3,
            ETIQUETA_PRESENCIA,
            codigo_evento,
            mensaje,
        )

        # La mutación funcional es deliberadamente posterior a ambos eventos
        # obligatorios: PULSACION_RECIBIDA (ya escrita por el llamador) y el
        # evento institucional de presencia que acabamos de persistir.
        preparacion.presencias[dni] = nuevo_valor
        return RespuestaEntrada(
            aceptada=True,
            dispositivo=pulsacion.dispositivo,
            tecla=pulsacion.tecla,
            motivo=MOTIVO_PRESENCIA_ACTUALIZADA,
            concejal=identidad,
            resultado=ResultadoPresencia(
                tipo="PRESENCIA",
                presente=nuevo_valor,
                presentes=preparacion.cantidad_presentes(),
                quorum_alcanzado=preparacion.quorum_alcanzado(),
            ),
        )

    def _procesar_test(
        self,
        preparacion: Preparacion,
        pulsacion: Pulsacion,
        dni: str,
        identidad: IdentidadConcejal,
    ) -> RespuestaEntrada:
        """Audita y activa/renueva el test sin modificar presencia ni quórum."""

        mensaje = (
            f"Test de dispositivo activado: {identidad.nombre} {identidad.apellido} "
            f"(banca Nro:{identidad.banca}); dispositivo=[{pulsacion.dispositivo}]"
        )
        preparacion.escritor_auditoria.registrar_evento(
            NivelAuditoria.L2,
            ETIQUETA_INPUT,
            CODIGO_TEST_DISPOSITIVO_ACTIVADO,
            mensaje,
        )

        # El reloj se consulta después de persistir el evento: la ventana
        # completa empieza cuando la activación queda confirmada, no antes.
        preparacion.activar_test_dispositivo(dni, self._reloj_monotono())
        return RespuestaEntrada(
            aceptada=True,
            dispositivo=pulsacion.dispositivo,
            tecla=pulsacion.tecla,
            motivo=MOTIVO_TEST_ACTIVADO,
            concejal=identidad,
            resultado=ResultadoTest(
                tipo="TEST",
                activo=True,
                duracion_segundos=preparacion.configuracion.device_test_seconds,
            ),
        )

    @staticmethod
    def _buscar_concejal(preparacion: Preparacion, dispositivo: str) -> Concejal | None:
        """Busca el dispositivo lógico en el padrón congelado, sin cachearlo."""

        return next(
            (
                concejal
                for concejal in preparacion.padron.concejales
                if concejal.dispositivo_votacion == dispositivo
            ),
            None,
        )

    @staticmethod
    def _crear_identidad(concejal: Concejal) -> IdentidadConcejal:
        """Limita la identidad de respuesta al DTO aprobado por DEC-006."""

        return IdentidadConcejal(
            dni=concejal.dni,
            nombre=concejal.nombre,
            apellido=concejal.apellido,
            banca=concejal.banca,
        )

    @staticmethod
    def _registrar_pulsacion_recibida(preparacion: Preparacion, pulsacion: Pulsacion) -> None:
        """Persiste el evento de entrada antes de cualquier resolución funcional."""

        preparacion.escritor_auditoria.registrar_evento(
            NivelAuditoria.L2,
            ETIQUETA_INPUT,
            CODIGO_PULSACION_RECIBIDA,
            f"Pulsación recibida: tecla [{pulsacion.tecla}] del dispositivo "
            f"[{pulsacion.dispositivo}]",
        )

    @staticmethod
    def _registrar_pulsacion_rechazada(
        preparacion: Preparacion, pulsacion: Pulsacion, motivo: str
    ) -> None:
        """Persiste el motivo estable de un rechazo funcional normal."""

        preparacion.escritor_auditoria.registrar_evento(
            NivelAuditoria.L2,
            ETIQUETA_INPUT,
            CODIGO_PULSACION_RECHAZADA,
            f"Pulsación rechazada: tecla [{pulsacion.tecla}] del dispositivo "
            f"[{pulsacion.dispositivo}]; motivo={motivo}",
        )

    @staticmethod
    def _respuesta_rechazo(
        pulsacion: Pulsacion,
        motivo: str,
        *,
        concejal: IdentidadConcejal | None,
    ) -> RespuestaEntrada:
        """Construye el formato común de los rechazos normales con HTTP 200."""

        return RespuestaEntrada(
            aceptada=False,
            dispositivo=pulsacion.dispositivo,
            tecla=pulsacion.tecla,
            motivo=motivo,
            concejal=concejal,
            resultado=None,
        )

    @staticmethod
    def _mensaje_presencia(identidad: IdentidadConcejal, presente: bool) -> str:
        """Devuelve exactamente el mensaje humano fijado por DEC-006."""

        estado = "PRESENTÓ" if presente else "AUSENTÓ"
        return f"{identidad.nombre} {identidad.apellido} (banca Nro:{identidad.banca}) se {estado}"
