# 10 - Decisiones técnicas abiertas

Las reglas de negocio principales ya están cerradas en `01-reglas-de-negocio.md`.

Las decisiones técnicas aprobadas se registran en `12-decisiones-tecnicas.md`.

Este archivo contiene **únicamente decisiones técnicas todavía abiertas**. Los agentes no deben resolverlas unilateralmente.

## Arquitectura base ya cerrada

Quedaron resueltas DT-001 a DT-008:

- monorepo;
- Python 3.14 + `uv`;
- Node.js 24 LTS + `pnpm` workspaces;
- estado operativo único en memoria;
- un solo proceso/worker FastAPI;
- REST + Server-Sent Events (SSE);
- API `/api/v1` con Pydantic/OpenAPI;
- proyecciones separadas para Moderación y Recinto.

Ver `12-decisiones-tecnicas.md`.

## Prioridad B - Backend y datos

### DT-009 Persistencia no operativa
Definir si además de los CSV se necesita alguna persistencia auxiliar para configuración/históricos o si la primera versión debe operar exclusivamente con archivos + memoria.

No se permite usar una persistencia para restaurar una sesión interrumpida.

### DT-010 Configuración
Definir formato y ubicación de archivos de configuración y padrón, validación al inicio de preparación y estrategia por entorno.

### DT-011 CSV de auditoría
Definir columnas exactas, delimitador, escape, codificación, timestamp, secuencia y nombres definitivos de archivos.

### DT-012 Escritura segura de CSV
Definir estrategia de flush/fsync, locking y manejo de errores de disco para satisfacer la regla de escritura inmediata.

### DT-013 Orden del Día
Definir dónde ocurre el parseo y el contrato técnico de errores de archivo, sin agregar validaciones institucionales.

### DT-014 Remapeo de dispositivos
Diseñar el mecanismo de remapeo rápido en memoria y su interacción con el bridge físico.

## Prioridad C - Frontend

### DT-015 Stack Nuxt
Definir versión de Nuxt/Vue/TypeScript y política de actualización.

### DT-016 Librería UI/estilos
Definir Tailwind, CSS propio, Nuxt UI u otra alternativa, teniendo en cuenta operación en pantalla fija, robustez y mantenimiento.

### DT-017 Estado frontend
Definir si basta con composables/useState o si corresponde Pinia.

### DT-018 Cliente API y tiempo real
Definir capa compartida para REST, SSE, reconexión, errores y sincronización de snapshots.

### DT-019 Componentes compartidos
Definir cuánto código UI/tipos/cliente API compartirán los dos frontends y dónde vivirá.

### DT-020 Estrategia responsive
Definir resoluciones objetivo de Moderación y Pantalla del Recinto y comportamiento mínimo ante otras resoluciones.

## Prioridad D - Calidad y pruebas

### DT-021 Framework de pruebas backend
Definir pytest y herramientas auxiliares.

### DT-022 Pruebas frontend
Definir Vitest/Vue Test Utils u otra combinación.

### DT-023 Pruebas E2E
Definir Playwright u otra herramienta y qué recorridos deben ejecutarse automáticamente.

### DT-024 Simulador de teclados
Definir una herramienta de desarrollo reproducible para generar pulsaciones sin hardware físico.

### DT-025 CI
Definir GitHub Actions, checks obligatorios, lint, typecheck y tests por PR.

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

- DT-010 a DT-012;
- DT-015 a DT-019;
- DT-021 a DT-026;
- DT-033 a DT-038.

DT-009, DT-013, DT-014 y las decisiones de despliegue deben resolverse antes de implementar el alcance que dependa de ellas.

Cada decisión aprobada debe retirarse de este archivo y trasladarse a `12-decisiones-tecnicas.md` antes de que los agentes dependan de ella.
