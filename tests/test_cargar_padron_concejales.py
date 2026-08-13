"""Pruebas unitarias de carga y validación de ``config/concejales.csv`` (WP-003).

Cubren el padrón válido, cada condición bloqueante de CA-003 (campos vacíos,
duplicados, bancas inválidas, ``ruta_imagen`` externa), el rechazo del
encabezado histórico con ``presente``, la correspondencia exacta
padrón/disposición (RN-CON-04) y el congelamiento del snapshot.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from botonera2_backend.configuracion.cargar_padron import cargar_padron_concejales
from botonera2_backend.configuracion.errores import ErrorPadronInvalido
from conftest import (
    ENCABEZADO_CANONICO,
    configuracion_de_prueba,
    escribir_padron,
    filas_padron_valido,
)

# Ruta del padrón canónico versionado en el repositorio, para el test de
# coherencia entre los archivos de ejemplo y el contrato del WP.
RUTA_PADRON_REPO = Path(__file__).parents[1] / "config" / "concejales.csv"
RUTA_TOML_REPO = Path(__file__).parents[1] / "config" / "system.toml"


def test_carga_el_padron_valido_con_sus_asociaciones(ruta_padron_valido: Path) -> None:
    """El padrón canónico de 12 concejales carga completo y congelado."""
    padron = cargar_padron_concejales(ruta_padron_valido, configuracion_de_prueba())

    assert len(padron.concejales) == 12
    assert isinstance(padron.concejales, tuple)

    # El DNI es identidad textual (RN-CON-01): se conserva como texto.
    primero = padron.concejales[0]
    assert primero.dni == "30000001"
    assert primero.nombre == "Ana"
    assert primero.apellido == "Garcia"
    assert primero.bloque == "Bloque 1"
    assert primero.banca == 1
    assert primero.dispositivo_votacion == "D-01"
    assert primero.ruta_imagen == "assets/bancas/banca-01.png"

    # El orden de las filas se preserva (RN-CON-04 y disposición).
    assert [concejal.banca for concejal in padron.concejales] == list(range(1, 13))
    assert [concejal.dispositivo_votacion for concejal in padron.concejales] == [
        f"D-{numero:02d}" for numero in range(1, 13)
    ]

    # La ruta de imagen queda disponible por concejal, sin hardcode por banca.
    assert padron.concejales[11].ruta_imagen == "assets/bancas/banca-12.png"


def test_acepta_bloque_vacio(ruta_padron_valido: Path) -> None:
    """El bloque vacío es válido (CA-003): las filas 5 y 9 no tienen bloque."""
    padron = cargar_padron_concejales(ruta_padron_valido, configuracion_de_prueba())

    assert padron.concejales[4].bloque == ""
    assert padron.concejales[8].bloque == ""


@pytest.mark.parametrize(
    "encabezado",
    [
        ENCABEZADO_CANONICO.split(",") + ["presente"],
        ENCABEZADO_CANONICO.split(",")[:-1],
        ["dni", "nombre", "apellido", "bloque", "banca", "ruta_imagen", "dispositivo_votacion"],
        ["DNI", "Nombre", "Apellido", "Bloque", "Banca", "Dispositivo", "Ruta"],
    ],
    ids=[
        "con-presente-historico",
        "columna-faltante",
        "columnas-reordenadas",
        "mayusculas-distintas",
    ],
)
def test_rechaza_encabezado_distinto_del_canonico(tmp_path: Path, encabezado: list[str]) -> None:
    """El encabezado debe ser exactamente el canónico.

    El formato histórico con ``presente`` no se acepta silenciosamente como
    el nuevo contrato: tampoco columnas faltantes, reordenadas o renombradas.
    """
    ruta = escribir_padron(tmp_path / "padron.csv", filas_padron_valido(), encabezado=encabezado)

    with pytest.raises(ErrorPadronInvalido, match="encabezado"):
        cargar_padron_concejales(ruta, configuracion_de_prueba())


def test_rechaza_fila_con_cantidad_incorrecta_de_columnas(tmp_path: Path) -> None:
    """Una fila con más columnas que el encabezado se rechaza por integridad."""
    filas = filas_padron_valido()
    filas[3].append("columna-extra")
    ruta = escribir_padron(tmp_path / "padron.csv", filas)

    with pytest.raises(ErrorPadronInvalido, match="columnas"):
        cargar_padron_concejales(ruta, configuracion_de_prueba())


@pytest.mark.parametrize(
    ("indice_columna", "valor_invalido", "fragmento"),
    [
        (0, "", "dni"),
        (1, "", "nombre"),
        (2, "", "apellido"),
        (4, "", "banca"),
        (4, "abc", "banca"),
        (4, "0", "entero positivo"),
        (4, "-2", "entero positivo"),
        (5, "", "dispositivo"),
        (6, "", "ruta_imagen"),
        (6, "https://servidor-ejemplo.com/logo.png", "ruta interna"),
        (6, "http://servidor-ejemplo.com/logo.png", "ruta interna"),
        (6, "ftp://servidor-ejemplo.com/logo.png", "ruta interna"),
        (6, "//servidor-ejemplo.com/logo.png", "ruta interna"),
    ],
    ids=[
        "dni-vacio",
        "nombre-vacio",
        "apellido-vacio",
        "banca-vacia",
        "banca-no-numerica",
        "banca-cero",
        "banca-negativa",
        "dispositivo-vacio",
        "ruta-imagen-vacia",
        "ruta-https",
        "ruta-http",
        "ruta-ftp",
        "ruta-protocolo-relativo",
    ],
)
def test_rechaza_fila_con_campo_bloqueante(
    tmp_path: Path, indice_columna: int, valor_invalido: str, fragmento: str
) -> None:
    """Cada condición bloqueante de CA-003 rechaza la carga con mensaje claro.

    El error es determinista e incluye el número de fila para corregir el
    archivo; aquí solo se verifica el fragmento del mensaje.
    """
    filas = filas_padron_valido()
    filas[3][indice_columna] = valor_invalido
    ruta = escribir_padron(tmp_path / "padron.csv", filas)

    with pytest.raises(ErrorPadronInvalido, match=fragmento):
        cargar_padron_concejales(ruta, configuracion_de_prueba())


@pytest.mark.parametrize(
    "indice_columna",
    [0, 4, 5],
    ids=["dni-duplicado", "banca-duplicada", "dispositivo-duplicado"],
)
def test_rechaza_campos_duplicados(tmp_path: Path, indice_columna: int) -> None:
    """DNI, banca y dispositivo de votación deben ser únicos (RN-CON-03).

    La fila 5 (índice 4) adopta el DNI/banca/dispositivo de la fila 4
    (índice 3): el duplicado aparece en orden de filas y se rechaza.
    """
    filas = filas_padron_valido()
    filas[4][indice_columna] = filas[3][indice_columna]
    ruta = escribir_padron(tmp_path / "padron.csv", filas)

    with pytest.raises(ErrorPadronInvalido, match="duplicad"):
        cargar_padron_concejales(ruta, configuracion_de_prueba())


def test_rechaza_cantidad_menor_que_la_capacidad(tmp_path: Path) -> None:
    """Menos concejales que la capacidad rompe la correspondencia exacta."""
    ruta = escribir_padron(tmp_path / "padron.csv", filas_padron_valido()[:11])

    with pytest.raises(ErrorPadronInvalido, match="cantidad de concejales"):
        cargar_padron_concejales(ruta, configuracion_de_prueba())


def test_rechaza_cantidad_mayor_que_la_capacidad(tmp_path: Path) -> None:
    """Con más filas que bancas el padrón siempre es rechazado.

    Con capacidad 12 y 13 filas no existe una combinación de bancas válida:
    o una banca supera la capacidad o se repite. La validación por fila
    alcanza primero y el padrón se rechaza; la regla de cantidad exacta
    (RN-CON-04) queda cubierta junto con unicidad y rango.
    """
    filas = filas_padron_valido()
    filas.append(["30000013", "Nuevo", "Concejal", "", "13", "D-13", "assets/bancas/banca-13.png"])
    ruta = escribir_padron(tmp_path / "padron.csv", filas)

    with pytest.raises(ErrorPadronInvalido):
        cargar_padron_concejales(ruta, configuracion_de_prueba())


def test_rechaza_banca_fuera_de_la_capacidad(tmp_path: Path) -> None:
    """Una banca mayor que la capacidad configurada se rechaza por fila."""
    filas = filas_padron_valido()
    filas[11][4] = "13"
    ruta = escribir_padron(tmp_path / "padron.csv", filas)

    with pytest.raises(ErrorPadronInvalido, match="excede la capacidad"):
        cargar_padron_concejales(ruta, configuracion_de_prueba())


def test_rechaza_hueco_en_la_cobertura_de_bancas(tmp_path: Path) -> None:
    """Un padrón que no cubre todas las bancas se rechaza.

    Con capacidad 3 y bancas 1, 2 y 4 falta la banca 3 y sobra la 4: el hueco
    siempre se observa como fuera de rango (o duplicado), porque con cantidad
    exacta y unicidad la cobertura completa queda garantizada.
    """
    configuracion = configuracion_de_prueba(filas_bancas=(3,))
    filas = filas_padron_valido()[:3]
    filas[2][4] = "4"
    ruta = escribir_padron(tmp_path / "padron.csv", filas)

    with pytest.raises(ErrorPadronInvalido, match="excede la capacidad"):
        cargar_padron_concejales(ruta, configuracion)


def test_rechaza_archivo_inexistente(tmp_path: Path) -> None:
    """Un padrón que no existe se reporta como error de carga."""
    with pytest.raises(ErrorPadronInvalido, match="no se pudo leer"):
        cargar_padron_concejales(tmp_path / "no-existe.csv", configuracion_de_prueba())


def test_cambiar_el_padron_en_disco_no_modifica_el_snapshot_cargado(tmp_path: Path) -> None:
    """Congelamiento del padrón (RN-CON-07 y CA-059).

    Se carga el padrón, se reescribe el archivo con otro DNI en la primera
    fila y el snapshot conserva sus valores originales; una recarga nueva
    obtiene los valores actualizados.
    """
    ruta = escribir_padron(tmp_path / "padron.csv", filas_padron_valido())
    padron = cargar_padron_concejales(ruta, configuracion_de_prueba())

    filas_nuevas = filas_padron_valido()
    filas_nuevas[0][0] = "99999999"
    escribir_padron(ruta, filas_nuevas)

    assert padron.concejales[0].dni == "30000001"
    padron_recargado = cargar_padron_concejales(ruta, configuracion_de_prueba())
    assert padron_recargado.concejales[0].dni == "99999999"
    assert padron.concejales[0].dni == "30000001"


def test_los_archivos_canonicos_del_repositorio_cargan_juntos() -> None:
    """Los ejemplos versionados cumplen el contrato completo de WP-003.

    Este test integra las dos cargas: la configuración real de
    ``config/system.toml`` y el padrón real de ``config/concejales.csv``
    deben ser compatibles entre sí (12 bancas, 12 concejales, sin duplicados).
    """
    from botonera2_backend.configuracion.cargar_configuracion import cargar_configuracion_sistema

    configuracion = cargar_configuracion_sistema(RUTA_TOML_REPO)
    padron = cargar_padron_concejales(RUTA_PADRON_REPO, configuracion)

    assert configuracion.capacidad_total == 12
    assert len(padron.concejales) == 12
    assert {concejal.banca for concejal in padron.concejales} == set(range(1, 13))
