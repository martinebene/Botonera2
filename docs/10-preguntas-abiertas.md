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
- DT-035: `PLAN.md` + especificación versionada por WP + `DEC-XXX` solo para decisiones transversales relevantes + template de PR; lectura normal `AGENTS.md -> WP -> fuentes canónicas indicadas`;
- DT-036: estrategia multiagente por roles; Codex implementador predeterminado, Claude Code/OpenCode como alternativas; un agente por WP; rama, worktree y sesión propios; paralelismo solo entre WPs independientes; sin automatización generativa en CI inicialmente.

Ver `14-gobernanza-agentes.md`.

### DT-037 Revisión independiente
Definir qué significa independencia entre implementador y revisor, qué PRs deben revisarse obligatoriamente y qué fuentes/evidencias debe inspeccionar el revisor antes de aprobar integración.

### DT-038 Autoridad de cambios
Definir qué decisiones puede tomar un agente por sí mismo y cuáles requieren decisión humana/documentada.

## Criterio para comenzar a programar

Antes del primer scaffold productivo deben estar cerradas DT-037 y DT-038.

Una vez cerradas, el repositorio tendrá definidas las reglas de negocio, arquitectura, stack, calidad, despliegue y gobernanza mínima necesaria para comenzar implementación incremental con agentes.

Cada decisión aprobada debe retirarse de este archivo y trasladarse a documentación canónica antes de que los agentes dependan de ella.
