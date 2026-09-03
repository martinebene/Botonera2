# Orquestación operativa de la implementación

Este documento describe el procedimiento práctico de coordinación de Botonera2. Deriva de `DEC-004`, `DEC-005`, `DEC-007` y `DEC-017` y no reemplaza `AGENTS.md`, los Work Packages ni las decisiones canónicas.

## Principio general

La coordinación y planificación documental se realizan preferentemente desde una conversación de ChatGPT Web con acceso independiente a GitHub.

Existen dos repositorios con responsabilidades distintas:

- `martinebene/Botonera2`: producto, documentación canónica, WPs, decisiones, código, PR, CI e integración;
- `martinebene/Botonera2-Control`: asignaciones, resultados, iteraciones y estado operativo de turnos.

GitHub se utiliza como transporte y persistencia. No existe encadenamiento autónomo que atraviese decisiones del ORCHESTRATOR. Conforme a DEC-018, el operador puede delegar a un **COORDINADOR_LOCAL** la secuencialización mecánica de un lote finito de asignaciones ya autorizadas, sin habilitarlo a cruzar puertas de implementación/revisión/integración.

## Actores

### ORCHESTRATOR

El ORCHESTRATOR:

- reconstruye el estado real desde GitHub;
- planifica los WPs con el operador;
- escala decisiones DT-038;
- mantiene documentación canónica dentro de la autoridad de DEC-005;
- selecciona/proponer implementador y revisor conforme DEC-007;
- crea las asignaciones en `Botonera2-Control`;
- es el único actor que modifica `CURRENT.json`;
- procesa los resultados de IMPLEMENTER y REVIEWER;
- decide correcciones, re-revisiones, integración, bloqueo y cierre.

### IMPLEMENTER

El IMPLEMENTER ejecuta únicamente la asignación vigente dirigida a su rol. Trabaja sobre la rama/worktree del WP y publica su resultado exclusivamente para el ORCHESTRATOR.

### REVIEWER

El REVIEWER ejecuta únicamente la asignación vigente dirigida a su rol, revisa el SHA exacto indicado en modo solo lectura y publica su informe exclusivamente para el ORCHESTRATOR.

### HUMAN_GATE

El operador humano conserva la compuerta entre decisiones sustantivas. Puede iniciar manualmente cada turno o, conforme a DEC-018, emitir una única autorización de lote a un COORDINADOR_LOCAL para ejecutar secuencialmente varias asignaciones ya autorizadas del mismo tramo. No necesita transportar WP, iteración, PR, SHA ni prompt completo entre actores.

### COORDINADOR_LOCAL

El COORDINADOR_LOCAL es un ejecutor mecánico de lotes bajo Orca, no un ORCHESTRATOR alternativo. Puede supervisar Runs/Tasks/Dispatches, limitar concurrencia física, consultar `cuotas-agentes --json`, esperar resets y reanudar workers. No puede modificar `CURRENT.json`, cambiar asignaciones, habilitar revisiones, interpretar hallazgos, mergear, desplegar ni limpiar worktrees. Su contrato completo está en DEC-018.

Las frases breves normales son:

- IMPLEMENTER: `Seguí`;
- REVIEWER: `Revisá`;
- ORCHESTRATOR: `Terminó el implementador`, `Terminó el revisor` o una consulta equivalente de estado.

Estas frases **no contienen el trabajo**. El actor descubre la tarea desde `Botonera2-Control`.

## Fuente de autoridad y precedencia

Para producto, alcance, contratos, criterios, Git, CI e integración manda Botonera2.

Para turno y transporte operativo manda el protocolo vigente de `Botonera2-Control`, subordinado a la documentación canónica.

En caso de contradicción:

1. reglas canónicas de Botonera2;
2. decisiones `DEC-XXX` posteriores aplicables;
3. protocolo de `Botonera2-Control`;
4. decisión del ORCHESTRATOR dentro de su autoridad;
5. asignación particular.

## Fuentes mínimas de una conversación nueva de orquestación

Leer o verificar:

1. `AGENTS.md`;
2. `docs/decisions/DEC-004-orquestacion-revision-secuencial-y-sincronizacion.md`;
3. `docs/decisions/DEC-005-planificacion-y-autoridad-documental-del-orquestador.md`;
4. `docs/decisions/DEC-007-entorno-orca-asignacion-agentes-y-lanzadores.md`;
5. `docs/decisions/DEC-017-coordinacion-mediante-botonera2-control.md`;
6. `docs/implementation/ORQUESTACION.md`;
7. `docs/implementation/PROMPTS_AGENTES.md` como estándar de contenido de delegación;
8. `docs/implementation/PLAN.md`;
9. `Botonera2-Control/PROTOCOL.md` y `Botonera2-Control/CURRENT.json`;
10. PR abiertas o recientemente integradas relevantes;
11. el `WP-XXX.md` concreto cuando corresponda.

No depender de memoria de conversaciones anteriores cuando GitHub puede reconstruir el estado.

## Planificación documental de un WP

Antes de iniciar implementación, el ORCHESTRATOR:

1. identifica el próximo WP permitido por `PLAN.md` y sus dependencias;
2. verifica dependencias `INTEGRADO`;
3. carga las fuentes canónicas propietarias del alcance;
4. inspecciona solo el código integrado necesario;
5. detecta ambigüedades y decisiones reservadas por DT-038;
6. consulta al operador únicamente las decisiones humanas necesarias;
7. redacta o actualiza `docs/work-packages/WP-XXX.md` siguiendo el formato vigente;
8. mantiene `BORRADOR` mientras haya decisiones pendientes;
9. registra `APROBADO` tras aprobación humana explícita;
10. actualiza documentación canónica en `main` conforme DEC-005;
11. verifica el SHA y la CI aplicable;
12. consulta disponibilidad/cuota de agentes/modelos cuando sea necesario;
13. propone y acuerda implementador + revisor independiente conforme DEC-007;
14. cambia PLAN a `EN_CURSO` con el implementador autorizado;
15. prepara la primera asignación en `Botonera2-Control`.

Los agentes locales reciben un WP ya cerrado. No redefinen alcance ni decisiones reservadas.

## Calidad de las asignaciones

`docs/implementation/PROMPTS_AGENTES.md` continúa vigente como estándar de calidad y contenido, aunque deja de ser el mecanismo normal de transporte manual.

Toda asignación debe ser explícita respecto de:

- rol y objetivo;
- WP y fuentes canónicas;
- alcance y exclusiones;
- decisiones/prohibiciones relevantes;
- branch/worktree/PR/SHA cuando correspondan;
- sincronización Git;
- tests y gates requeridos;
- escalamiento;
- evidencia final;
- ruta exacta del resultado a publicar.

La asignación no reemplaza al WP. La redundancia deliberada sigue siendo una salvaguarda para agentes con capacidades distintas.

## Preparación de un turno en Botonera2-Control

El ORCHESTRATOR crea un mensaje append-only bajo:

```text
work-packages/WP-NNN/iteration-XXX/
```

Archivos normales:

```text
01-orchestrator-to-implementer.md
02-implementer-to-orchestrator.md
03-orchestrator-to-reviewer.md
04-reviewer-to-orchestrator.md
```

Luego actualiza `CURRENT.json` con:

- WP;
- iteración;
- estado;
- `next_actor`;
- `assignment_id`;
- `assignment_path`;
- `expected_response_path`;
- PR/SHA cuando corresponda.

Los mensajes publicados no se reescriben. Una corrección o re-revisión genera una nueva iteración/mensaje.

## Elegibilidad obligatoria del agente local

Antes de actuar, IMPLEMENTER o REVIEWER debe:

1. determinar el worktree Git actual y la rama activa;
2. resolver de forma inequívoca el `WP-NNN` correspondiente a ese worktree/rama;
3. sincronizar `martinebene/Botonera2-Control` con `main` remoto;
4. leer su `AGENTS.md`;
5. leer `CURRENT.json`;
6. cuando `protocol_version >= 1.2` y exista `active_assignments`, filtrar primero por el WP del worktree actual;
7. dentro de ese WP, confirmar que `next_actor` coincide con su rol y que harness/modelo coinciden cuando estén fijados;
8. exigir exactamente una asignación compatible dentro del WP actual;
9. verificar `assignment_id`, WP, iteración y destinatario;
10. comprobar que `expected_response_path` todavía no exista;
11. leer únicamente la asignación dirigida a su rol;
12. recién entonces cargar el contexto canónico de Botonera2.

Asignaciones del mismo harness/modelo en otros WPs paralelos no generan ambigüedad porque pertenecen a otros worktrees. Si no puede resolver el WP local o quedan cero/múltiples asignaciones para ese mismo WP, el agente se detiene sin modificar nada.

La existencia del resultado esperado significa que ese turno terminó, incluso si `CURRENT.json` todavía conserva el estado anterior hasta que el humano vuelva al ORCHESTRATOR.

## Aislamiento entre roles

No existe canal lateral IMPLEMENTER -> REVIEWER ni REVIEWER -> IMPLEMENTER.

El IMPLEMENTER no debe leer informes `reviewer-to-orchestrator`.

El REVIEWER no debe leer informes `implementer-to-orchestrator`.

Los hallazgos del REVIEWER llegan al ORCHESTRATOR, quien decide cuáles acepta, reformula, descarta o escala. Solo una nueva asignación del ORCHESTRATOR puede convertirlos en trabajo autorizado para el IMPLEMENTER.

## Cambios documentales directos desde ChatGPT Web

Con aprobación humana explícita, DEC-005 permite al ORCHESTRATOR modificar directamente en `main` documentación autorizada como:

- `AGENTS.md`;
- README exclusivamente documental;
- `docs/**/*.md`, incluidos PLAN, ORQUESTACION, WPs y DECs.

Antes de escribir debe:

1. verificar HEAD actual de `main`;
2. confirmar que el cambio es exclusivamente documental y está autorizado;
3. no introducir decisiones DT-038 no aprobadas;
4. realizar la escritura y registrar SHA;
5. volver a verificar HEAD remoto;
6. verificar la CI aplicable;
7. no habilitar trabajo dependiente si la CI falla;
8. exigir sincronización local antes de continuar.

Esta excepción no alcanza a código, tests ejecutables, scripts, workflows/CI, configuración funcional, dependencias, lockfiles, tooling ejecutable, assets ni despliegue.

## Inicio local de un WP

Antes del lanzamiento:

- WP `APROBADO`;
- dependencias `INTEGRADO`;
- PLAN `EN_CURSO` con un implementador;
- implementador/revisor acordados;
- asignación IMPLEMENTER publicada en `Botonera2-Control`;
- `CURRENT.json` apuntando a esa asignación.

El checkout coordinador se sincroniza:

```bash
cd /workspace/Botonera2
git switch main
git status --short
git fetch --prune origin
git pull --ff-only origin main
```

`git status --short` debe estar vacío y `HEAD` debe coincidir con `origin/main`.

### Orca

Cuando Orca es el entorno vigente:

```bash
uv run python scripts/iniciar_wp_orca.py NNN agente
```

El lanzador crea el worktree/rama nativa y abre el agente **sin inyectar el trabajo**.

Una vez abierto, el operador puede decir `Seguí`. El agente debe entonces sincronizar `Botonera2-Control`, descubrir la asignación y verificar su elegibilidad antes de modificar el WP.

No se copia/pega normalmente un prompt exhaustivo desde ChatGPT Web.

### Entorno genérico

Se conserva:

```bash
uv run python scripts/iniciar_wp.py NNN agente
```

El agente sigue la misma regla de descubrimiento desde `Botonera2-Control`.

## Paralelismo de WPs

Cuando el PLAN permite WPs independientes, protocolo 1.2 de Botonera2-Control permite publicarlos simultáneamente mediante `CURRENT.json.active_assignments`.

Cada entrada activa debe identificar WP, iteración, rol, `assignment_id`, `assignment_path`, `expected_response_path` y agente/arnés/modelo cuando corresponda. Los worktrees deben ser distintos y no puede existir superposición sustantiva no coordinada.

El mismo harness/modelo puede ser IMPLEMENTER de varios WPs paralelos o REVIEWER de varios WPs paralelos. No hace falta reservar un harness distinto por WP. La sesión local se desambigua primero por el WP de su worktree y después por rol/harness/modelo.

Para evitar cruces operativos, dentro de un mismo lote paralelo activo no se asigna el mismo harness/modelo simultáneamente como IMPLEMENTER de unos WPs y REVIEWER de otros. La independencia exigida sigue siendo por WP/candidato: quien revisa un WP no puede ser quien implementó ese mismo WP.

Por defecto cada HUMAN_GATE puede iniciar manualmente cada sesión. Como excepción de DEC-018, una sola autorización humana puede iniciar un lote supervisado por COORDINADOR_LOCAL, que despacha esas sesiones una por una o hasta la concurrencia máxima autorizada. Cada worker sigue resolviendo exactamente una asignación compatible **para su WP local**; asignaciones compatibles del mismo agente en otros worktrees se ignoran.

Agregar o completar otro WP paralelo no revoca una asignación ya iniciada. Los campos escalares históricos de `CURRENT.json` quedan como resumen/compatibilidad y no autorizan trabajo cuando `active_assignments` existe.

## Ejecución secuencial de lotes paralelos bajo restricción de recursos

Cuando varios WPs son independientes pero el VPS no puede sostener varios agentes pesados simultáneos, el paralelismo lógico de `active_assignments` se conserva y la ejecución física puede fijarse en `max_concurrency = 1`.

El ORCHESTRATOR entrega un prompt específico de COORDINADOR_LOCAL que contiene los WPs, fase, worktrees, agentes/modelos autorizados, política de cuota y condiciones de detención. El coordinador:

1. crea o adopta un Run de Orca;
2. crea una Task por asignación;
3. consulta `cuotas-agentes --json` antes de despachar;
4. inicia sólo un worker pesado a la vez cuando `max_concurrency = 1`;
5. espera `worker_done`, `escalation` o `question` mediante la capa de orchestration;
6. libera o deja inactivo el worker finalizado sin borrar el worktree;
7. inicia el siguiente WP autorizado;
8. si una cuota se agota, espera su reset o aprovecha otro WP listo del mismo lote;
9. reanuda la misma sesión tras el reset cuando sigue viva; si Orca prueba `failed/stopped`, usa un reemplazo controlado en el mismo worktree;
10. termina el lote sin atravesar la siguiente puerta del ORCHESTRATOR.

El coordinador debe usar, cuando sea razonablemente posible, una fuente de cuota distinta de las ventanas que supervisa. Usar un modelo con nombre diferente pero dentro de la misma cuota efectiva no brinda independencia suficiente.

Un timeout, TUI idle o falta temporal de mensajes no prueba agotamiento. Para suspender/reanudar por cuota debe existir evidencia explícita o estructurada.

## Lotes nocturnos con transición mecánica preautorizada

DEC-018 permite una excepción acotada para aprovechar periodos prolongados sin presencia del operador.

El ORCHESTRATOR puede preparar un manifiesto de lote que autorice al COORDINADOR_LOCAL a pasar automáticamente de una asignación IMPLEMENTER/SYNC ya autorizada a una REVIEWER ya decidida por HUMAN_GATE, **sin decidir nada por sí mismo**, cuando se cumplan condiciones objetivas verificables de PR/SHA/main/CI/handoff y no exista escalamiento.

En ese caso el COORDINADOR_LOCAL puede publicar la asignación REVIEWER exacta y actualizar únicamente el estado operativo necesario de Botonera2-Control para volver elegible al revisor fijado. Esa autoridad debe estar expresamente listada en el manifiesto del lote.

Esta excepción no alcanza a:

- interpretar el informe del REVIEWER;
- ordenar correcciones;
- re-revisiones;
- merge;
- cierre documental;
- cleanup;
- deploy.

Ante cualquier hallazgo o desviación material, el lote termina y vuelve al ORCHESTRATOR/HUMAN_GATE.

## Turno de implementación

IMPLEMENTER:

1. verifica elegibilidad;
2. desde ese momento continúa autónomamente hasta el handoff, sin pedir permisos intermedios para acciones rutinarias;
3. trabaja únicamente en el worktree/rama del WP;
4. respeta AGENTS, WP, DECs y asignación;
5. sincroniza con `origin/main` según corresponda;
6. ejecuta validaciones aplicables;
7. diagnostica y corrige fallos normales dentro del alcance;
8. crea commits sin solicitar confirmación adicional;
9. push de rama sin solicitar confirmación adicional;
10. crea/actualiza PR;
11. deja candidato remoto con SHA exacto;
12. verifica CI según la asignación;
13. publica mediante commit/push únicamente `expected_response_path` en `Botonera2-Control`;
14. se detiene.

El inicio del turno por HUMAN_GATE ya autoriza estos pasos. El IMPLEMENTER solo vuelve al humano antes del handoff ante un gate real: DT-038/aprobación reservada, contradicción material, conflicto Git no trivial, operación destructiva/no autorizada, merge/deploy/infraestructura persistente no autorizada, credencial faltante o imposibilidad técnica.

El operador informa al ORCHESTRATOR que terminó el implementador.

El ORCHESTRATOR verifica GitHub real y no toma el autorreporte como autoridad suficiente.

## Sincronización final antes de revisión

Desde el worktree real:

```bash
git status --short
git fetch origin
git merge origin/main
```

No usar rebase ni force-push. Si `origin/main` avanzó, se incorpora mediante merge normal y se repiten las validaciones antes de publicar el candidato final.

El candidato debe tener PR, SHA exacto, árbol limpio y CI aplicable identificable.

## Turno de revisión independiente

El ORCHESTRATOR crea una asignación REVIEWER normalizada que incluye únicamente el contexto necesario para una revisión independiente: WP, PR, base, SHA exacto, criterios, fuentes, pruebas, CI y prohibiciones.

El operador inicia manualmente el turno con `Revisá`.

REVIEWER:

- verifica elegibilidad desde `Botonera2-Control`;
- desde ese momento completa autónomamente toda la revisión hasta el handoff, sin pedir permisos intermedios;
- utiliza una sesión distinta;
- preferentemente usa otra familia de modelo;
- revisa el SHA exacto;
- inspecciona directamente código/diff/tests/CI;
- ejecuta tests/builds/validaciones no destructivas sin solicitar confirmación;
- trabaja en solo lectura respecto de Botonera2;
- no lee el informe privado del IMPLEMENTER;
- no modifica/pushea/mergea código de Botonera2;
- crea, commitea y pushea sin confirmación adicional únicamente su resultado para el ORCHESTRATOR en Botonera2-Control;
- finaliza con el worktree limpio.

Encontrar hallazgos no detiene el turno: debe completar la revisión y publicarlos. Solo un gate real de escalamiento o una imposibilidad técnica justifica devolver el control antes del handoff.

Cambiar solo de arnés manteniendo el mismo modelo efectivo no satisface por sí mismo la independencia.

## Correcciones y re-revisiones

Si existen hallazgos que el ORCHESTRATOR considera accionables:

1. ORCHESTRATOR procesa el informe del REVIEWER;
2. crea una nueva iteración/asignación IMPLEMENTER con los hallazgos autorizados;
3. HUMAN_GATE vuelve al implementador;
4. IMPLEMENTER corrige en la misma rama/PR salvo decisión canónica contraria;
5. publica nuevo candidato y resultado;
6. ORCHESTRATOR verifica;
7. crea nueva asignación REVIEWER sobre el nuevo SHA;
8. HUMAN_GATE inicia re-revisión.

El ciclo puede repetirse sin límite artificial.

## Puerta de integración

Antes de indicar que una PR puede integrarse, el ORCHESTRATOR verifica directamente en GitHub:

- PR abierta y base `main`;
- mergeable;
- SHA revisado igual al HEAD actual;
- CI aplicable verde;
- revisión independiente procesada;
- cero hallazgos BLOQUEANTES pendientes;
- cero hallazgos IMPORTANTES pendientes.

La integración productiva se realiza mediante squash merge.

El REVIEWER no mergea ni autoriza por sí mismo la integración.

## Después del merge

El ORCHESTRATOR verifica:

- PR efectivamente mergeada;
- SHA de integración;
- estado de `main`;
- CI post-merge cuando corresponda;
- ausencia de trabajo productivo pendiente;
- cierre documental;
- limpieza de worktree/rama.

### Excepción demostrada de plataforma en CI post-merge

DEC-017 permite documentar una excepción únicamente cuando:

1. la CI del candidato exacto fue verde;
2. la revisión independiente aprobó ese candidato;
3. el squash merge fue normal;
4. candidato y squash tienen el mismo tree SHA;
5. existe evidencia de que la corrida post-merge quedó huérfana/inconsistente por infraestructura GitHub;
6. el operador autoriza explícitamente la excepción.

No se crea un commit vacío ni se modifica código solo para fabricar una nueva corrida.

## Limpieza en Orca

Cuando Orca administró el worktree, usar primero Orca:

```bash
orca worktree list --repo path:/workspace/Botonera2 --json
```

Obtener un selector inequívoco, preferentemente `id:<id>`, y ejecutar:

```bash
orca worktree rm \
  --worktree "id:<id-exacto-devuelto-por-orca>" \
  --json
```

Luego verificar:

```bash
orca worktree list --repo path:/workspace/Botonera2 --json
git worktree list
git branch --list '*wp-NNN*'
```

Solo después se elimina la rama remota:

```bash
git push origin --delete <rama-remota>
git fetch --prune origin
```

No usar `--force` en `orca worktree rm` para descartar trabajo no investigado.

## Limpieza en entorno genérico

```bash
cd /workspace/Botonera2
git worktree remove <ruta-del-worktree>
git branch -d <rama> || git branch -D <rama>
git push origin --delete <rama>
git fetch --prune origin
git worktree list
git branch -r
```

`git branch -D` solo es admisible después de verificar que la PR fue integrada por squash, el árbol está limpio y no existen commits posteriores no integrados.

Como estado remoto normal, si no hay ningún WP activo debe quedar únicamente `main`.

## Flujo resumido

```text
ORCHESTRATOR
  -> reconstruye Botonera2 + Botonera2-Control
  -> planifica WP con HUMAN_GATE
  -> resuelve decisiones DT-038
  -> documenta/aprueba WP
  -> selecciona implementador + revisor
  -> PLAN EN_CURSO
  -> publica asignación IMPLEMENTER + CURRENT
  -> HUMAN_GATE: "Seguí"
  -> IMPLEMENTER descubre asignación, implementa, PR/SHA/CI, publica resultado
  -> HUMAN_GATE vuelve al ORCHESTRATOR
  -> ORCHESTRATOR verifica GitHub
  -> publica asignación REVIEWER + CURRENT
  -> HUMAN_GATE: "Revisá"
  -> REVIEWER revisa solo lectura y publica resultado
  -> HUMAN_GATE vuelve al ORCHESTRATOR
  -> correcciones/re-revisiones si hacen falta
  -> ORCHESTRATOR verifica puerta de integración
  -> squash merge
  -> cierre documental + Control FINAL_DECISION
  -> limpieza
  -> CURRENT vuelve a PLANNING
```

## Regla para una conversación nueva

Una conversación nueva de ORCHESTRATOR debe reconstruir el estado desde ambos repositorios y no desde memoria.

`Botonera2-Control/CURRENT.json` indica el turno operativo; `Botonera2/docs/implementation/PLAN.md` y los WPs indican qué trabajo de producto existe y bajo qué reglas.

El contexto durable reside en GitHub.