#!/usr/bin/env python3
"""Lanzador específico de Work Packages para el entorno Orca.

Aplica las mismas puertas de seguridad y validaciones documentales/Git que el
lanzador genérico y delega en la CLI de Orca la creación del worktree, la
configuración del workspace y el inicio del agente asignado.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast

# Permitir ejecución directa como script añadiendo la raíz del repositorio a sys.path
_directorio_scripts = Path(__file__).resolve().parent
_directorio_raiz = _directorio_scripts.parent
if str(_directorio_raiz) not in sys.path:
    sys.path.insert(0, str(_directorio_raiz))

from scripts.comun_lanzador import (  # noqa: E402
    ErrorInicioWP,
    actualizar_main,
    crear_slug,
    leer_plan,
    leer_wp,
    listar_worktrees,
    normalizar_numero_wp,
    validar_autorizacion,
    validar_checkout_coordinador,
)

AGENTES_ADMITIDOS_ORCA: tuple[str, ...] = ("antigravity", "opencode", "codex", "claude")

# Tipo para inyección de dependencias en ejecución de comandos de subprocess
TipoEjecutorComando = Callable[..., subprocess.CompletedProcess[str]]


def _parsear_json_objeto(texto: str, comando: str) -> dict[str, Any]:
    """Decodifica una cadena JSON y valida que sea un objeto de nivel superior.

    Parámetros:
        texto: Salida textual producida por la CLI de Orca con --json.
        comando: Nombre descriptivo del subcomando ejecutado para contexto de error.

    Retorna:
        Diccionario parseado con las claves del objeto JSON.

    Lanza:
        ErrorInicioWP: Si el texto no es JSON válido o no es un diccionario.
    """
    try:
        datos: object = json.loads(texto)
    except json.JSONDecodeError as error:
        raise ErrorInicioWP(
            f"Orca devolvió una respuesta JSON inválida en {comando!r}: {error}"
        ) from error

    if not isinstance(datos, dict):
        raise ErrorInicioWP(f"La respuesta de Orca en {comando!r} no es un objeto JSON.")

    return cast(dict[str, Any], datos)


def _extraer_dict(contenedor: dict[str, Any], clave: str) -> dict[str, Any]:
    """Extrae un subdiccionario tipado de forma segura desde un diccionario contenedor."""
    valor = contenedor.get(clave)
    if isinstance(valor, dict):
        return cast(dict[str, Any], valor)
    return {}


def _extraer_lista(contenedor: dict[str, Any], clave: str) -> list[Any]:
    """Extrae una lista tipada de forma segura desde un diccionario contenedor."""
    valor = contenedor.get(clave)
    if isinstance(valor, list):
        return cast(list[Any], valor)
    return []


def verificar_runtime_orca(
    raiz: Path,
    ejecutor: TipoEjecutorComando = subprocess.run,
) -> dict[str, Any]:
    """Comprueba que el runtime de Orca esté disponible, alcanzable y en estado 'ready'.

    Parámetros:
        raiz: Directorio de trabajo para la ejecución del comando.
        ejecutor: Función invocable para ejecutar procesos (permite simular en pruebas).

    Retorna:
        Diccionario con la respuesta JSON del comando 'orca status --json'.

    Lanza:
        ErrorInicioWP: Si la CLI no existe, el comando falla o el runtime no está listo.
    """
    if shutil.which("orca") is None and ejecutor is subprocess.run:
        raise ErrorInicioWP(
            "La CLI de Orca ('orca') no está instalada o no figura en PATH; "
            "no se creó ningún worktree."
        )

    try:
        resultado = ejecutor(
            ["orca", "status", "--json"],
            cwd=raiz,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as error:
        raise ErrorInicioWP(
            "La CLI de Orca ('orca') no está instalada o no figura en PATH."
        ) from error

    if resultado.returncode != 0:
        detalle = resultado.stderr.strip() or resultado.stdout.strip() or "sin detalle"
        raise ErrorInicioWP(
            f"Orca no responde (código {resultado.returncode}): {detalle}. "
            "Verificá que Orca esté abierto ('orca open') antes de ejecutar este lanzador."
        )

    datos = _parsear_json_objeto(resultado.stdout, "orca status")

    if not datos.get("ok"):
        detalle_err = str(datos.get("error", "inválida"))
        raise ErrorInicioWP(f"Orca reportó un estado no exitoso: {detalle_err}")

    resultado_dict = _extraer_dict(datos, "result")
    runtime = _extraer_dict(resultado_dict, "runtime")

    estado_runtime = runtime.get("state")
    alcanzable = bool(runtime.get("reachable", False))

    if estado_runtime != "ready" or not alcanzable:
        raise ErrorInicioWP(
            f"El runtime de Orca no está listo (estado: {estado_runtime!r}, "
            f"alcanzable: {alcanzable}). "
            "Asegurate de que Orca esté activo y conectado antes de continuar."
        )

    return datos


def verificar_repositorio_registrado_orca(
    raiz: Path,
    ejecutor: TipoEjecutorComando = subprocess.run,
) -> dict[str, Any]:
    """Verifica que el repositorio coordinador esté registrado en el runtime de Orca.

    Parámetros:
        raiz: Raíz del repositorio coordinador local.
        ejecutor: Función invocable para ejecutar procesos.

    Retorna:
        Diccionario con la información del repositorio registrado en Orca.

    Lanza:
        ErrorInicioWP: Si la consulta falla o el repositorio no está registrado.
    """
    try:
        resultado = ejecutor(
            ["orca", "repo", "list", "--json"],
            cwd=raiz,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as error:
        raise ErrorInicioWP(
            "La CLI de Orca ('orca') no está instalada o no figura en PATH."
        ) from error

    if resultado.returncode != 0:
        detalle = resultado.stderr.strip() or resultado.stdout.strip() or "sin detalle"
        raise ErrorInicioWP(f"Orca no pudo listar los repositorios registrados: {detalle}")

    datos = _parsear_json_objeto(resultado.stdout, "orca repo list")

    if not datos.get("ok"):
        raise ErrorInicioWP("La consulta de repositorios en Orca reportó un fallo.")

    resultado_dict = _extraer_dict(datos, "result")
    repos_list = _extraer_lista(resultado_dict, "repos")

    raiz_resuelta = raiz.resolve()
    for repo_item in repos_list:
        if isinstance(repo_item, dict):
            repo_dict = cast(dict[str, Any], repo_item)
            path_val = repo_dict.get("path")
            if path_val and Path(str(path_val)).resolve() == raiz_resuelta:
                return repo_dict

    raise ErrorInicioWP(
        f"El repositorio coordinador ({raiz_resuelta}) no está registrado en Orca. "
        f"Registralo ejecutando: orca repo add --path {raiz_resuelta}"
    )


def verificar_conflictos_worktree_orca(
    raiz: Path,
    numero_wp: str,
    titulo: str,
    ejecutor: TipoEjecutorComando = subprocess.run,
) -> None:
    """Detecta si ya existe un worktree o rama para este WP tanto en Git como en Orca.

    Parámetros:
        raiz: Raíz del repositorio coordinador.
        numero_wp: Identificador normalizado de tres dígitos del WP.
        titulo: Título del WP.
        ejecutor: Función invocable para ejecutar procesos.

    Lanza:
        ErrorInicioWP: Si detecta colisiones previas para evitar sobrescribir trabajo.
    """
    prefijo_display = f"wp/{numero_wp}-"
    prefijo_rama_orca = f"wp-{numero_wp}-"

    # 1. Validar worktrees locales administrados por Git
    worktrees_git = listar_worktrees(raiz)
    for wt in worktrees_git:
        if wt.rama and (wt.rama.startswith(prefijo_display) or prefijo_rama_orca in wt.rama):
            raise ErrorInicioWP(
                f"Ya existe un worktree Git con la rama {wt.rama!r} en {wt.ruta}; "
                "inspeccionalo antes de iniciar un nuevo WP."
            )

    # 2. Validar workspaces registrados en Orca
    try:
        resultado = ejecutor(
            ["orca", "worktree", "list", "--repo", f"path:{raiz}", "--json"],
            cwd=raiz,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return

    if resultado.returncode == 0:
        try:
            datos_obj: object = json.loads(resultado.stdout)
        except json.JSONDecodeError:
            return

        if isinstance(datos_obj, dict):
            datos_dict = cast(dict[str, Any], datos_obj)
            if datos_dict.get("ok"):
                res_dict = _extraer_dict(datos_dict, "result")
                worktrees_list = _extraer_lista(res_dict, "worktrees")
                for wt_obj in worktrees_list:
                    if isinstance(wt_obj, dict):
                        wt_dict = cast(dict[str, Any], wt_obj)
                        display = str(wt_dict.get("displayName", ""))
                        rama = str(wt_dict.get("branch", ""))
                        path_wt = str(wt_dict.get("path", ""))
                        if (
                            display.startswith(prefijo_display)
                            or prefijo_rama_orca in rama
                            or f"-wp{numero_wp}" in path_wt
                            or f"wp-{numero_wp}" in path_wt
                        ):
                            raise ErrorInicioWP(
                                f"Ya existe un workspace en Orca para WP-{numero_wp} "
                                f"(nombre: {display!r}, rama: {rama!r}, ruta: {path_wt!r}); "
                                "inspeccionalo antes de crear uno nuevo."
                            )


def construir_prompt_inicial(numero_wp: str) -> str:
    """Construye un prompt inicial breve que remite al agente a las fuentes canónicas.

    Parámetros:
        numero_wp: Número del WP en formato de tres dígitos (ej. '030').

    Retorna:
        Texto del prompt que recibirá el agente al inicializar la terminal de Orca.
    """
    return (
        f"Implementá WP-{numero_wp}. Leé primero AGENTS.md y "
        f"docs/work-packages/WP-{numero_wp}.md y después únicamente las fuentes canónicas "
        f"que ese WP exige. Respetá estrictamente su alcance, exclusiones y decisiones vigentes."
    )


def construir_comando_creacion_orca(
    raiz: Path,
    numero_wp: str,
    titulo: str,
    agente: str,
    prompt: str,
) -> list[str]:
    """Genera la lista de argumentos para 'orca worktree create' según DEC-007.

    Parámetros:
        raiz: Raíz del repositorio coordinador.
        numero_wp: Número del WP.
        titulo: Título del WP extraído de su archivo Markdown.
        agente: Nombre del agente a lanzar en Orca.
        prompt: Prompt inicial para el agente.

    Retorna:
        Lista de cadenas con el comando completo de Orca.
    """
    slug = crear_slug(titulo)
    nombre_workspace = f"wp/{numero_wp}-{slug}"
    return [
        "orca",
        "worktree",
        "create",
        "--repo",
        f"path:{raiz}",
        "--name",
        nombre_workspace,
        "--base-branch",
        "origin/main",
        "--no-parent",
        "--agent",
        agente,
        "--prompt",
        prompt,
        "--setup",
        "run",
        "--activate",
        "--json",
    ]


def validar_respuesta_creacion_orca(
    datos_json: dict[str, Any],
    sha_esperado: str,
) -> dict[str, Any]:
    """Interpreta y valida de forma conservadora la respuesta JSON de creación de Orca.

    Verifica que:
    1. La operación se informe exitosa (ok: True).
    2. Exista el objeto worktree en la respuesta.
    3. El commit inicial (head) coincida con el origin/main validado.
    4. La rama base sea equivalente a origin/main.
    5. No exista un padre Orca asignado indebidamente a este WP independiente.

    Parámetros:
        datos_json: Diccionario parseado de la salida JSON de Orca.
        sha_esperado: SHA de 40 caracteres de origin/main obtenido antes de la creación.

    Retorna:
        Diccionario con los datos del worktree creado.

    Lanza:
        ErrorInicioWP: Si cualquier verificación falla (sin ejecutar borrado automático).
    """
    if not datos_json.get("ok"):
        error_detalle = str(
            datos_json.get("error") or datos_json.get("message") or "error no especificado"
        )
        raise ErrorInicioWP(f"Orca reportó un fallo en la creación del worktree: {error_detalle}")

    resultado_dict = _extraer_dict(datos_json, "result")
    worktree = _extraer_dict(resultado_dict, "worktree")
    if not worktree:
        raise ErrorInicioWP(
            "La respuesta de Orca no contiene la información del worktree "
            "creado ('result.worktree')."
        )

    # 1. Validar SHA inicial del worktree contra origin/main validado
    git_dict = _extraer_dict(worktree, "git")
    head_creado_obj = worktree.get("head") or git_dict.get("head")
    head_creado = str(head_creado_obj) if head_creado_obj is not None else ""

    if not head_creado or head_creado.casefold() != sha_esperado.casefold():
        raise ErrorInicioWP(
            f"El SHA del worktree creado ({head_creado!r}) no coincide con origin/main "
            f"({sha_esperado!r}). "
            "El estado se conservó para diagnóstico; no se ejecutó limpieza automática."
        )

    # 2. Validar rama base origin/main
    base_ref_obj = worktree.get("baseRef")
    base_ref = str(base_ref_obj) if base_ref_obj is not None else ""
    if not base_ref or ("origin/main" not in base_ref and base_ref != "refs/remotes/origin/main"):
        raise ErrorInicioWP(
            f"La referencia base del worktree ({base_ref!r}) no corresponde a 'origin/main'."
        )

    # 3. Validar ausencia de padre para WPs independientes
    parent_id = worktree.get("parentWorktreeId")
    lineage = worktree.get("lineage")
    if parent_id is not None or (lineage is not None and lineage != []):
        raise ErrorInicioWP(
            f"El worktree se creó con un ancestro o relación padre no autorizada "
            f"(parent: {parent_id!r}, lineage: {lineage!r})."
        )

    return worktree


def crear_parser() -> argparse.ArgumentParser:
    """Define la interfaz de línea de comandos para el lanzador Orca."""
    parser = argparse.ArgumentParser(
        description="Prepara un worktree administrado por Orca y lanza el agente asignado."
    )
    parser.add_argument("wp", help="Número del Work Package, por ejemplo 030")
    parser.add_argument(
        "agente",
        choices=AGENTES_ADMITIDOS_ORCA,
        help="Nombre del agente a lanzar en Orca ('antigravity', 'opencode', 'codex', 'claude')",
    )
    return parser


def iniciar(
    argumentos: list[str] | None = None,
    ejecutor_orca: TipoEjecutorComando = subprocess.run,
) -> int:
    """Coordina todas las validaciones documentales/Git y delega la creación en Orca.

    Parámetros:
        argumentos: Lista de argumentos de línea de comandos (o None para sys.argv[1:]).
        ejecutor_orca: Invocable para ejecutar comandos (útil para pruebas unitarias).

    Retorna:
        0 si la operación fue exitosa, o lanza ErrorInicioWP ante inconsistencias.
    """
    opciones = crear_parser().parse_args(argumentos)
    numero_wp = normalizar_numero_wp(opciones.wp)
    agente = opciones.agente
    raiz = Path.cwd().resolve()

    # 1. Validaciones Git y documentales previas
    validar_checkout_coordinador(raiz)
    verificar_runtime_orca(raiz, ejecutor=ejecutor_orca)
    verificar_repositorio_registrado_orca(raiz, ejecutor=ejecutor_orca)

    sha_origin_main = actualizar_main(raiz)
    _, titulo, dependencias = leer_wp(raiz, numero_wp)
    validar_autorizacion(numero_wp, agente, dependencias, leer_plan(raiz))
    verificar_conflictos_worktree_orca(raiz, numero_wp, titulo, ejecutor=ejecutor_orca)

    # 2. Construcción del prompt y comando para Orca
    prompt = construir_prompt_inicial(numero_wp)
    comando_orca = construir_comando_creacion_orca(
        raiz=raiz,
        numero_wp=numero_wp,
        titulo=titulo,
        agente=agente,
        prompt=prompt,
    )

    # 3. Invocación de Orca
    print(f"Creando worktree en Orca para WP-{numero_wp} y lanzando {agente}...")
    resultado = ejecutor_orca(
        comando_orca,
        cwd=raiz,
        capture_output=True,
        text=True,
        check=False,
    )

    if resultado.returncode != 0:
        detalle = resultado.stderr.strip() or resultado.stdout.strip() or "sin detalle"
        raise ErrorInicioWP(
            f"Orca falló al crear el worktree (código {resultado.returncode}): {detalle}. "
            "No se ejecutó borrado automático para permitir diagnóstico."
        )

    # 4. Validación estricta de la respuesta JSON
    datos_json = _parsear_json_objeto(resultado.stdout, "orca worktree create")
    worktree = validar_respuesta_creacion_orca(datos_json, sha_origin_main)

    # 5. Informar resultado al operador
    ruta_worktree = str(worktree.get("path", "<no especificada>"))
    rama = str(worktree.get("branch", "<no especificada>"))
    base_ref = str(worktree.get("baseRef", "origin/main"))

    print(f"Worktree creado exitosamente por Orca en: {ruta_worktree}")
    print(f"Rama nativa Orca: {rama}")
    print(f"Base verificada: {base_ref} ({sha_origin_main})")
    print(f"Agente lanzado en terminal administrada por Orca: {agente}")
    return 0


def main() -> int:
    """Punto de entrada principal para la ejecución del lanzador Orca."""
    try:
        return iniciar()
    except ErrorInicioWP as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
