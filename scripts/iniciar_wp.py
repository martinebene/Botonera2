#!/usr/bin/env python3
"""Prepara un worktree aislado y abre el agente asignado a un WP autorizado.

El lanzador automatiza únicamente tareas mecánicas de Git. La autorización
continúa viviendo en el WP y en ``PLAN.md``: este programa nunca edita esos
documentos, no crea PRs y no integra ni despliega cambios.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

AGENTES_ADMITIDOS = ("codex", "claude", "opencode")


class ErrorInicioWP(RuntimeError):
    """Representa una precondición incumplida sin imprimir un traceback técnico."""


@dataclass(frozen=True)
class FilaPlan:
    """Resume la autorización operativa de un WP extraída de la tabla del PLAN."""

    estado: str
    agente: str


@dataclass(frozen=True)
class WorktreeGit:
    """Describe una entrada relevante de ``git worktree list --porcelain``."""

    ruta: Path
    rama: str | None


def ejecutar_git(
    raiz: Path,
    *argumentos: str,
    verificar: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Ejecuta Git en ``raiz`` y devuelve salida textual.

    Cuando ``verificar`` es verdadero, un error de Git se convierte en un
    mensaje breve orientado al operador. No se intenta reparar automáticamente
    el repositorio porque podría borrar o reinterpretar trabajo existente.
    """

    resultado = subprocess.run(
        ["git", *argumentos],
        cwd=raiz,
        check=False,
        capture_output=True,
        text=True,
    )
    if verificar and resultado.returncode != 0:
        detalle = resultado.stderr.strip() or resultado.stdout.strip() or "sin detalle"
        raise ErrorInicioWP(f"Git no pudo ejecutar {' '.join(argumentos)}: {detalle}")
    return resultado


def normalizar_numero_wp(valor: str) -> str:
    """Convierte ``1`` o ``001`` al identificador estable de tres dígitos."""

    if not valor.isdecimal() or not 1 <= int(valor) <= 999:
        raise ErrorInicioWP("El WP debe indicarse con un número entre 001 y 999.")
    return f"{int(valor):03d}"


def validar_checkout_coordinador(raiz_esperada: Path) -> None:
    """Exige la raíz del checkout coordinador, rama ``main`` y estado limpio."""

    resultado_raiz = ejecutar_git(raiz_esperada, "rev-parse", "--show-toplevel")
    raiz_git = Path(resultado_raiz.stdout.strip()).resolve()
    if raiz_git != raiz_esperada:
        raise ErrorInicioWP(
            "Ejecutá el lanzador desde la raíz del checkout coordinador de Botonera2."
        )

    rama = ejecutar_git(raiz_esperada, "branch", "--show-current").stdout.strip()
    if rama != "main":
        raise ErrorInicioWP(f"El checkout coordinador debe estar en main; rama actual: {rama!r}.")

    if ejecutar_git(raiz_esperada, "status", "--porcelain").stdout.strip():
        raise ErrorInicioWP(
            "main tiene cambios locales; confirmalos o retiralos antes de iniciar un WP."
        )


def actualizar_main(raiz: Path) -> str:
    """Actualiza referencias y adelanta ``main`` únicamente mediante fast-forward."""

    ejecutar_git(raiz, "remote", "get-url", "origin")
    ejecutar_git(raiz, "fetch", "--prune", "origin")
    ejecutar_git(raiz, "merge", "--ff-only", "origin/main")

    actual = ejecutar_git(raiz, "rev-parse", "HEAD").stdout.strip()
    remoto = ejecutar_git(raiz, "rev-parse", "origin/main").stdout.strip()
    if actual != remoto:
        raise ErrorInicioWP(
            "main no coincide con origin/main después del fast-forward; revisá los commits locales."
        )
    return remoto


def extraer_seccion(texto: str, titulo: str) -> str:
    """Obtiene el contenido de una sección Markdown de segundo nivel."""

    patron = re.compile(
        rf"^## {re.escape(titulo)}\s*$\n(?P<contenido>.*?)(?=^##\s|\Z)",
        flags=re.MULTILINE | re.DOTALL,
    )
    coincidencia = patron.search(texto)
    if coincidencia is None:
        raise ErrorInicioWP(f"El documento no contiene la sección obligatoria {titulo!r}.")
    return coincidencia.group("contenido")


def leer_wp(raiz: Path, numero_wp: str) -> tuple[Path, str, list[str]]:
    """Valida aprobación, obtiene el título y enumera dependencias WP declaradas."""

    ruta_wp = raiz / "docs" / "work-packages" / f"WP-{numero_wp}.md"
    if not ruta_wp.is_file():
        raise ErrorInicioWP(f"No existe {ruta_wp.relative_to(raiz)}.")

    texto = ruta_wp.read_text(encoding="utf-8")
    estado = extraer_seccion(texto, "Estado documental")
    if not re.search(r"`APROBADO`", estado):
        raise ErrorInicioWP(f"WP-{numero_wp} no tiene estado documental APROBADO.")

    encabezado = re.search(rf"^# WP-{numero_wp} - (?P<titulo>.+)$", texto, re.MULTILINE)
    if encabezado is None:
        raise ErrorInicioWP(f"WP-{numero_wp} no tiene el encabezado canónico esperado.")

    seccion_dependencias = extraer_seccion(texto, "Dependencias")
    dependencias = sorted(
        {
            dependencia
            for dependencia in re.findall(r"\bWP-(\d{3})\b", seccion_dependencias)
            if dependencia != numero_wp
        }
    )
    return ruta_wp, encabezado.group("titulo").strip(), dependencias


def leer_plan(raiz: Path) -> dict[str, FilaPlan]:
    """Interpreta las filas WP de PLAN sin modificar el documento canónico."""

    ruta_plan = raiz / "docs" / "implementation" / "PLAN.md"
    if not ruta_plan.is_file():
        raise ErrorInicioWP("No existe docs/implementation/PLAN.md.")

    filas: dict[str, FilaPlan] = {}
    for linea in ruta_plan.read_text(encoding="utf-8").splitlines():
        columnas = [columna.strip() for columna in linea.strip().strip("|").split("|")]
        if len(columnas) < 5 or re.fullmatch(r"WP-\d{3}", columnas[0]) is None:
            continue
        numero = columnas[0].removeprefix("WP-")
        filas[numero] = FilaPlan(estado=columnas[2], agente=columnas[4])
    return filas


def validar_autorizacion(
    numero_wp: str,
    agente_solicitado: str,
    dependencias: list[str],
    filas_plan: dict[str, FilaPlan],
) -> None:
    """Comprueba estado, agente único y dependencias integradas en PLAN."""

    fila = filas_plan.get(numero_wp)
    if fila is None:
        raise ErrorInicioWP(f"WP-{numero_wp} no figura en PLAN.md.")
    if fila.estado != "EN_CURSO":
        raise ErrorInicioWP(
            f"WP-{numero_wp} debe figurar EN_CURSO en PLAN.md; figura {fila.estado!r}."
        )
    if fila.agente.casefold() != agente_solicitado.casefold():
        raise ErrorInicioWP(
            f"WP-{numero_wp} está asignado a {fila.agente!r}, no a {agente_solicitado!r}."
        )

    no_integradas = [
        f"WP-{dependencia}"
        for dependencia in dependencias
        if filas_plan.get(dependencia) is None or filas_plan[dependencia].estado != "INTEGRADO"
    ]
    if no_integradas:
        raise ErrorInicioWP(
            "Dependencias todavía no integradas en PLAN.md: " + ", ".join(no_integradas) + "."
        )


def crear_slug(titulo: str) -> str:
    """Deriva un segmento de rama estable, legible y compatible con Git."""

    sin_marcas = "".join(
        caracter
        for caracter in unicodedata.normalize("NFKD", titulo)
        if not unicodedata.combining(caracter)
    )
    slug = re.sub(r"[^a-z0-9]+", "-", sin_marcas.casefold()).strip("-")
    slug = slug[:56].rstrip("-")
    if not slug:
        raise ErrorInicioWP("El título del WP no permite construir un nombre de rama válido.")
    return slug


def listar_worktrees(raiz: Path) -> list[WorktreeGit]:
    """Convierte la salida por bloques de Git en objetos fáciles de validar."""

    salida = ejecutar_git(raiz, "worktree", "list", "--porcelain").stdout
    worktrees: list[WorktreeGit] = []
    for bloque in salida.strip().split("\n\n"):
        if not bloque.strip():
            continue
        valores: dict[str, str] = {}
        for linea in bloque.splitlines():
            clave, _, valor = linea.partition(" ")
            valores[clave] = valor
        rama_completa = valores.get("branch")
        rama = rama_completa.removeprefix("refs/heads/") if rama_completa else None
        worktrees.append(WorktreeGit(ruta=Path(valores["worktree"]).resolve(), rama=rama))
    return worktrees


def preparar_worktree(
    raiz: Path,
    numero_wp: str,
    titulo: str,
    referencia_base: str,
) -> tuple[Path, str, bool]:
    """Crea o reutiliza de forma inequívoca la rama y el worktree del WP.

    No elimina rutas ni ramas. Una ruta ocupada o una rama ya asociada a otro
    worktree produce un error para que el operador pueda inspeccionarlo.
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
    """Define la interfaz de línea de comandos documentada por DEC-002."""

    parser = argparse.ArgumentParser(
        description="Prepara el worktree de un WP autorizado y abre su agente asignado."
    )
    parser.add_argument("wp", help="Número del Work Package, por ejemplo 002")
    parser.add_argument("agente", choices=AGENTES_ADMITIDOS, help="CLI del agente asignado")
    return parser


def iniciar(argumentos: list[str] | None = None) -> int:
    """Coordina validaciones, actualización segura, worktree y lanzamiento."""

    opciones = crear_parser().parse_args(argumentos)
    numero_wp = normalizar_numero_wp(opciones.wp)
    agente = opciones.agente
    raiz = Path.cwd().resolve()

    validar_checkout_coordinador(raiz)
    if shutil.which(agente) is None:
        raise ErrorInicioWP(
            f"La CLI {agente!r} no está instalada o no figura en PATH; no se creó ningún worktree."
        )

    referencia_base = actualizar_main(raiz)
    _, titulo, dependencias = leer_wp(raiz, numero_wp)
    validar_autorizacion(numero_wp, agente, dependencias, leer_plan(raiz))
    ruta_worktree, rama, reutilizado = preparar_worktree(raiz, numero_wp, titulo, referencia_base)

    accion = "Reutilizando" if reutilizado else "Creado"
    print(f"{accion} {ruta_worktree} con la rama {rama}.")
    print(f"Abriendo {agente} dentro del worktree autorizado...")
    resultado = subprocess.run([agente], cwd=ruta_worktree, check=False)
    if resultado.returncode != 0:
        raise ErrorInicioWP(
            f"La CLI {agente!r} terminó con código {resultado.returncode}; "
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
