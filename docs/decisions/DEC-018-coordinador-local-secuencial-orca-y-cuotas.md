# DEC-018 - Coordinador local secuencial en Orca y gestión de cuotas

## Estado

`APROBADA`

## Contexto

Botonera2 admite lotes de Work Packages independientes que conceptualmente pueden ejecutarse en paralelo mediante worktrees separados y `CURRENT.json.active_assignments`. En el VPS de desarrollo, sin embargo, ejecutar simultáneamente varios agentes de programación puede exceder la capacidad práctica de CPU, RAM o swap.

El operador quiere conservar la ventaja de preparar varios worktrees y asignaciones de una sola vez, pero ejecutar los agentes pesados de forma estrictamente secuencial. También quiere reducir intervenciones manuales repetitivas sin delegar al entorno local decisiones propias del ORCHESTRATOR ni eliminar las puertas de revisión e integración.

El entorno ya dispone de dos capacidades útiles:

1. Orca ofrece coordinación supervisada mediante Runs, Tasks, Dispatches, `worker_done`, `escalation`, `question`, `check --wait`, reutilización/liberación de workers y reintentos controlados.
2. El VPS dispone de `cuotas-agentes --json`, que expone de forma estructurada ventanas de uso, porcentaje libre/usado y tiempo de reinicio para AGY/Antigravity, OpenCode Go, Codex y Claude Code.

Esta decisión complementa DEC-007 y reemplaza parcialmente la exigencia de DEC-017 de una intervención HUMAN_GATE separada para cada sesión local cuando varias asignaciones del mismo tramo ya fueron autorizadas por el ORCHESTRATOR.

## Decisión

### 1. Nuevo rol operativo: COORDINADOR_LOCAL

Se autoriza un rol local llamado `COORDINADOR_LOCAL`.

No es un segundo ORCHESTRATOR. No decide producto, alcance, revisión, integración ni cierre.

Su única responsabilidad es ejecutar mecánicamente un lote finito de asignaciones **ya autorizadas** por el ORCHESTRATOR, respetando dependencias, cuotas y una concurrencia máxima indicada.

El COORDINADOR_LOCAL puede:

- identificar worktrees/terminales Orca ya creados;
- crear un Run/Tasks/Dispatches de Orca para supervisión;
- iniciar o reactivar el agente exacto asignado a cada WP;
- esperar `worker_done`, `escalation` o `question`;
- ejecutar como máximo la cantidad de workers simultáneos autorizada;
- reutilizar o liberar terminales de agente sin borrar el worktree;
- consultar `cuotas-agentes --json`;
- demorar una asignación por falta de cuota;
- elegir otro WP ya autorizado y listo del mismo lote mientras espera una cuota, salvo que el ORCHESTRATOR haya fijado orden estricto;
- reanudar el mismo agente después del reinicio de su ventana;
- si el proceso terminó, iniciar un reemplazo controlado en el **mismo worktree**, conservando el trabajo parcial y la asignación vigente.

### 2. Autoridad que nunca recibe

El COORDINADOR_LOCAL no puede:

- crear, aprobar o redefinir WPs;
- modificar PLAN por decisión propia;
- escribir `CURRENT.json`;
- cambiar implementador o revisor asignado;
- sustituir un modelo por otro sin autorización previa;
- interpretar un handoff como aprobación;
- habilitar REVIEWER después de IMPLEMENTER;
- convertir hallazgos del REVIEWER en trabajo de corrección;
- cruzar una puerta ORCHESTRATOR;
- mergear PRs;
- hacer deploy;
- limpiar ramas/worktrees;
- resolver decisiones DT-038;
- usar force-push, rebase o acciones destructivas.

Cuando termina un lote, vuelve el control al HUMAN_GATE/ORCHESTRATOR.

### 3. HUMAN_GATE por lote

Por defecto sigue siendo válido iniciar cada sesión manualmente.

Como excepción controlada, el HUMAN_GATE puede dar **una única orden** al COORDINADOR_LOCAL para ejecutar secuencialmente un lote de asignaciones que el ORCHESTRATOR ya dejó autorizadas.

Ejemplos válidos:

- cuatro IMPLEMENTER de WPs independientes ya autorizados;
- cuatro REVIEWER ya autorizados sobre candidatos exactos;
- una tanda de re-revisiones ya autorizadas.

Una autorización de lote **no permite atravesar una fase que todavía depende del ORCHESTRATOR**. Por ejemplo, un lote de implementaciones termina al completar sus handoffs; el COORDINADOR_LOCAL no puede iniciar revisiones hasta que el ORCHESTRATOR verifique GitHub, congele candidatos y publique las asignaciones REVIEWER.

### 4. Concurrencia física separada del paralelismo lógico

`active_assignments` puede expresar paralelismo lógico aunque el entorno ejecute físicamente una sola tarea a la vez.

Para el VPS actual, el ORCHESTRATOR puede fijar:

`max_concurrency = 1`

Esto significa:

1. un solo worker pesado activo;
2. al recibir finalización válida, el coordinador libera o deja inactivo ese worker según corresponda;
3. recién entonces inicia el siguiente;
4. los worktrees restantes pueden permanecer abiertos sin ejecutar agentes pesados.

El coordinador mismo puede permanecer activo mientras espera, pero debe usar un agente/modelo de bajo impacto relativo y una cuota independiente de las cuotas que deba supervisar.

### 5. Independencia de cuota del coordinador

No alcanza con usar un nombre de modelo distinto.

El COORDINADOR_LOCAL debe operar, cuando sea razonablemente posible, sobre una **fuente de cuota independiente** de los workers que debe supervisar.

Ejemplo válido:

- COORDINADOR_LOCAL: OpenCode usando OpenCode Go u OpenRouter;
- IMPLEMENTER: Claude Code y/o Codex;
- REVIEWER: AGY/Antigravity.

Si un worker del mismo lote también consume la misma ventana efectiva de OpenCode Go usada por el coordinador, esa combinación deja de ser robusta frente al agotamiento de cuota y debe evitarse o declararse expresamente.

### 6. Gestión de ventanas y rate limits

Antes de iniciar cada worker, el coordinador consulta la fuente estructurada disponible:

`cuotas-agentes --json`

Debe usar como mínimo, cuando existan:

- proveedor;
- ventana de 5 horas;
- `usado_pct` / `libre_pct`;
- `reinicia_epoch`;
- estado de error/rate-limit.

No debe inventar cuánto consumirá una tarea. La afirmación “hay cuota suficiente” es una política operativa, no una predicción exacta.

Por cada lote, el ORCHESTRATOR puede fijar un umbral de reserva o una regla más simple. Si no existe un umbral explícito, el coordinador sólo bloquea automáticamente por agotamiento/rate-limit confirmado y puede preferir otro WP listo con mayor disponibilidad.

Si la cuota está agotada:

1. no inicia ese worker;
2. registra la causa;
3. si existe otro WP listo del lote, puede ejecutarlo;
4. de lo contrario espera hasta el reinicio informado, con un pequeño margen de seguridad;
5. vuelve a consultar la cuota antes de reanudar.

### 7. Agotamiento durante una tarea

El coordinador no considera un timeout de espera, TUI idle o ausencia temporal de mensajes como prueba de agotamiento.

Para clasificar un bloqueo por cuota debe existir evidencia, por ejemplo:

- mensaje explícito de rate limit/usage limit en el agente;
- estado estructurado de cuota agotada;
- combinación coherente de ambos.

Si un worker queda detenido por cuota:

1. conserva worktree, rama y archivos;
2. no marca el WP como completado;
3. espera el reset de la ventana;
4. revalida cuota;
5. si la sesión sigue viva, reanuda **esa misma sesión**;
6. si el proceso terminó o Orca lo prueba como failed/stopped, crea un reemplazo controlado en el mismo worktree, vinculándolo como reintento cuando Orca lo soporte;
7. el reemplazo debe inspeccionar el estado existente antes de editar y continuar la misma asignación;
8. nunca se crean dos workers activos simultáneos sobre el mismo WP.

### 8. Uso de Orca orchestration

Cuando el COORDINADOR_LOCAL supervise la tanda, debe preferir la capa estructurada de Orca:

- Run para el lote;
- Task por asignación;
- Dispatch/worker-start sobre la terminal del worktree correspondiente;
- `check --wait` para `worker_done`, `escalation` y `question`;
- `worker-release` al terminar cuando no se reutilice inmediatamente;
- `worker-start --retry-of` o mecanismo equivalente sólo ante estado failed/stopped comprobado.

No debe usar polling agresivo ni interpretar un mero cambio visual como finalización.

### 9. Condiciones de detención

El lote se detiene y devuelve control humano si aparece:

- DT-038 o decisión reservada;
- contradicción de asignación;
- pérdida de elegibilidad;
- conflicto Git no trivial;
- operación destructiva necesaria;
- secreto/credencial faltante;
- `escalation` que requiera decisión;
- resultado esperado inconsistente;
- imposibilidad de determinar de forma segura si un worker está vivo o duplicado.

Una falta de cuota con reset conocido **no es por sí sola una escalación**: es una condición de espera/reanudación.

### 10. Prompt obligatorio por lote

Cada vez que el ORCHESTRATOR habilite un lote lógicamente paralelo que vaya a secuencializarse localmente, debe entregar al operador un prompt específico para el COORDINADOR_LOCAL.

Ese prompt debe identificar:

- WPs del lote;
- fase: IMPLEMENTER, REVIEWER o re-revisión;
- worktrees/terminales esperados;
- agente/modelo autorizado por WP;
- concurrencia máxima;
- orden fijo o libertad de reordenar por cuota;
- proveedor de cuota de cada agente;
- política de espera/reanudación;
- stop conditions;
- prohibición expresa de cruzar al siguiente gate del ORCHESTRATOR.

### 11. Transición mecánica preautorizada dentro de un lote nocturno

Por autorización HUMAN_GATE explícita y acotada, el ORCHESTRATOR puede preparar un lote en el que el COORDINADOR_LOCAL atraviese **una transición mecánica ya decidida** sin esperar una nueva intervención humana, siempre que todos estos elementos hayan sido fijados antes de iniciar el lote:

- WP y fase exacta;
- siguiente rol ya aprobado;
- harness/modelo exacto del siguiente rol;
- criterios de elegibilidad;
- plantilla de asignación;
- condición objetiva de paso;
- condición de detención.

Esta excepción existe para aprovechar ventanas nocturnas o ausencias prolongadas del operador y no convierte al COORDINADOR_LOCAL en ORCHESTRATOR general.

La condición objetiva normal para pasar de una sincronización/implementación ya autorizada a una revisión ya autorizada es:

1. existe el handoff esperado del IMPLEMENTER;
2. la PR exacta sigue abierta contra `main`;
3. el HEAD remoto coincide con el candidate SHA informado;
4. el candidato contiene el `main` requerido mediante merge normal cuando correspondía;
5. el worktree quedó limpio;
6. la CI del SHA exacto terminó `success`;
7. no hubo `escalation`, conflicto no trivial, decisión DT-038 ni desviación material;
8. el revisor y modelo fueron fijados por HUMAN_GATE antes de iniciar el lote.

Sólo en ese caso el COORDINADOR_LOCAL puede, si el lote lo autoriza expresamente:

- reconstruir la asignación REVIEWER desde la plantilla preaprobada;
- fijar en ella PR/base/candidate/tree SHA y CI exactos;
- publicarla en Botonera2-Control;
- actualizar exclusivamente los campos operativos de `CURRENT.json` necesarios para volver elegible a ese REVIEWER;
- iniciar el REVIEWER y esperar su handoff.

No puede evaluar el contenido del review, convertir hallazgos en correcciones, habilitar re-revisión ni mergear. Esas decisiones vuelven al ORCHESTRATOR/HUMAN_GATE.

La transición mecánica preautorizada debe aparecer además en un manifiesto de lote append-only en Botonera2-Control. Si falta el manifiesto, los datos no coinciden o la condición objetiva no se cumple, el coordinador se detiene.

## Consecuencias

- Se mantiene el aislamiento por worktree.
- Se reduce la intervención humana repetitiva.
- La limitación física del VPS deja de impedir preparar lotes lógicamente paralelos.
- El ORCHESTRATOR conserva todas las decisiones sustantivas.
- Los workers pueden esperar resets de cuota durante horas sin perder el trabajo parcial.
- La selección del coordinador se evalúa por **independencia de cuota**, no sólo por nombre de modelo.
- `cuotas-agentes --json` pasa a ser una fuente operativa admitida para planificación y scheduling local, sin convertirse en fuente canónica de producto.
