# Plan de implementación

Este archivo es el mapa canónico de implementación incremental de Botonera2.

No reemplaza las reglas de negocio, decisiones técnicas ni documentos propietarios. Su función es ordenar los Work Packages (WP), declarar dependencias y reflejar su estado.

## Estados permitidos

- `PENDIENTE`
- `EN_CURSO`
- `INTEGRADO`
- `BLOQUEADO`

## Reglas

- Cada WP debe tener un único resultado verificable.
- Cada WP se implementa en su propia rama `wp/NNN-descripcion-corta` y termina en una PR.
- Cada WP `EN_CURSO` debe tener un único agente implementador asignado y un `git worktree` propio.
- No se permite que dos agentes trabajen sobre el mismo WP, rama o working tree.
- Pueden ejecutarse WPs en paralelo solo cuando sean independientes y este PLAN lo permita.
- Un WP no debe comenzar si depende de otro WP aún no integrado, salvo autorización explícita documentada.
- Los agentes no deben ampliar silenciosamente el alcance de un WP.
- Las decisiones nuevas que cambien arquitectura, contratos globales o criterios transversales deben resolverse y documentarse antes de continuar el alcance afectado.
- El agente/herramienta asignado es información operativa y puede cambiar entre WPs; no forma parte de la arquitectura permanente del producto.

## Secuencia inicial

La secuencia concreta de implementación se definirá al terminar DT-037 y DT-038.

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-001 | Inicialización reproducible del monorepo y toolchains | PENDIENTE | - | - |

Los siguientes WPs se incorporarán a este plan antes de iniciar programación productiva.
