# Botonera2

Reimplementación desde cero del sistema de votación del Concejo Deliberante de Puerto Madryn.

## Objetivo

Construir una nueva versión mantenible y verificable compuesta por:

- backend FastAPI como única autoridad de estado y reglas de negocio;
- frontend Nuxt.js de Moderación;
- frontend Nuxt.js de Pantalla del Recinto;
- servicio/bridge independiente para capturar los teclados físicos y enviar sus pulsaciones al backend.

La documentación de este repositorio es la especificación canónica para Botonera2 y debe permitir que agentes de programación implementen el sistema sin reinterpretar las reglas institucionales ni técnicas ya decididas.

## Fuentes históricas

El sistema actualmente en producción está en `martinebene/Botonera`, rama `main`.

Referencia histórica de producción:

- repositorio: `https://github.com/martinebene/Botonera`
- rama: `main`
- snapshot usado para el relevamiento inicial: `537823b4a0045853c74a388058fa3739cf7457a5`

Existe además una rama histórica `v2`, no validada en producción. Puede aportar contexto técnico, pero no es fuente normativa.

### Regla de autoridad

1. La documentación vigente de **Botonera2** manda para la nueva implementación.
2. Para reglas extraídas del sistema anterior, se tomó como fuente de verdad el **código ejecutable de `Botonera/main`**, no su documentación antigua.
3. `Botonera/v2`, README, manuales, comentarios y documentación histórica sirven solo como contexto salvo referencia expresa.
4. El repositorio histórico solo debe consultarse en el futuro para descargar assets o validar explícitamente una regla dudosa.

## Ciclo funcional global

El sistema tiene tres estados globales:

`SIN_PREPARAR -> PREPARANDO -> SESION_ABIERTA -> SIN_PREPARAR`

- `SIN_PREPARAR`: no existe interacción funcional con los dispositivos.
- `PREPARANDO`: se cargan configuración y concejales, se identifican autoridades, se acredita presencia y se prueban teclados.
- `SESION_ABIERTA`: se habilitan votaciones y uso de la palabra.
- Cancelar preparación o cerrar sesión devuelve el sistema a `SIN_PREPARAR`.

El estado operativo es deliberadamente **volátil y en memoria**. Una interrupción técnica no se recupera: reglamentariamente corresponde preparar nuevamente la sala y abrir una nueva sesión.

## Principios funcionales centrales

- Una sola preparación/sesión activa por vez.
- Una sola votación activa por vez.
- El backend decide toda transición de negocio.
- La presencia la cambia únicamente el dispositivo físico del concejal.
- Cada concejal puede emitir como máximo un voto ordinario por votación y ese voto es irreversible.
- Presidencia es un rol institucional independiente del rol Concejal.
- El voto presidencial de desempate existe solo para mayorías simples empatadas.
- Mayoría simple y mayoría especial son conceptos distintos.
- Las votaciones públicas mantienen secretos los votos individuales hasta el cierre.
- Todas las interacciones relevantes se escriben inmediatamente en tres archivos CSV jerárquicos.
- El Orden del Día es solo una ayuda de carga; no es autoridad para el sistema y no limita qué puede votar el cuerpo.

## Arquitectura técnica base aprobada

Botonera2 será un **monorepo** con separación entre backend, los dos frontends y el bridge físico.

Decisiones ya cerradas:

- Python 3.14 + `uv`;
- Node.js 24 LTS + `pnpm` workspaces;
- FastAPI con un único proceso/worker y un único estado operativo en memoria;
- API REST nueva versionada bajo `/api/v1`;
- Pydantic/OpenAPI como contrato técnico;
- REST para comandos y snapshots;
- Server-Sent Events (SSE) para actualizaciones backend -> frontend;
- proyecciones separadas `ModerationState` y `PublicState`;
- secreto temporal de votos protegido desde backend.

Ver `docs/12-decisiones-tecnicas.md`.

## Estructura ejecutable

```text
apps/backend/              paquete Python importable; FastAPI llegará en WP-002
apps/moderacion/           SPA Nuxt 4 de Moderación
apps/recinto/              SPA Nuxt 4 pública
services/device-bridge/    paquete Python importable; todavía sin hardware
packages/api-client/       entrada reservada para REST/SSE y tipos
packages/frontend-shared/  entrada reservada para código realmente común
tools/device-simulator/    ubicación reservada para la futura CLI
scripts/iniciar_wp.py      lanzador seguro de Work Packages
config/                    ubicación reservada para datos funcionales
```

Los paquetes vacíos son límites arquitectónicos deliberados. No contienen
contratos ni reglas funcionales anticipadas.

## Requisitos y bootstrap

- Python 3.14, fijado por `.python-version`;
- `uv`, único gestor de proyectos y dependencias Python;
- Node.js 24 LTS, fijado por `.nvmrc` y `.node-version`;
- pnpm 11, fijado por `packageManager` en `package.json`.

Desde un clon limpio, los dos gestores deben respetar los lockfiles:

```powershell
uv sync --frozen
pnpm install --frozen-lockfile
```

`uv` puede instalar el intérprete requerido con `uv python install 3.14`. En
Node, Corepack o un gestor de versiones puede activar la versión declarada;
`corepack enable` y `corepack install` respetan el `packageManager` versionado.

## Comandos de desarrollo y calidad

Todos los comandos se ejecutan desde la raíz y funcionan igual en PowerShell y
en una terminal POSIX:

```powershell
# Python
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest

# TypeScript, Vue y Nuxt
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` ejecuta `nuxt generate` para ambos frontends. Los artefactos
estáticos quedan en `apps/moderacion/.output/public` y
`apps/recinto/.output/public`; no requieren un servidor Node en producción.
Para desarrollo interactivo existen `pnpm dev:moderacion` y
`pnpm dev:recinto`.

## Inicio aislado de un Work Package

Después de que una persona apruebe el WP, lo marque `EN_CURSO` en
`docs/implementation/PLAN.md` y asigne un agente, ejecutá desde el checkout
coordinador limpio en `main`:

```powershell
uv run python scripts/iniciar_wp.py 002 codex
uv run python scripts/iniciar_wp.py 015 claude
uv run python scripts/iniciar_wp.py 016 opencode
```

El lanzador hace `fetch`, permite actualizar `main` solo por fast-forward,
valida aprobación, estado, agente y dependencias, y crea una rama
`wp/NNN-descripcion` en un worktree hermano `Botonera2-wpNNN`. Si la relación
rama/worktree ya es inequívocamente la misma, la reutiliza. Ante una CLI
ausente o un conflicto se detiene sin borrar ni reparar trabajo.

El script no aprueba WPs, no edita el PLAN, no crea commits ni PRs, no integra
cambios y no despliega. WP-001 fue la única excepción preparada manualmente.

## Herramientas MCP estándar para agentes

Los MCP son herramientas del entorno del agente, no dependencias del producto.
DEC-003 asigna estas responsabilidades:

- **Context7:** documentación externa actual y específica de versión;
- **Nuxt MCP:** referencia oficial preferente para Nuxt 4;
- **Playwright MCP:** exploración del navegador complementaria a tests
  Playwright versionados;
- **GitHub MCP o integración equivalente:** contexto y operaciones sobre
  GitHub únicamente dentro de la autoridad ya aprobada.

Antes de depender de una herramienta, comprobá el inventario y su estado:

```powershell
codex mcp list
claude mcp list
opencode mcp list
```

La sintaxis puede evolucionar; verificá también `mcp --help` en cada CLI y la
documentación primaria enlazada abajo. Ejemplos orientativos de configuración
personal, que **no deben copiarse al repositorio**, son:

```powershell
# Codex: servidor local y servidor HTTP remoto
codex mcp add context7 -- npx -y @upstash/context7-mcp
codex mcp add nuxt --url https://nuxt.com/mcp

# Claude Code: configuración de usuario para un servidor HTTP
claude mcp add --scope user --transport http nuxt https://nuxt.com/mcp

# OpenCode: agregar/listar servidores según la versión instalada
opencode mcp --help
opencode mcp list
```

En OpenCode también se puede declarar un servidor local o remoto bajo `mcp`
en la configuración personal. Usá sustituciones de variables de entorno para
tokens; nunca escribas el valor del secreto en un JSON versionado. Playwright
MCP y GitHub requieren revisar primero el servidor oficial, los permisos y el
método de autenticación apropiado para el entorno.

Fuentes primarias vigentes para completar o ajustar la configuración:

- [MCP en Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli);
- [MCP en Claude Code](https://docs.claude.com/en/docs/mcp);
- [MCP en OpenCode](https://opencode.ai/docs/mcp-servers/);
- [Nuxt MCP](https://nuxt.com/mcp);
- [Playwright MCP](https://github.com/microsoft/playwright-mcp);
- [GitHub MCP Server](https://github.com/github/github-mcp-server).

Si un MCP necesario no está disponible, el agente debe avisar qué herramienta
falta, para qué se necesitaba, qué alternativa primaria/equivalente existe y
qué impacto tiene continuar. Solo puede seguir si el fallback no cambia
arquitectura, alcance, contratos ni pruebas y no obliga a adivinar una API. La
configuración personal (`~/.codex/config.toml` y equivalentes), API keys,
tokens, cookies y credenciales nunca se versionan.

## Lectura obligatoria para agentes

Para un WP normal, seguí el flujo acotado definido por `AGENTS.md`:

1. leer `AGENTS.md`;
2. leer el `docs/work-packages/WP-XXX.md` asignado;
3. leer solo las fuentes canónicas y secciones que ese WP declare;
4. leer las decisiones transversales obligatorias vigentes;
5. inspeccionar únicamente el código y las pruebas necesarios para el alcance.

Una auditoría global, una planificación transversal o la resolución de una
contradicción documental pueden requerir el conjunto más amplio de fuentes que
enumera `AGENTS.md`.

## Estado actual

WP-001 incorpora el scaffold ejecutable y reproducible del monorepo. Todavía no
existen reglas de negocio, endpoints funcionales, conexión con dispositivos ni
datos institucionales: esos resultados pertenecen a Work Packages posteriores.
