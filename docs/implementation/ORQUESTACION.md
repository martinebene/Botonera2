# Orquestación operativa de la implementación

Este documento describe el procedimiento práctico de coordinación de Botonera2. Deriva de `DEC-004`, `DEC-005` y `DEC-007` y no reemplaza `AGENTS.md`, los Work Packages ni las decisiones canónicas.

## Rol del orquestador

La coordinación y planificación documental se realizan preferentemente desde una conversación de ChatGPT Web con acceso independiente a GitHub.

El orquestador consulta directamente `martinebene/Botonera2`, verifica `main`, ramas, PR, SHA, CI y merges, reconstruye el estado vigente, identifica el próximo WP habilitado, carga únicamente las fuentes canónicas necesarias y planifica su definición junto con el operador humano antes de delegar implementación.

Cuando durante la planificación aparece una decisión reservada por DT-038, el orquestador la presenta al operador con alternativas, impacto y recomendación, y solo la incorpora a la documentación canónica después de una decisión humana explícita.

Antes de entregar comandos para iniciar un WP, el orquestador debe conocer el **entorno operativo actual**. Si el operador está trabajando mediante Orca, utiliza el flujo Orca definido por DEC-007; si está usando terminal/SSH/Warp u otro entorno genérico, utiliza el lanzador genérico. Si el entorno no puede determinarse con seguridad, debe preguntarlo en lugar de asumir una herramienta histórica.

El orquestador entrega al operador los comandos y prompts correspondientes al entorno vigente, recibe las salidas locales y las contrasta con GitHub antes de habilitar transiciones. Una conversación nueva reconstruye el estado desde el repositorio y no depende de memoria de conversaciones anteriores.

## Fuentes mínimas de una conversación nueva

Leer en este orden:

1. `AGENTS.md`;
2. `docs/decisions/DEC-004-orquestacion-revision-secuencial-y-sincronizacion.md`;
3. `docs/decisions/DEC-005-planificacion-y-autoridad-documental-del-orquestador.md`;
4. `docs/decisions/DEC-007-entorno-orca-asignacion-agentes-y-lanzadores.md`;
5. `docs/implementation/ORQUESTACION.md`;
6. `docs/implementation/PLAN.md`;
7. PR abiertas o recientemente integradas relevantes;
8. el `WP-XXX.md` concreto cuando corresponda.

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
11. registra el SHA, verifica CI de `main` aplicable y exige sincronización local antes de trabajo dependiente;
12. propone el agente implementador según complejidad, riesgo, capacidad, disponibilidad/cuota e integración con el entorno conforme a DEC-007.

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

Si el cambio documental afecta o resuelve una escalación de un WP que ya está `EN_CURSO`, sincronizar únicamente el checkout coordinador no es suficiente. Antes de que el implementador reanude ese WP, su worktree debe incorporar el nuevo `origin/main` mediante merge normal.

En un worktree genérico:

```bash
cd <ruta-del-worktree>
git status --short
git fetch origin
git merge origin/main
```

En Orca, la ruta real debe obtenerse de `orca worktree show/list --json` o del resultado del lanzamiento; no debe suponerse `/workspace/Botonera2-wpNNN`.

El árbol debe estar limpio antes del merge. No usar rebase ni force-push. Después del merge se repiten las validaciones aplicables antes de continuar el trabajo productivo. De este modo el implementador nunca sigue trabajando contra un WP, DEC u otra definición canónica que ya fue reemplazada en `main`.

Esta excepción no alcanza a código, tests ejecutables, scripts, workflows/CI, configuración TOML/CSV/JSON, dependencias, lockfiles, tooling ejecutable, assets ni despliegue. Los agentes locales tampoco adquieren esta autoridad.

La documentación que un implementador modifica dentro de un WP permanece en la rama y PR de ese WP normalmente.

## Inicio de un WP

Antes de iniciar, el WP debe estar `APROBADO`, sus dependencias `INTEGRADO` y `PLAN.md` debe marcarlo `EN_CURSO` con un único agente asignado. La transición documental a `EN_CURSO` y la asignación pueden registrarse directamente en `main` por el orquestador conforme a DEC-005, siempre con autorización humana explícita.

El checkout coordinador se sincroniza siempre:

```bash
cd /workspace/Botonera2
git switch main
git status --short
git fetch --prune origin
git pull --ff-only origin main
```

`git status --short` debe estar vacío y `HEAD` debe coincidir con `origin/main`.

### Si el entorno actual es Orca

Una vez integrado WP-030, el inicio normal será:

```bash
uv run python scripts/iniciar_wp_orca.py NNN agente
```

Ese lanzador conserva las validaciones documentales/Git y delega en `orca worktree create` la creación del worktree, la rama nativa Orca y el lanzamiento del agente dentro de una terminal administrada por Orca.

La identidad visible del workspace debe conservar el WP (`wp/NNN-descripcion`). La rama Git puede usar la forma nativa aceptada por DEC-007, por ejemplo `<git-username>/wp-NNN-descripcion`; no se renombra por detrás solo para imitar la convención genérica.

WP-030 es la única excepción de bootstrap prevista para este lanzador: puede iniciarse manualmente con `orca worktree create` después de reproducir todas las validaciones de DEC-007.

### Si el entorno es genérico/terminal/SSH/Warp

Se conserva:

```bash
uv run python scripts/iniciar_wp.py NNN agente
```

El lanzador genérico prepara mediante Git la rama/worktree y abre directamente la CLI correspondiente.

En ambos casos el agente implementador trabaja únicamente dentro del worktree del WP y respeta `AGENTS.md`, el WP y las decisiones transversales.

## Asignación de implementador y revisor

No existe un implementador universal predeterminado.

El orquestador selecciona/proponer el agente por WP conforme a DEC-007:

- Antigravity/AGY es una opción preferente para WPs sencillos o medios bien delimitados cuando resulte adecuado;
- Codex se reserva preferentemente para trabajo complejo, sensible o de alto acoplamiento/razonamiento;
- OpenCode puede implementar o revisar según el modelo efectivo utilizado;
- otras capacidades aprobadas siguen siendo válidas.

La disponibilidad/cuota es un factor operativo legítimo, pero nunca habilita a reducir criterios de aceptación, pruebas o revisión.

El modelo concreto no se congela en la arquitectura; cuando sea relevante se registra en la PR para demostrar trazabilidad e independencia.

## Sincronización final antes de revisión

Antes de revisar el candidato, desde la ruta real del worktree:

```bash
git status --short
git fetch origin
git merge origin/main
```

No usar rebase ni force-push. Si `origin/main` avanzó, se incorpora mediante merge normal. Después se repiten las validaciones aplicables, se pushea la rama y se registra el nuevo HEAD.

El orquestador verifica en GitHub que la PR apunta a `main`, el HEAD remoto coincide y la CI corresponde al candidato vigente.

## Revisión independiente secuencial

Por defecto no se crea un segundo worktree de revisión. El revisor usa el mismo worktree del WP después de que el implementador terminó.

Antes de iniciar la revisión, desde el worktree real:

```bash
git status --short
git rev-parse HEAD
```

El árbol debe estar limpio, el SHA debe coincidir con el HEAD remoto y el implementador no debe estar actuando sobre ese worktree.

El revisor usa una sesión distinta, preferentemente otra familia de modelo, trabaja en modo solo lectura y finaliza con `git status` limpio. Nunca hay dos agentes actuando simultáneamente sobre el mismo WP/worktree.

Cuando Antigravity/AGY implementa, se prefiere OpenCode con una familia no Gemini como revisor si está disponible y es adecuada. Esta preferencia no reemplaza la regla general: la independencia depende de sesión/agente/modelo efectivo, no del nombre del arnés.

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
git fetch --prune origin
git pull --ff-only origin main
```

La limpieza del WP integrado es obligatoria y comprende **worktree, rama local y rama remota**. No se conserva una rama de WP, administrativa o documental una vez que su PR fue integrada y se verificó que no contiene trabajo posterior no integrado.

Antes de borrar nada debe verificarse:

1. que la PR esté efectivamente `merged` y que el SHA de integración esté identificado;
2. que el HEAD de la rama remota corresponda al candidato integrado o, si el merge fue squash, que no existan commits posteriores al candidato revisado;
3. que el worktree del WP tenga `git status --short` vacío;
4. que ninguna sesión de implementador o revisor siga actuando sobre ese worktree.

### Limpieza en Orca

Con las condiciones anteriores cumplidas, se prefiere:

```text
orca worktree rm --worktree <selector-o-id>
```

Después se verifica que Orca retiró el worktree y la rama local. Si la rama fue publicada para la PR, se elimina además la rama remota explícitamente y se ejecuta:

```bash
git fetch --prune origin
git worktree list
git branch -r
```

No usar `--force` salvo que exista una razón investigada y autorizada; nunca para descartar trabajo no integrado.

### Limpieza en entorno genérico

El cierre normal es:

```bash
cd /workspace/Botonera2

git worktree remove <ruta-del-worktree>

git branch -d <rama> || git branch -D <rama>

git push origin --delete <rama>

git fetch --prune origin
git worktree list
git branch -r
```

El uso de `git branch -D` solo está permitido cuando la eliminación normal falla por haber integrado mediante squash y el merge remoto ya fue verificado. Nunca se usa para descartar trabajo no integrado.

Si la rama remota avanzó después del SHA revisado/integrado, si contiene commits no explicados o si el worktree no está limpio, **se detiene la limpieza y se investiga**; no se fuerza ni se elimina la rama.

Como estado normal del repositorio remoto, cuando no hay ningún WP activo debe quedar únicamente `main`. Las ramas temporales existen solo mientras haya trabajo o una PR todavía no integrada que las necesite.

El orquestador puede registrar directamente en `main` los cierres documentales posteriores al merge, por ejemplo `EN_CURSO -> INTEGRADO`, retiro de agente y actualización del próximo punto de control, conforme a DEC-005.

## Flujo resumido

```text
ChatGPT Web orquestador
  -> reconstruye estado desde GitHub
  -> determina/pregunta entorno operativo actual
  -> planifica próximo WP con el operador
  -> resuelve con el humano decisiones DT-038
  -> actualiza documentación canónica directamente en main
  -> verifica SHA/CI y sincroniza clon local
  -> autoriza WP y asigna implementador según DEC-007
  -> si Orca: ejecuta lanzador Orca (o bootstrap manual WP-030)
  -> si otro entorno: ejecuta lanzador genérico
  -> implementador trabaja en rama/worktree aislado
  -> candidato se sincroniza con origin/main
  -> validaciones completas + push
  -> revisor independiente usa secuencialmente el mismo worktree en solo lectura
  -> correcciones vuelven al implementador si existen
  -> orquestador verifica SHA + CI + revisión en GitHub
  -> squash merge productivo
  -> actualización documental/administrativa directa por el orquestador
  -> limpieza específica del entorno + rama remota
  -> siguiente WP
```

## Prompt mínimo para una nueva conversación

La nueva conversación debe recibir un mensaje que indique, como mínimo:

- que actúa como orquestador y planificador documental de `martinebene/Botonera2`;
- que no debe reconstruir el estado desde memoria de conversaciones previas;
- que debe leer primero `AGENTS.md`, DEC-004, DEC-005, DEC-007, este procedimiento y `PLAN.md`;
- que debe usar GitHub como fuente remota independiente;
- que debe determinar o preguntar qué entorno operativo está utilizando el operador antes de iniciar un WP;
- que si el entorno es Orca debe preferir el lanzador Orca y las ramas/worktrees nativos admitidos por DEC-007; si es otro entorno debe usar el lanzador genérico correspondiente;
- que debe planificar los WPs junto con el operador antes de delegar implementación;
- que debe escalar decisiones DT-038 al operador y no inventarlas;
- que puede mantener directamente en `main` la documentación autorizada por DEC-005;
- que debe seleccionar implementador/revisor según DEC-007, preservando revisión independiente y reservando capacidad cara/escasa para trabajo que la justifique;
- que debe respetar sincronización GitHub/local, un worktree por WP, revisión independiente secuencial, CI, squash merge, verificación remota y limpieza local/remota específica del entorno;
- que cambios ejecutables/productivos siguen mediante rama + PR;
- que debe comenzar reconstruyendo el estado actual y no iniciar implementación hasta que el WP correspondiente esté definido y aprobado.

El contexto durable debe provenir del repositorio, no del historial de ChatGPT.
