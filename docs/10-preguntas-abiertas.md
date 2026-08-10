# 10 - Decisiones técnicas abiertas

Las reglas de negocio principales ya están cerradas en `01-reglas-de-negocio.md`.

Las decisiones técnicas aprobadas se registran en `12-decisiones-tecnicas.md`.

Este archivo contiene **únicamente decisiones técnicas todavía abiertas**. Los agentes no deben resolverlas unilateralmente.

## Arquitectura, backend/datos y frontend ya cerrados

Quedaron resueltas DT-001 a DT-020. Ver `12-decisiones-tecnicas.md`.

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
- auditoría CSV estructurada con `flush` + `fsync` y fallo cerrado;
- Orden del Día parseado en backend;
- remapeo físico->lógico dentro del device-bridge;
- Nuxt 4 + TypeScript estricto;
- Tailwind CSS v4 + componentes propios;
- sin Pinia inicialmente;
- cliente API compartido REST/SSE;
- compartición frontend mínima y explícita;
- Full HD como referencia, con diseño responsive no dependiente del hardware actual.

## Prioridad D - Calidad y pruebas

### DT-021 Framework de pruebas backend
Definir pytest y herramientas auxiliares para unitarias, servicios de dominio, API e integración.

### DT-022 Pruebas frontend
Definir Vitest/Vue Test Utils u otra combinación para componentes, composables y cliente compartido.

### DT-023 Pruebas E2E
Definir Playwright u otra herramienta y qué recorridos críticos deben ejecutarse automáticamente.

### DT-024 Simulador de teclados
Definir una herramienta de desarrollo reproducible para generar pulsaciones sin hardware físico y cubrir concurrencia/casos de error.

### DT-025 CI
Definir GitHub Actions, checks obligatorios, lint, typecheck, tests y política de bloqueo de merge por PR.

### DT-026 Calidad estática
Definir Ruff/formatter/type checker para Python y ESLint/Prettier o equivalentes para frontend.

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

Antes del primer scaffold productivo deben estar cerradas, como mínimo:

- DT-021 a DT-026;
- DT-033 a DT-038.

Las decisiones DT-027 a DT-032 deben resolverse antes del despliegue productivo y conviene cerrarlas antes si condicionan la estructura inicial.

Cada decisión aprobada debe retirarse de este archivo y trasladarse a `12-decisiones-tecnicas.md` antes de que los agentes dependan de ella.
