"""Fixtures y ayudas compartidas para las pruebas de configuración y padrón (WP-003).

Este archivo centraliza tres cosas que los dos archivos de prueba repiten:

- el texto del ``system.toml`` canónico y las líneas que los tests reemplazan
  para fabricar variantes inválidas;
- la construcción del padrón de fantasía de 12 concejales;
- ``configuracion_de_prueba``, que arma una ``ConfiguracionSistema`` directa
  (sin pasar por el TOML) cuando el test solo se ocupa de validar el padrón.

Los datos son ficticios: ningún nombre, DNI, bloque o ruta corresponde a una
persona real (restricción del WP-003 sobre fixtures versionados).
"""

from __future__ import annotations

import csv
from pathlib import Path

import pytest
from botonera2_backend.configuracion.cargar_configuracion import cargar_configuracion_sistema
from botonera2_backend.configuracion.modelos import ConfiguracionSistema

# Encabezado canónico exacto del padrón aprobado en WP-003.
ENCABEZADO_CANONICO = "dni,nombre,apellido,bloque,banca,dispositivo_votacion,ruta_imagen"

# Líneas del system.toml canónico. Se exponen como constantes para que los
# tests armen variantes inválidas con ``replace`` sin duplicar el TOML entero.
LINEA_QUORUM = "quorum = 7"
LINEA_ROWS = "rows = [3, 4, 5]"
LINEA_TYPES = (
    'types = ["Ratificación", "Despacho OP", "Despacho Gob", "Despacho AS", '
    '"Despacho HA", "Despacho Eco", "Mocion", "P. Sobre Tabla", "Otro"]'
)
LINEA_TIMER_REVELADO = "moderation_vote_reveal_seconds = 4"
LINEA_TIMER_CUENTA_REGRESIVA = "public_initial_countdown_seconds = 4"
LINEA_TIMER_RESULTADO = "public_result_display_seconds = 6"
LINEA_LOGS = 'logs_dir = "logs"'

TOML_CANONICO = f"""[session]
{LINEA_QUORUM}

[room]
{LINEA_ROWS}

[voting]
{LINEA_TYPES}

[timers]
{LINEA_TIMER_REVELADO}
{LINEA_TIMER_CUENTA_REGRESIVA}
{LINEA_TIMER_RESULTADO}

[paths]
{LINEA_LOGS}
"""

# Nombres de fantasía para el padrón de prueba. Dos filas dejan el bloque
# vacío (fila 5 y 9) para demostrar que el bloque vacío es válido (CA-003).
NOMBRES_FANTASIA: tuple[tuple[str, str], ...] = (
    ("Ana", "Garcia"),
    ("Bruno", "Martinez"),
    ("Carla", "Rodriguez"),
    ("Diego", "Fernandez"),
    ("Elsa", "Moreno"),
    ("Facundo", "Silva"),
    ("Gisela", "Lopez"),
    ("Hugo", "Alvarez"),
    ("Irene", "Suarez"),
    ("Javier", "Ortiz"),
    ("Laura", "Pereyra"),
    ("Marcos", "Torres"),
)


def escribir_system_toml(ruta: Path, contenido: str) -> Path:
    """Escribe un ``system.toml`` en ``ruta`` y la devuelve para encadenar."""
    ruta.write_text(contenido, encoding="utf-8")
    return ruta


def escribir_padron(
    ruta: Path,
    filas: list[list[str]],
    *,
    encabezado: list[str] | None = None,
) -> Path:
    """Escribe un CSV de padrón usando ``csv.writer`` (respeta comillas).

    Por defecto usa el encabezado canónico; pasar ``encabezado`` permite
    fabricar archivos con el formato histórico (con ``presente``) o con
    columnas reordenadas para probar su rechazo.
    """
    with ruta.open("w", encoding="utf-8-sig", newline="") as archivo:
        escritor = csv.writer(archivo)
        escritor.writerow(encabezado or ENCABEZADO_CANONICO.split(","))
        escritor.writerows(filas)
    return ruta


def filas_padron_valido() -> list[list[str]]:
    """Devuelve 12 filas ficticias válidas para la capacidad canónica (12).

    Cada llamada construye una lista nueva: los tests pueden modificarla sin
    contaminar los demás escenarios.
    """
    filas: list[list[str]] = []
    for numero, (nombre, apellido) in enumerate(NOMBRES_FANTASIA, start=1):
        # El bloque queda vacío en las filas 5 y 9 para probar que es válido.
        bloque = "" if numero in (5, 9) else f"Bloque {((numero - 1) % 3) + 1}"
        filas.append(
            [
                f"3000000{numero}",
                nombre,
                apellido,
                bloque,
                str(numero),
                f"D-{numero:02d}",
                f"assets/bancas/banca-{numero:02d}.png",
            ]
        )
    return filas


def configuracion_de_prueba(*, filas_bancas: tuple[int, ...] = (3, 4, 5)) -> ConfiguracionSistema:
    """Construye una configuración válida directamente, sin leer TOML.

    Los tests de padrón no necesitan pasar por ``system.toml``: les alcanza
    esta configuración para conocer la capacidad del recinto.
    """
    return ConfiguracionSistema(
        quorum=7,
        filas_bancas=filas_bancas,
        tipos_votacion=("Ratificación", "Otro"),
        moderacion_revelado_votos_segundos=4,
        recinto_cuenta_regresiva_inicial_segundos=4,
        recinto_resultado_publico_segundos=6,
        directorio_registros="logs",
    )


@pytest.fixture
def ruta_system_toml_valido(tmp_path: Path) -> Path:
    """Escribe el TOML canónico y devuelve su ruta."""
    return escribir_system_toml(tmp_path / "system.toml", TOML_CANONICO)


@pytest.fixture
def configuracion_valida(ruta_system_toml_valido: Path) -> ConfiguracionSistema:
    """Configuración cargada desde el TOML canónico, tal como operaría WP-005."""
    return cargar_configuracion_sistema(ruta_system_toml_valido)


@pytest.fixture
def ruta_padron_valido(tmp_path: Path) -> Path:
    """Escribe el padrón de fantasía completo y devuelve su ruta."""
    return escribir_padron(tmp_path / "concejales.csv", filas_padron_valido())
