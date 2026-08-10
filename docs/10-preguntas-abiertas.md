# 10 - Decisiones técnicas abiertas

Las reglas de negocio principales ya están cerradas en `01-reglas-de-negocio.md`.

Las decisiones técnicas aprobadas se registran en `12-decisiones-tecnicas.md`.

Este archivo contiene **únicamente decisiones técnicas todavía abiertas**. Los agentes no deben resolverlas unilateralmente.

## Arquitectura, backend/datos, frontend y calidad ya cerrados

Quedaron resueltas DT-001 a DT-026. Ver `12-decisiones-tecnicas.md`.

Resumen:

- monorepo;
- Python 3.14 + `uv`;
- Node.js 24 LTS + `pnpm` workspaces;
- estado único en memoria y un worker FastAPI;
- REST + SSE;
- API `/api/v1` con Pydantic/OpenAPI;
- proyecciones separadas Moderación/Recinto;
- sin base de datos inicial;
- configuración `system.toml` + padrón CSV + `devices.json` del bridge;
- auditoría CSV con `flush` + `fsync` y fallo cerrado;
- Orden del Día parseado en backend;
- remapeo físico→lógico dentro del device-bridge;
- Nuxt 4 + TypeScript estricto;
- Tailwind CSS v4 + componentes propios;
- sin Pinia inicialmente;
- cliente API compartido REST/SSE;
- compartición frontend mínima;
- Full HD como referencia con diseño responsive;
- pytest + HTTPX + AnyIO;
- Vitest + Nuxt Test Utils + Vue Test Utils;
- Playwright E2E en Chromium con Full HD y 1366×768 inicialmente;
- simulador CLI reproducible de dispositivos;
- GitHub Actions por PR;
- Ruff + Pyright / ESLint + Prettier + typecheck.

## Prioridad E - Despliegue

### DT-027 Sistema operativo objetivo
Confirmar Linux y distribución/versión objetivo de producción.

### DT-028 Servicio de procesos
Definir systemd, contenedores Docker u otra estrategia.

### DT-029 Servido de frontends
Definir si Nuxt se compila como aplicación estática, SSR o servidor Node, y cómo se publica junto al backend.

### DT-030 Proxy/puertos
Definir Nginx/Caddy/directo, URLs y política CORS/orígenes.

### DT-031 Actualizaciones y rollback
Definir procedimiento seguro para desplegar nuevas versiones sin poner en riesgo la versión operativa.

### DT-032 Backups de registros
Definir retención/copia externa de los CSV institucionales.

## Prioridad F - Trabajo con agentes

### DT-033 Modelo de ramas
Definir rama estable, ramas de trabajo, PR obligatoria y política de merge.

### DT-034 Tamaño de unidades de trabajo
Definir cómo descomponer la implementación en work packages pequeños y verificables.

### DT-035 Documentación para agentes
Definir artefactos adicionales: decisiones técnicas, planes, matrices de trazabilidad, especificaciones de work packages y checklist de entrega.

### DT-036 Agentes/herramientas
Definir herramientas principales (Codex, Claude Code, OpenCode, etc.), funciones de cada una y cómo evitar que varios agentes modifiquen el mismo alcance simultáneamente.

### DT-037 Revisión independiente
Definir que un agente distinto del implementador revise cada PR crítica y qué fuentes debe usar.

### DT-038 Autoridad de cambios
Definir qué decisiones puede tomar un agente por sí mismo y cuáles requieren decisión humana/documentada.

## Criterio para comenzar a programar

Antes del primer scaffold productivo deben estar cerradas, como mínimo, DT-033 a DT-038.

Las decisiones DT-027 a DT-032 conviene cerrarlas antes del scaffold porque pueden condicionar estructura de build, configuración y scripts de despliegue.

Cada decisión aprobada debe retirarse de este archivo y trasladarse a `12-decisiones-tecnicas.md` antes de que los agentes dependan de ella.
