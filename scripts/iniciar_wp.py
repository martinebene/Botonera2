#!/usr/bin/env python3
"""Prepara un worktree aislado de Git y abre el agente asignado a un WP autorizado.

El lanzador genérico automatiza únicamente tareas mecánicas de Git para entornos
de terminal / SSH / Warp. La autorización continúa viviendo en el WP y en
``PLAN.md``: este programa nunca edita esos documentos, no crea PRs y no integra
ni despliega cambios.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

# Permitir ejecución directa como script añadiendo la raíz del repositorio a sys.path
_directorio_scripts = Path(__file__).resolve().parent
_directorio_raiz = _directorio_scripts.parent
if str(_directorio_raiz) not in sys.path:
    sys.path.insert(0, str(_directorio_raiz))

from scripts.comun_lanzador import (  # noqa: E402
    ErrorInicioWP,
    actualizar_main,
    crear_slug,
    ejecutar_git,
    leer_plan,
    leer_wp,
    listar_worktrees,
    normalizar_numero_wp,
    validar_autorizacion,
    validar_checkout_coordinador,
)

AGENTES_ADMITIDOS: tuple[str, ...] = ("codex", "claude", "opencode", "antigravity")

# Mapeo entre identificador lógico del agente en PLAN.md y posibles nombres de CLI local
MAPEO_EJECUTABLES_GENERICO: dict[str, tuple[str, ...]] = {
    "antigravity": ("agy", "antigravity"),
}


def resolver_ejecutable_agente_generico(agente: str) -> str | None:
    """Resuelve el ejecutable local en PATH para el agente solicitado en el entorno genérico.

    Parámetros:
        agente: Nombre del agente tal como figura en PLAN.md ('codex', 'antigravity', etc.).

    Retorna:
        Nombre del ejecutable encontrado en PATH, o None si ninguno está disponible.
    """
    candidatos = MAPEO_EJECUTABLES_GENERICO.get(agente, (agente,))
    for candidato in candidatos:
        if shutil.which(candidato) is not None:
            return candidato
    return None


def preparar_worktree(
    raiz: Path,
    numero_wp: str,
    titulo: str,
    referencia_base: str,
) -> tuple[Path, str, bool]:
    """Crea o reutiliza de forma inequívoca la rama y el worktree del WP mediante Git.

    No elimina rutas ni ramas. Una ruta ocupada o una rama ya asociada a otro
    worktree produce un error para que el operador pueda inspeccionarlo.

    Parámetros:
        raiz: Raíz del repositorio coordinador.
        numero_wp: Identificador normalizado de tres dígitos.
        titulo: Título del WP extraído de su archivo Markdown.
        referencia_base: Referencia de commit/rama desde la cual crear la rama (SHA de origin/main).

    Retorna:
        Tupla con (ruta_worktree, nombre_rama, fue_reutilizado).
    """
    rama = f"wp/{numero_wp}-{crear_slug(titulo)}"
    ruta_worktree = raiz.parent / f"{raiz.name}-wp{numero_wp}"
    worktrees = listar_worktrees(raiz)

    por_ruta = next((item for item in worktrees if item.ruta == ruta_worktree.resolve()), None)
    por_rama = next((item for item in worktrees if item.rama == rama), None)

    if por_ruta is not None:
        if por_ruta.rama != rama:
            raise ErrorInicioWP(
                f"La ruta {ruta_worktree} ya pertenece a la rama {por_ruta.rama!r}; no se modificó."
            )
        if por_rama is None or por_rama.ruta != ruta_worktree.resolve():
            raise ErrorInicioWP("La relación rama/worktree existente es ambigua; no se modificó.")
        return ruta_worktree, rama, True

    if por_rama is not None:
        raise ErrorInicioWP(
            f"La rama {rama} ya está abierta en {por_rama.ruta}; no se creó otro worktree."
        )
    if ruta_worktree.exists():
        raise ErrorInicioWP(f"La ruta destino {ruta_worktree} ya existe y Git no la administra.")

    rama_existe = (
        ejecutar_git(
            raiz, "show-ref", "--verify", "--quiet", f"refs/heads/{rama}", verificar=False
        ).returncode
        == 0
    )
    if rama_existe:
        ejecutar_git(raiz, "worktree", "add", str(ruta_worktree), rama)
    else:
        ejecutar_git(
            raiz,
            "worktree",
            "add",
            "-b",
            rama,
            str(ruta_worktree),
            referencia_base,
        )
    return ruta_worktree, rama, False


def crear_parser() -> argparse.ArgumentParser:
    """Define la interfaz de línea de comandos para el lanzador genérico."""
    parser = argparse.ArgumentParser(
        description="Prepara el worktree de un WP autorizado y abre su agente asignado."
    )
    parser.add_argument("wp", help="Número del Work Package, por ejemplo 002")
    parser.add_argument(
        "agente",
        choices=AGENTES_ADMITIDOS,
        help="CLI del agente asignado en PLAN.md",
    )
    return parser


def iniciar(argumentos: list[str] | None = None) -> int:
    """Coordina validaciones, actualización segura, worktree y lanzamiento del agente."""
    opciones = crear_parser().parse_args(argumentos)
    numero_wp = normalizar_numero_wp(opciones.wp)
    agente = opciones.agente
    raiz = Path.cwd().resolve()

    validar_checkout_coordinador(raiz)

    ejecutable = resolver_ejecutable_agente_generico(agente)
    if ejecutable is None:
        if agente == "antigravity":
            detalle = "La CLI 'agy' (o 'antigravity') no está instalada o no figura en PATH"
        else:
            detalle = f"La CLI {agente!r} no está instalada o no figura en PATH"
        raise ErrorInicioWP(f"{detalle}; no se creó ningún worktree.")

    referencia_base = actualizar_main(raiz)
    _, titulo, dependencias = leer_wp(raiz, numero_wp)
    validar_autorizacion(numero_wp, agente, dependencias, leer_plan(raiz))
    ruta_worktree, rama, reutilizado = preparar_worktree(raiz, numero_wp, titulo, referencia_base)

    accion = "Reutilizando" if reutilizado else "Creado"
    print(f"{accion} {ruta_worktree} con la rama {rama}.")
    print(f"Abriendo {ejecutable} dentro del worktree autorizado...")
    resultado = subprocess.run([ejecutable], cwd=ruta_worktree, check=False)
    if resultado.returncode != 0:
        raise ErrorInicioWP(
            f"La CLI {ejecutable!r} terminó con código {resultado.returncode}; "
            "la rama y el worktree se conservaron para diagnóstico."
        )
    return 0


def main() -> int:
    """Presenta errores operativos sin ocultar su causa ni borrar trabajo."""
    try:
        return iniciar()
    except ErrorInicioWP as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
