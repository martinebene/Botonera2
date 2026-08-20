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

    Falla cerrado ante cualquier error de comunicación, código de retorno no cero,
    JSON inválido o respuesta incompleta de Orca para asegurar que no se cree un
    worktree sin haber demostrado la ausencia de conflictos previos.

    Parámetros:
        raiz: Raíz del repositorio coordinador.
        numero_wp: Identificador normalizado de tres dígitos del WP.
        titulo: Título del WP extraído de su archivo Markdown.
        ejecutor: Función invocable para ejecutar procesos.

    Lanza:
        ErrorInicioWP: Si detecta colisiones previas o si la comprobación no pudo realizarse.
    """
    slug = crear_slug(titulo)
    nombre_esperado = f"wp/{numero_wp}-{slug}"
    prefijo_display = f"wp/{numero_wp}-"
    prefijo_rama_orca = f"wp-{numero_wp}-"

    # 1. Validar worktrees locales administrados por Git
    worktrees_git = listar_worktrees(raiz)
    for wt in worktrees_git:
        if wt.rama and (
            wt.rama.startswith(prefijo_display)
            or prefijo_rama_orca in wt.rama
            or wt.rama == nombre_esperado
        ):
            raise ErrorInicioWP(
                f"Ya existe un worktree Git con la rama {wt.rama!r} en {wt.ruta}; "
                "inspeccionalo antes de iniciar un nuevo WP."
            )

    # 2. Validar workspaces registrados en Orca (fallando cerrado ante cualquier error)
    try:
        resultado = ejecutor(
            ["orca", "worktree", "list", "--repo", f"path:{raiz}", "--json"],
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
            f"Orca falló al consultar workspaces existentes (código {resultado.returncode}): "
            f"{detalle}. No se pudo demostrar la ausencia de conflictos; "
            "no se creó ningún worktree."
        )

    datos_json = _parsear_json_objeto(resultado.stdout, "orca worktree list")
    if not datos_json.get("ok"):
        detalle_err = str(
            datos_json.get("error") or datos_json.get("message") or "error no especificado"
        )
        raise ErrorInicioWP(
            f"Orca reportó un fallo al listar workspaces: {detalle_err}. "
            "No se pudo verificar la ausencia de conflictos."
        )

    res_dict = _extraer_dict(datos_json, "result")
    if "worktrees" not in res_dict or not isinstance(res_dict["worktrees"], list):
        raise ErrorInicioWP(
            "La respuesta de Orca no contiene la lista de worktrees esperada ('result.worktrees'). "
            "No se pudo verificar la ausencia de conflictos."
        )

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
                or display == nombre_esperado
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
    agente: str | None = None,
) -> dict[str, Any]:
    """Interpreta y valida de forma conservadora la respuesta JSON de creación de Orca.

    Verifica que:
    1. La operación se informe exitosa (ok: True).
    2. Exista el objeto worktree en la respuesta con datos esenciales válidos (path, branch).
    3. El commit inicial (head) coincida con el origin/main validado.
    4. La rama base sea equivalente a origin/main (baseRef: 'refs/remotes/origin/main').
    5. No exista un padre Orca asignado indebidamente a este WP independiente.
    6. Exista evidencia real del inicio del agente ('agentTerminalHandle' o
       'startupTerminal.handle') cuando se solicita un agente.

    Parámetros:
        datos_json: Diccionario parseado de la salida JSON de Orca.
        sha_esperado: SHA de 40 caracteres de origin/main obtenido antes de la creación.
        agente: Nombre del agente solicitado, para verificar el handle de terminal iniciado.

    Retorna:
        Diccionario con los datos del worktree creado y la información de la terminal.

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

    # 1. Validar que existan los datos esenciales de ruta y rama
    path_creado = str(worktree.get("path") or "").strip()
    if not path_creado:
        raise ErrorInicioWP(
            "La respuesta de Orca no contiene una ruta válida para el worktree "
            "('result.worktree.path')."
        )

    branch_creada = str(worktree.get("branch") or "").strip()
    if not branch_creada:
        raise ErrorInicioWP(
            "La respuesta de Orca no contiene una rama válida para el worktree "
            "('result.worktree.branch')."
        )

    # 2. Validar SHA inicial del worktree contra origin/main validado
    git_dict = _extraer_dict(worktree, "git")
    head_creado_obj = worktree.get("head") or git_dict.get("head")
    head_creado = str(head_creado_obj) if head_creado_obj is not None else ""

    if not head_creado or head_creado.casefold() != sha_esperado.casefold():
        raise ErrorInicioWP(
            f"El SHA del worktree creado ({head_creado!r}) no coincide con origin/main "
            f"({sha_esperado!r}). "
            "El estado se conservó para diagnóstico; no se ejecutó limpieza automática."
        )

    # 3. Validar rama base origin/main (baseRef observado en Orca: 'refs/remotes/origin/main')
    base_ref_obj = worktree.get("baseRef")
    base_ref = str(base_ref_obj) if base_ref_obj is not None else ""
    if not base_ref or ("origin/main" not in base_ref and base_ref != "refs/remotes/origin/main"):
        raise ErrorInicioWP(
            f"La referencia base del worktree ({base_ref!r}) no corresponde a 'origin/main'."
        )

    # 4. Validar ausencia de padre para WPs independientes
    parent_id = worktree.get("parentWorktreeId")
    lineage = worktree.get("lineage")
    if parent_id is not None or (lineage is not None and lineage != []):
        raise ErrorInicioWP(
            f"El worktree se creó con un ancestro o relación padre no autorizada "
            f"(parent: {parent_id!r}, lineage: {lineage!r})."
        )

    # 5. Validar evidencia real de inicio del agente
    if agente:
        startup_terminal = _extraer_dict(resultado_dict, "startupTerminal")
        handle_terminal = resultado_dict.get("agentTerminalHandle") or startup_terminal.get(
            "handle"
        )
        if (
            not handle_terminal
            or not isinstance(handle_terminal, str)
            or not handle_terminal.strip()
        ):
            raise ErrorInicioWP(
                "Orca creó el worktree pero no informó el identificador de la terminal del agente "
                "('result.agentTerminalHandle' o 'result.startupTerminal.handle'). "
                "El estado se conservó para diagnóstico; no se ejecutó limpieza automática."
            )
        worktree["terminalHandle"] = str(handle_terminal).strip()

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

    Aplica el orden estricto de validación definido por DEC-007 y WP-030:
    1. Validar checkout coordinador (en rama main, working tree limpio).
    2. Validar runtime de Orca activo, alcanzable y listo.
    3. Validar repositorio coordinador registrado en Orca.
    4. Actualizar main únicamente por fast-forward contra origin/main.
    5. Leer contrato del WP y PLAN.md, validando estado documental y dependencias.
    6. Verificar ausencia de colisiones en Git y workspaces de Orca (fallo cerrado).
    7. Construir prompt y comando de creación con --no-parent y --agent.
    8. Delegar creación en Orca y validar rigurosamente la respuesta JSON y el agente.

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

    # 1. Validar checkout coordinador
    validar_checkout_coordinador(raiz)

    # 2. Validar runtime de Orca
    verificar_runtime_orca(raiz, ejecutor=ejecutor_orca)

    # 3. Validar registro del repositorio en Orca
    verificar_repositorio_registrado_orca(raiz, ejecutor=ejecutor_orca)

    # 4. Sincronizar origin/main de forma segura
    sha_origin_main = actualizar_main(raiz)

    # 5. Leer especificación documental y validar autorización
    _, titulo, dependencias = leer_wp(raiz, numero_wp)
    validar_autorizacion(numero_wp, agente, dependencias, leer_plan(raiz))

    # 6. Validar colisiones previas en Git y Orca (fallando cerrado ante cualquier error)
    verificar_conflictos_worktree_orca(raiz, numero_wp, titulo, ejecutor=ejecutor_orca)

    # 7. Construcción del prompt y comando para Orca
    prompt = construir_prompt_inicial(numero_wp)
    comando_orca = construir_comando_creacion_orca(
        raiz=raiz,
        numero_wp=numero_wp,
        titulo=titulo,
        agente=agente,
        prompt=prompt,
    )

    # 8. Invocación de Orca
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

    # 9. Validación estricta de la respuesta JSON y evidencia real del agente
    datos_json = _parsear_json_objeto(resultado.stdout, "orca worktree create")
    worktree = validar_respuesta_creacion_orca(datos_json, sha_origin_main, agente=agente)

    # 10. Informar resultado al operador
    ruta_worktree = str(worktree.get("path", "<no especificada>"))
    rama = str(worktree.get("branch", "<no especificada>"))
    base_ref = str(worktree.get("baseRef", "origin/main"))
    handle_terminal = str(worktree.get("terminalHandle", "<no informado>"))

    print(f"Worktree creado exitosamente por Orca en: {ruta_worktree}")
    print(f"Rama nativa Orca: {rama}")
    print(f"Base verificada: {base_ref} ({sha_origin_main})")
    print(f"Agente lanzado en terminal administrada por Orca: {agente} (handle: {handle_terminal})")
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
