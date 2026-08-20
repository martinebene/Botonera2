# Plan de implementación

**Estado del PLAN: APROBADO**

Este archivo es el mapa canónico de implementación incremental de Botonera2.

No reemplaza las reglas de negocio, decisiones técnicas ni documentos propietarios. Su función es ordenar los Work Packages (WP), declarar dependencias y reflejar su estado.

## Estados permitidos

- `PENDIENTE`
- `EN_CURSO`
- `INTEGRADO`
- `BLOQUEADO`

## Reglas

- Cada WP debe tener un único resultado verificable.
- Cada WP se implementa en una rama corta propia y termina en una PR. La forma de la rama depende del entorno según DEC-007: `wp/NNN-descripcion-corta` en el lanzador genérico o la rama nativa trazable generada por Orca a partir del workspace `wp/NNN-descripcion-corta`.
- Cada WP `EN_CURSO` debe tener un único agente implementador asignado y un `git worktree` propio.
- No se permite que dos agentes actúen simultáneamente sobre el mismo WP, rama o working tree. Las sesiones del implementador y del revisor pueden permanecer abiertas en el mismo worktree si el relevo es estrictamente secuencial y el agente que no tiene el turno permanece inactivo.
- Pueden ejecutarse WPs en paralelo solo cuando sean independientes y este PLAN lo permita.
- Un WP no debe comenzar si depende de otro WP aún no integrado, salvo autorización explícita documentada.
- Los agentes no deben ampliar silenciosamente el alcance de un WP.
- Las decisiones nuevas reservadas por DT-038 deben escalarse antes de continuar la parte afectada.
- El agente/herramienta asignado es información operativa y puede cambiar entre WPs; no forma parte de la arquitectura permanente del producto.
- No existe un implementador universal predeterminado: el agente se asigna por WP según complejidad, riesgo, capacidad, disponibilidad/cuota e integración con el entorno, conforme a DEC-007.
- Todo WP de implementación requiere CI aplicable verde y revisión independiente antes de integrarse.
- La aprobación de este PLAN aprueba la secuencia y dependencias generales; cada `WP-XXX.md` debe estar individualmente `APROBADO` antes de pasar a `EN_CURSO`.
- Los `WP-NNN.md` son también entrada estructurada para los lanzadores. Antes de aprobarlos y nuevamente antes de pasarlos a `EN_CURSO`, el orquestador debe verificar `docs/implementation/FORMATO_WP_LANZADORES.md`; en particular, dentro de `## Dependencias` solo pueden aparecer identificadores `WP-NNN` que sean dependencias reales.
- Antes de delegar cualquier implementación, corrección o revisión, el orquestador debe verificar `docs/implementation/PROMPTS_AGENTES.md` y construir un prompt explícito que no dependa de inferencias tácitas del agente.
- Una implementación no se considera lista para revisión solo porque el código y tests locales terminen: debe existir candidato remoto identificable con commits, sincronización final, validaciones repetidas, push, PR y SHA exacto, salvo que la tarea haya sido expresamente parcial.
- Antes de iniciar un WP, el orquestador debe conocer el entorno operativo actual. Con Orca se utiliza el lanzador Orca integrado por WP-030; en otros entornos se conserva `scripts/iniciar_wp.py`.

## Soporte operativo transversal

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-030 | Incorporar lanzador Orca y soporte multi-entorno para iniciar WPs preservando las validaciones del lanzador genérico | INTEGRADO | WP-001 | - |
| WP-031 | Separar lanzamiento Orca del prompt automático y habilitar salida copiable de OpenCode bajo Orca | PENDIENTE | WP-030 | - |

WP-030 fue incorporado después de definir la numeración funcional WP-001..WP-029; su número no representa una nueva fase de producto. Fue el bootstrap operativo transversal aprobado por DEC-007 y quedó integrado mediante PR #12. Desde este punto, cuando Orca sea el entorno activo, el camino normal para iniciar un WP autorizado es `scripts/iniciar_wp_orca.py`.

WP-031 está documentalmente `APROBADO` y continúa `PENDIENTE` hasta que el operador autorice su inicio y se asigne implementador. Su alcance aprobado retira del launcher Orca el prompt automático breve, conserva el prompt exhaustivo como salida visible de ChatGPT Web para copia/pegado manual y agrega la regla condicional de salida copiable únicamente para OpenCode bajo Orca.

## Fase 1 - Fundaciones reproducibles

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-001 | Inicializar monorepo, toolchains, scaffolds mínimos, CI base reproducible y lanzador local de WPs | INTEGRADO | - | - |
| WP-002 | Crear runtime base FastAPI, estado global inicial y serialización única de mutaciones | INTEGRADO | WP-001 | - |
| WP-003 | Implementar carga/validación/congelamiento de configuración y padrón | INTEGRADO | WP-001 | - |
| WP-004 | Implementar motor de auditoría CSV seguro y testeable | INTEGRADO | WP-001 | - |

WP-002, WP-003 y WP-004 pueden ejecutarse en paralelo después de integrar WP-001 porque sus responsabilidades son independientes y sus contratos quedan delimitados en sus respectivos WPs.

## Fase 2 - Ciclo de sala, entradas y sesión

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-005 | Implementar `Preparar sala` y `Cancelar preparación` integrando configuración, padrón y auditoría | INTEGRADO | WP-002, WP-003, WP-004 | - |
| WP-006 | Implementar entrada lógica de dispositivos, presencia, test y cálculo de quórum | INTEGRADO | WP-005 | - |
| WP-007 | Crear simulador CLI reproducible de dispositivos y escenarios básicos | INTEGRADO | WP-006 | - |
| WP-008 | Implementar autoridades, número de sesión y ciclo abrir/cerrar sesión sin votación activa | PENDIENTE | WP-005, WP-006 | - |

WP-007 puede avanzar en paralelo con WP-008 una vez integrado WP-006. Con WP-030 integrado, ya no existe un bloqueo operativo transversal para iniciar cualquiera de ellos cuando su WP individual esté aprobado, pase a `EN_CURSO` y tenga agente asignado.

WP-007 quedó integrado mediante squash merge de PR #13 después de CI verde y revisión independiente secuencial con OpenCode + DeepSeek V4 Pro. Los hallazgos BLOQUEANTES e IMPORTANTES quedaron en cero. Se aceptó un único hallazgo MENOR no bloqueante sobre instrumentación interna del test de concurrencia; no altera el comportamiento funcional ni la aptitud del WP y no se incorpora silenciosamente a WP-031.

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
| WP-015 | Implementar cola y uso de la palabra, incluida pérdida por ausencia y transiciones sin avance implícito | PENDIENTE | WP-008, WP-006 | - |
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
| WP-022 | Implementar UI de preparación, presencia, autoridades, sesión y advertencia de cierre con palabra pendiente | PENDIENTE | WP-021, WP-008 | - |
| WP-023 | Implementar UI de votaciones, resultado, desempate, Orden del Día y advertencia de apertura con palabra pendiente | PENDIENTE | WP-021, WP-014, WP-016 | - |
| WP-024 | Implementar UI de palabra con semántica Otorgar/Quitar definida, eventos y remapeo de dispositivos | PENDIENTE | WP-021, WP-015, WP-020 | - |

WP-022, WP-023 y WP-024 pueden ejecutarse en paralelo cuando sus dependencias estén integradas, usando worktrees diferentes y sin superposición no coordinada. Las advertencias de WP-022/WP-023 consumen el estado de palabra ya disponible a través de la proyección compartida; no agregan una precondición nueva al backend.

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

Los criterios `CA-001` a `CA-063` de `docs/11-criterios-de-aceptacion.md` deben quedar asignados a WPs concretos a medida que se escriban sus especificaciones. Ningún criterio puede quedar sin cobertura antes de WP-029.

En particular:

- CA-061 corresponde al dominio de palabra de WP-015 y su representación/controles en WP-024;
- CA-062 corresponde a la advertencia de apertura de votación de WP-023;
- CA-063 corresponde a la advertencia de cierre de sesión de WP-022;
- WP-027 debe cubrir estos recorridos de forma integrada cuando corresponda.

La trazabilidad se mantiene en cada WP y PR, no mediante una matriz duplicada permanente.

## Inicio local de WPs

DEC-002 y DEC-007 establecen un flujo común de autorización con lanzamiento específico según entorno:

1. el planificador/humano aprueba el WP después de que el orquestador verifique el formato parseable de `FORMATO_WP_LANZADORES.md`;
2. se cambia su estado a `EN_CURSO` y se asigna el agente en este PLAN, repitiendo el preflight parseable antes de habilitar el lanzamiento;
3. el orquestador construye/verifica el prompt exhaustivo según `PROMPTS_AGENTES.md`;
4. el operador actualiza su checkout coordinador de `main`;
5. el orquestador determina el entorno actual;
6. si el entorno es Orca, se utiliza `scripts/iniciar_wp_orca.py NNN agente`;
7. si el entorno es genérico/terminal/SSH/Warp u otro sin integración Orca, se utiliza `scripts/iniciar_wp.py NNN agente`;
8. el lanzador correspondiente valida estado/dependencias y prepara el agente dentro de un worktree aislado según las reglas de su entorno.

Los lanzadores **no** pueden efectuar los pasos 1 o 2 ni modificar `main` para conseguirlos.

WP-001 fue la excepción inicial para construir el lanzador genérico. WP-030 fue la excepción de bootstrap para construir el lanzador Orca; ambos están integrados y sus lanzadores pasan a ser caminos operativos normales según el entorno.

## Próximo punto de control

WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007 y WP-030 están `INTEGRADO` y sin agente operativo asignado.

DEC-007 está vigente: Orca es el entorno operativo preferido mientras esté en uso, no existe un implementador universal predeterminado y los agentes se seleccionan por complejidad/capacidad/cuota manteniendo revisión independiente.

El próximo paso acordado es **WP-031**, actualmente `PENDIENTE` y documentalmente `APROBADO`. Ya no tiene decisiones abiertas de planificación. Para comenzar su implementación solo resta autorizar el paso a `EN_CURSO`, asignar implementador, sincronizar el checkout coordinador y lanzar el worktree según el entorno.

WP-008 mantiene sus dependencias funcionales satisfechas y continúa `PENDIENTE`, pero la secuencia operativa acordada prioriza cerrar WP-031 antes de iniciar el siguiente WP funcional.