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
- Las decisiones nuevas reservadas por DT-038 deben escalarse antes de continuar la parte afectada.
- El agente/herramienta asignado es información operativa y puede cambiar entre WPs; no forma parte de la arquitectura permanente del producto.
- Todo WP de implementación requiere CI aplicable verde y revisión independiente antes de integrarse.

## Fase 1 - Fundaciones reproducibles

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-001 | Inicializar monorepo, toolchains, scaffolds mínimos y CI base reproducible | PENDIENTE | - | - |
| WP-002 | Crear runtime base FastAPI, estado global inicial y serialización única de mutaciones | PENDIENTE | WP-001 | - |
| WP-003 | Implementar carga/validación/congelamiento de configuración y padrón | PENDIENTE | WP-001 | - |
| WP-004 | Implementar motor de auditoría CSV seguro y testeable | PENDIENTE | WP-001 | - |

WP-002, WP-003 y WP-004 pueden ejecutarse en paralelo después de integrar WP-001 porque sus responsabilidades son independientes y sus contratos quedarán delimitados en sus respectivos WPs.

## Fase 2 - Ciclo de sala, entradas y sesión

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-005 | Implementar `Preparar sala` y `Cancelar preparación` integrando configuración, padrón y auditoría | PENDIENTE | WP-002, WP-003, WP-004 | - |
| WP-006 | Implementar entrada lógica de dispositivos, presencia, test y cálculo de quórum | PENDIENTE | WP-005 | - |
| WP-007 | Crear simulador CLI reproducible de dispositivos y escenarios básicos | PENDIENTE | WP-006 | - |
| WP-008 | Implementar autoridades, número de sesión y ciclo abrir/cerrar sesión sin votación activa | PENDIENTE | WP-005, WP-006 | - |

WP-007 puede avanzar en paralelo con WP-008 una vez integrado WP-006.

## Fase 3 - Núcleo de votación

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-009 | Implementar apertura e inmutabilidad de una votación y bloqueo de aperturas incompatibles | PENDIENTE | WP-008 | - |
| WP-010 | Implementar voto ordinario, unicidad, irreversibilidad y autocierre por completitud | PENDIENTE | WP-009, WP-006, WP-004 | - |
| WP-011 | Implementar mayoría SIMPLE y estado `EMPATADA` | PENDIENTE | WP-010 | - |
| WP-012 | Implementar mayoría ESPECIAL sobre PRESENTES/CUERPO | PENDIENTE | WP-010 | - |
| WP-013 | Implementar finalización manual, pérdida de quórum, `INCONCLUSA` y cierre de sesión con votación pendiente | PENDIENTE | WP-011, WP-012, WP-008 | - |
| WP-014 | Implementar desempate presidencial | PENDIENTE | WP-011, WP-013 | - |

WP-011 y WP-012 pueden ejecutarse en paralelo después de WP-010.

## Fase 4 - Capacidades backend complementarias

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-015 | Implementar cola y uso de la palabra | PENDIENTE | WP-008, WP-006 | - |
| WP-016 | Implementar parser backend de Orden del Día y contrato de carga | PENDIENTE | WP-002 | - |
| WP-017 | Implementar snapshots `ModerationState`/`PublicState`, secreto temporal y streams SSE | PENDIENTE | WP-013, WP-014, WP-015 | - |
| WP-018 | Implementar paquete TypeScript `api-client` derivado de OpenAPI con REST/SSE/reconexión | PENDIENTE | WP-017 | - |

WP-015 y WP-016 pueden ejecutarse en paralelo con otros WPs cuando sus dependencias estén integradas. WP-016 debe respetar el contrato explícito de Orden del Día cerrado en DT-039.

## Fase 5 - Hardware y bridge

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-019 | Implementar bridge físico base y compatibilidad de pulsaciones fingerprint → dispositivo lógico → backend | PENDIENTE | WP-006 | - |
| WP-020 | Implementar remapeo rápido físico→lógico coordinado desde Moderación/backend | PENDIENTE | WP-019, WP-017 | - |

## Fase 6 - Frontend de Moderación

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-021 | Crear shell de Moderación, layout responsive y sincronización mediante `api-client` | PENDIENTE | WP-018 | - |
| WP-022 | Implementar UI de preparación, presencia, autoridades y sesión | PENDIENTE | WP-021, WP-008 | - |
| WP-023 | Implementar UI de votaciones, resultado, desempate y Orden del Día | PENDIENTE | WP-021, WP-014, WP-016 | - |
| WP-024 | Implementar UI de palabra, eventos y remapeo de dispositivos | PENDIENTE | WP-021, WP-015, WP-020 | - |

WP-022, WP-023 y WP-024 pueden ejecutarse en paralelo cuando sus dependencias estén integradas, usando worktrees diferentes y sin superposición no coordinada.

## Fase 7 - Pantalla del Recinto

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-025 | Crear shell público, bancas, presencia, quórum y uso de palabra | PENDIENTE | WP-018, WP-015 | - |
| WP-026 | Implementar experiencia pública de votación, secreto, revelado, resultados y temporizadores | PENDIENTE | WP-025, WP-014, WP-017 | - |

WP-025 puede desarrollarse en paralelo con los WPs de Moderación una vez disponible WP-018.

## Fase 8 - Integración y producción

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-027 | Completar E2E críticos integrando backend, simulador y ambos frontends | PENDIENTE | WP-007, WP-022, WP-023, WP-024, WP-026 | - |
| WP-028 | Implementar empaquetado y despliegue productivo: SPA, Nginx, systemd, releases y rollback | PENDIENTE | WP-027 | - |
| WP-029 | Validar bridge/hardware real, regresión funcional y candidato de producción | PENDIENTE | WP-019, WP-020, WP-027, WP-028 | - |

## Cobertura funcional esperada

Los criterios `CA-001` a `CA-060` de `docs/11-criterios-de-aceptacion.md` deben quedar asignados a WPs concretos a medida que se escriban sus especificaciones. Ningún criterio puede quedar sin cobertura antes de WP-029.

La trazabilidad se mantiene en cada WP y PR, no mediante una matriz duplicada permanente.

## Próximo punto de control

Antes de ejecutar WP-001:

1. revisar y aprobar este PLAN;
2. revisar y aprobar los primeros WPs versionados;
3. solo entonces marcar WP-001 como `EN_CURSO`, asignar agente, crear rama/worktree y comenzar implementación.
