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
│   └── frontend-shared/  # código compartido entre frontends cuando corresponda
├── docs/
├── scripts/
└── ...
```

La estructura podrá ampliarse con archivos raíz de workspaces, tooling, CI y configuración, pero los cuatro componentes funcionales deben permanecer separados.

## DT-002 - Python

- Versión objetivo: **Python 3.14**.
- Gestor de proyectos/dependencias: **uv**.
- Debe existir lockfile versionado (`uv.lock`).
- Backend y `device-bridge` pueden formar parte de un workspace `uv` si resulta compatible con sus necesidades de ejecución.
- No usar `pip + requirements.txt` como fuente canónica de dependencias salvo exportaciones generadas para compatibilidad externa.

## DT-003 - Node.js y paquetes JavaScript

- Versión objetivo: **Node.js 24 LTS**.
- Gestor de paquetes: **pnpm**.
- Los proyectos Nuxt y paquetes TypeScript compartidos se organizarán mediante **pnpm workspaces**.
- El lockfile canónico será `pnpm-lock.yaml` y debe versionarse.

## DT-004 - Estado operativo del backend

El backend tendrá **un único estado operativo en memoria** por ejecución.

Principios:

- se crea durante el ciclo de vida de FastAPI;
- representa `SIN_PREPARAR`, `PREPARANDO` o `SESION_ABIERTA` y sus entidades activas;
- no se restaura desde disco después de una caída;
- toda mutación de negocio pasa por servicios/comandos del backend;
- comandos y pulsaciones concurrentes deben serializarse mediante un mecanismo único de exclusión/ordenamiento;
- el orden aceptado por ese mecanismo es el orden oficial que luego se registra.

No se permite distribuir el estado activo entre procesos independientes sin una futura decisión técnica que reemplace explícitamente esta arquitectura.

## DT-005 - Un solo proceso/worker de FastAPI

La ejecución productiva del backend utilizará **un único proceso/worker**.

Motivo: el estado activo es deliberadamente local y volátil. Varios workers crearían estados independientes e incompatibles con las invariantes de sesión y votación.

La capacidad requerida es pequeña y acotada: dispositivos físicos del recinto y pocos clientes web. No se busca escalar horizontalmente el estado operativo.

## DT-006 - Transporte frontend/backend

Se utilizará:

- **REST** para comandos y consultas puntuales;
- **Server-Sent Events (SSE)** para cambios de estado enviados desde backend a los frontends.

Flujo esperado:

1. al cargar o reconectar, el frontend solicita un snapshot completo por REST;
2. luego mantiene una suscripción SSE;
3. los comandos de Moderación se envían mediante REST;
4. ante pérdida/reconexión del stream, el cliente vuelve a obtener un snapshot completo antes de continuar;
5. Moderación y Recinto reciben proyecciones diferentes.

No se usará polling periódico como mecanismo normal de sincronización ni WebSocket salvo que una decisión posterior documentada lo reemplace.

## DT-007 - Contrato de API

La API interna nueva será **REST versionada bajo `/api/v1`**.

- FastAPI + Pydantic definen los esquemas de entrada/salida.
- OpenAPI generado por FastAPI es la definición técnica canónica del contrato HTTP.
- Los errores de dominio deben incluir identificadores estables legibles por máquina; no depender únicamente de mensajes humanos.
- Debe diferenciarse claramente entre comandos que mutan estado y consultas/proyecciones.
- Los contratos TypeScript de los frontends deben derivarse del contrato OpenAPI cuando sea práctico, evitando duplicación manual de modelos.

La compatibilidad transitoria con el bridge físico histórico puede mantener una ruta adaptadora distinta si fuera necesario; no obliga a copiar los endpoints internos históricos.

## DT-008 - Proyecciones separadas de estado

El backend generará al menos dos DTO/proyecciones diferentes:

- **ModerationState**: información necesaria para operar la sesión, incluyendo votos individuales cuando la política temporal configurada permita mostrarlos.
- **PublicState**: información apta para la Pantalla del Recinto.

Durante una votación `EN_CURSO`, `PublicState` no debe contener votos individuales ni eventos/datos capaces de revelarlos. El secreto del voto temporal se garantiza en servidor y no mediante ocultamiento visual en el frontend.

## Consecuencias para los agentes

Estas decisiones están cerradas. Los agentes no deben:

- dividir el sistema en repositorios independientes;
- sustituir `uv` o `pnpm` por otros gestores sin una decisión documentada;
- ejecutar múltiples workers del backend;
- reintroducir polling como sincronización principal;
- sustituir REST + SSE por WebSockets por iniciativa propia;
- entregar al frontend público el mismo DTO completo de Moderación;
- introducir una persistencia destinada a reconstruir una sesión caída.
