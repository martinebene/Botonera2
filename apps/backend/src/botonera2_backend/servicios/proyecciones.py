"""DTOs y constructores autoritativos de los estados de solo lectura.

REST y SSE llaman a este mismo servicio. Esa única ruta de construcción evita
que el stream público aplique una política de secreto distinta del snapshot o
que alguno serialice accidentalmente objetos mutables del dominio.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import datetime, timedelta

from pydantic import BaseModel, ConfigDict, Field

from botonera2_backend.auditoria import EventoAuditoriaReciente
from botonera2_backend.configuracion.modelos import Concejal, ConfiguracionSistema
from botonera2_backend.dominio.estado import EstadoGlobal, EstadoOperativo
from botonera2_backend.dominio.preparacion import Preparacion
from botonera2_backend.dominio.remapeo import OperacionRemapeo
from botonera2_backend.dominio.sesion import Sesion
from botonera2_backend.dominio.votacion import (
    EstadoVotacion,
    ResultadoVotacion,
    TipoMayoria,
    Votacion,
)
from botonera2_backend.servicios.publicacion import CoordinadorPublicacion
from botonera2_backend.servicios.serializacion import EjecutorMutaciones


class ModeloProyeccion(BaseModel):
    """Base inmutable de todos los DTOs enviados por REST o SSE."""

    model_config = ConfigDict(frozen=True)


class ConfiguracionProyectada(ModeloProyeccion):
    """Configuración congelada necesaria para construir la UI de Moderación."""

    quorum: int
    filas_bancas: tuple[int, ...]
    tipos_votacion: tuple[str, ...]
    duracion_test_segundos: int | float
    revelado_votos_moderacion_segundos: int | float
    cuenta_regresiva_recinto_segundos: int | float
    resultado_publico_recinto_segundos: int | float


class DatosPreparacion(ModeloProyeccion):
    """Identifica el contexto que todavía no es una sesión formal."""

    fecha_hora_inicio: datetime
    numero_sesion: int | None
    presidencia: str | None
    secretaria_legislativa: str | None


class DatosSesion(ModeloProyeccion):
    """Identifica la sesión formal y sus autoridades vigentes."""

    fecha_hora_inicio_preparacion: datetime
    fecha_hora_apertura: datetime
    numero_sesion: int
    presidencia: str
    secretaria_legislativa: str


class EstadoQuorum(ModeloProyeccion):
    """Expone los cálculos de quórum para que la UI no los reimplemente."""

    cantidad_presentes: int
    requerido: int
    alcanzado: bool


class ConcejalModeracion(ModeloProyeccion):
    """Banca completa disponible para el operador institucional."""

    dni: str
    nombre: str
    apellido: str
    bloque: str
    banca: int
    dispositivo_votacion: str
    ruta_imagen: str
    presente: bool
    test_activo: bool
    test_expira_en: datetime | None


class ConcejalPublico(ModeloProyeccion):
    """Banca pública por allowlist, sin DNI ni identificador de dispositivo."""

    nombre: str
    apellido: str
    bloque: str
    banca: int
    ruta_imagen: str
    presente: bool
    test_activo: bool
    test_expira_en: datetime | None


class PersonaPalabraModeracion(ModeloProyeccion):
    """Identidad de cola/orador apropiada para Moderación."""

    dni: str
    nombre: str
    apellido: str
    banca: int


class PersonaPalabraPublica(ModeloProyeccion):
    """Identidad pública de cola/orador sin DNI."""

    nombre: str
    apellido: str
    banca: int


class EstadoPalabraModeracion(ModeloProyeccion):
    """Copia ordenada de la única cola y el único orador del dominio."""

    cola: tuple[PersonaPalabraModeracion, ...]
    orador: PersonaPalabraModeracion | None


class EstadoPalabraPublico(ModeloProyeccion):
    """Versión pública del uso de palabra."""

    cola: tuple[PersonaPalabraPublica, ...]
    orador: PersonaPalabraPublica | None


class ConteosVotosProyectados(ModeloProyeccion):
    """Conteos derivados que nunca incluyen el voto presidencial."""

    positivos: int
    negativos: int
    abstenciones: int
    total: int


class VotoModeracion(ModeloProyeccion):
    """Voto ordinario individual revelable a Moderación según su deadline."""

    dni: str
    nombre: str
    apellido: str
    banca: int
    valor: str


class VotoPublico(ModeloProyeccion):
    """Voto ordinario público posterior al cierre, asociado solo a la banca."""

    nombre: str
    apellido: str
    banca: int
    valor: str


class VotoPresidencialProyectado(ModeloProyeccion):
    """Desempate separado que no se mezcla con los votos de concejales."""

    presidencia: str
    sentido: str


class VotacionModeracion(ModeloProyeccion):
    """Vista completa de la votación relevante para el operador."""

    id: str
    numero_votacion: int
    tipo: str
    tema: str
    tipo_mayoria: str
    factor: float
    base: str
    estado_recepcion: str
    resultado: str | None
    fecha_hora_apertura: datetime
    fecha_hora_cierre: datetime | None
    fecha_hora_resultado: datetime | None
    motivo_finalizacion_manual: str | None
    cantidad_votos_recibidos: int
    revelado_individual_desde: datetime
    votos_individuales_revelados: bool
    votos_individuales: tuple[VotoModeracion, ...] | None
    conteos: ConteosVotosProyectados | None
    voto_presidencial: VotoPresidencialProyectado | None


class VotacionPublica(ModeloProyeccion):
    """Vista pública restrictiva construida sin serializar el dominio completo."""

    id: str
    numero_votacion: int
    tipo: str
    tema: str
    tipo_mayoria: str
    factor: float
    base: str
    estado_recepcion: str
    resultado: str | None
    fecha_hora_apertura: datetime
    fecha_hora_cierre: datetime | None
    cuenta_regresiva_hasta: datetime | None
    resultado_visible_hasta: datetime | None
    votos_individuales: tuple[VotoPublico, ...] | None
    conteos: ConteosVotosProyectados | None
    voto_presidencial: VotoPresidencialProyectado | None


class PuntoOrdenDelDiaProyectado(ModeloProyeccion):
    """Punto asistencial normalizado disponible solo para Moderación."""

    nro_votacion: int
    tipo: str
    tema: str
    tipo_mayoria: str
    factor: float
    base: str


class EventoRecienteProyectado(ModeloProyeccion):
    """Evento cuyo ``fsync`` ya fue confirmado por el escritor activo."""

    seq: int
    timestamp: str
    nivel: str
    etiqueta: str
    codigo_evento: str
    mensaje: str


class EstadoAuditoriaProyectado(ModeloProyeccion):
    """Condición técnica del escritor, separada del estado reglamentario."""

    activa: bool
    disponible: bool
    fallado: bool
    cerrado: bool
    motivo: str | None


class EstadoRemapeoModeracion(ModeloProyeccion):
    """Operación física activa visible exclusivamente para Moderación."""

    remapeo_id: str
    dispositivo: str
    estado: str
    fingerprint_anterior: str | None
    candidato: str | None
    diagnostico: str | None


class Capacidad(ModeloProyeccion):
    """Indica disponibilidad actual y códigos estables que explican el bloqueo."""

    habilitada: bool
    motivos: tuple[str, ...] = Field(default_factory=tuple)


class CapacidadesModeracion(ModeloProyeccion):
    """Precondiciones derivables sin intentar validar bodies futuros."""

    preparar_sala: Capacidad
    actualizar_preparacion: Capacidad
    cancelar_preparacion: Capacidad
    abrir_sesion: Capacidad
    actualizar_sesion: Capacidad
    cerrar_sesion: Capacidad
    cargar_orden_del_dia: Capacidad
    descartar_orden_del_dia: Capacidad
    abrir_votacion: Capacidad
    finalizar_votacion: Capacidad
    desempatar: Capacidad
    otorgar_palabra: Capacidad
    quitar_palabra: Capacidad


class EstadoModeracion(ModeloProyeccion):
    """Snapshot completo y reconstruible del frontend de Moderación."""

    revision: int
    generado_en: datetime
    estado_global: EstadoGlobal
    preparacion: DatosPreparacion | None
    sesion: DatosSesion | None
    configuracion: ConfiguracionProyectada | None
    concejales: tuple[ConcejalModeracion, ...]
    quorum: EstadoQuorum | None
    votacion: VotacionModeracion | None
    palabra: EstadoPalabraModeracion | None
    orden_del_dia: tuple[PuntoOrdenDelDiaProyectado, ...]
    eventos_recientes: tuple[EventoRecienteProyectado, ...]
    auditoria: EstadoAuditoriaProyectado
    remapeo: EstadoRemapeoModeracion | None
    capacidades: CapacidadesModeracion


class EstadoRecinto(ModeloProyeccion):
    """Snapshot público por allowlist, sin capacidades ni eventos de auditoría."""

    revision: int
    generado_en: datetime
    estado_global: EstadoGlobal
    preparacion: DatosPreparacion | None
    sesion: DatosSesion | None
    concejales: tuple[ConcejalPublico, ...]
    quorum: EstadoQuorum | None
    votacion: VotacionPublica | None
    palabra: EstadoPalabraPublico | None


class ServicioProyecciones:
    """Construye copias coherentes desde la única fuente de verdad operativa.

    Los relojes civil y monotónico son inyectables. El primero interpreta
    deadlines visibles; el segundo coincide con las expiraciones de test y no
    se ve afectado por ajustes del reloj del sistema.
    """

    def __init__(
        self,
        estado_operativo: EstadoOperativo,
        ejecutor_mutaciones: EjecutorMutaciones,
        coordinador: CoordinadorPublicacion,
        *,
        reloj: Callable[[], datetime] = datetime.now,
        reloj_monotono: Callable[[], float] = time.monotonic,
    ) -> None:
        self._estado = estado_operativo
        self._ejecutor = ejecutor_mutaciones
        self._coordinador = coordinador
        self._reloj = reloj
        self._reloj_monotono = reloj_monotono

    async def obtener_estado_moderacion(self) -> EstadoModeracion:
        """Toma una copia completa bajo el lock compartido."""

        return await self._ejecutor.leer_coherente(self._construir_moderacion)

    async def obtener_estado_recinto(self) -> EstadoRecinto:
        """Toma la proyección pública usando el mismo constructor de REST/SSE."""

        return await self._ejecutor.leer_coherente(self._construir_recinto)

    def demora_hasta_proxima_frontera(self) -> float | None:
        """Calcula bajo lock cuánto falta para el próximo cambio de payload.

        El llamador es el temporizador de lifespan y ya utiliza
        ``leer_coherente``. Se ignora el fin del countdown porque el DTO expone
        el deadline absoluto y el frontend puede dibujarlo localmente sin una
        publicación por segundo ni un cambio de payload al llegar a cero.
        """

        contexto = self._estado.contexto_operativo_activo()
        if contexto is None:
            return None

        ahora = self._reloj()
        ahora_monotono = self._reloj_monotono()
        demoras: list[float] = []
        demoras.extend(
            expiracion - ahora_monotono
            for expiracion in contexto.expiraciones_test.values()
            if expiracion > ahora_monotono
        )

        votacion = self._votacion_relevante()
        if votacion is not None:
            revelado = votacion.fecha_hora_apertura + timedelta(
                seconds=contexto.configuracion.moderacion_revelado_votos_segundos
            )
            demora_revelado = (revelado - ahora).total_seconds()
            if demora_revelado > 0:
                demoras.append(demora_revelado)

            if votacion.resultado in (
                ResultadoVotacion.APROBADA,
                ResultadoVotacion.RECHAZADA,
                ResultadoVotacion.INCONCLUSA,
            ):
                disponible_desde = votacion.fecha_hora_resultado
                if disponible_desde is not None:
                    limite = disponible_desde + timedelta(
                        seconds=contexto.configuracion.recinto_resultado_publico_segundos
                    )
                    demora_resultado = (limite - ahora).total_seconds()
                    if demora_resultado > 0:
                        demoras.append(demora_resultado)

        return min(demoras) if demoras else None

    def _construir_moderacion(self) -> EstadoModeracion:
        """Construye el DTO sin devolver referencias mutables del dominio."""

        generado_en = self._reloj()
        monotono = self._reloj_monotono()
        contexto = self._estado.contexto_operativo_activo()
        sesion = self._estado.sesion_activa
        return EstadoModeracion(
            revision=self._coordinador.revision,
            generado_en=generado_en,
            estado_global=self._estado.estado_global,
            preparacion=self._datos_preparacion(contexto),
            sesion=self._datos_sesion(sesion),
            configuracion=(
                self._configuracion(contexto.configuracion) if contexto is not None else None
            ),
            concejales=self._concejales_moderacion(contexto, generado_en, monotono),
            quorum=self._quorum(contexto),
            votacion=self._votacion_moderacion(contexto, generado_en),
            palabra=self._palabra_moderacion(sesion, contexto),
            orden_del_dia=self._orden_del_dia(contexto),
            eventos_recientes=self._eventos(contexto),
            auditoria=self._auditoria(contexto),
            remapeo=self._remapeo(self._estado.remapeo_activo),
            capacidades=self._capacidades(contexto),
        )

    def _construir_recinto(self) -> EstadoRecinto:
        """Construye por allowlist el DTO que protege el secreto en servidor."""

        generado_en = self._reloj()
        monotono = self._reloj_monotono()
        contexto = self._estado.contexto_operativo_activo()
        sesion = self._estado.sesion_activa
        return EstadoRecinto(
            revision=self._coordinador.revision,
            generado_en=generado_en,
            estado_global=self._estado.estado_global,
            preparacion=self._datos_preparacion(contexto),
            sesion=self._datos_sesion(sesion),
            concejales=self._concejales_publicos(contexto, generado_en, monotono),
            quorum=self._quorum(contexto),
            votacion=self._votacion_publica(contexto, generado_en),
            palabra=self._palabra_publica(sesion, contexto),
        )

    def _datos_preparacion(self, contexto: Preparacion | None) -> DatosPreparacion | None:
        """Expone preparación solo durante ``PREPARANDO``."""

        if contexto is None or self._estado.estado_global is not EstadoGlobal.PREPARANDO:
            return None
        return DatosPreparacion(
            fecha_hora_inicio=contexto.fecha_hora_inicio,
            numero_sesion=contexto.numero_sesion,
            presidencia=contexto.presidencia,
            secretaria_legislativa=contexto.secretaria_legislativa,
        )

    @staticmethod
    def _datos_sesion(sesion: Sesion | None) -> DatosSesion | None:
        """Copia los datos formales si existe una sesión abierta."""

        if sesion is None:
            return None
        return DatosSesion(
            fecha_hora_inicio_preparacion=sesion.contexto_operativo.fecha_hora_inicio,
            fecha_hora_apertura=sesion.fecha_hora_apertura,
            numero_sesion=sesion.numero_sesion,
            presidencia=sesion.presidencia,
            secretaria_legislativa=sesion.secretaria_legislativa,
        )

    @staticmethod
    def _configuracion(configuracion: ConfiguracionSistema) -> ConfiguracionProyectada:
        """Copia los parámetros congelados con nombres propios del DTO."""

        return ConfiguracionProyectada(
            quorum=configuracion.quorum,
            filas_bancas=configuracion.filas_bancas,
            tipos_votacion=configuracion.tipos_votacion,
            duracion_test_segundos=configuracion.device_test_seconds,
            revelado_votos_moderacion_segundos=(configuracion.moderacion_revelado_votos_segundos),
            cuenta_regresiva_recinto_segundos=(
                configuracion.recinto_cuenta_regresiva_inicial_segundos
            ),
            resultado_publico_recinto_segundos=(configuracion.recinto_resultado_publico_segundos),
        )

    @staticmethod
    def _quorum(contexto: Preparacion | None) -> EstadoQuorum | None:
        """Proyecta los tres datos de quórum desde el mapa autoritativo."""

        if contexto is None:
            return None
        return EstadoQuorum(
            cantidad_presentes=contexto.cantidad_presentes(),
            requerido=contexto.configuracion.quorum,
            alcanzado=contexto.quorum_alcanzado(),
        )

    def _concejales_moderacion(
        self,
        contexto: Preparacion | None,
        generado_en: datetime,
        monotono: float,
    ) -> tuple[ConcejalModeracion, ...]:
        """Copia padrón, presencia y test para el operador."""

        if contexto is None:
            return ()
        return tuple(
            ConcejalModeracion(
                dni=concejal.dni,
                nombre=concejal.nombre,
                apellido=concejal.apellido,
                bloque=concejal.bloque,
                banca=concejal.banca,
                dispositivo_votacion=concejal.dispositivo_votacion,
                ruta_imagen=concejal.ruta_imagen,
                presente=contexto.presencias[concejal.dni],
                test_activo=contexto.test_dispositivo_activo(concejal.dni, monotono),
                test_expira_en=self._deadline_test(contexto, concejal.dni, generado_en, monotono),
            )
            for concejal in contexto.padron.concejales
        )

    def _concejales_publicos(
        self,
        contexto: Preparacion | None,
        generado_en: datetime,
        monotono: float,
    ) -> tuple[ConcejalPublico, ...]:
        """Copia solamente campos públicos de cada banca."""

        if contexto is None:
            return ()
        return tuple(
            ConcejalPublico(
                nombre=concejal.nombre,
                apellido=concejal.apellido,
                bloque=concejal.bloque,
                banca=concejal.banca,
                ruta_imagen=concejal.ruta_imagen,
                presente=contexto.presencias[concejal.dni],
                test_activo=contexto.test_dispositivo_activo(concejal.dni, monotono),
                test_expira_en=self._deadline_test(contexto, concejal.dni, generado_en, monotono),
            )
            for concejal in contexto.padron.concejales
        )

    @staticmethod
    def _deadline_test(
        contexto: Preparacion,
        dni: str,
        generado_en: datetime,
        monotono: float,
    ) -> datetime | None:
        """Convierte la expiración monotónica en deadline civil aproximado."""

        expiracion = contexto.expiraciones_test.get(dni)
        if expiracion is None or expiracion <= monotono:
            return None
        return generado_en + timedelta(seconds=expiracion - monotono)

    def _votacion_relevante(self) -> Votacion | None:
        """Selecciona activa o, si ya terminó, la última del historial."""

        if self._estado.votacion_activa is not None:
            return self._estado.votacion_activa
        sesion = self._estado.sesion_activa
        if sesion is None or not sesion.votaciones:
            return None
        return sesion.votaciones[-1]

    def _votacion_moderacion(
        self,
        contexto: Preparacion | None,
        generado_en: datetime,
    ) -> VotacionModeracion | None:
        """Aplica el retardo global desde la apertura, nunca por voto."""

        votacion = self._votacion_relevante()
        if contexto is None or votacion is None:
            return None
        revelado_desde = votacion.fecha_hora_apertura + timedelta(
            seconds=contexto.configuracion.moderacion_revelado_votos_segundos
        )
        revelados = generado_en >= revelado_desde
        votos = self._votos_moderacion(contexto, votacion) if revelados else None
        conteos = self._conteos(votacion) if revelados else None
        presidencial = votacion.voto_desempate
        return VotacionModeracion(
            id=votacion.id,
            numero_votacion=votacion.numero_votacion,
            tipo=votacion.tipo,
            tema=votacion.tema,
            tipo_mayoria=votacion.tipo_mayoria.value,
            factor=votacion.factor,
            base=votacion.base.value,
            estado_recepcion=votacion.estado.value,
            resultado=votacion.resultado.value if votacion.resultado is not None else None,
            fecha_hora_apertura=votacion.fecha_hora_apertura,
            fecha_hora_cierre=votacion.fecha_hora_cierre,
            fecha_hora_resultado=votacion.fecha_hora_resultado,
            motivo_finalizacion_manual=votacion.motivo_finalizacion_manual,
            cantidad_votos_recibidos=len(votacion.votos_ordinarios),
            revelado_individual_desde=revelado_desde,
            votos_individuales_revelados=revelados,
            votos_individuales=votos,
            conteos=conteos,
            voto_presidencial=(
                VotoPresidencialProyectado(
                    presidencia=presidencial.presidencia,
                    sentido=presidencial.sentido.value,
                )
                if presidencial is not None
                else None
            ),
        )

    def _votacion_publica(
        self,
        contexto: Preparacion | None,
        generado_en: datetime,
    ) -> VotacionPublica | None:
        """Omite votos EN_CURSO y expira solo los resultados finales."""

        votacion = self._votacion_relevante()
        if contexto is None or votacion is None:
            return None

        resultado_visible_hasta: datetime | None = None
        if votacion.resultado in (
            ResultadoVotacion.APROBADA,
            ResultadoVotacion.RECHAZADA,
            ResultadoVotacion.INCONCLUSA,
        ):
            disponible_desde = votacion.fecha_hora_resultado
            if disponible_desde is None:
                raise RuntimeError("Resultado final sin fecha de disponibilidad")
            resultado_visible_hasta = disponible_desde + timedelta(
                seconds=contexto.configuracion.recinto_resultado_publico_segundos
            )
            if generado_en >= resultado_visible_hasta:
                return None

        en_curso = votacion.estado is EstadoVotacion.EN_CURSO
        votos = None if en_curso else self._votos_publicos(contexto, votacion)
        conteos = None if en_curso else self._conteos(votacion)
        presidencial = votacion.voto_desempate
        # En el estado parcial EMPATADA + voto presidencial todavía no existe
        # un resultado final auditado. Omitir el sentido evita inferirlo en la
        # pantalla pública; Moderación sí ve el último hecho durable.
        exponer_presidencial = presidencial is not None and votacion.resultado in (
            ResultadoVotacion.APROBADA,
            ResultadoVotacion.RECHAZADA,
        )
        return VotacionPublica(
            id=votacion.id,
            numero_votacion=votacion.numero_votacion,
            tipo=votacion.tipo,
            tema=votacion.tema,
            tipo_mayoria=votacion.tipo_mayoria.value,
            factor=votacion.factor,
            base=votacion.base.value,
            estado_recepcion=votacion.estado.value,
            resultado=votacion.resultado.value if votacion.resultado is not None else None,
            fecha_hora_apertura=votacion.fecha_hora_apertura,
            fecha_hora_cierre=votacion.fecha_hora_cierre,
            cuenta_regresiva_hasta=(
                votacion.fecha_hora_apertura
                + timedelta(
                    seconds=contexto.configuracion.recinto_cuenta_regresiva_inicial_segundos
                )
                if en_curso
                else None
            ),
            resultado_visible_hasta=resultado_visible_hasta,
            votos_individuales=votos,
            conteos=conteos,
            voto_presidencial=(
                VotoPresidencialProyectado(
                    presidencia=presidencial.presidencia,
                    sentido=presidencial.sentido.value,
                )
                if exponer_presidencial and presidencial is not None
                else None
            ),
        )

    @staticmethod
    def _conteos(votacion: Votacion) -> ConteosVotosProyectados:
        """Deriva conteos de los votos ordinarios en el instante del snapshot."""

        conteos = votacion.contar_votos_ordinarios()
        return ConteosVotosProyectados(
            positivos=conteos.positivos,
            negativos=conteos.negativos,
            abstenciones=conteos.abstenciones,
            total=conteos.votos_emitidos,
        )

    @staticmethod
    def _buscar_concejal(contexto: Preparacion, dni: str) -> Concejal:
        """Resuelve un DNI contra el padrón congelado sin cache paralelo."""

        for concejal in contexto.padron.concejales:
            if concejal.dni == dni:
                return concejal
        raise RuntimeError(f"Voto o palabra con DNI ausente del padrón: {dni}")

    def _votos_moderacion(
        self,
        contexto: Preparacion,
        votacion: Votacion,
    ) -> tuple[VotoModeracion, ...]:
        """Ordena por banca los votos revelados y copia su identidad completa."""

        votos: list[VotoModeracion] = []
        for dni, voto in votacion.votos_ordinarios.items():
            concejal = self._buscar_concejal(contexto, dni)
            votos.append(
                VotoModeracion(
                    dni=dni,
                    nombre=concejal.nombre,
                    apellido=concejal.apellido,
                    banca=concejal.banca,
                    valor=voto.valor.value,
                )
            )
        return tuple(sorted(votos, key=lambda voto: voto.banca))

    def _votos_publicos(
        self,
        contexto: Preparacion,
        votacion: Votacion,
    ) -> tuple[VotoPublico, ...]:
        """Construye votos públicos sin transportar DNI ni objetos de dominio."""

        votos: list[VotoPublico] = []
        for dni, voto in votacion.votos_ordinarios.items():
            concejal = self._buscar_concejal(contexto, dni)
            votos.append(
                VotoPublico(
                    nombre=concejal.nombre,
                    apellido=concejal.apellido,
                    banca=concejal.banca,
                    valor=voto.valor.value,
                )
            )
        return tuple(sorted(votos, key=lambda voto: voto.banca))

    def _palabra_moderacion(
        self,
        sesion: Sesion | None,
        contexto: Preparacion | None,
    ) -> EstadoPalabraModeracion | None:
        """Copia FIFO y orador con identidad de Moderación."""

        if sesion is None or contexto is None:
            return None
        return EstadoPalabraModeracion(
            cola=tuple(
                self._persona_palabra_moderacion(contexto, dni) for dni in sesion.palabra.cola_dnis
            ),
            orador=(
                self._persona_palabra_moderacion(contexto, sesion.palabra.orador_dni)
                if sesion.palabra.orador_dni is not None
                else None
            ),
        )

    def _palabra_publica(
        self,
        sesion: Sesion | None,
        contexto: Preparacion | None,
    ) -> EstadoPalabraPublico | None:
        """Copia FIFO y orador omitiendo DNI."""

        if sesion is None or contexto is None:
            return None
        return EstadoPalabraPublico(
            cola=tuple(
                self._persona_palabra_publica(contexto, dni) for dni in sesion.palabra.cola_dnis
            ),
            orador=(
                self._persona_palabra_publica(contexto, sesion.palabra.orador_dni)
                if sesion.palabra.orador_dni is not None
                else None
            ),
        )

    def _persona_palabra_moderacion(
        self,
        contexto: Preparacion,
        dni: str,
    ) -> PersonaPalabraModeracion:
        """Resuelve una identidad interna para la cola de Moderación."""

        concejal = self._buscar_concejal(contexto, dni)
        return PersonaPalabraModeracion(
            dni=dni,
            nombre=concejal.nombre,
            apellido=concejal.apellido,
            banca=concejal.banca,
        )

    def _persona_palabra_publica(
        self,
        contexto: Preparacion,
        dni: str,
    ) -> PersonaPalabraPublica:
        """Resuelve una identidad segura para la cola pública."""

        concejal = self._buscar_concejal(contexto, dni)
        return PersonaPalabraPublica(
            nombre=concejal.nombre,
            apellido=concejal.apellido,
            banca=concejal.banca,
        )

    @staticmethod
    def _orden_del_dia(
        contexto: Preparacion | None,
    ) -> tuple[PuntoOrdenDelDiaProyectado, ...]:
        """Copia la colección temporal o devuelve una colección vacía."""

        if contexto is None or contexto.orden_del_dia is None:
            return ()
        return tuple(
            PuntoOrdenDelDiaProyectado(
                nro_votacion=punto.nro_votacion,
                tipo=punto.tipo,
                tema=punto.tema,
                tipo_mayoria=punto.tipo_mayoria.value,
                factor=punto.factor,
                base=punto.base.value,
            )
            for punto in contexto.orden_del_dia
        )

    @staticmethod
    def _eventos(contexto: Preparacion | None) -> tuple[EventoRecienteProyectado, ...]:
        """Copia hasta 200 eventos confirmados del escritor activo."""

        if contexto is None:
            return ()
        return tuple(
            ServicioProyecciones._evento(evento)
            for evento in contexto.escritor_auditoria.eventos_recientes
        )

    @staticmethod
    def _evento(evento: EventoAuditoriaReciente) -> EventoRecienteProyectado:
        """Traduce las seis dimensiones canónicas sin reinterpretarlas."""

        return EventoRecienteProyectado(
            seq=evento.secuencia,
            timestamp=evento.timestamp,
            nivel=evento.nivel.value,
            etiqueta=evento.etiqueta,
            codigo_evento=evento.codigo_evento,
            mensaje=evento.mensaje,
        )

    @staticmethod
    def _auditoria(contexto: Preparacion | None) -> EstadoAuditoriaProyectado:
        """Distingue ausencia normal de contexto y fallo técnico activo."""

        if contexto is None:
            return EstadoAuditoriaProyectado(
                activa=False,
                disponible=True,
                fallado=False,
                cerrado=False,
                motivo=None,
            )
        escritor = contexto.escritor_auditoria
        disponible = not escritor.fallado and not escritor.cerrado
        motivo = None
        if escritor.fallado:
            motivo = "AUDITORIA_NO_DISPONIBLE"
        elif escritor.cerrado:
            motivo = "AUDITORIA_CERRADA"
        return EstadoAuditoriaProyectado(
            activa=True,
            disponible=disponible,
            fallado=escritor.fallado,
            cerrado=escritor.cerrado,
            motivo=motivo,
        )

    @staticmethod
    def _remapeo(operacion: OperacionRemapeo | None) -> EstadoRemapeoModeracion | None:
        """Copia el submodelo sin incorporarlo a la allowlist de Recinto."""

        if operacion is None:
            return None
        return EstadoRemapeoModeracion(
            remapeo_id=operacion.remapeo_id,
            dispositivo=operacion.dispositivo,
            estado=operacion.estado.value,
            fingerprint_anterior=operacion.fingerprint_anterior,
            candidato=operacion.candidato,
            diagnostico=operacion.diagnostico,
        )

    def _capacidades(self, contexto: Preparacion | None) -> CapacidadesModeracion:
        """Evalúa solo precondiciones que ya existen en el estado actual."""

        estado = self._estado.estado_global
        sesion = self._estado.sesion_activa
        votacion = self._estado.votacion_activa
        auditoria_no_disponible = contexto is not None and (
            contexto.escritor_auditoria.fallado or contexto.escritor_auditoria.cerrado
        )

        def motivos_estado(*estados_permitidos: EstadoGlobal) -> list[str]:
            return [] if estado in estados_permitidos else ["ESTADO_INCOMPATIBLE"]

        def mutante(motivos: list[str]) -> Capacidad:
            if auditoria_no_disponible and "AUDITORIA_NO_DISPONIBLE" not in motivos:
                motivos.append("AUDITORIA_NO_DISPONIBLE")
            return Capacidad(habilitada=not motivos, motivos=tuple(motivos))

        motivos_abrir_sesion = motivos_estado(EstadoGlobal.PREPARANDO)
        if estado is EstadoGlobal.PREPARANDO and contexto is not None:
            if not contexto.quorum_alcanzado():
                motivos_abrir_sesion.append("QUORUM_INSUFICIENTE")
            if contexto.numero_sesion is None:
                motivos_abrir_sesion.append("NUMERO_SESION_REQUERIDO")
            if contexto.presidencia is None:
                motivos_abrir_sesion.append("PRESIDENCIA_REQUERIDA")
            if contexto.secretaria_legislativa is None:
                motivos_abrir_sesion.append("SECRETARIA_LEGISLATIVA_REQUERIDA")

        motivos_cerrar = motivos_estado(EstadoGlobal.SESION_ABIERTA)
        if (
            estado is EstadoGlobal.SESION_ABIERTA
            and votacion is not None
            and votacion.estado is EstadoVotacion.CERRADA
            and votacion.resultado is None
        ):
            motivos_cerrar.append("VOTACION_PENDIENTE")

        motivos_abrir_votacion = motivos_estado(EstadoGlobal.SESION_ABIERTA)
        if estado is EstadoGlobal.SESION_ABIERTA and sesion is not None:
            if not sesion.contexto_operativo.quorum_alcanzado():
                motivos_abrir_votacion.append("QUORUM_INSUFICIENTE")
            if votacion is not None:
                motivos_abrir_votacion.append("VOTACION_PENDIENTE")

        motivos_finalizar = motivos_estado(EstadoGlobal.SESION_ABIERTA)
        if estado is EstadoGlobal.SESION_ABIERTA and (
            votacion is None
            or votacion.estado is not EstadoVotacion.EN_CURSO
            or votacion.resultado is not None
        ):
            motivos_finalizar.append("VOTACION_NO_EN_CURSO")

        motivos_desempatar = motivos_estado(EstadoGlobal.SESION_ABIERTA)
        if estado is EstadoGlobal.SESION_ABIERTA:
            if (
                votacion is None
                or votacion.estado is not EstadoVotacion.CERRADA
                or votacion.resultado is not ResultadoVotacion.EMPATADA
                or votacion.tipo_mayoria is not TipoMayoria.SIMPLE
            ):
                motivos_desempatar.append("VOTACION_NO_EMPATADA")
            elif votacion.voto_desempate is not None:
                motivos_desempatar.append("DESEMPATE_YA_EMITIDO")

        return CapacidadesModeracion(
            preparar_sala=mutante(motivos_estado(EstadoGlobal.SIN_PREPARAR)),
            actualizar_preparacion=mutante(motivos_estado(EstadoGlobal.PREPARANDO)),
            cancelar_preparacion=mutante(motivos_estado(EstadoGlobal.PREPARANDO)),
            abrir_sesion=mutante(motivos_abrir_sesion),
            actualizar_sesion=mutante(motivos_estado(EstadoGlobal.SESION_ABIERTA)),
            cerrar_sesion=mutante(motivos_cerrar),
            cargar_orden_del_dia=mutante(
                motivos_estado(EstadoGlobal.PREPARANDO, EstadoGlobal.SESION_ABIERTA)
            ),
            descartar_orden_del_dia=mutante(
                motivos_estado(EstadoGlobal.PREPARANDO, EstadoGlobal.SESION_ABIERTA)
            ),
            abrir_votacion=mutante(motivos_abrir_votacion),
            finalizar_votacion=mutante(motivos_finalizar),
            desempatar=mutante(motivos_desempatar),
            otorgar_palabra=mutante(motivos_estado(EstadoGlobal.SESION_ABIERTA)),
            quitar_palabra=mutante(motivos_estado(EstadoGlobal.SESION_ABIERTA)),
        )
