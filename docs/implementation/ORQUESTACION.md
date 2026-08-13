# Orquestación operativa de la implementación

Este documento describe el procedimiento práctico de coordinación de Botonera2. Deriva de `DEC-004` y no reemplaza `AGENTS.md`, los Work Packages ni las decisiones canónicas.

## Rol del orquestador

La coordinación se realiza preferentemente desde una conversación de ChatGPT Web con acceso independiente a GitHub.

El orquestador consulta directamente `martinebene/Botonera2`, verifica `main`, ramas, PR, SHA, CI y merges, entrega al operador comandos y prompts para ejecutar en Warp, recibe las salidas locales y las contrasta con GitHub antes de habilitar transiciones. Una conversación nueva reconstruye el estado desde el repositorio y no depende de memoria de conversaciones anteriores.

## Fuentes mínimas de una conversación nueva

Leer en este orden:

1. `AGENTS.md`;
2. `docs/decisions/DEC-004-orquestacion-revision-secuencial-y-sincronizacion.md`;
3. `docs/implementation/ORQUESTACION.md`;
4. `docs/implementation/PLAN.md`;
5. PR abiertas o recientemente integradas relevantes;
6. el `WP-XXX.md` concreto cuando corresponda.

No es necesario reconstruir toda la historia si el repositorio ya contiene el estado canónico vigente.

## Inicio de un WP

Antes de iniciar, el WP debe estar `APROBADO`, sus dependencias `INTEGRADO` y `PLAN.md` debe marcarlo `EN_CURSO` con un único agente asignado.

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

## Actualizaciones administrativas directas a main

El orquestador puede evitar una PR administrativa únicamente para los cambios permitidos por DEC-004 en `docs/implementation/PLAN.md`.

Ejemplos válidos:

- PR productiva verificada como mergeada: `EN_CURSO` a `INTEGRADO` y retiro del agente;
- WP ya `APROBADO`, dependencias `INTEGRADO` y autorización humana explícita: `PENDIENTE` a `EN_CURSO` y asignación de agente;
- actualización de `Próximo punto de control` para reflejar esas transiciones.

Después del commit directo se registra el SHA, se espera la CI de `main` y se sincroniza el coordinador local antes de continuar.

Cualquier cambio normativo, de alcance, dependencia, WP, DEC, AGENTS, código, CI, arquitectura o contrato continúa por rama + PR.

## Prompt mínimo para una nueva conversación

La nueva conversación debe recibir un mensaje que indique, como mínimo:

- que actúa como orquestador de `martinebene/Botonera2`;
- que no debe reconstruir el estado desde memoria de conversaciones previas;
- que debe leer primero `AGENTS.md`, DEC-004, este procedimiento y `PLAN.md`;
- que debe usar GitHub como fuente remota independiente;
- que el operador ejecutará en Warp los comandos/agentes locales y pegará sus salidas;
- que debe respetar sincronización GitHub/local, un worktree por WP, revisión independiente secuencial, CI, squash merge, verificación remota y limpieza;
- que los commits administrativos directos a `main` están limitados estrictamente por DEC-004;
- que debe comenzar reconstruyendo el estado actual y no modificar nada hasta determinar el próximo punto de control permitido.

El contexto durable debe provenir del repositorio, no del historial de ChatGPT.
