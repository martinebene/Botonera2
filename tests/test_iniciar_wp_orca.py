"""Pruebas de regresión para el lanzador Orca (scripts/iniciar_wp_orca.py).

Verifica todas las puertas de seguridad documentales, de estado Git y de
integración con Orca de forma determinista y sin requerir un runtime real de
Orca en CI.
"""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from scripts.iniciar_wp_orca import (
    construir_comando_creacion_orca,
    construir_prompt_inicial,
)

DIRECTORIO_SCRIPTS = Path(__file__).parents[1] / "scripts"
RUTA_LANZADOR_ORCA = DIRECTORIO_SCRIPTS / "iniciar_wp_orca.py"


@dataclass(frozen=True)
class RepositorioPruebaOrca:
    """Agrupa las rutas aisladas y archivos de control para pruebas de Orca."""

    coordinador: Path
    remoto: Path
    directorio_bin: Path
    registro_orca: Path
    entorno: dict[str, str]


def ejecutar(
    *argumentos: str,
    cwd: Path,
    entorno: dict[str, str] | None = None,
    verificar: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Ejecuta un comando de prueba y muestra su salida en caso de fallo."""
    resultado = subprocess.run(
        list(argumentos),
        cwd=cwd,
        env=entorno,
        check=False,
        capture_output=True,
        text=True,
    )
    if verificar and resultado.returncode != 0:
        detalle = (
            f"Falló {' '.join(argumentos)}\n"
            f"stdout:\n{resultado.stdout}\n"
            f"stderr:\n{resultado.stderr}"
        )
        raise AssertionError(detalle)
    return resultado


def contenido_wp(
    numero: str = "030",
    titulo: str = "Lanzador Orca de prueba",
    *,
    aprobado: bool = True,
    dependencias: list[str] | None = None,
) -> str:
    """Construye el contrato Markdown mínimo para un WP de prueba."""
    estado = "APROBADO" if aprobado else "BORRADOR"
    if dependencias is None:
        dependencias = ["001"]
    lineas_dep = (
        "\n".join(f"- WP-{dep} integrado." for dep in dependencias)
        if dependencias
        else "- Ninguna."
    )
    return f"""# WP-{numero} - {titulo}

## Estado documental

`{estado}`

## Dependencias

{lineas_dep}

## Alcance

- Alcance de prueba para el lanzador Orca.
"""


def contenido_plan(
    numero: str = "030",
    *,
    estado_wp: str = "EN_CURSO",
    agente: str = "antigravity",
    dependencia_integrada: bool = True,
) -> str:
    """Construye las filas equivalentes a PLAN.md para pruebas."""
    estado_dep = "INTEGRADO" if dependencia_integrada else "EN_CURSO"
    return f"""# Plan de prueba

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-001 | Base | {estado_dep} | - | - |
| WP-{numero} | Lanzador Orca | {estado_wp} | WP-001 | {agente} |
"""


def crear_simulador_orca(directorio_bin: Path, registro_archivo: Path) -> None:
    """Crea una CLI simulada de 'orca' que responde con JSON determinista."""
    codigo_simulador = f"""#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

registro = Path({str(registro_archivo)!r})
argumentos = sys.argv[1:]

with registro.open("a", encoding="utf-8") as f:
    f.write(" ".join(argumentos) + "\\n")

# Comportamiento segun subcomando
if not argumentos:
    print("orca CLI simulada")
    sys.exit(0)

subcomando = argumentos[0]

if subcomando == "status":
    modo = os.environ.get("ORCA_MOCK_STATUS", "ready")
    if modo == "error":
        print(json.dumps({{"ok": False, "error": "Runtime caido"}}))
        sys.exit(1)
    elif modo == "not_ready":
        print(json.dumps({{
            "ok": True,
            "result": {{"runtime": {{"state": "setting-up", "reachable": False}}}}
        }}))
    elif modo == "invalid_json":
        print("ESTO_NO_ES_JSON")
    else:
        print(json.dumps({{
            "ok": True,
            "result": {{
                "runtime": {{"state": "ready", "reachable": True}},
                "app": {{"running": True}}
            }}
        }}))
    sys.exit(0)

if subcomando == "repo" and len(argumentos) > 1 and argumentos[1] == "list":
    modo = os.environ.get("ORCA_MOCK_REPO_LIST", "ok")
    if modo == "unregistered":
        print(json.dumps({{"ok": True, "result": {{"repos": []}}}}))
    elif modo == "invalid_json":
        print("MALFORMED_JSON")
    else:
        repo_path = os.environ.get("ORCA_MOCK_REPO_PATH", str(Path.cwd()))
        print(json.dumps({{
            "ok": True,
            "result": {{
                "repos": [
                    {{"id": "repo-123", "path": repo_path, "displayName": "Botonera2"}}
                ]
            }}
        }}))
    sys.exit(0)

if subcomando == "worktree" and len(argumentos) > 1 and argumentos[1] == "list":
    modo = os.environ.get("ORCA_MOCK_WORKTREE_LIST", "empty")
    if modo == "conflict":
        print(json.dumps({{
            "ok": True,
            "result": {{
                "worktrees": [
                    {{
                        "displayName": "wp/030-lanzador-orca",
                        "branch": "refs/heads/martinebene/wp-030-lanzador-orca",
                        "path": "/mock/path"
                    }}
                ]
            }}
        }}))
    else:
        print(json.dumps({{"ok": True, "result": {{"worktrees": []}}}}))
    sys.exit(0)

if subcomando == "worktree" and len(argumentos) > 1 and argumentos[1] == "create":
    modo = os.environ.get("ORCA_MOCK_CREATE", "ok")
    if modo == "error":
        print("Error interno de Orca", file=sys.stderr)
        sys.exit(1)
    elif modo == "invalid_json":
        print("OUTPUT_NO_JSON")
        sys.exit(0)
    elif modo == "head_mismatch":
        print(json.dumps({{
            "ok": True,
            "result": {{
                "worktree": {{
                    "id": "repo::/mock/wt",
                    "path": "/mock/wt",
                    "head": "0000000000000000000000000000000000000000",
                    "branch": "refs/heads/martinebene/wp-030-lanzador-orca",
                    "baseRef": "refs/remotes/origin/main",
                    "parentWorktreeId": None,
                    "lineage": None,
                    "createdWithAgent": "antigravity"
                }}
            }}
        }}))
    elif modo == "bad_base":
        head = os.environ.get("ORCA_MOCK_HEAD", "4355d14911428f17ea975d36116a72aac310ba2c")
        print(json.dumps({{
            "ok": True,
            "result": {{
                "worktree": {{
                    "id": "repo::/mock/wt",
                    "path": "/mock/wt",
                    "head": head,
                    "branch": "refs/heads/martinebene/wp-030-lanzador-orca",
                    "baseRef": "refs/heads/otra-rama",
                    "parentWorktreeId": None,
                    "lineage": None,
                    "createdWithAgent": "antigravity"
                }}
            }}
        }}))
    elif modo == "unexpected_parent":
        head = os.environ.get("ORCA_MOCK_HEAD", "4355d14911428f17ea975d36116a72aac310ba2c")
        print(json.dumps({{
            "ok": True,
            "result": {{
                "worktree": {{
                    "id": "repo::/mock/wt",
                    "path": "/mock/wt",
                    "head": head,
                    "branch": "refs/heads/martinebene/wp-030-lanzador-orca",
                    "baseRef": "refs/remotes/origin/main",
                    "parentWorktreeId": "padre-no-autorizado",
                    "lineage": ["padre-1"],
                    "createdWithAgent": "antigravity"
                }}
            }}
        }}))
    else:
        head = os.environ.get("ORCA_MOCK_HEAD", "4355d14911428f17ea975d36116a72aac310ba2c")
        agent = os.environ.get("ORCA_MOCK_AGENT", "antigravity")
        print(json.dumps({{
            "ok": True,
            "result": {{
                "agentTerminalHandle": "term_12345",
                "worktree": {{
                    "id": "repo::/home/dev/orca/workspaces/Botonera2/wp-030-lanzador-orca",
                    "path": "/home/dev/orca/workspaces/Botonera2/wp-030-lanzador-orca",
                    "head": head,
                    "branch": "refs/heads/martinebene/wp-030-lanzador-orca",
                    "baseRef": "refs/remotes/origin/main",
                    "parentWorktreeId": None,
                    "lineage": None,
                    "createdWithAgent": agent
                }}
            }}
        }}))
    sys.exit(0)

print(json.dumps({{"ok": True, "result": {{}}}}))
"""
    cli_orca = directorio_bin / "orca"
    cli_orca.write_text(codigo_simulador, encoding="utf-8")
    cli_orca.chmod(cli_orca.stat().st_mode | stat.S_IXUSR)


def crear_repositorio_orca(
    tmp_path: Path,
    numero_wp: str = "030",
    *,
    aprobado: bool = True,
    estado_wp: str = "EN_CURSO",
    agente: str = "antigravity",
    dependencia_integrada: bool = True,
) -> RepositorioPruebaOrca:
    """Crea un repositorio coordinador aislado y configura el simulador de Orca."""
    semilla = tmp_path / "semilla"
    semilla.mkdir(parents=True, exist_ok=True)
    ejecutar("git", "init", "--initial-branch=main", cwd=semilla)
    ejecutar("git", "config", "user.name", "Pruebas Botonera2", cwd=semilla)
    ejecutar("git", "config", "user.email", "pruebas@example.invalid", cwd=semilla)

    (semilla / ".gitignore").write_text("__pycache__/\n*.pyc\n", encoding="utf-8")
    (semilla / "docs" / "work-packages").mkdir(parents=True)
    (semilla / "docs" / "implementation").mkdir(parents=True)
    (semilla / "scripts").mkdir()

    for archivo_script in DIRECTORIO_SCRIPTS.glob("*.py"):
        shutil.copy2(archivo_script, semilla / "scripts" / archivo_script.name)

    (semilla / "docs" / "work-packages" / f"WP-{numero_wp}.md").write_text(
        contenido_wp(numero=numero_wp, aprobado=aprobado), encoding="utf-8"
    )
    (semilla / "docs" / "implementation" / "PLAN.md").write_text(
        contenido_plan(
            numero=numero_wp,
            estado_wp=estado_wp,
            agente=agente,
            dependencia_integrada=dependencia_integrada,
        ),
        encoding="utf-8",
    )
    ejecutar("git", "add", ".", cwd=semilla)
    ejecutar("git", "commit", "-m", "test: escenario inicial", cwd=semilla)

    remoto = tmp_path / "remoto.git"
    ejecutar("git", "clone", "--bare", str(semilla), str(remoto), cwd=tmp_path)
    coordinador = tmp_path / "coordinador"
    ejecutar("git", "clone", str(remoto), str(coordinador), cwd=tmp_path)

    directorio_bin = tmp_path / "bin"
    directorio_bin.mkdir(parents=True, exist_ok=True)
    registro_orca = tmp_path / "registro-orca.txt"
    crear_simulador_orca(directorio_bin, registro_orca)

    ruta_git = shutil.which("git")
    if ruta_git is not None:
        (directorio_bin / "git").symlink_to(ruta_git)
    (directorio_bin / "python3").symlink_to(sys.executable)

    sha_main = ejecutar("git", "rev-parse", "HEAD", cwd=coordinador).stdout.strip()

    entorno = os.environ.copy()
    entorno["PATH"] = os.pathsep.join((str(directorio_bin), entorno.get("PATH", "")))
    entorno["ORCA_MOCK_REPO_PATH"] = str(coordinador.resolve())
    entorno["ORCA_MOCK_HEAD"] = sha_main
    entorno["ORCA_MOCK_AGENT"] = agente
    entorno["PYTHONDONTWRITEBYTECODE"] = "1"
    return RepositorioPruebaOrca(coordinador, remoto, directorio_bin, registro_orca, entorno)


def lanzar_orca(
    repositorio: RepositorioPruebaOrca,
    numero_wp: str = "030",
    *,
    agente: str = "antigravity",
    entorno: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Invoca scripts/iniciar_wp_orca.py simulando la ejecución del operador."""
    return ejecutar(
        sys.executable,
        "scripts/iniciar_wp_orca.py",
        numero_wp,
        agente,
        cwd=repositorio.coordinador,
        entorno=entorno or repositorio.entorno,
        verificar=False,
    )


def test_rechaza_rama_distinta_de_main_en_orca(tmp_path: Path) -> None:
    """Verifica que el lanzador Orca exija rama main."""
    repositorio = crear_repositorio_orca(tmp_path)
    ejecutar("git", "switch", "-c", "otra-rama", cwd=repositorio.coordinador)

    resultado = lanzar_orca(repositorio)

    assert resultado.returncode == 1
    assert "debe estar en main" in resultado.stderr


def test_rechaza_working_tree_sucio_en_orca(tmp_path: Path) -> None:
    """Verifica que el lanzador Orca exija árbol de trabajo limpio."""
    repositorio = crear_repositorio_orca(tmp_path)
    (repositorio.coordinador / "archivo-local.txt").write_text("modificado", encoding="utf-8")

    resultado = lanzar_orca(repositorio)

    assert resultado.returncode == 1
    assert "cambios locales" in resultado.stderr


def test_rechaza_wp_no_aprobado_en_orca(tmp_path: Path) -> None:
    """Verifica que un WP con estado BORRADOR sea rechazado."""
    repositorio = crear_repositorio_orca(tmp_path, aprobado=False)

    resultado = lanzar_orca(repositorio)

    assert resultado.returncode == 1
    assert "no tiene estado documental APROBADO" in resultado.stderr


def test_rechaza_wp_no_marcado_en_curso_en_orca(tmp_path: Path) -> None:
    """Verifica que el WP deba figurar EN_CURSO en PLAN.md."""
    repositorio = crear_repositorio_orca(tmp_path, estado_wp="PENDIENTE")

    resultado = lanzar_orca(repositorio)

    assert resultado.returncode == 1
    assert "debe figurar EN_CURSO" in resultado.stderr


def test_rechaza_agente_distinto_del_asignado_en_orca(tmp_path: Path) -> None:
    """Verifica que el agente solicitado coincida con el asignado en PLAN.md."""
    repositorio = crear_repositorio_orca(tmp_path, agente="antigravity")

    resultado = lanzar_orca(repositorio, agente="opencode")

    assert resultado.returncode == 1
    assert "está asignado a 'antigravity'" in resultado.stderr


def test_rechaza_dependencia_no_integrada_en_orca(tmp_path: Path) -> None:
    """Verifica que las dependencias declaradas deban estar en estado INTEGRADO."""
    repositorio = crear_repositorio_orca(tmp_path, dependencia_integrada=False)

    resultado = lanzar_orca(repositorio)

    assert resultado.returncode == 1
    assert "Dependencias todavía no integradas" in resultado.stderr


def test_rechaza_runtime_orca_no_ready(tmp_path: Path) -> None:
    """Verifica el rechazo explícito cuando Orca no está en estado ready o no es alcanzable."""
    repositorio = crear_repositorio_orca(tmp_path)
    entorno = repositorio.entorno.copy()
    entorno["ORCA_MOCK_STATUS"] = "not_ready"

    resultado = lanzar_orca(repositorio, entorno=entorno)

    assert resultado.returncode == 1
    assert "El runtime de Orca no está listo" in resultado.stderr


def test_rechaza_repositorio_no_registrado_en_orca(tmp_path: Path) -> None:
    """Verifica el rechazo claro cuando el repo coordinador no está registrado en Orca."""
    repositorio = crear_repositorio_orca(tmp_path)
    entorno = repositorio.entorno.copy()
    entorno["ORCA_MOCK_REPO_LIST"] = "unregistered"

    resultado = lanzar_orca(repositorio, entorno=entorno)

    assert resultado.returncode == 1
    assert "no está registrado en Orca" in resultado.stderr
    assert "orca repo add --path" in resultado.stderr


def test_construccion_correcta_de_comando_y_prompt_orca(tmp_path: Path) -> None:
    """Demuestra la construcción adecuada de argumentos para 'orca worktree create'."""
    prompt = construir_prompt_inicial("030")
    assert "Implementá WP-030" in prompt
    assert "AGENTS.md" in prompt
    assert "docs/work-packages/WP-030.md" in prompt

    comando = construir_comando_creacion_orca(
        raiz=Path("/workspace/Botonera2"),
        numero_wp="030",
        titulo="Lanzador Orca y soporte multi-entorno",
        agente="antigravity",
        prompt=prompt,
    )
    assert comando[:4] == ["orca", "worktree", "create", "--repo"]
    assert comando[4] == "path:/workspace/Botonera2"
    assert comando[5] == "--name"
    assert comando[6] == "wp/030-lanzador-orca-y-soporte-multi-entorno"
    assert "--base-branch" in comando
    assert comando[comando.index("--base-branch") + 1] == "origin/main"
    assert "--no-parent" in comando
    assert "--agent" in comando
    assert comando[comando.index("--agent") + 1] == "antigravity"
    assert "--prompt" in comando
    assert comando[comando.index("--prompt") + 1] == prompt
    assert "--setup" in comando
    assert comando[comando.index("--setup") + 1] == "run"
    assert "--activate" in comando
    assert "--json" in comando


def test_flujo_exitoso_crea_worktree_en_orca(tmp_path: Path) -> None:
    """Ejecuta el flujo completo válido verificando que delega en Orca e informa el resultado."""
    repositorio = crear_repositorio_orca(tmp_path, numero_wp="030", agente="antigravity")

    resultado = lanzar_orca(repositorio, numero_wp="030", agente="antigravity")

    assert resultado.returncode == 0, resultado.stderr
    assert "Worktree creado exitosamente por Orca" in resultado.stdout
    assert "Rama nativa Orca: refs/heads/martinebene/wp-030-lanzador-orca" in resultado.stdout
    assert "Agente lanzado en terminal administrada por Orca: antigravity" in resultado.stdout

    # Comprobar que orca fue invocado con los parámetros esperados
    registro = repositorio.registro_orca.read_text(encoding="utf-8")
    assert "status --json" in registro
    assert "repo list --json" in registro
    assert "worktree create" in registro
    assert "--agent antigravity" in registro
    assert "--no-parent" in registro


def test_rechaza_sha_inconsistente_sin_borrado_destructivo(tmp_path: Path) -> None:
    """Verifica que si el SHA devuelto por Orca difiere de origin/main, falla y no borra."""
    repositorio = crear_repositorio_orca(tmp_path)
    entorno = repositorio.entorno.copy()
    entorno["ORCA_MOCK_CREATE"] = "head_mismatch"

    resultado = lanzar_orca(repositorio, entorno=entorno)

    assert resultado.returncode == 1
    assert "no coincide con origin/main" in resultado.stderr
    assert "no se ejecutó limpieza automática" in resultado.stderr

    # Asegurar que no se llamó a 'orca worktree rm'
    registro = repositorio.registro_orca.read_text(encoding="utf-8")
    assert "worktree rm" not in registro


def test_rechaza_base_invalida_en_respuesta_orca(tmp_path: Path) -> None:
    """Verifica que una base distinta de origin/main sea rechazada."""
    repositorio = crear_repositorio_orca(tmp_path)
    entorno = repositorio.entorno.copy()
    entorno["ORCA_MOCK_CREATE"] = "bad_base"

    resultado = lanzar_orca(repositorio, entorno=entorno)

    assert resultado.returncode == 1
    assert "no corresponde a 'origin/main'" in resultado.stderr


def test_rechaza_ancestro_o_padre_no_autorizado(tmp_path: Path) -> None:
    """Verifica que un worktree creado con padre sea rechazado para WPs independientes."""
    repositorio = crear_repositorio_orca(tmp_path)
    entorno = repositorio.entorno.copy()
    entorno["ORCA_MOCK_CREATE"] = "unexpected_parent"

    resultado = lanzar_orca(repositorio, entorno=entorno)

    assert resultado.returncode == 1
    assert "padre no autorizada" in resultado.stderr


def test_rechaza_salida_invalida_de_orca_sin_limpieza(tmp_path: Path) -> None:
    """Verifica que ante una salida no JSON o error de Orca se preserve el estado."""
    repositorio = crear_repositorio_orca(tmp_path)
    entorno = repositorio.entorno.copy()
    entorno["ORCA_MOCK_CREATE"] = "invalid_json"

    resultado = lanzar_orca(repositorio, entorno=entorno)

    assert resultado.returncode == 1
    assert "respuesta JSON inválida" in resultado.stderr
    registro = repositorio.registro_orca.read_text(encoding="utf-8")
    assert "worktree rm" not in registro


def test_detecta_conflicto_previo_en_worktrees_orca(tmp_path: Path) -> None:
    """Verifica que si ya existe un worktree en Orca para ese WP, rechaza antes de crear."""
    repositorio = crear_repositorio_orca(tmp_path)
    entorno = repositorio.entorno.copy()
    entorno["ORCA_MOCK_WORKTREE_LIST"] = "conflict"

    resultado = lanzar_orca(repositorio, entorno=entorno)

    assert resultado.returncode == 1
    assert "Ya existe un workspace en Orca para WP-030" in resultado.stderr
    registro = repositorio.registro_orca.read_text(encoding="utf-8")
    assert "worktree create" not in registro


def test_soporte_agentes_admitidos_orca(tmp_path: Path) -> None:
    """Verifica que los cuatro agentes aprobados para Orca puedan ser lanzados."""
    for agente in ("antigravity", "opencode", "codex", "claude"):
        repositorio = crear_repositorio_orca(tmp_path / agente, agente=agente)
        resultado = lanzar_orca(repositorio, agente=agente)
        assert resultado.returncode == 0, f"Fallo con agente {agente}: {resultado.stderr}"
        assert f"Agente lanzado en terminal administrada por Orca: {agente}" in resultado.stdout


def test_no_hace_push_ni_crea_pr_ni_modifica_plan(tmp_path: Path) -> None:
    """Demuestra que el lanzador Orca no modifica PLAN.md ni empuja ramas a origin."""
    repositorio = crear_repositorio_orca(tmp_path)
    ruta_plan = repositorio.coordinador / "docs" / "implementation" / "PLAN.md"
    plan_antes = ruta_plan.read_text(encoding="utf-8")
    commit_remoto_antes = ejecutar(
        "git", "rev-parse", "HEAD", cwd=repositorio.remoto
    ).stdout.strip()

    resultado = lanzar_orca(repositorio)

    assert resultado.returncode == 0, resultado.stderr
    plan_despues = ruta_plan.read_text(encoding="utf-8")
    assert plan_despues == plan_antes

    commit_remoto_despues = ejecutar(
        "git", "rev-parse", "HEAD", cwd=repositorio.remoto
    ).stdout.strip()
    assert commit_remoto_despues == commit_remoto_antes

    ramas_remotas = ejecutar("git", "branch", "--list", cwd=repositorio.remoto).stdout
    assert "wp-030" not in ramas_remotas
    assert "wp/030" not in ramas_remotas
