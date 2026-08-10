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

Quedaron resueltas:

- DT-033: modelo trunk-based simple con rama corta por WP, PR obligatoria, CI verde y squash merge;
- DT-034: WPs pequeños, orientados a un único resultado verificable, con dependencias, alcance, exclusiones, criterios de aceptación y una PR por WP;
- DT-035: `PLAN.md` + especificación versionada por WP + `DEC-XXX` solo para decisiones transversales relevantes + template de PR; lectura normal `AGENTS.md -> WP -> fuentes canónicas indicadas`.

Ver `14-gobernanza-agentes.md`.

### DT-036 Agentes/herramientas
Definir herramientas principales (Codex, Claude Code, OpenCode, etc.), funciones de cada una y cómo evitar que varios agentes modifiquen el mismo alcance simultáneamente.

### DT-037 Revisión independiente
Definir que un agente distinto del implementador revise cada PR crítica y qué fuentes debe usar.

### DT-038 Autoridad de cambios
Definir qué decisiones puede tomar un agente por sí mismo y cuáles requieren decisión humana/documentada.

## Criterio para comenzar a programar

Antes del primer scaffold productivo deben estar cerradas DT-036 a DT-038.

Una vez cerradas, el repositorio tendrá definidas las reglas de negocio, arquitectura, stack, calidad, despliegue y gobernanza mínima necesaria para comenzar implementación incremental con agentes.

Cada decisión aprobada debe retirarse de este archivo y trasladarse a documentación canónica antes de que los agentes dependan de ella.
