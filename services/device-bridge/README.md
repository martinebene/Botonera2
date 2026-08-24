# Botonera2 — Device Bridge (Bridge Físico Linux)

## Propósito y Función

El **Device Bridge** (`services/device-bridge`) es el servicio encargado de interactuar con el hardware físico en el recinto legislativo (teclados numéricos USB asociados a cada banca) en sistemas operativos Linux.

Su única función es:
1. Detectar teclados físicos mediante `evdev`.
2. Extraer sus metadatos de hardware para derivar un identificador persistente (**fingerprint canónico**).
3. Resolver el identificador físico hacia un identificador lógico (`dev01`, `dev02`, etc.) a través del archivo de mapeo `config/devices.json`.
4. Normalizar la tecla presionada al catálogo de la API.
5. Transmitir el evento como una pulsación lógica a FastAPI (`POST /api/v1/entradas/tecla`).

```text
Teclado Físico (USB)
       ↓
     evdev (/dev/input/event*)
       ↓
Fingerprint Físico (lin|vendor=...|product=...)
       ↓
  devices.json (Mapeo estricto)
       ↓
Dispositivo Lógico (dev01 .. devXX)
       ↓
Normalización de Tecla (0..9, +, -, ENTER, etc.)
       ↓
POST /api/v1/entradas/tecla (FastAPI)
```

## Frontera de Responsabilidades

### Lo que SÍ hace el Bridge:
- Descubre y abre dispositivos Linux con capacidad `EV_KEY`.
- Genera el fingerprint persistente e independiente de la ruta efímera `/dev/input/eventN`.
- Filtra estrictamente eventos de pulsación (`keydown`), descartando `keyup` y `repeat/hold`.
- Valida la integridad de `devices.json` (incluyendo detección de claves JSON duplicadas y unicidad inversa).
- Despacha a lo sumo **un intento HTTP** por pulsación.
- Loguea diagnósticos locales (stdout/stderr y journald).
- Se recupera automáticamente de desconexiones y reconexiones de hardware en caliente.

### Lo que NO hace el Bridge:
- **No evalúa reglas de negocio**: No decide presencia, quórum, validez de votos, irreversibilidad, pedidos de palabra ni resultados. Toda la semántica institucional reside en FastAPI.
- **No interpreta el padrón**: No lee `config/concejales.csv`.
- **No reintenta peticiones**: No realiza retries automáticos ante timeouts o errores de red.
- **No acumula eventos (cero replay)**: No utiliza colas durables ni reintentos automáticos. Ante caídas de red, timeouts o fallos de transporte, interrumpe el procesamiento del lote y purga activamente los búferes de hardware para evitar ráfagas tardías de eventos antiguos cuando se restablece la conexión.
- **No asigna dispositivos no mapeados**: Un fingerprint desconocido nunca se asigna automáticamente a un `devXX` libre.

---

## Arquitectura y Componentes

El paquete `botonera2_device_bridge` está estructurado en módulos enfocados y testeables:

- [`fingerprint.py`](file:///home/dev/orca/workspaces/Botonera2/wp-019-bridge-fisico-linux-y-compatibilidad-fingerprint-a-dispo/services/device-bridge/src/botonera2_device_bridge/fingerprint.py): Construcción y validación del formato canónico Linux.
- [`configuracion.py`](file:///home/dev/orca/workspaces/Botonera2/wp-019-bridge-fisico-linux-y-compatibilidad-fingerprint-a-dispo/services/device-bridge/src/botonera2_device_bridge/configuracion.py): Parámetros operacionales y lector estricto de `devices.json` con detección de duplicados.
- [`normalizador.py`](file:///home/dev/orca/workspaces/Botonera2/wp-019-bridge-fisico-linux-y-compatibilidad-fingerprint-a-dispo/services/device-bridge/src/botonera2_device_bridge/normalizador.py): Normalización amplia de teclas físicas y numpad hacia valores de API (`0`..`9`, `ENTER`, etc.).
- [`cliente_http.py`](file:///home/dev/orca/workspaces/Botonera2/wp-019-bridge-fisico-linux-y-compatibilidad-fingerprint-a-dispo/services/device-bridge/src/botonera2_device_bridge/cliente_http.py): Cliente HTTP liviano basado en `urllib.request` (biblioteca estándar) con política de cero reintentos.
- [`adaptador_linux.py`](file:///home/dev/orca/workspaces/Botonera2/wp-019-bridge-fisico-linux-y-compatibilidad-fingerprint-a-dispo/services/device-bridge/src/botonera2_device_bridge/adaptador_linux.py): Abstracción del hardware. Contiene `AdaptadorEvdevLinux` para Linux real y `AdaptadorFalso` para pruebas en CI sin hardware.
- [`servicio.py`](file:///home/dev/orca/workspaces/Botonera2/wp-019-bridge-fisico-linux-y-compatibilidad-fingerprint-a-dispo/services/device-bridge/src/botonera2_device_bridge/servicio.py): Orquestador del ciclo de vida y flujo de eventos.
- [`cli.py`](file:///home/dev/orca/workspaces/Botonera2/wp-019-bridge-fisico-linux-y-compatibilidad-fingerprint-a-dispo/services/device-bridge/src/botonera2_device_bridge/cli.py): Punto de entrada ejecutable de consola (`botonera2-device-bridge`) con manejo de señales `SIGINT`/`SIGTERM`.

---

## Formato del Fingerprint Canónico

El fingerprint identifica de forma determinista y estable a cada teclado físico en Linux:

```text
lin|vendor=<hex4>|product=<hex4>|version=<hex4>|phys=<texto>|uniq=<texto>|name=<texto>
```

Ejemplo:
```text
lin|vendor=1a2c|product=2d43|version=0110|phys=usb-0000:00:14.0-1/input0|uniq=|name=USB Keyboard
```

- `vendor`, `product`, `version`: Cuatro caracteres hexadecimales en minúsculas.
- `phys`, `uniq`, `name`: Información reportada por el kernel. Si no están presentes se representan como texto vacío (ej: `uniq=`).
- No contiene `/dev/input/eventN` para evitar variaciones si los dispositivos cambian de nodo tras reconectar.

---

## Configuración y `devices.json`

Ruta por defecto:
`services/device-bridge/config/devices.json`

Formato:
```json
{
  "lin|vendor=1a2c|product=2d43|version=0110|phys=usb-0000:00:14.0-1/input0|uniq=|name=USB Keyboard": "dev01",
  "lin|vendor=1a2c|product=2d43|version=0110|phys=usb-0000:00:14.0-2/input0|uniq=|name=USB Keyboard": "dev02"
}
```

Reglas del validador:
- Objeto JSON plano.
- Claves no vacías y con formato `lin|...`.
- Valores estrictamente string con formato `devXX` (dos dígitos).
- Sin claves duplicadas.
- Sin identificadores lógicos duplicados.

---

## Normalización de Teclas

El bridge traduce teclas físicas de teclado estándar y teclado numérico (numpad) hacia los valores reconocidos:

| Teclas Físicas / evdev | Valor API |
| :--- | :--- |
| `0`..`9`, `KEY_0`..`KEY_9`, `KP0`..`KP9`, `KEY_KP0`..`KEY_KP9` | `'0'`..`'9'` |
| `.`, `DOT`, `KEY_DOT`, `KPDOT`, `KEY_KPDOT` | `'.'` |
| `+`, `PLUS`, `KEY_KPPLUS`, `KPPLUS` | `'+'` |
| `-`, `MINUS`, `KEY_MINUS`, `KPMINUS`, `KEY_KPMINUS` | `'-'` |
| `*`, `ASTERISK`, `KEY_KPASTERISK`, `KPASTERISK` | `'*'` |
| `/`, `SLASH`, `KEY_SLASH`, `KEY_KPSLASH`, `KPSLASH` | `'/'` |
| `ENTER`, `KEY_ENTER`, `KPENTER`, `KEY_KPENTER` | `'ENTER'` |
| `ESC`, `KEY_ESC` | `'ESC'` |
| `TAB`, `KEY_TAB` | `'TAB'` |
| `SPACE`, `KEY_SPACE` | `'SPACE'` |
| `BACKSPACE`, `KEY_BACKSPACE` | `'BACKSPACE'` |

> **Nota (Decisión Humana 4.B)**: Las teclas reconocidas sin función activa actual (como `4`, `5`, `6`, `0`, `ENTER`, etc.) también se envían al backend. El bridge no las descarta; la decisión de aceptar o rechazar pertenece a FastAPI. Teclas físicas no catalogadas se ignoran con log diagnóstico.

---

## Requisitos y Permisos en Linux

### Requisitos:
- Python 3.14
- Linux con soporte `evdev` y nodos `/dev/input/event*` (Plataforma de referencia: Linux Mint 22.3).
- Dependencia directa: `evdev>=1.9.3,<2` (gestionada mediante `uv`).

### Permisos de Acceso a `/dev/input`:
Para que un proceso no root pueda leer `/dev/input/event*`, el usuario debe tener permisos de lectura sobre esos nodos.

En Linux Mint / Debian / Ubuntu, esto se logra habitualmente agregando al usuario al grupo `input`:
```bash
sudo usermod -a -G input $USER
```
*(Requiere cerrar e iniciar sesión para que el grupo tome efecto)*.

---

## Ejecución y Parámetros CLI

El paquete registra el comando de consola `botonera2-device-bridge`.

### Ejecutar con uv:
```bash
# Ejecución estándar con defaults
uv run botonera2-device-bridge

# Especificando parámetros
uv run botonera2-device-bridge \
  --config services/device-bridge/config/devices.json \
  --url http://127.0.0.1:8000 \
  --timeout 3.0 \
  --intervalo-escaneo 2.0 \
  --log-level INFO
```

### Variables de Entorno Soportadas:
- `BOTONERA2_DEVICES_CONFIG`: Ruta al archivo `devices.json`.
- `BOTONERA2_BACKEND_URL`: URL base de FastAPI (ej: `http://127.0.0.1:8000`).
- `BOTONERA2_HTTP_TIMEOUT`: Timeout HTTP en segundos (ej: `3.0`).
- `BOTONERA2_SCAN_INTERVAL`: Intervalo de re-escaneo de dispositivos en segundos (ej: `2.0`).
- `BOTONERA2_LOG_LEVEL`: Nivel de log (`DEBUG`, `INFO`, `WARNING`, `ERROR`).

---

## Pruebas Automatizadas

Las pruebas del bridge se ejecutan mediante `pytest` y no requieren hardware real ni privilegios especiales gracias al `AdaptadorFalso`:

```bash
uv run pytest tests/device_bridge/
```

Para ejecutar la suite completa de calidad y tests:
```bash
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest
```

---

## Alcance Futuro y Pendientes

- **Remapeo rápido coordinado (WP-020)**: El flujo dinámico iniciado desde Moderación para reasignar un nuevo fingerprint a un `devXX` existente en caliente se construirá sobre las interfaces de este bridge.
- **Unidad systemd e instalación (Fase de Despliegue)**: El empaquetado del servicio `botonera2-device-bridge.service` y reglas udev se implementará en la etapa de despliegue productivo (DT-028).
