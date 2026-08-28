"""Pruebas de seguridad, atomicidad y rollback del mecanismo productivo."""

from __future__ import annotations

import io
import json
import subprocess
import sys
import tarfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import pytest

import deploy.herramienta_despliegue as modulo_despliegue
from deploy.herramienta_despliegue import (
    ErrorDespliegue,
    GestorDespliegue,
    ResultadoComando,
    extraer_paquete_seguro,
    plan_permisos,
    resolver_enlace_release,
    validar_manifest,
    verificar_checksum,
)
from scripts.empaquetar_produccion import construir_paquete, sha256_archivo

SHA_A = "a" * 40
SHA_B = "b" * 40


def crear_checkout_minimo(raiz: Path) -> None:
    """Construye la allowlist mínima que consume el empaquetador real."""

    archivos = {
        "pyproject.toml": "[project]\nname='raiz'\nversion='0'\n",
        "uv.lock": "version = 1\n",
        ".python-version": "3.14\n",
        "apps/backend/pyproject.toml": "[project]\nname='botonera2-backend'\nversion='0'\n",
        "apps/backend/src/botonera2_backend/__init__.py": "",
        "services/device-bridge/pyproject.toml": (
            "[project]\nname='botonera2-device-bridge'\nversion='0'\n"
        ),
        "services/device-bridge/src/botonera2_device_bridge/__init__.py": "",
        "apps/moderacion/.output/public/index.html": "<!doctype html>Moderación",
        "apps/moderacion/.output/public/_nuxt/app.js": "m",
        "apps/recinto/.output/public/index.html": "<!doctype html>Recinto",
        "apps/recinto/.output/public/_nuxt/app.js": "r",
        "deploy/__init__.py": "",
        "deploy/herramienta_despliegue.py": "# herramienta",
        "deploy/validar_configuracion.py": "# validador",
        "deploy/systemd/botonera2-backend.service": "[Service]\n",
        "deploy/systemd/botonera2-device-bridge.service": "[Service]\n",
        "deploy/nginx/botonera2.conf": "server {}\n",
    }
    for relativa, contenido in archivos.items():
        ruta = raiz / relativa
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(contenido, encoding="utf-8")


def test_paquete_es_reproducible_trazable_y_excluye_configuracion(tmp_path: Path) -> None:
    """Mismo SHA/contenido produce bytes iguales y nunca empaqueta fixtures."""

    checkout = tmp_path / "checkout"
    crear_checkout_minimo(checkout)
    (checkout / "config").mkdir()
    (checkout / "config/system.toml").write_text("secreto='no'", encoding="utf-8")

    paquete_1, sidecar_1 = construir_paquete(
        raiz=checkout,
        directorio_salida=tmp_path / "salida-1",
        sha_commit=SHA_A,
        sha_arbol="c" * 40,
    )
    paquete_2, _ = construir_paquete(
        raiz=checkout,
        directorio_salida=tmp_path / "salida-2",
        sha_commit=SHA_A,
        sha_arbol="c" * 40,
    )

    assert paquete_1.name == f"botonera2-{SHA_A}.tar.gz"
    assert sha256_archivo(paquete_1) == sha256_archivo(paquete_2)
    verificar_checksum(paquete_1, sidecar_1)
    with tarfile.open(paquete_1, "r:gz") as tar:
        nombres = tar.getnames()
        manifest = json.load(tar.extractfile("release.json"))  # type: ignore[arg-type]
    assert manifest["commit_sha"] == SHA_A
    assert "config/system.toml" not in nombres
    assert not any("node_modules" in nombre or ".venv" in nombre for nombre in nombres)


@pytest.mark.parametrize(
    ("campo", "valor", "mensaje"),
    [
        ("tree_sha", "abreviado", "tree SHA"),
        ("spas", {"moderacion": "otra-ruta"}, "SPA canónicas"),
        ("paquetes_python", ["botonera2-backend"], "paquetes Python canónicos"),
    ],
    ids=["tree-sha", "spas", "paquetes-python"],
)
def test_manifest_rechaza_identidad_runtime_incompleta(
    tmp_path: Path, campo: str, valor: object, mensaje: str
) -> None:
    """El receptor no confía en metadatos parciales aunque el tar sea legible."""

    checkout = tmp_path / "checkout"
    crear_checkout_minimo(checkout)
    paquete, _ = construir_paquete(
        raiz=checkout,
        directorio_salida=tmp_path / "salida",
        sha_commit=SHA_A,
        sha_arbol="c" * 40,
    )
    with tarfile.open(paquete, "r:gz") as tar:
        manifest = json.load(tar.extractfile("release.json"))  # type: ignore[arg-type]
    manifest[campo] = valor

    with pytest.raises(ErrorDespliegue, match=mensaje):
        validar_manifest(manifest, SHA_A)


def test_checksum_adulterado_es_rechazado(tmp_path: Path) -> None:
    """Un solo byte distinto impide preparar antes de extraer."""

    paquete = tmp_path / "botonera2.tar.gz"
    paquete.write_bytes(b"contenido")
    sidecar = tmp_path / "botonera2.tar.gz.sha256"
    sidecar.write_text(f"{'0' * 64}  {paquete.name}\n", encoding="ascii")

    with pytest.raises(ErrorDespliegue, match="Checksum incorrecto"):
        verificar_checksum(paquete, sidecar)


def test_validador_release_directo_expone_ayuda() -> None:
    """La misma invocación que usa CI debe resolver imports desde ``scripts/``."""

    raiz = Path(__file__).resolve().parents[1]
    resultado = subprocess.run(
        [sys.executable, str(raiz / "scripts/validar_release_produccion.py"), "--help"],
        cwd=raiz,
        capture_output=True,
        text=True,
        check=False,
    )

    assert resultado.returncode == 0, resultado.stderr
    assert "Valida una release" in resultado.stdout


def test_bootstrap_es_idempotente_y_crea_solo_estructura_externa(tmp_path: Path) -> None:
    """Repetir bootstrap conserva directorios y no inventa datos institucionales."""

    gestor = crear_gestor(tmp_path)
    primer_plan = gestor.bootstrap()
    segundo_plan = gestor.bootstrap()

    assert primer_plan == segundo_plan == plan_permisos()
    assert gestor.releases.is_dir()
    assert (gestor.config / "bridge").is_dir()
    assert gestor.logs.is_dir()
    assert not (gestor.config / "system.toml").exists()
    assert not (gestor.config / "concejales.csv").exists()
    assert not (gestor.config / "bridge/devices.json").exists()


def test_preparar_es_idempotente_y_no_cambia_current(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La venv nace en la ruta final y repetir el mismo SHA no reinstala."""

    checkout = tmp_path / "checkout"
    crear_checkout_minimo(checkout)
    paquete, sidecar = construir_paquete(
        raiz=checkout,
        directorio_salida=tmp_path / "salida",
        sha_commit=SHA_A,
        sha_arbol="c" * 40,
    )
    ejecutor = EjecutorFalso()
    gestor = crear_gestor(tmp_path, ejecutor)

    # En producción root puede administrar un árbol 0555. El test evita ese
    # modo únicamente para que pytest retire su directorio temporal al final.
    def conservar_escribible(release: Path) -> None:
        del release

    monkeypatch.setattr(gestor, "_hacer_release_solo_lectura", conservar_escribible)

    release = gestor.preparar(paquete, sidecar, SHA_A)
    llamadas_primera = len(ejecutor.llamadas)
    repetida = gestor.preparar(paquete, sidecar, SHA_A)

    assert release == repetida == gestor.releases / SHA_A
    assert (release / ".venv/bin/uvicorn").is_file()
    assert resolver_enlace_release(gestor.current, gestor.releases) is None
    assert len(ejecutor.llamadas) == llamadas_primera


def crear_tar_malicioso(ruta: Path, nombre: str, *, tipo: bytes | None = None) -> None:
    """Crea una entrada controlada para probar traversal y enlaces."""

    with tarfile.open(ruta, "w:gz") as tar:
        datos = b"x"
        info = tarfile.TarInfo(nombre)
        if tipo is not None:
            info.type = tipo
            info.linkname = "../../escape"
            info.size = 0
            tar.addfile(info)
        else:
            info.size = len(datos)
            tar.addfile(info, io.BytesIO(datos))


@pytest.mark.parametrize(
    ("nombre", "tipo"),
    [("../escape", None), ("/absoluto", None), ("app/enlace", tarfile.SYMTYPE)],
    ids=["traversal", "absoluta", "symlink"],
)
def test_extraccion_rechaza_rutas_y_enlaces(
    tmp_path: Path, nombre: str, tipo: bytes | None
) -> None:
    """La inspección ocurre antes de que una entrada pueda escribir afuera."""

    paquete = tmp_path / "malicioso.tar.gz"
    crear_tar_malicioso(paquete, nombre, tipo=tipo)

    with pytest.raises(ErrorDespliegue):
        extraer_paquete_seguro(paquete, tmp_path / "destino", SHA_A)
    assert not (tmp_path / "escape").exists()


class EjecutorFalso:
    """Emula comandos privilegiados y materializa la venv mínima al preparar."""

    def __init__(self) -> None:
        self.llamadas: list[list[str]] = []
        self.estado_backend = "active"

    def ejecutar(
        self,
        argumentos: Sequence[str],
        *,
        directorio: Path | None = None,
        entorno: Mapping[str, str] | None = None,
        comprobar: bool = True,
    ) -> ResultadoComando:
        del comprobar
        args = [str(valor) for valor in argumentos]
        self.llamadas.append(args)
        if args[:2] == ["uv", "sync"]:
            assert directorio is not None and entorno is not None
            venv = Path(entorno["UV_PROJECT_ENVIRONMENT"])
            (venv / "bin").mkdir(parents=True)
            for nombre in ("python", "uvicorn", "botonera2-device-bridge"):
                (venv / "bin" / nombre).write_text("ejecutable", encoding="utf-8")
        if args[:2] == ["systemctl", "is-active"]:
            return ResultadoComando(0, f"{self.estado_backend}\n")
        return ResultadoComando(0)


def crear_release_preparada(gestor: GestorDespliegue, sha: str) -> Path:
    """Crea una release operacional mínima para probar activación sin uv real."""

    release = gestor.releases / sha
    requeridos = (
        ".venv/bin/python",
        ".venv/bin/uvicorn",
        ".venv/bin/botonera2-device-bridge",
        "web/moderacion/index.html",
        "web/recinto/index.html",
        "deploy/systemd/botonera2-backend.service",
        "deploy/systemd/botonera2-device-bridge.service",
        "deploy/nginx/botonera2.conf",
        "deploy/validar_configuracion.py",
    )
    for relativa in requeridos:
        ruta = release / relativa
        ruta.parent.mkdir(parents=True, exist_ok=True)
        contenido = "<!doctype html>" if ruta.name == "index.html" else "archivo"
        ruta.write_text(contenido, encoding="utf-8")
    (release / modulo_despliegue.MARCADOR_PREPARADA).write_text(
        json.dumps({"commit_sha": sha}), encoding="utf-8"
    )
    return release


def crear_gestor(tmp_path: Path, ejecutor: EjecutorFalso | None = None) -> GestorDespliegue:
    """Aísla todas las rutas que en producción pertenecen a /opt y /etc."""

    ejecutor = ejecutor or EjecutorFalso()

    def json_ok(url: str, timeout: float) -> dict[str, Any]:
        del timeout
        if url.endswith("estado/moderacion"):
            return {"estado_global": "SIN_PREPARAR"}
        return {"estado": "ok"}

    def html_ok(url: str, timeout: float) -> str:
        """Emula el HTML que Nginx sirve para cualquiera de las dos SPA."""

        del url, timeout
        return "<!doctype html>"

    return GestorDespliegue(
        tmp_path / "opt/botonera2",
        ejecutor=ejecutor,
        consultor_json=json_ok,
        consultor_texto=html_ok,
        directorio_systemd=tmp_path / "etc/systemd/system",
        ruta_nginx=tmp_path / "etc/nginx/conf.d/botonera2.conf",
    )


def crear_config_externa(gestor: GestorDespliegue) -> None:
    """Crea placeholders; el fake confirma que el parser se invoca por subprocess."""

    for relativa in ("system.toml", "concejales.csv", "bridge/devices.json"):
        ruta = gestor.config / relativa
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text("fixture externo", encoding="utf-8")
    gestor.logs.mkdir(parents=True, exist_ok=True)


def test_activacion_previous_y_rollback_preservan_config_y_logs(tmp_path: Path) -> None:
    """Los enlaces rotan, mientras los datos externos quedan byte a byte iguales."""

    gestor = crear_gestor(tmp_path)
    release_a = crear_release_preparada(gestor, SHA_A)
    crear_release_preparada(gestor, SHA_B)
    crear_config_externa(gestor)
    config_antes = (gestor.config / "system.toml").read_bytes()
    log = gestor.logs / "institucional.csv"
    log.write_text("durable", encoding="utf-8")

    gestor.activar(SHA_A)
    assert resolver_enlace_release(gestor.current, gestor.releases) == release_a
    assert resolver_enlace_release(gestor.previous, gestor.releases) is None

    gestor.activar(SHA_B)
    assert resolver_enlace_release(gestor.current, gestor.releases).name == SHA_B  # type: ignore[union-attr]
    assert resolver_enlace_release(gestor.previous, gestor.releases).name == SHA_A  # type: ignore[union-attr]

    gestor.rollback()
    assert resolver_enlace_release(gestor.current, gestor.releases).name == SHA_A  # type: ignore[union-attr]
    assert resolver_enlace_release(gestor.previous, gestor.releases).name == SHA_B  # type: ignore[union-attr]
    assert (gestor.config / "system.toml").read_bytes() == config_antes
    assert log.read_text(encoding="utf-8") == "durable"


@pytest.mark.parametrize("estado", ["PREPARANDO", "SESION_ABIERTA"])
def test_guard_rechaza_estado_institucional_activo(tmp_path: Path, estado: str) -> None:
    """No existe flag que permita interrumpir deliberadamente una sesión."""

    gestor = crear_gestor(tmp_path)
    release = crear_release_preparada(gestor, SHA_A)
    cambiar = modulo_despliegue.cambiar_enlace_atomico
    cambiar(gestor.current, release)

    def consultar_estado(_url: str, _timeout: float) -> dict[str, Any]:
        return {"estado_global": estado}

    gestor.consultor_json = consultar_estado

    with pytest.raises(ErrorDespliegue, match="Despliegue rechazado"):
        gestor.guard_institucional()


def test_guard_falla_cerrado_si_systemd_activo_pero_http_inaccesible(tmp_path: Path) -> None:
    """Un active inconsistente no se interpreta como permiso para reiniciar."""

    gestor = crear_gestor(tmp_path)
    release = crear_release_preparada(gestor, SHA_A)
    modulo_despliegue.cambiar_enlace_atomico(gestor.current, release)

    def inaccesible(_url: str, _timeout: float) -> dict[str, Any]:
        raise ErrorDespliegue("sin respuesta")

    gestor.consultor_json = inaccesible
    with pytest.raises(ErrorDespliegue, match="sin respuesta"):
        gestor.guard_institucional()


def test_fallo_health_restaura_current_y_no_actualiza_previous(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un fallo posterior al switch vuelve a la release sana anterior."""

    gestor = crear_gestor(tmp_path)
    crear_release_preparada(gestor, SHA_A)
    crear_release_preparada(gestor, SHA_B)
    crear_config_externa(gestor)
    gestor.activar(SHA_A)

    def no_dormir(segundos: float) -> None:
        """Evita una espera real mientras se recorren todos los intentos."""

        del segundos

    monkeypatch.setattr(modulo_despliegue.time, "sleep", no_dormir)

    def salud_por_release(url: str, _timeout: float) -> dict[str, Any]:
        if url.endswith("estado/moderacion"):
            return {"estado_global": "SIN_PREPARAR"}
        actual = resolver_enlace_release(gestor.current, gestor.releases)
        if url == modulo_despliegue.URL_HEALTH and actual is not None and actual.name == SHA_B:
            raise ErrorDespliegue("health nuevo falló")
        return {"estado": "ok"}

    gestor.consultor_json = salud_por_release
    with pytest.raises(ErrorDespliegue, match="se restauró la release anterior"):
        gestor.activar(SHA_B)

    assert resolver_enlace_release(gestor.current, gestor.releases).name == SHA_A  # type: ignore[union-attr]
    assert resolver_enlace_release(gestor.previous, gestor.releases) is None


def test_fallo_del_rollback_detiene_y_reporta_ambos_errores(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La herramienta no sigue mutando si tampoco recupera la release anterior."""

    gestor = crear_gestor(tmp_path)
    crear_release_preparada(gestor, SHA_A)
    crear_release_preparada(gestor, SHA_B)
    crear_config_externa(gestor)
    gestor.activar(SHA_A)

    def no_dormir(segundos: float) -> None:
        del segundos

    def health_siempre_fallido(url: str, _timeout: float) -> dict[str, Any]:
        if url.endswith("estado/moderacion"):
            return {"estado_global": "SIN_PREPARAR"}
        if url == modulo_despliegue.URL_HEALTH:
            raise ErrorDespliegue("health indisponible")
        return {"estado": "ok"}

    monkeypatch.setattr(modulo_despliegue.time, "sleep", no_dormir)
    gestor.consultor_json = health_siempre_fallido

    with pytest.raises(ErrorDespliegue, match="también el rollback automático"):
        gestor.activar(SHA_B)


def test_plan_de_permisos_separa_backend_bridge_e_input() -> None:
    """El plan deja releases administrativas y escritura mínima por servicio."""

    por_ruta = {entrada.ruta_relativa: entrada for entrada in plan_permisos()}
    assert por_ruta["releases"].usuario == "root"
    assert por_ruta["logs"].usuario == "botonera2-backend"
    assert por_ruta["config/bridge"].usuario == "botonera2-bridge"
    assert por_ruta["config/system.toml"].modo == 0o640


def test_plantillas_fijan_loopback_worker_usuarios_y_sse() -> None:
    """Las propiedades productivas críticas son visibles en los artefactos."""

    raiz = Path(__file__).resolve().parents[1]
    backend = (raiz / "deploy/systemd/botonera2-backend.service").read_text(encoding="utf-8")
    bridge = (raiz / "deploy/systemd/botonera2-device-bridge.service").read_text(encoding="utf-8")
    nginx = (raiz / "deploy/nginx/botonera2.conf").read_text(encoding="utf-8")

    assert "User=botonera2-backend" in backend
    assert "--host 127.0.0.1 --port 8000 --workers 1" in backend
    assert "WorkingDirectory=/opt/botonera2" in backend
    assert "PYTHONDONTWRITEBYTECODE=1" in backend
    assert "User=botonera2-bridge" in bridge
    assert "SupplementaryGroups=input" in bridge
    assert "--control-host 127.0.0.1 --control-port 8765" in bridge
    assert "proxy_http_version 1.1" in nginx
    assert "proxy_buffering off" in nginx
    assert "proxy_read_timeout 1h" in nginx
    assert "proxy_pass http://127.0.0.1:8000;" in nginx
    assert "cors" not in nginx.lower()
    assert "ssl" not in nginx.lower()
