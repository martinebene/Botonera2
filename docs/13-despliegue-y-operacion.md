# 13 - Despliegue y operación

Este documento registra las decisiones técnicas cerradas para el despliegue inicial de SISLeg.

Complementa `12-decisiones-tecnicas.md`. Las decisiones todavía abiertas permanecen en `10-preguntas-abiertas.md`.

## DT-027 - Sistema operativo objetivo

La plataforma de producción de referencia será **Linux Mint 22.3 Cinnamon**.

La implementación no debe acoplarse innecesariamente a Linux Mint: backend, frontends, tooling y scripts deben conservar compatibilidad razonable con Linux estándar cuando no exista una necesidad específica del hardware.

Linux Mint se adopta como referencia porque la máquina de producción también opera navegador, pantallas y dispositivos físicos del recinto.

## DT-028 - Servicios nativos con systemd

La primera versión se desplegará de forma nativa mediante **systemd**, sin Docker/Compose.

Servicios principales previstos:

- `botonera2-backend.service`;
- `botonera2-device-bridge.service`;
- Nginx como servicio del sistema.

El backend mantiene un único proceso/worker según DT-005.

No introducir contenedores por iniciativa propia. Una futura migración a contenedores requiere decisión técnica explícita, especialmente por la interacción del bridge con hardware físico.

## DT-029 - Frontends Nuxt como SPA estáticas

Los frontends de Moderación y Pantalla del Recinto se construirán como aplicaciones Nuxt client-side/SPA estáticas.

Principios:

- no habrá servidores Node/Nitro permanentes en producción para estos frontends;
- Nginx servirá los archivos HTML/CSS/JS generados;
- Moderación y Recinto consumirán FastAPI mediante REST + SSE;
- no se necesita SSR para el objetivo institucional de SISLeg.

La configuración concreta de build debe respetar Nuxt 4 y el funcionamiento bajo subrutas definido en DT-030.

## DT-030 - Nginx y mismo origen

La instalación utilizará **Nginx** como punto de entrada HTTP y un único origen lógico.

Estructura objetivo conceptual:

```text
http://botonera/
├── /moderacion/
├── /recinto/
└── /api/v1/
```

Nginx:

- sirve ambos frontends estáticos;
- hace proxy de `/api/v1/` hacia FastAPI en loopback;
- configura correctamente los endpoints SSE para entrega inmediata sin buffering indebido;
- evita la necesidad normal de CORS entre frontend y backend al mantenerlos bajo el mismo origen.

Los puertos internos exactos pueden ser configuración de despliegue siempre que no cambien este contrato externo.

## DT-031 - Releases inmutables y rollback

Producción no se actualizará mediante `git pull` sobre el árbol activo.

Estructura objetivo conceptual:

```text
/opt/botonera2/
├── releases/
│   ├── <release-A>/
│   ├── <release-B>/
│   └── <release-C>/
├── current -> releases/<release-activa>
├── config/
└── logs/
```

Cada release debe ser inmutable y estar identificada de forma trazable, preferentemente por commit o artefacto derivado de un commit conocido.

Procedimiento general:

1. partir de una versión cuya CI esté aprobada;
2. preparar/buildar una nueva release sin alterar `current`;
3. comprobar que el sistema operativo esté en `SIN_PREPARAR` antes de reemplazar la versión activa;
4. cambiar el enlace `current` a la nueva release;
5. reiniciar los servicios necesarios;
6. ejecutar verificaciones de salud;
7. si la nueva versión falla, volver al enlace de la release anterior y reiniciar.

No se despliega ni reinicia deliberadamente SISLeg durante `PREPARANDO` o `SESION_ABIERTA`, porque el estado activo es volátil y una interrupción obliga reglamentariamente a comenzar nuevamente.

Configuración y registros viven fuera de `releases/` para que actualización y rollback no los sustituyan ni eliminen.

## DT-032 - Registros conservados solo localmente en la primera versión

En la primera versión **no se implementará backup automático externo** de los CSV institucionales.

Los registros:

- se conservan localmente en el directorio de logs definido por configuración;
- permanecen fuera del árbol de releases;
- no deben eliminarse por despliegues, rollback, builds o limpieza de versiones;
- mantienen la retención indefinida definida funcionalmente salvo intervención administrativa externa.

Una política futura de segunda copia, NAS, nube, cifrado o retención automatizada requerirá una decisión técnica posterior.

Esta decisión no reduce las garantías de escritura inmediata `flush` + `fsync` de DT-012: únicamente define que la primera versión no agrega una segunda copia automática.

## Consecuencias para los agentes

Sin una decisión posterior documentada, los agentes no deben:

- sustituir Linux Mint como plataforma de referencia productiva por otra distribución asumida;
- introducir Docker/Compose;
- desplegar Nuxt mediante servidores Node permanentes;
- separar frontend y API en orígenes públicos diferentes sin necesidad explícita;
- actualizar producción mediante `git pull` sobre la instalación activa;
- colocar configuración o logs dentro de una release inmutable;
- desplegar mientras exista preparación o sesión activa;
- agregar por iniciativa propia servicios de backup remoto o dependencias de nube.

## Runbook productivo versionado

Este procedimiento materializa DT-027 a DT-032. Los comandos que cambian la
máquina institucional requieren gate humano y se ejecutan únicamente cuando
el recinto está fuera de preparación y sesión. El desarrollo, CI y revisión
de WP-028 no ejecutan estos pasos sobre producción.

### Artefacto y trazabilidad

Un checkout limpio del commit aprobado genera:

```bash
pnpm install --frozen-lockfile
uv sync --frozen --all-packages
pnpm empaquetar:produccion
```

La salida es `dist/produccion/botonera2-<sha-completo>.tar.gz` y su sidecar
`.sha256`. El artifact de CI agrega una copia de
`deploy/herramienta_despliegue.py` del mismo checkout, necesaria para preparar
la primera release sin Git ni una instalación previa. `release.json` identifica
commit/tree, Python objetivo, paquetes, SPA y el inventario SHA-256 de cada
archivo. El empaquetador rechaza cambios versionables locales para no atribuir
al commit contenido que Git no conoce.

La identidad de ambos builds Nuxt se deriva del SHA Git completo y la marca de
prerender del timestamp del mismo commit. Como estas SPA no usan reglas de ruta
en cliente, el app manifest experimental se desactiva para evitar UUID y fechas
volátiles sin quitar funcionalidad. El job productivo ejecuta dos veces
`pnpm empaquetar:produccion` y compara tar y sidecar byte a byte antes del smoke;
por eso la reproducibilidad cubre también `pnpm build`, no sólo el tar final.

### Prerequisitos administrativos

- Linux Mint 22.3 x86_64 con systemd y Nginx;
- Python 3.14 y `uv` disponibles por rutas estables; cada directorio padre del
  ejecutable Python debe ser atravesable y el binario legible/ejecutable por
  usuarios sin privilegios;
- `runuser` y `find`, utilizados para comprobar accesos con las identidades
  efectivas de backend y bridge antes de activar; `chown` y `chmod`, usados por
  el bootstrap para materializar el plan declarado;
- artefacto correspondiente al SHA aprobado y su sidecar;
- acceso root solamente durante bootstrap/instalación de unidades;
- configuración institucional real preparada fuera del repositorio.

`preflight` diagnostica prerequisitos pero no instala paquetes. También
resuelve el mismo Python 3.14 con que se ejecutó la herramienta y rechaza una
ruta que dependa de un home privado del administrador:

```bash
python3.14 deploy/herramienta_despliegue.py preflight
```

### Primera instalación

1. Descargar un único artifact aprobado de CI y transferir juntos paquete,
   sidecar y `herramienta_despliegue.py` por un canal administrativo. No mezclar
   archivos de ejecuciones o SHA diferentes.
2. Crear usuarios/directorios, sin copiar fixtures del repositorio:

   ```bash
   sudo python3.14 deploy/herramienta_despliegue.py bootstrap --aplicar-usuarios
   ```

3. Provisionar manualmente `system.toml`, `concejales.csv` y
   `bridge/devices.json` bajo `/opt/botonera2/config/`. `paths.logs_dir` debe
   resolver exactamente a `/opt/botonera2/logs`.
4. Repetir el bootstrap después de provisionar para aplicar idempotentemente el
   plan también a los archivos recién creados:

   ```bash
   sudo python3.14 deploy/herramienta_despliegue.py bootstrap --aplicar-usuarios
   ```

   El plan deja `/opt/botonera2` atravesable, releases administrativas;
   `logs/` escribible solo por backend; configuración institucional de solo lectura para backend; y
   `config/bridge/` escribible solo por bridge. El modo `0751` del directorio
   padre `config/` es deliberado: permite que bridge lo atraviese para llegar a
   su propio subdirectorio, pero no enumerarlo ni leer los archivos del backend.
   Únicamente bridge integra el grupo `input`.
5. Preparar sin tocar `current`:

   ```bash
   sudo python3.14 deploy/herramienta_despliegue.py preparar \
     botonera2-<sha>.tar.gz \
     --checksum botonera2-<sha>.tar.gz.sha256 \
     --sha <sha>
   ```

6. Confirmar que el estado institucional permite la intervención y activar:

   ```bash
   sudo python3.14 /opt/botonera2/releases/<sha>/deploy/herramienta_despliegue.py \
     activar <sha>
   ```

La activación valida configuración, units y Nginx; cambia `current`
atómicamente; reinicia backend/bridge; comprueba health y ambas SPA por Nginx;
y recién entonces actualiza `previous`.

La validación de configuración recibe dos rutas: la raíz de la instalación
—donde viven `config/` y `logs/`— y la release que se está activando. La
segunda es necesaria desde WP-065 porque las rutas de la sección `[sonidos]`
resuelven contra la Pantalla del Recinto publicada por esa release
(`<release>/web/recinto/`). Si un archivo de sonido configurado no está
publicado, la activación falla antes de tocar el servicio. Los assets viajan
dentro de la release, como el resto de la SPA; `config/` no los contiene.

Durante `preparar`, `uv sync` recibe explícitamente la ruta resuelta de ese
Python 3.14 mediante `--python` y deshabilita descargas automáticas. De esta
manera la venv no puede seleccionar por preferencia un Python administrado en
el home privado de root. Antes del switch, `activar` usa `runuser` para probar
con ambos usuarios reales la lectura, escritura, ejecución y pertenencia al
grupo `input` declaradas por el plan. Si un acceso no coincide, falla sin
instalar archivos de sistema, reiniciar servicios ni cambiar `current`.

### Actualización

1. Obtener el artefacto del SHA con CI y revisión aprobadas.
2. Ejecutar `preparar`; crea la venv en su ruta final y no reinicia servicios
   ni cambia `current`.
3. Verificar explícitamente que el sistema esté `SIN_PREPARAR`.
4. Ejecutar `activar <sha>` y verificar `estado`, health y ambas SPA.

Si systemd marca backend `inactive`/`failed`, la herramienta permite continuar
con advertencia porque no existe un runtime activo. Si lo marca `active` pero
HTTP no responde o es inconsistente, falla cerrado. No existe `--force`.

### Rollback

El rollback por defecto activa `previous`; también puede señalar una release
preparada concreta:

```bash
sudo python3.14 /opt/botonera2/current/deploy/herramienta_despliegue.py rollback
sudo python3.14 /opt/botonera2/current/deploy/herramienta_despliegue.py rollback --sha <sha>
```

Aplica el mismo guard institucional y las mismas verificaciones que una
actualización. Un rollback exitoso intercambia de hecho `current`/`previous`,
permitiendo roll-forward. Si una activación falla después del switch, se
intenta restaurar automáticamente release y archivos de despliegue anteriores.
Si esa recuperación también falla, la herramienta se detiene y exige
intervención; nunca borra la release fallida.

### Diagnóstico de solo lectura

```bash
python3.14 /opt/botonera2/current/deploy/herramienta_despliegue.py estado
readlink -f /opt/botonera2/current
readlink -f /opt/botonera2/previous
systemctl status botonera2-backend.service botonera2-device-bridge.service
journalctl -u botonera2-backend.service -u botonera2-device-bridge.service
nginx -t
curl --fail http://127.0.0.1:8000/api/v1/health
curl --fail http://127.0.0.1/api/v1/health
curl --fail http://127.0.0.1/moderacion/
curl --fail http://127.0.0.1/recinto/
```

Activar o volver atrás nunca modifica `config/` ni `logs/`, no elimina
releases y no recupera estado institucional volátil después de un reinicio.
