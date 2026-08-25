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
- Antes de iniciar un WP, el orquestador debe conocer el entorno operativo actual. Con Orca se utiliza el lanzador Orca integrado por WP-030/WP-031; en otros entornos se conserva `scripts/iniciar_wp.py`.

## Soporte operativo transversal

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-030 | Incorporar lanzador Orca y soporte multi-entorno para iniciar WPs preservando las validaciones del lanzador genérico | INTEGRADO | WP-001 | - |
| WP-031 | Lanzamiento sin prompt automático y salida copiable de OpenCode bajo Orca | INTEGRADO | WP-030 | - |

WP-030 fue incorporado después de definir la numeración funcional WP-001..WP-029; su número no representa una nueva fase de producto. Fue el bootstrap operativo transversal aprobado por DEC-007 y quedó integrado mediante PR #12.

WP-031 quedó integrado mediante PR #14 después de CI verde, revisión independiente con OpenCode + DeepSeek V4 Pro y validación manual exitosa del espejo de última respuesta en una terminal común de Orca. Desde ese punto, el lanzador Orca abre el agente sin inyectar `--prompt`: ChatGPT Web entrega el prompt exhaustivo visible al operador, que lo revisa y pega manualmente.

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
| WP-008 | Implementar autoridades, número de sesión y ciclo abrir/cerrar sesión sin votación activa | INTEGRADO | WP-005, WP-006 | - |

WP-007 puede avanzar en paralelo con WP-008 una vez integrado WP-006.

WP-007 quedó integrado mediante squash merge de PR #13 después de CI verde y revisión independiente secuencial con OpenCode + DeepSeek V4 Pro. Los hallazgos BLOQUEANTES e IMPORTANTES quedaron en cero. Se aceptó un único hallazgo MENOR no bloqueante sobre instrumentación interna del test de concurrencia; no altera el comportamiento funcional ni la aptitud del WP.

WP-008 quedó integrado mediante squash merge de PR #15 después de CI verde y revisión independiente secuencial con OpenCode + DeepSeek V4 Pro sobre el SHA exacto `59ecb5f88000df2172a1871724bc4791c067e10f`. La revisión concluyó `APTO PARA INTEGRAR`, con cero hallazgos BLOQUEANTES/IMPORTANTES y dos hallazgos MENORES no bloqueantes: robustez futura del handler de conflictos ante subclases y dos casos de borde no versionados en tests aunque verificados diagnósticamente. La validación OpenCode+Orca del espejo de salida también resultó exitosa.

## Fase 3 - Núcleo de votación

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-009 | Implementar apertura e inmutabilidad de una votación y bloqueo de aperturas incompatibles | INTEGRADO | WP-008 | - |
| WP-010 | Implementar voto ordinario, unicidad, irreversibilidad y autocierre de recepción por completitud, sin calcular resultado | INTEGRADO | WP-009, WP-006, WP-004 | - |
| WP-011 | Calcular y aplicar el resultado de una votación cerrada para mayoría SIMPLE o ESPECIAL, incluido `EMPATADA` transitorio en SIMPLE | INTEGRADO | WP-010 | - |
| WP-013 | Implementar finalización manual, pérdida de quórum, resultado `INCONCLUSA` y cierre de sesión con votación pendiente | INTEGRADO | WP-011, WP-008 | - |
| WP-014 | Implementar desempate presidencial sobre una votación `EMPATADA` y registrar su resultado final | INTEGRADO | WP-011, WP-013 | - |

WP-009 quedó integrado mediante squash merge de PR #16 sobre el candidato final `c68dfe94852b598a2cdd2edf243eb8b78420916c`, después de CI verde y revisión independiente secuencial con OpenCode + DeepSeek V4 Pro. La re-revisión final concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES, IMPORTANTES y MENORES. El squash merge produjo el commit `c2d5e29f8beb0a010cd69ba0df252cef45856cf9` en `main`. Durante la primera revisión se emitió un hallazgo IMPORTANTE sobre la construcción de un body JSON no finito; la re-revisión demostró que la premisa sobre el escape `}}` del f-string era incorrecta, retiró ese hallazgo y confirmó que el commit adicional solo fortaleció la especificidad de la prueba.

WP-010 quedó integrado mediante squash merge de PR #17 sobre el candidato final `25b39529edf124f59454a23f57949581ff57df1a`, después de CI verde en el run `32542647934` y revisión independiente secuencial con Antigravity + Gemini 3.7 Flash High. La revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES, IMPORTANTES y MENORES. El squash merge produjo el commit `20ca95b783ab81f516a5f0bd413c5b241201b607` en `main`.

WP-011 quedó integrado mediante squash merge de PR #18 sobre el candidato final `e49ae2d2825ab92f36fd97ac0b7f218d498adce4`, después de CI verde en el run `32585394682` y revisión independiente secuencial con Antigravity + Gemini 3.7 Flash High. La revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES, IMPORTANTES y MENORES. El squash merge produjo el commit `f36a1a9ec1d36966b4c31f89411452e130f82840` en `main`.

WP-013 quedó integrado mediante squash merge de PR #19 sobre el candidato final `b6a655fa99bb08265142441cdcda0998057e0918`, después de CI verde en el run `32602766244` y revisión independiente secuencial con Antigravity + Gemini 3.7 Flash High. La revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES, IMPORTANTES y MENORES. El squash merge produjo el commit `eab8116a4eedf9c006fe7fa3159bdf59ba0b8688` en `main`.

WP-014 quedó integrado mediante squash merge de PR #20 sobre el candidato final `c760ee67644dba32f603363c5069b7fb70f52a6e`, después de CI verde en el run `32606294816` y revisión independiente secuencial con Antigravity + Gemini 3.7 Flash High. La revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES, IMPORTANTES y MENORES. El squash merge produjo el commit `1158032f934f5466505b205c76fce9d8cbd0a593` en `main`.

DEC-010 separa el ciclo de vida de la votación (`EN_CURSO`/`CERRADA`) de su resultado (`APROBADA`/`RECHAZADA`/`EMPATADA`/`INCONCLUSA`). WP-010 cierra la recepción sin calcular resultado; WP-011 concentra en un único alcance el cálculo SIMPLE y ESPECIAL. El alcance que se había previsto para WP-012 queda absorbido por WP-011: no se creará `WP-012.md` para ese alcance y la numeración posterior se conserva sin renumerar para mantener trazabilidad. `EMPATADA` es un resultado transitorio y pendiente que debe resolverse posteriormente por desempate presidencial sobre la misma instancia de votación.

## Fase 4 - Capacidades backend complementarias

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-015 | Implementar cola y uso de la palabra, incluida pérdida por ausencia y transiciones sin avance implícito | INTEGRADO | WP-008, WP-006 | - |
| WP-016 | Implementar parser backend de Orden del Día y contrato de carga | INTEGRADO | WP-002 | - |
| WP-017 | Implementar snapshots `ModerationState`/`PublicState`, secreto temporal y streams SSE | INTEGRADO | WP-013, WP-014, WP-015, WP-016 | - |
| WP-018 | Implementar paquete TypeScript `api-client` derivado de OpenAPI con REST/SSE/reconexión | INTEGRADO | WP-017 | - |

WP-015 quedó integrado mediante squash merge de PR #22 sobre el candidato final `a9f7a304fb332fb40c3574bbf1b825db182b88cd`, después de CI verde en el run `32648143986` y revisión independiente final con Antigravity/AGY + Gemini 3.7 Flash High. La revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES, IMPORTANTES y MENORES. El candidato había incorporado previamente por merge normal el `main` que contenía WP-016, preservando ambos contratos. El squash merge produjo el commit `922b4076d25da1f9055f84c3f2b637db08fa851b` en `main`.

WP-016 quedó integrado mediante squash merge de PR #21 sobre el candidato final `a9f33169b2958428edcec8458351f90c73a90ee1`, después de CI verde en el run `32645383185` y re-revisión independiente final con OpenCode + DeepSeek V4 Pro. La revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES e IMPORTANTES. Se aceptó un único hallazgo MENOR no bloqueante sobre mantenibilidad del test determinista de concurrencia Caso C ante un futuro renombre interno de `_instalar_bajo_lock`. La dependencia directa `python-multipart>=0.0.18,<1` había sido aprobada explícitamente conforme DT-038. El squash merge produjo el commit `5ef8c293ffdaff2a3007cc926ece358a3a011ff7` en `main`.

WP-017 quedó integrado mediante squash merge de PR #23 sobre el candidato final `40180d2d05e673151204769b40232871ca1e559a`, después de CI verde en el run `32677898954` y revisión independiente final con Antigravity/AGY + Gemini 3.7 Flash High. La revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES, IMPORTANTES y MENORES; verificó 653 tests backend y todos los gates aplicables. El squash merge produjo el commit `25e1ffa4c3be3af5e6a3610dd1c3cef5434c657b` en `main`. DEC-013 quedó implementada sin nuevas dependencias directas ni decisiones DT-038 pendientes.

WP-018 quedó integrado mediante squash merge de PR #24 sobre el candidato final `01f0af26c42b81e444750400eb588239fe9dc6d2`, después de CI verde en el run `32681901272` y revisión independiente final con OpenCode + DeepSeek V4 Pro. La revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES e IMPORTANTES y cinco hallazgos MENORES no bloqueantes sobre cobertura nominal de un test de cancelación, política de reset de backoff, respuesta 2xx vacía no-204, un comentario de CI y mantenibilidad futura del alias `SolicitudAperturaVotacion`. Verificó 28 tests Vitest y 658 tests pytest. La única nueva dependencia directa externa fue `openapi-typescript@7.13.0` como `devDependency`, previamente aprobada por DEC-014/DT-038. El squash merge produjo el commit `5375a246e0040c54e6750ab9f76520c21a305925` en `main`.

## Hotfixes transversales

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-032 | Corregir pérdida de cancelación en fronteras temporales y estabilizar teardown/CI del backend | INTEGRADO | WP-017 | - |

WP-032 quedó integrado mediante squash merge de PR #28 sobre el candidato `ae0b5fa8e2c36b5a00f1711650e72e575d5e597d`, después de CI candidata #192 / run `32857548560` verde 6/6 y revisión independiente con OpenCode + DeepSeek V4 Pro, que concluyó `LISTA PARA INTEGRAR` con cero hallazgos BLOQUEANTES, IMPORTANTES y MENORES. El squash produjo `8e2cf38c0ddd4fd9a003df0754497253fcf710ff` en `main`. La CI post-merge #193 / run `32861046565` terminó `success` 6/6 y `Backend · pruebas` completó `uv run pytest` normalmente, confirmando que la condición de carrera de cancelación que había bloqueado el gate post-merge de WP-021 quedó corregida.

## Fase 5 - Hardware y bridge

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-019 | Implementar bridge físico base y compatibilidad de pulsaciones fingerprint → dispositivo lógico → backend | INTEGRADO | WP-006 | - |
| WP-020 | Implementar remapeo rápido físico→lógico coordinado desde Moderación/backend | INTEGRADO | WP-019, WP-017, WP-018 | - |

WP-019 quedó integrado mediante squash merge de PR #25 sobre el candidato final `20ee564b132d46b2f9cdfe39ea4e7642ffaf54ee`, después de CI verde en el run `32734716124` y re-revisión independiente final con OpenCode + DeepSeek V4 Pro. La primera revisión había detectado tres hallazgos IMPORTANTES sobre replay tardío por HTTP síncrono, clasificación de respuestas HTTP y falta de cobertura directa del adaptador evdev real; el implementador los corrigió y la re-revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES e IMPORTANTES y seis hallazgos MENORES no bloqueantes. Se verificaron 813 tests pytest, 155 tests específicos del bridge y 28 tests Vitest, además de todos los gates aplicables. La única nueva dependencia runtime directa fue `evdev>=1.9.3,<2`, previamente aprobada por DEC-015/DT-038. El squash merge produjo el commit `edc04af6baabbeeba29ee6fcf0c6e33af9ef5bec` en `main`.

WP-020 quedó integrado mediante squash merge de PR #26 sobre el candidato final `10d1a7763f3889e543c0cc7e3b65fa6bb6c76250`, después de CI verde en el run `32749012562` y revisión independiente con Antigravity/AGY + Gemini 3.7 Flash High. La revisión concluyó `LISTA PARA INTEGRAR`, con cero hallazgos BLOQUEANTES, IMPORTANTES y MENORES; verificó 836 tests pytest, 29 tests TypeScript y todos los gates aplicables. No se agregaron dependencias directas. El squash merge produjo el commit `a0e755654ab67ad8e137bce30f7ad0ccef9df19c` en `main`. La revisión confirmó además que la discrepancia preexistente entre `D-01..D-12` en `config/concejales.csv` y `dev01..dev12` en `devices.json` no fue introducida ni agravada por WP-020 y no bloquea esta integración, pero debe alinearse antes de una prueba integrada que utilice la configuración raíz.

## Fase 6 - Frontend de Moderación

| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-021 | Crear shell de Moderación, layout responsive y sincronización mediante `api-client` | INTEGRADO | WP-018 | - |
| WP-022 | Implementar UI de preparación, presencia, autoridades, sesión y advertencia de cierre con palabra pendiente | PENDIENTE | WP-021, WP-008 | - |
| WP-023 | Implementar UI de votaciones, resultado, desempate, Orden del Día y advertencia de apertura con palabra pendiente | PENDIENTE | WP-021, WP-014, WP-016 | - |
| WP-024 | Implementar UI de palabra con semántica Otorgar/Quitar definida, eventos y remapeo de dispositivos | PENDIENTE | WP-021, WP-015, WP-020 | - |

WP-021 quedó integrado mediante squash merge de PR #27 sobre el candidato final `660cacfe9e87ffb4e9fa7d189763d49bfb45ca01`, después de una tercera re-revisión independiente con OpenCode + DeepSeek V4 Pro que concluyó `LISTA PARA INTEGRAR` con cero hallazgos BLOQUEANTES e IMPORTANTES y un hallazgo MENOR no bloqueante. El squash produjo `2c037261e5a234bb95ce3463de5b4923884630c4` en `main`. Su primer gate post-merge quedó cancelado por una flake backend preexistente del teardown de fronteras temporales, posteriormente aislada y corregida por WP-032; la CI post-merge #193 / run `32861046565` sobre el main que incluye ambos cambios terminó verde 6/6, por lo que el cierre canónico de WP-021 queda completado.

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
6. si el entorno es Orca, se utiliza `scripts/iniciar_wp_orca.py NNN agente`; el launcher abre el agente sin prompt automático;
7. si el entorno es genérico/terminal/SSH/Warp u otro sin integración Orca, se utiliza `scripts/iniciar_wp.py NNN agente`;
8. el operador revisa y pega manualmente en el agente el prompt exhaustivo entregado por ChatGPT Web;
9. el agente trabaja dentro de su worktree aislado.

Los lanzadores no pueden aprobar WPs, cambiar su estado en PLAN ni modificar `main` para conseguir autorización.

## Próximo punto de control

WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-013, WP-014, WP-015, WP-016, WP-017, WP-018, WP-019, WP-020, WP-021, WP-030, WP-031 y WP-032 están `INTEGRADO` y sin agente operativo asignado.

DEC-007, DEC-009, DEC-010, DEC-011, DEC-012, DEC-013, DEC-014, DEC-015 y DEC-016 están vigentes. Orca continúa como entorno operativo preferido mientras esté en uso.

Con WP-021 cerrado, quedan habilitados documentalmente WP-022, WP-023 y WP-024 conforme a sus dependencias ya integradas. WP-025 también continúa disponible para ejecución en paralelo porque depende de WP-018 y WP-015, ambos integrados. Antes de lanzar cualquiera de ellos deben cumplirse nuevamente el preflight de formato, la selección de implementador/revisor y la transición a `EN_CURSO` conforme DEC-007.

La discrepancia preexistente `D-01..D-12` versus `dev01..dev12` debe resolverse antes de una prueba integrada que dependa de la configuración raíz.