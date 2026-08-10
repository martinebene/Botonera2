# 12 - Decisiones técnicas

Este documento registra decisiones técnicas ya aprobadas para Botonera2. Complementa las reglas de negocio y evita que los agentes vuelvan a decidir aspectos ya cerrados.

Las decisiones aún no resueltas permanecen en `10-preguntas-abiertas.md`.

## DT-001 - Monorepo

Botonera2 será un **monorepo**.

Estructura objetivo inicial:

```text
Botonera2/
├── apps/
│   ├── backend/          # FastAPI
│   ├── moderacion/       # Nuxt
│   └── recinto/          # Nuxt
├── services/
│   └── device-bridge/    # captura/remapeo de dispositivos físicos
├── packages/
│   ├── api-client/       # cliente REST/SSE y tipos derivados
│   └── frontend-shared/  # código genuinamente común
├── config/
├── docs/
├── scripts/
└── ...
```

Los cuatro componentes funcionales deben permanecer separados aunque vivan en el mismo repositorio.

## DT-002 - Python

- Versión objetivo: **Python 3.14**.
- Gestor de proyectos/dependencias: **uv**.
- Lockfile canónico versionado: `uv.lock`.
- Backend y `device-bridge` pueden formar parte de un workspace `uv` cuando corresponda.
- `pip + requirements.txt` no será la fuente canónica de dependencias; solo puede existir como exportación de compatibilidad.

## DT-003 - Node.js y paquetes JavaScript

- Versión objetivo: **Node.js 24 LTS**.
- Gestor de paquetes: **pnpm**.
- Nuxt y paquetes TypeScript compartidos se organizan mediante **pnpm workspaces**.
- Lockfile canónico versionado: `pnpm-lock.yaml`.

## DT-004 - Estado operativo del backend

El backend tendrá **un único estado operativo en memoria** por ejecución.

Principios:

- se crea durante el ciclo de vida de FastAPI;
- representa `SIN_PREPARAR`, `PREPARANDO` o `SESION_ABIERTA` y sus entidades activas;
- no se restaura desde disco después de una caída;
- toda mutación de negocio pasa por servicios/comandos del backend;
- comandos y pulsaciones concurrentes se serializan mediante un mecanismo único de exclusión/ordenamiento;
- el orden aceptado por ese mecanismo es el orden oficial que luego se registra.

No se permite distribuir el estado activo entre procesos independientes sin una futura decisión técnica que reemplace explícitamente esta arquitectura.

## DT-005 - Un solo proceso/worker de FastAPI

La ejecución productiva del backend utilizará **un único proceso/worker**.

Varios workers crearían estados independientes incompatibles con las invariantes de sesión y votación. La capacidad requerida es pequeña y acotada; no se busca escalar horizontalmente el estado operativo.

## DT-006 - Transporte frontend/backend

Se utilizará:

- **REST** para comandos y consultas puntuales;
- **Server-Sent Events (SSE)** para cambios de estado enviados desde backend a los frontends.

Flujo:

1. al cargar o reconectar, el frontend solicita snapshot completo por REST;
2. luego mantiene una suscripción SSE;
3. los comandos de Moderación se envían mediante REST;
4. ante pérdida/reconexión del stream, el cliente obtiene nuevamente un snapshot completo antes de continuar;
5. Moderación y Recinto reciben proyecciones diferentes.

No se usará polling periódico como mecanismo normal ni WebSocket salvo decisión futura documentada.

## DT-007 - Contrato de API

La API interna nueva será **REST versionada bajo `/api/v1`**.

- FastAPI + Pydantic definen esquemas de entrada/salida.
- OpenAPI generado por FastAPI es la definición técnica canónica del contrato HTTP.
- Los errores de dominio incluyen identificadores estables legibles por máquina.
- Se distinguen comandos que mutan estado de consultas/proyecciones.
- Los contratos TypeScript deben derivarse de OpenAPI cuando sea práctico, evitando duplicar modelos manualmente.

La compatibilidad transitoria con el bridge histórico puede mantener una ruta adaptadora distinta; no obliga a copiar endpoints internos antiguos.

## DT-008 - Proyecciones separadas de estado

El backend genera al menos:

- **ModerationState**: información necesaria para operar, incluyendo votos individuales cuando la política temporal configurada lo permita;
- **PublicState**: información apta para Pantalla del Recinto.

Durante `EN_CURSO`, `PublicState` no contiene votos individuales ni eventos/datos capaces de revelarlos. El secreto temporal se garantiza en servidor.

## DT-009 - Sin base de datos en la primera versión

La primera versión operará con:

- estado activo en memoria;
- configuración en archivos;
- padrón en CSV;
- auditoría institucional en tres CSV.

No se incorporará PostgreSQL, SQLite ni otra base de datos. Una futura necesidad de histórico consultable o configuración administrable requerirá una decisión técnica nueva.

Ninguna persistencia futura podrá usarse implícitamente para reconstruir una sesión interrumpida sin cambiar explícitamente la regla de negocio correspondiente.

## DT-010 - Configuración por archivos

Estructura inicial:

```text
config/
├── system.toml
└── concejales.csv

services/device-bridge/
└── config/
    └── devices.json
```

### `system.toml`

Contiene configuración funcional/técnica del backend, incluyendo como mínimo:

- quórum;
- disposición de bancas;
- tipos descriptivos de votación;
- retardo para mostrar votos en Moderación;
- cuenta regresiva/efecto inicial público;
- permanencia del resultado público;
- directorio de registros;
- otras opciones explícitamente documentadas.

### `concejales.csv`

Contiene el padrón. Se valida al iniciar `PREPARANDO`; un padrón inválido bloquea la preparación.

### `devices.json`

Pertenece al `device-bridge` y contiene la relación entre fingerprints físicos y dispositivos lógicos.

La configuración funcional y el padrón se cargan al iniciar `PREPARANDO` y quedan congelados hasta cancelar preparación/cerrar sesión. El remapeo físico del bridge es una excepción operativa explícita.

## DT-011 - Formato de los CSV de auditoría

Cada preparación crea un conjunto nuevo dentro de una carpeta por día, con fecha y hora de inicio en el nombre:

```text
logs/
└── AAAA-MM-DD/
    ├── AAAA-MM-DD_HH-MM-SS-L1.csv
    ├── AAAA-MM-DD_HH-MM-SS-L2.csv
    └── AAAA-MM-DD_HH-MM-SS-L3.csv
```

Columnas canónicas iniciales:

```text
seq;timestamp;level;tag;event_code;message
```

Reglas:

- delimitador: `;`;
- codificación: **UTF-8 con BOM** para interoperabilidad directa con herramientas como Excel;
- timestamp: `AAAA-MM-DD HH:MM:SS`, hora local del servidor;
- `seq`: secuencia monotónica dentro de la preparación/sesión;
- `level`: 1, 2 o 3;
- `tag`: categoría funcional/técnica;
- `event_code`: identificador estable y legible por máquina;
- `message`: descripción humana legible.

La jerarquía sigue siendo acumulativa: L1 recibe eventos L1+L2+L3; L2 recibe L2+L3; L3 recibe solo L3.

## DT-012 - Escritura segura y fallo cerrado

Cada evento se persiste de forma síncrona bajo el mecanismo de serialización del backend:

1. escribir la fila correspondiente;
2. ejecutar `flush`;
3. ejecutar `fsync` para forzar persistencia al sistema de archivos antes de considerar completada la operación funcional asociada.

El volumen esperado permite priorizar integridad frente a throughput.

Si durante `PREPARANDO` o `SESION_ABIERTA` el backend pierde la capacidad de garantizar escritura de auditoría, debe entrar en **fallo cerrado** para nuevas operaciones que muten estado y exponer una condición técnica grave a Moderación. No debe continuar aceptando silenciosamente interacciones institucionales sin registro garantizado.

El diseño concreto debe evitar que un fallo al escribir un nivel produzca una falsa confirmación de una operación parcialmente auditada.

## DT-013 - Orden del Día procesado por backend

El CSV de Orden del Día se carga desde Moderación y se envía al backend.

El backend:

- lee/parsea el archivo;
- valida solo legibilidad y formato técnico interpretable;
- devuelve los puntos normalizados para asistencia de UI o un error técnico estable;
- no valida secuencia, unicidad ni legitimidad institucional del contenido.

El parser debe quedar testeado en backend y no duplicarse en Nuxt.

## DT-014 - Remapeo físico en el device-bridge

El identificador lógico que conoce el backend permanece estable.

Modelo:

```text
teclado físico (fingerprint) -> device-bridge -> identificador lógico (ej. dev05) -> backend -> concejal
```

Ante falla de un teclado, el remapeo rápido sustituye **el fingerprint físico asociado al mismo identificador lógico** dentro del bridge.

Consecuencias:

- no cambia la identidad del concejal;
- no cambia presencia;
- no cambia votos ya emitidos;
- puede ocurrir incluso durante una votación;
- no requiere modificar el padrón cargado en backend;
- queda registrado institucional/técnicamente;
- no reescribe automáticamente la configuración base salvo una futura decisión explícita.

La operación se inicia desde Moderación a través del backend; el frontend no se conecta directamente al bridge. El contrato backend↔bridge para ejecutar/capturar el remapeo se definirá dentro del work package correspondiente sin cambiar esta responsabilidad.

## DT-015 - Stack Nuxt

- **Nuxt 4** en la última versión estable seleccionada al crear el scaffold.
- Vue 3 gestionado por el ecosistema/dependencias de Nuxt.
- TypeScript en modo estricto.
- `nuxt typecheck` forma parte de los controles obligatorios.
- Las versiones resueltas quedan congeladas por `pnpm-lock.yaml`.
- Actualizaciones de dependencias se realizan de forma deliberada mediante PR; no se actualizan automáticamente en producción.

## DT-016 - Tailwind CSS y componentes propios

Los dos frontends utilizarán **Tailwind CSS v4** y componentes Vue/Nuxt propios.

No se incorporará Nuxt UI como dependencia inicial. La interfaz de Botonera2 es específica para operación institucional y pantalla fija; se prioriza control visual, bajo acoplamiento y facilidad de auditoría.

Puede utilizarse CSS propio complementario cuando Tailwind no sea la herramienta adecuada.

## DT-017 - Estado frontend sin Pinia inicialmente

No se usará Pinia en la primera versión salvo que aparezca una necesidad concreta documentada.

Principio:

- el estado autoritativo vive en FastAPI;
- cada frontend mantiene la proyección recibida y estado local puramente visual mediante composables, `useState`, `ref` y primitives de Vue/Nuxt;
- no se duplican máquinas de estado de negocio en el navegador.

## DT-018 - Cliente API compartido

Existirá un paquete compartido, inicialmente:

```text
packages/api-client/
```

Responsabilidades:

- tipos derivados de OpenAPI;
- cliente REST;
- manejo uniforme de errores y códigos de dominio;
- cliente SSE;
- reconexión;
- recuperación de snapshot completo;
- control de secuencia/sincronización;
- utilidades comunes de contrato.

Los componentes no deben implementar de forma dispersa sus propios flujos de `$fetch`/SSE para las mismas operaciones.

## DT-019 - Compartición frontend mínima y explícita

Se compartirá solo infraestructura y elementos genuinamente comunes entre Moderación y Recinto.

`packages/frontend-shared/` puede incluir:

- algoritmo/representación de disposición de bancas;
- utilidades visuales comunes;
- assets comunes;
- tipos auxiliares no generados por OpenAPI;
- componentes realmente idénticos cuando exista esa necesidad.

No se construirá preventivamente una gran librería UI común. Moderación y Recinto tienen objetivos operativos y visuales diferentes.

## DT-020 - Estrategia responsive y hardware de referencia

El hardware actual de Moderación y Pantalla del Recinto es **Full HD (1920×1080)**. Esa resolución es referencia de diseño y pruebas visuales, no requisito rígido.

Principios:

- las interfaces deben adaptarse a cambios razonables de monitor, resolución, escala del sistema operativo y configuración del navegador;
- no usar coordenadas o tamaños absolutos que hagan depender la funcionalidad de 1920×1080;
- Moderación debe conservar todas las capacidades y evitar solapamientos/crecimiento destructivo en resoluciones menores razonables;
- listas y paneles extensos utilizan scroll interno cuando corresponda;
- Pantalla del Recinto prioriza la composición 16:9 pero debe responder de manera controlada ante otras relaciones de aspecto;
- texto, bancas, indicadores y controles críticos deben mantener legibilidad y jerarquía visual;
- los tests de frontend/E2E deben incluir al menos Full HD y una o más resoluciones alternativas definidas al implementar pruebas.

El cambio futuro de hardware no debe requerir cambiar reglas de negocio ni reescribir la interfaz.

## Consecuencias para los agentes

DT-001 a DT-020 están cerradas. Los agentes no deben, sin una nueva decisión documentada:

- dividir el sistema en repositorios independientes;
- sustituir `uv`, `pnpm`, Nuxt 4 o Tailwind v4 por otras bases;
- introducir una base de datos;
- ejecutar múltiples workers del backend;
- reintroducir polling como sincronización principal;
- sustituir REST + SSE por WebSockets;
- entregar al frontend público el DTO completo de Moderación;
- parsear el Orden del Día exclusivamente en frontend;
- aceptar mutaciones si la auditoría obligatoria no puede persistirse;
- implementar el remapeo cambiando votos, presencia o identidad del concejal;
- introducir Pinia o una librería UI extensa por iniciativa propia;
- asumir que la UI solo funcionará a 1920×1080.
