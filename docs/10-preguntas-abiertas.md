# 10 - Decisiones técnicas abiertas

Las reglas de negocio principales ya están cerradas en `01-reglas-de-negocio.md`.

Las decisiones técnicas aprobadas se registran en:

- `12-decisiones-tecnicas.md` para arquitectura, backend/datos, frontend y calidad;
- `13-despliegue-y-operacion.md` para despliegue/operación;
- `14-gobernanza-agentes.md` para trabajo con agentes.

Este archivo contiene **únicamente decisiones técnicas todavía abiertas**. Los agentes no deben resolverlas unilateralmente.

## Arquitectura, backend/datos, frontend, calidad y despliegue ya cerrados

Quedaron resueltas DT-001 a DT-032.

## Gobernanza de agentes

### DT-033 Modelo de ramas — CERRADA

Modelo trunk-based simple:

- `main` como única rama estable de integración;
- sin commits directos a `main`;
- rama corta por Work Package: `wp/NNN-descripcion-corta`;
- PR obligatoria;
- CI verde antes de integrar;
- squash merge;
- eliminación de la rama luego del merge;
- sin `develop` ni GitFlow.

Ver `14-gobernanza-agentes.md`.

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

Antes del primer scaffold productivo deben estar cerradas DT-034 a DT-038.

Una vez cerradas, el repositorio tendrá definidas las reglas de negocio, arquitectura, stack, calidad, despliegue y gobernanza mínima necesaria para comenzar implementación incremental con agentes.

Cada decisión aprobada debe retirarse de este archivo y trasladarse a documentación canónica antes de que los agentes dependan de ella.
