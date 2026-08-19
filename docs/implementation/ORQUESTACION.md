# Orquestación operativa de la implementación

Este documento describe el procedimiento práctico de coordinación de Botonera2. Deriva de `DEC-004` y `DEC-005` y no reemplaza `AGENTS.md`, los Work Packages ni las decisiones canónicas.

## Rol del orquestador

La coordinación y planificación documental se realizan preferentemente desde una conversación de ChatGPT Web con acceso independiente a GitHub.

El orquestador consulta directamente `martinebene/Botonera2`, verifica `main`, ramas, PR, SHA, CI y merges, reconstruye el estado vigente, identifica el próximo WP habilitado, carga únicamente las fuentes canónicas necesarias y planifica su definición junto con el operador humano antes de delegar implementación.

Cuando durante la planificación aparece una decisión reservada por DT-038, el orquestador la presenta al operador con alternativas, impacto y recomendación, y solo la incorpora a la documentación canónica después de una decisión humana explícita.

El orquestador entrega al operador comandos y prompts para ejecutar en Warp, recibe las salidas locales y las contrasta con GitHub antes de habilitar transiciones. Una conversación nueva reconstruye el estado desde el repositorio y no depende de memoria de conversaciones anteriores.

## Fuentes mínimas de una conversación nueva

Leer en este orden:

1. `AGENTS.md`;
2. `docs/decisions/DEC-004-orquestacion-revision-secuencial-y-sincronizacion.md`;
3. `docs/decisions/DEC-005-planificacion-y-autoridad-documental-del-orquestador.md`;
4. `docs/implementation/ORQUESTACION.md`;
5. `docs/implementation/PLAN.md`;
6. PR abiertas o recientemente integradas relevantes;
7. el `WP-XXX.md` concreto cuando corresponda.

No es necesario reconstruir toda la historia si el repositorio ya contiene el estado canónico vigente.

## Planificación documental de un WP

Antes de iniciar implementación, el orquestador:

1. identifica el próximo WP permitido por `PLAN.md` y sus dependencias;
2. verifica que las dependencias requeridas estén `INTEGRADO`;
3. carga las fuentes canónicas propietarias del alcance;
4. inspecciona únicamente el código integrado previo necesario para que el contrato sea implementable y no duplique responsabilidades;
5. detecta ambigüedades, contradicciones y decisiones reservadas por DT-038;
6. consulta al operador únicamente las definiciones humanas necesarias;
7. redacta o actualiza `docs/work-packages/WP-XXX.md` siguiendo `TEMPLATE.md`;
8. mantiene el WP como `BORRADOR` mientras existan decisiones pendientes;
9. cuando el operador aprueba explícitamente la definición completa, registra el WP como `APROBADO`;
10. actualiza la documentación canónica directamente en `main` conforme a DEC-005;
11. registra el SHA, verifica CI de `main` aplicable y exige sincronización local antes de trabajo dependiente.

Los agentes locales de implementación reciben el WP ya cerrado. No redefinen alcance, reglas, contratos ni decisiones reservadas.

## Cambios documentales directos desde ChatGPT Web

Con aprobación humana explícita, el orquestador puede crear o modificar directamente en `main`:

- `AGENTS.md`;
- `README.md` cuando el cambio sea exclusivamente documental;
- `docs/**/*.md`, incluidos PLAN, ORQUESTACION, WPs, DECs y demás especificación canónica.

Antes de cada escritura directa debe:

1. verificar el HEAD actual de `main` en GitHub;
2. confirmar que el cambio es exclusivamente documental y está autorizado;
3. no introducir decisiones DT-038 no aprobadas;
4. realizar el commit y registrar su SHA;
5. volver a verificar el HEAD remoto;
6. verificar CI aplicable de `main`;
7. no habilitar trabajo dependiente si la CI falla;
8. hacer sincronizar el checkout coordinador local mediante fast-forward.

Esta excepción no alcanza a código, tests ejecutables, scripts, workflows/CI, configuración TOML/CSV/JSON, dependencias, lockfiles, tooling ejecutable, assets ni despliegue. Los agentes locales tampoco adquieren esta autoridad.

La documentación que un implementador modifica dentro de un WP permanece en la rama y PR de ese WP normalmente.

## Inicio de un WP

Antes de iniciar, el WP debe estar `APROBADO`, sus dependencias `INTEGRADO` y `PLAN.md` debe marcarlo `EN_CURSO` con un único agente asignado. La transición documental a `EN_CURSO` y la asignación pueden registrarse directamente en `main` por el orquestador conforme a DEC-005, siempre con autorización humana explícita.

El coordinador local se sincroniza:

```bash
cd /workspace/Botonera2
git switch main
git status --short
git fetch origin
git pull --ff-only origin main
```

`git status --short` debe estar vacío. Luego se usa el lanzador:

```bash
uv run python scripts/iniciar_wp.py NNN agente
```

El agente implementador trabaja únicamente dentro del worktree del WP y respeta `AGENTS.md`, el WP y las decisiones transversales.

## Sincronización final antes de revisión

Antes de revisar el candidato:

```bash
git status --short
git fetch origin
git merge origin/main
```

No usar rebase ni force-push. Si `origin/main` avanzó, se incorpora mediante merge normal. Después se repiten las validaciones aplicables, se pushea la rama y se registra el nuevo HEAD.

El orquestador verifica en GitHub que la PR apunta a `main`, el HEAD remoto coincide y la CI corresponde al candidato vigente.

## Revisión independiente secuencial

Por defecto no se crea un segundo worktree de revisión. El revisor usa el mismo worktree del WP después de que el implementador terminó.

Antes de iniciar la revisión:

```bash
cd /workspace/Botonera2-wpNNN
git status --short
git rev-parse HEAD
```

El árbol debe estar limpio, el SHA debe coincidir con el HEAD remoto y el implementador no debe estar actuando sobre ese worktree.

El revisor usa una sesión distinta, preferentemente otra familia de modelo, trabaja en modo solo lectura y finaliza con `git status` limpio. Nunca hay dos agentes actuando simultáneamente sobre el mismo WP/worktree.

Si hay correcciones, vuelve el implementador original, corrige y pushea; luego se repiten sincronización, validaciones y revisión sobre el nuevo SHA.

Un worktree de revisión separado queda reservado para casos donde aporte aislamiento real.

## Puerta de integración

Antes de indicar que una PR puede integrarse, el orquestador verifica directamente en GitHub:

- PR abierta y base `main`;
- mergeable;
- SHA revisado igual al HEAD actual;
- CI aplicable verde;
- revisión independiente registrada;
- cero hallazgos BLOQUEANTES pendientes;
- cero hallazgos IMPORTANTES pendientes.

La integración productiva se realiza mediante squash merge.

## Después del merge

El operador informa el merge y el orquestador lo verifica directamente en GitHub, incluyendo el SHA de integración.

Después se sincroniza el coordinador local:

```bash
cd /workspace/Botonera2
git switch main
git fetch origin
git pull --ff-only origin main
```

Antes de eliminar el worktree, su `git status --short` debe estar vacío. Solo después se limpia worktree y rama. Si la eliminación normal de la rama local falla únicamente por el squash merge, puede eliminarse la rama local después de verificar el merge remoto y el árbol limpio.

El orquestador puede registrar directamente en `main` los cierres documentales posteriores al merge, por ejemplo `EN_CURSO -> INTEGRADO`, retiro de agente y actualización del próximo punto de control, conforme a DEC-005.

## Flujo resumido

```text
ChatGPT Web orquestador
  -> reconstruye estado desde GitHub
  -> planifica próximo WP con el operador
  -> resuelve con el humano decisiones DT-038
  -> actualiza documentación canónica directamente en main
  -> verifica SHA/CI y sincroniza clon local
  -> autoriza WP y asigna implementador
  -> operador ejecuta scripts/iniciar_wp.py
  -> implementador trabaja en rama/worktree del WP
  -> candidato se sincroniza con origin/main
  -> validaciones completas + push
  -> revisor independiente usa secuencialmente el mismo worktree en solo lectura
  -> correcciones vuelven al implementador si existen
  -> orquestador verifica SHA + CI + revisión en GitHub
  -> squash merge productivo
  -> actualización documental/administrativa directa por el orquestador
  -> sincronización y limpieza local
  -> siguiente WP
```

## Prompt mínimo para una nueva conversación

La nueva conversación debe recibir un mensaje que indique, como mínimo:

- que actúa como orquestador y planificador documental de `martinebene/Botonera2`;
- que no debe reconstruir el estado desde memoria de conversaciones previas;
- que debe leer primero `AGENTS.md`, DEC-004, DEC-005, este procedimiento y `PLAN.md`;
- que debe usar GitHub como fuente remota independiente;
- que debe planificar los WPs junto con el operador antes de delegar implementación;
- que debe escalar decisiones DT-038 al operador y no inventarlas;
- que puede mantener directamente en `main` la documentación autorizada por DEC-005;
- que el operador ejecutará en Warp los comandos/agentes locales y pegará sus salidas;
- que debe respetar sincronización GitHub/local, un worktree por WP, revisión independiente secuencial, CI, squash merge, verificación remota y limpieza;
- que cambios ejecutables/productivos siguen mediante rama + PR;
- que debe comenzar reconstruyendo el estado actual y no iniciar implementación hasta que el WP correspondiente esté definido y aprobado.

El contexto durable debe provenir del repositorio, no del historial de ChatGPT.
