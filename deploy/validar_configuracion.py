"""Valida configuración productiva con los parsers propietarios instalados."""

from __future__ import annotations

import argparse
from collections.abc import Sequence
from pathlib import Path

from botonera2_backend.configuracion.cargar_configuracion import cargar_configuracion_sistema
from botonera2_backend.configuracion.cargar_padron import cargar_padron_concejales
from botonera2_device_bridge.configuracion import cargar_dispositivos_json


def validar(raiz: Path) -> None:
    """Carga los tres contratos y exige que auditoría resuelva fuera de release."""

    configuracion = cargar_configuracion_sistema(raiz / "config/system.toml")
    cargar_padron_concejales(raiz / "config/concejales.csv", configuracion)
    cargar_dispositivos_json(raiz / "config/bridge/devices.json")

    ruta_configurada = Path(configuracion.directorio_registros)
    if not ruta_configurada.is_absolute():
        ruta_configurada = raiz / ruta_configurada
    esperado = (raiz / "logs").resolve()
    real = ruta_configurada.resolve()
    if real != esperado:
        raise ValueError(f"logs_dir debe resolver a {esperado} y resolvió a {real}")


def main(argumentos: Sequence[str] | None = None) -> int:
    """Expone la validación como subprocess aislado del CLI administrativo."""

    parser = argparse.ArgumentParser()
    parser.add_argument("raiz", type=Path)
    opciones = parser.parse_args(argumentos)
    validar(opciones.raiz.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
