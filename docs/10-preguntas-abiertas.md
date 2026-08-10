# 10 - Decisiones técnicas abiertas

Las reglas de negocio principales y las decisiones técnicas previas a la implementación están cerradas.

Las decisiones aprobadas se registran en:

- `12-decisiones-tecnicas.md` para arquitectura, backend/datos, frontend y calidad;
- `13-despliegue-y-operacion.md` para despliegue/operación;
- `14-gobernanza-agentes.md` para ramas, WPs, herramientas agénticas, revisión y autoridad.

## Estado actual

**No existen decisiones técnicas previas abiertas.**

Quedaron resueltas DT-001 a DT-038.

La implementación puede comenzar únicamente mediante los Work Packages versionados en `docs/work-packages/` y la secuencia aprobada en `docs/implementation/PLAN.md`.

## Decisiones nuevas durante la implementación

Este cierre no significa que nunca puedan aparecer decisiones nuevas.

Si durante un WP surge una cuestión que:

- modifica arquitectura, contratos o responsabilidades;
- cambia una decisión DT ya aprobada;
- incorpora una dependencia directa no prevista;
- altera reglas, criterios de aceptación, formatos canónicos, seguridad, auditoría, CI o despliegue;
- tiene consecuencias transversales o futuras relevantes;

el agente no debe resolverla unilateralmente.

Debe escalarla según DT-038 y, cuando corresponda, documentarla mediante un `DEC-XXX` aprobado antes de continuar el alcance afectado.

## Criterio de inicio de programación

Las condiciones documentales mínimas previas quedaron satisfechas.

Antes de ejecutar un WP concreto todavía deben cumplirse sus condiciones operativas:

1. el WP debe existir y estar aprobado en `docs/work-packages/`;
2. sus dependencias deben estar integradas o expresamente autorizadas;
3. debe tener rama y `git worktree` propios;
4. debe registrarse el agente implementador cuando pase a `EN_CURSO`;
5. la entrega debe pasar CI y revisión independiente antes de integrarse.

El hecho de que DT-001 a DT-038 estén cerradas **no autoriza a un agente a improvisar trabajo fuera del PLAN o de un WP aprobado**.