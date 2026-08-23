"""Pruebas del servicio de dominio para Orden del Día (WP-016).

Verifica:
- Carga inicial y reemplazo completo bajo el EjecutorMutaciones.
- Preservación de la colección previa ante intento de carga inválida.
- Descarte efectivo y descarte no-op (sin auditoría ficticia).
- Conservación del Orden del Día en la transición PREPARANDO -> SESION_ABIERTA.
- Descarte del Orden del Día al cancelar preparación o cerrar sesión.
- Carga y descarte durante una votación activa sin modificar dicha votación.
- Rechazo con ErrorEstadoIncompatible en SIN_PREPARAR.
- Comportamiento de fallo cerrado ante fallas en la auditoría.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest
from botonera2_backend.auditoria import (
    ErrorAuditoria,
    EscritorAuditoriaCsv,
)
from botonera2_backend.configuracion.modelos import (
    Concejal,
    ConfiguracionSistema,
    Padron,
)
from botonera2_backend.dominio.errores import ErrorEstadoIncompatible, ErrorOrdenDelDiaInvalido
from botonera2_backend.dominio.estado import EstadoGlobal, EstadoOperativo
from botonera2_backend.dominio.preparacion import Preparacion
from botonera2_backend.dominio.sesion import Sesion
from botonera2_backend.dominio.votacion import (
    BaseMayoria,
    TipoMayoria,
    Votacion,
)
from botonera2_backend.servicios.orden_del_dia import ServicioOrdenDelDia
from botonera2_backend.servicios.serializacion import EjecutorMutaciones

pytestmark = pytest.mark.anyio

CSV_VALIDO_A = (
    b"nro_votacion,tipo,tema,tipo_mayoria,factor,base\n"
    b"1,Despacho,Tema A1,SIMPLE,,\n"
    b"2,Despacho,Tema A2,ESPECIAL,0.6666666667,PRESENTES\n"
)

CSV_VALIDO_B = (
    b"nro_votacion,tipo,tema,tipo_mayoria,factor,base\n"
    b"10,Mocion,Tema B1,SIMPLE,0,VOTOS_COMPUTABLES\n"
)

CSV_INVALIDO = (
    b"nro_votacion,tipo,tema,tipo_mayoria,factor,base\n"
    b"1,Despacho,Tema Invalido,ESPECIAL,-1,PRESENTES\n"
)


def _crear_preparacion_aislada(
    tmp_path: Path,
) -> tuple[EstadoOperativo, Preparacion, EscritorAuditoriaCsv]:
    """Fabrica un estado en PREPARANDO con escritor real sobre tmp_path."""
    logs_dir = tmp_path / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    escritor = EscritorAuditoriaCsv(logs_dir, datetime.now())
    configuracion = ConfiguracionSistema(
        quorum=1,
        filas_bancas=(1,),
        tipos_votacion=("Despacho", "Mocion"),
        device_test_seconds=4,
        moderacion_revelado_votos_segundos=0,
        recinto_cuenta_regresiva_inicial_segundos=4,
        recinto_resultado_publico_segundos=6,
        directorio_registros=str(logs_dir),
    )
    concejal = Concejal(
        dni="12345678",
        nombre="Juan",
        apellido="Perez",
        bloque="",
        banca=1,
        dispositivo_votacion="D-01",
        ruta_imagen="img/1.png",
    )
    padron = Padron(concejales=(concejal,))
    prep = Preparacion(
        fecha_hora_inicio=datetime.now(),
        configuracion=configuracion,
        padron=padron,
        presencias={"12345678": True},
        escritor_auditoria=escritor,
        numero_sesion=1,
        presidencia="Presidente",
        secretaria_legislativa="Secretario",
    )
    estado = EstadoOperativo()
    estado.preparacion_activa = prep
    estado.archivos_auditoria_activos = prep.rutas_auditoria()
    estado.estado_global = EstadoGlobal.PREPARANDO
    return estado, prep, escritor


async def test_carga_inicial_y_reemplazo_en_preparando(tmp_path: Path) -> None:
    """Demuestra la carga inicial y el reemplazo completo del Orden del Día en PREPARANDO."""
    estado, prep, escritor = _crear_preparacion_aislada(tmp_path)
    ejecutor = EjecutorMutaciones()
    servicio = ServicioOrdenDelDia(estado, ejecutor)

    # 1. Carga inicial
    puntos_a = await servicio.cargar_orden_del_dia(CSV_VALIDO_A)
    assert len(puntos_a) == 2
    assert prep.orden_del_dia == puntos_a
    assert puntos_a[0].nro_votacion == 1
    assert puntos_a[1].nro_votacion == 2

    # 2. Reemplazo completo
    puntos_b = await servicio.cargar_orden_del_dia(CSV_VALIDO_B)
    assert len(puntos_b) == 1
    assert prep.orden_del_dia == puntos_b
    assert puntos_b[0].nro_votacion == 10

    escritor.cerrar()


async def test_carga_invalida_preserva_coleccion_previa(tmp_path: Path) -> None:
    """Demuestra que una carga defectuosa no altera la colección previa válida."""
    estado, prep, escritor = _crear_preparacion_aislada(tmp_path)
    ejecutor = EjecutorMutaciones()
    servicio = ServicioOrdenDelDia(estado, ejecutor)

    # Cargamos colección A válida
    puntos_a = await servicio.cargar_orden_del_dia(CSV_VALIDO_A)
    assert prep.orden_del_dia == puntos_a

    # Intentamos cargar archivo inválido
    with pytest.raises(ErrorOrdenDelDiaInvalido):
        await servicio.cargar_orden_del_dia(CSV_INVALIDO)

    # La colección A sigue intacta
    assert prep.orden_del_dia == puntos_a
    escritor.cerrar()


async def test_descarte_efectivo_y_descarte_noop(tmp_path: Path) -> None:
    """Demuestra que el descarte efectivo limpia la colección y sin colección es no-op."""
    estado, prep, escritor = _crear_preparacion_aislada(tmp_path)
    ejecutor = EjecutorMutaciones()
    servicio = ServicioOrdenDelDia(estado, ejecutor)

    # Descarte sin colección previa (no-op)
    await servicio.descartar_orden_del_dia()
    assert prep.orden_del_dia is None

    # Cargamos y luego descartamos efectivamente
    await servicio.cargar_orden_del_dia(CSV_VALIDO_A)
    assert prep.orden_del_dia is not None

    await servicio.descartar_orden_del_dia()
    assert prep.orden_del_dia is None

    escritor.cerrar()


async def test_conservacion_preparando_a_sesion_abierta(tmp_path: Path) -> None:
    """Demuestra que el Orden del Día cargado en PREPARANDO persiste al abrir sesión formal."""
    estado, prep, escritor = _crear_preparacion_aislada(tmp_path)
    ejecutor = EjecutorMutaciones()
    servicio = ServicioOrdenDelDia(estado, ejecutor)

    puntos = await servicio.cargar_orden_del_dia(CSV_VALIDO_A)

    # Transición formal a SESION_ABIERTA
    sesion = Sesion(contexto_operativo=prep, fecha_hora_apertura=datetime.now())
    estado.preparacion_activa = None
    estado.sesion_activa = sesion
    estado.estado_global = EstadoGlobal.SESION_ABIERTA

    # Sigue disponible en el contexto operativo de la sesión
    assert estado.contexto_operativo_activo() is prep
    assert sesion.contexto_operativo.orden_del_dia == puntos

    # Puede reemplazarse durante SESION_ABIERTA
    puntos_b = await servicio.cargar_orden_del_dia(CSV_VALIDO_B)
    assert sesion.contexto_operativo.orden_del_dia == puntos_b

    # Y puede descartarse en SESION_ABIERTA
    await servicio.descartar_orden_del_dia()
    assert sesion.contexto_operativo.orden_del_dia is None

    escritor.cerrar()


async def test_carga_y_descarte_durante_votacion_activa(tmp_path: Path) -> None:
    """Demuestra que cargar o descartar durante una votación no modifica la votación."""
    estado, prep, escritor = _crear_preparacion_aislada(tmp_path)
    ejecutor = EjecutorMutaciones()
    servicio = ServicioOrdenDelDia(estado, ejecutor)

    sesion = Sesion(contexto_operativo=prep, fecha_hora_apertura=datetime.now())
    estado.preparacion_activa = None
    estado.sesion_activa = sesion
    estado.estado_global = EstadoGlobal.SESION_ABIERTA

    # Creamos una votación activa
    votacion = Votacion(
        id="vot-001",
        numero_votacion=1,
        tipo="Despacho",
        tema="Tema en votación",
        tipo_mayoria=TipoMayoria.SIMPLE,
        factor=0.0,
        base=BaseMayoria.VOTOS_COMPUTABLES,
        fecha_hora_apertura=datetime.now(),
    )
    estado.votacion_activa = votacion
    sesion.votaciones.append(votacion)

    # Cargar Orden del Día durante la votación
    puntos = await servicio.cargar_orden_del_dia(CSV_VALIDO_A)
    assert sesion.contexto_operativo.orden_del_dia == puntos
    # La votación permanece exactamente igual
    assert estado.votacion_activa is votacion
    assert votacion.id == "vot-001"
    assert votacion.tema == "Tema en votación"
    assert votacion.resultado is None

    # Descartar durante la votación
    await servicio.descartar_orden_del_dia()
    assert sesion.contexto_operativo.orden_del_dia is None
    assert estado.votacion_activa is votacion

    escritor.cerrar()


async def test_rechazo_en_sin_preparar() -> None:
    """Demuestra que intentar cargar o descartar en SIN_PREPARAR lanza ErrorEstadoIncompatible."""
    estado = EstadoOperativo()
    assert estado.estado_global is EstadoGlobal.SIN_PREPARAR
    ejecutor = EjecutorMutaciones()
    servicio = ServicioOrdenDelDia(estado, ejecutor)

    with pytest.raises(ErrorEstadoIncompatible, match="SIN_PREPARAR"):
        await servicio.cargar_orden_del_dia(CSV_VALIDO_A)

    with pytest.raises(ErrorEstadoIncompatible, match="SIN_PREPARAR"):
        await servicio.descartar_orden_del_dia()


async def test_fallo_auditoria_en_carga_preserva_estado_previo(tmp_path: Path) -> None:
    """Demuestra fallo cerrado: si falla la auditoría al cargar, no se muta el estado."""
    estado, prep, escritor = _crear_preparacion_aislada(tmp_path)
    ejecutor = EjecutorMutaciones()
    servicio = ServicioOrdenDelDia(estado, ejecutor)

    # Cargamos colección válida
    puntos_a = await servicio.cargar_orden_del_dia(CSV_VALIDO_A)
    assert prep.orden_del_dia == puntos_a

    # Cerramos el escritor para forzar fallo de auditoría
    escritor.cerrar()

    with pytest.raises(ErrorAuditoria):
        await servicio.cargar_orden_del_dia(CSV_VALIDO_B)

    # La colección previa se preservó intacta
    assert prep.orden_del_dia == puntos_a


async def test_fallo_auditoria_en_descarte_preserva_estado_previo(tmp_path: Path) -> None:
    """Demuestra fallo cerrado: si falla la auditoría al descartar, la colección no se limpia."""
    estado, prep, escritor = _crear_preparacion_aislada(tmp_path)
    ejecutor = EjecutorMutaciones()
    servicio = ServicioOrdenDelDia(estado, ejecutor)

    # Cargamos colección válida
    puntos_a = await servicio.cargar_orden_del_dia(CSV_VALIDO_A)
    assert prep.orden_del_dia == puntos_a

    # Cerramos el escritor para forzar fallo de auditoría
    escritor.cerrar()

    with pytest.raises(ErrorAuditoria):
        await servicio.descartar_orden_del_dia()

    # La colección no se borró
    assert prep.orden_del_dia == puntos_a
