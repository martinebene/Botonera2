# Orquestación operativa de la implementación

Este documento describe el procedimiento práctico de coordinación de Botonera2. Deriva de `DEC-004`, `DEC-005` y `DEC-007` y no reemplaza `AGENTS.md`, los Work Packages ni las decisiones canónicas.

## Rol del orquestador

La coordinación y planificación documental se realizan preferentemente desde una conversación de ChatGPT Web con acceso independiente a GitHub.

El orquestador consulta directamente `martinebene/Botonera2`, verifica `main`, ramas, PR, SHA, CI y merges, reconstruye el estado vigente, identifica el próximo WP habilitado, carga únicamente las fuentes canónicas necesarias y planifica su definición junto con el operador humano antes de delegar implementación.

Cuando durante la planificación aparece una decisión reservada por DT-038, el orquestador la presenta al operador con alternativas, impacto y recomendación, y solo la incorpora a la documentación canónica después de una decisión humana explícita.

Antes de entregar comandos para iniciar un WP, el orquestador debe conocer el **entorno operativo actual**. Si el operador está trabajando mediante Orca, utiliza el flujo Orca definido por DEC-007; si está usando terminal/SSH/Warp u otro entorno genérico, utiliza el lanzador genérico. Si el entorno no puede determinarse con seguridad, debe preguntarlo en lugar de asumir una herramienta histórica.

El orquestador entrega al operador los comandos y prompts correspondientes al entorno vigente, recibe las salidas locales y las contrasta con GitHub antes de habilitar transiciones. Una conversación nueva reconstruye el estado desde el repositorio y no depende de memoria de conversaciones anteriores.

## Calidad obligatoria de los prompts de delegación

La redacción del prompt de cada agente es una responsabilidad central del orquestador y no una formalidad secundaria.

En el flujo vigente ChatGPT Web utiliza GPT-5.6 Sol como referencia operativa de orquestación de alta capacidad. El procedimiento no queda congelado a ese nombre de modelo: si en el futuro cambia la oferta, debe utilizarse para orquestación el modelo de mayor capacidad/razonamiento disponible que resulte adecuado.

Esa capacidad debe aprovecharse para **reducir deliberadamente la cantidad de inferencias que se delegan** a implementadores y revisores. Los agentes locales pueden usar modelos más pequeños, rápidos o económicos y no debe suponerse que reconstruirán por sí solos pasos operativos que el orquestador puede especificar con precisión.

Por lo tanto:

- los prompts deben ser explícitos, detallados y específicos para el estado real del WP;
- no alcanza con `Implementá WP-NNN`, `Revisá la PR` o instrucciones equivalentes;
- el prompt debe repetir los pasos operativos críticos aunque también estén documentados en el repositorio;
- la redundancia entre documentación y prompt se considera una salvaguarda intencional;
- nunca se delegan decisiones DT-038 mediante una formulación ambigua esperando que el agente “elija lo mejor”;
- el agente debe recibir criterios claros de finalización y un formato concreto de evidencia a devolver.

La política completa y los mínimos obligatorios para prompts de implementación, corrección, revisión y re-revisión están en `docs/implementation/PROMPTS_AGENTES.md` y deben verificarse antes de cada delegación.

El prompt operativo no reemplaza el WP ni las decisiones canónicas. Si existe contradicción, prevalece la documentación normativa y el orquestador debe corregir el prompt antes de continuar.

## Fuentes mínimas de una conversación nueva

Leer en este orden:

1. `AGENTS.md`;
2. `docs/decisions/DEC-004-orquestacion-revision-secuencial-y-sincronizacion.md`;
3. `docs/decisions/DEC-005-planificacion-y-autoridad-documental-del-orquestador.md`;
4. `docs/decisions/DEC-007-entorno-orca-asignacion-agentes-y-lanzadores.md`;
5. `docs/implementation/ORQUESTACION.md`;
6. `docs/implementation/PROMPTS_AGENTES.md`;
7. `docs/implementation/PLAN.md`;
8. PR abiertas o recientemente integradas relevantes;
9. el `WP-XXX.md` concreto cuando corresponda.

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
12. consulta al operador qué agentes/modelos están disponibles en ese momento y cómo se encuentran sus cuotas/capacidad operativa;
13. evalúa complejidad, riesgo, capacidades, rendimiento observado, cuota e independencia entre familias y propone una pareja implementador + revisor para ese WP;
14. acuerda explícitamente con el operador el implementador y el revisor previsto antes del lanzamiento; el implementador se registra en PLAN y el revisor permanece como asignación operativa de revisión;
15. construye el prompt exhaustivo del implementador conforme a `PROMPTS_AGENTES.md`, incluyendo explícitamente entrega Git/PR, checks, límites, escalamiento y evidencia final.

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

La selección previa del implementador y del revisor previsto debe haberse acordado conforme a DEC-007 usando información vigente de agentes/modelos disponibles y cuotas. No existe una pareja permanente obligatoria. Si cambian materialmente disponibilidad o cuota antes de iniciar la revisión, la elección del revisor puede reconsiderarse con acuerdo explícito del operador.

Además, antes de lanzar al agente, el orquestador debe completar el preflight de `PROMPTS_AGENTES.md`. Un launcher que valide correctamente Git/documentación pero entregue un prompt operativo insuficiente no satisface por sí solo esta obligación.

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

El inicio normal se realiza mediante el lanzador específico de Orca:

```bash
uv run python scripts/iniciar_wp_orca.py NNN agente
```

Ese lanzador conserva las validaciones documentales/Git y delega en `orca worktree create` la creación del worktree, la rama nativa Orca y el lanzamiento del agente dentro de una terminal administrada por Orca, **sin pasar ningún prompt de trabajo**.

La identidad visible del workspace debe conservar el WP (`wp/NNN-descripcion`). La rama Git puede usar la forma nativa aceptada por DEC-007, por ejemplo `<git-username>/wp-NNN-descripcion`; no se renombra por detrás solo para imitar la convención genérica.

Una vez que el lanzador informa que el agente fue abierto, el operador copia y pega manualmente en la terminal el prompt exhaustivo redactado por ChatGPT Web. Si el agente es OpenCode y el entorno es Orca, el prompt incluye el bloque condicional de salida copiable conforme a `PROMPTS_AGENTES.md`.

WP-030 y WP-031 contaron con excepciones de bootstrap documentadas en sus respectivas especificaciones para construir y corregir el launcher; a partir de su integración, `scripts/iniciar_wp_orca.py` es el camino operativo normal bajo Orca.

### Si el entorno es genérico/terminal/SSH/Warp

Se conserva:

```bash
uv run python scripts/iniciar_wp.py NNN agente
```

El lanzador genérico prepara mediante Git la rama/worktree y abre directamente la CLI correspondiente.

En ambos casos el agente implementador trabaja únicamente dentro del worktree del WP y respeta `AGENTS.md`, el WP y las decisiones transversales.

## Asignación de implementador y revisor

No existe un implementador universal predeterminado ni una pareja fija implementador/revisor.

Para cada WP, el orquestador debe preguntar al operador por el estado actual de agentes, modelos y cuotas y luego recomendar una pareja concreta teniendo en cuenta:

- complejidad y sensibilidad del WP;
- riesgo y necesidad de razonamiento transversal;
- capacidades relativas de los modelos disponibles en ese momento;
- desempeño observado en WPs anteriores;
- cuota/coste y conveniencia de reservar capacidad escasa;
- integración con el entorno operativo;
- independencia entre implementador y revisor, prefiriendo familias distintas.

La selección se acuerda con el operador. Una combinación usada previamente es solo antecedente para la recomendación, no una regla para el siguiente WP.

La disponibilidad/cuota es un factor operativo legítimo, pero nunca habilita a reducir criterios de aceptación, pruebas o revisión.

El modelo concreto no se congela en la arquitectura; cuando sea relevante se registra en la PR/informe para demostrar trazabilidad e independencia.

La diferencia de capacidad entre el orquestador y el agente elegido debe compensarse con mejor especificación y prompts, **no** reduciendo controles ni esperando que el agente complete por intuición instrucciones omitidas.

## Sincronización final antes de revisión

Antes de revisar el candidato, desde la ruta real del worktree:

```bash
git status --short
git fetch origin
git merge origin/main
```

No usar rebase ni force-push. Si `origin/main` avanzó, se incorpora mediante merge normal. Después se repiten las validaciones aplicables, se pushea la rama y se registra el nuevo HEAD.

El orquestador verifica en GitHub que la PR apunta a `main`, el HEAD remoto coincide y la CI corresponde al candidato vigente.

El resumen funcional del implementador no basta para iniciar revisión. Debe existir un **candidato entregado para revisión**: commits publicados, PR abierta, SHA exacto, árbol limpio y validaciones finales identificadas conforme a `PROMPTS_AGENTES.md`.

## Revisión independiente secuencial

Por defecto no se crea un segundo worktree de revisión. El revisor usa el mismo worktree del WP después de que el implementador terminó.

Antes de iniciar la revisión, desde el worktree real:

```bash
git status --short
git rev-parse HEAD
```

El árbol debe estar limpio, el SHA debe coincidir con el HEAD remoto y el implementador no debe estar actuando sobre ese worktree.

Antes de lanzar la revisión, el orquestador reconfirma que el revisor previamente acordado sigue siendo adecuado según disponibilidad/cuota actuales. Si cambió materialmente el contexto, propone una alternativa y la acuerda con el operador antes de continuar.

El revisor usa una sesión distinta, preferentemente otra familia de modelo, trabaja en modo solo lectura y finaliza con `git status` limpio. Nunca hay dos agentes actuando simultáneamente sobre el mismo WP/worktree.

El prompt del revisor debe identificar explícitamente PR, SHA, base, modo solo lectura, checks, criterios de hallazgo, prohibición de modificar/pushear/mergear y formato de veredicto según `PROMPTS_AGENTES.md`.

Cambiar solamente de arnés manteniendo el mismo modelo efectivo no satisface por sí mismo la independencia.

Si hay correcciones, vuelve el implementador original, corrige y pushea; luego se repiten sincronización, validaciones y revisión sobre el nuevo SHA. El prompt de corrección debe enumerar los hallazgos exactos y la re-revisión debe congelar el nuevo SHA.

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

Cuando el worktree fue creado y administrado por Orca, **la eliminación normal debe realizarse mediante `orca worktree rm`**, no mediante `git worktree remove` como primer paso. Orca debe retirar su metadata, el worktree Git y la rama local asociada de forma coordinada.

Antes de eliminarlo, obtener el selector real desde Orca:

```bash
orca worktree list --repo path:/workspace/Botonera2 --json
```

La salida incluye para cada worktree, entre otros campos, `id`, `path` y `displayName`. El argumento `--worktree` de `orca worktree rm` requiere un **selector explícito**; no se debe pasar el `displayName` desnudo suponiendo que Orca lo interpretará.

La forma preferida por ser inequívoca es usar el `id` exacto devuelto por Orca:

```bash
orca worktree rm \
  --worktree "id:<id-exacto-devuelto-por-orca>" \
  --json
```

También pueden utilizarse otros selectores explícitos soportados por la versión vigente de Orca, por ejemplo `path:<ruta-absoluta>` o `name:<nombre>`, siempre que hayan sido obtenidos/verificados previamente y sean inequívocos.

**No usar** una forma como:

```text
orca worktree rm --worktree "wp/007-descripcion"
```

sin prefijo de selector. Ese texto es solo el nombre visible del workspace y puede producir `selector_not_found` sin retirar el worktree.

Después del `rm`, verificar antes de tocar ramas manualmente:

```bash
orca worktree list --repo path:/workspace/Botonera2 --json
git worktree list
```

El worktree eliminado ya no debe aparecer en ninguno de los dos listados. En el flujo normal Orca también retira la rama local asociada; se comprueba explícitamente con:

```bash
git branch --list '*wp-NNN*'
```

Solo después de confirmar que Orca retiró correctamente el worktree se elimina la rama remota publicada para la PR:

```bash
git push origin --delete <rama-remota>
git fetch --prune origin
```

La comprobación final debe incluir:

```bash
git worktree list
git branch --list '*wp-NNN*'
git branch -r --list '*wp-NNN*'
```

Si Orca retiró el worktree pero dejó una rama local, no se borra a ciegas mientras pueda estar asociada a trabajo no investigado. Con PR ya verificada como integrada, árbol limpio y ausencia de commits posteriores, puede retirarse manualmente; si el squash merge hace que `git branch -d` no la considere fusionada, `git branch -D` es admisible únicamente después de esas verificaciones.

No usar `--force` en `orca worktree rm` salvo que exista una razón investigada y autorizada; nunca para descartar trabajo no integrado. Ante `selector_not_found`, no asumir que la eliminación ocurrió: volver a listar Orca, obtener `id`/`path` válido y repetir con un selector explícito.

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
  -> consulta agentes/modelos disponibles y cuotas actuales
  -> evalúa complejidad/riesgo y propone implementador + revisor independiente
  -> acuerda ambos con el operador
  -> autoriza WP y registra implementador según DEC-007
  -> construye prompt exhaustivo según PROMPTS_AGENTES.md (con salida copiable si Orca+OpenCode)
  -> si Orca: operador ejecuta lanzador Orca (iniciar_wp_orca.py); crea worktree y abre agente SIN prompt
  -> si otro entorno: operador ejecuta lanzador genérico (iniciar_wp.py); crea worktree y abre agente
  -> operador revisa y pega manualmente el prompt en la sesión del agente
  -> implementador trabaja en rama/worktree aislado
  -> implementación local completa
  -> commits + sincronización con origin/main + validaciones finales + push + PR
  -> candidato entregado para revisión con SHA exacto
  -> orquestador verifica candidato en GitHub
  -> reconfirma revisor previsto según disponibilidad/cuota vigente
  -> revisor recibe prompt exhaustivo y usa secuencialmente el mismo worktree en solo lectura
  -> correcciones vuelven al implementador con hallazgos explícitos si existen
  -> re-revisión sobre nuevo SHA
  -> orquestador verifica SHA + CI + revisión en GitHub
  -> squash merge productivo
  -> actualización documental/administrativa directa por el orquestador
  -> limpieza específica del entorno; en Orca se obtiene el selector y se usa `orca worktree rm` antes de eliminar la rama remota
  -> siguiente WP
```

## Prompt mínimo para una nueva conversación

La nueva conversación debe recibir un mensaje que indique, como mínimo:

- que actúa como orquestador y planificador documental de `martinebene/Botonera2`;
- que no debe reconstruir el estado desde memoria de conversaciones previas;
- que debe leer primero `AGENTS.md`, DEC-004, DEC-005, DEC-007, este procedimiento, `PROMPTS_AGENTES.md` y `PLAN.md`;
- que debe usar GitHub como fuente remota independiente;
- que debe determinar o preguntar qué entorno operativo está utilizando el operador antes de iniciar un WP;
- que si el entorno es Orca debe preferir el lanzador Orca y las ramas/worktrees nativos admitidos por DEC-007; si es otro entorno debe usar el lanzador genérico correspondiente;
- que los lanzadores crean el worktree y abren el agente **sin prompt de trabajo**, y que el operador traslada manualmente el prompt exhaustivo preparado por el orquestador;
- que cuando el entorno es Orca y el agente es OpenCode, el prompt debe incluir el bloque de salida copiable definido en `PROMPTS_AGENTES.md`;
- que debe planificar los WPs junto con el operador antes de delegar implementación;
- que debe escalar decisiones DT-038 al operador y no inventarlas;
- que puede mantener directamente en `main` la documentación autorizada por DEC-005;
- que antes de cada WP debe consultar qué agentes/modelos están disponibles y cómo están sus cuotas, y acordar con el operador implementador + revisor independiente según complejidad, capacidad, coste y familia de modelo;
- que no debe fijar una pareja permanente ni asumir que modelos/cuotas de un WP siguen iguales en el siguiente;
- que puede reconfirmar/cambiar de común acuerdo el revisor antes de la revisión si cambió materialmente la disponibilidad;
- que debe aprovechar la mayor capacidad de razonamiento del orquestador para redactar **prompts de agentes exhaustivos y explícitos**, sin confiar en que implementadores/revisores infieran pasos omitidos;
- que todo prompt debe cumplir `docs/implementation/PROMPTS_AGENTES.md`, incluyendo rol, alcance, prohibiciones, Git/PR, validaciones, escalamiento y evidencia final;
- que debe respetar sincronización GitHub/local, un worktree por WP, revisión independiente secuencial, CI, squash merge, verificación remota y limpieza local/remota específica del entorno;
- que si usa Orca para limpiar un WP debe obtener primero un selector válido desde `orca worktree list --json` y ejecutar `orca worktree rm` con selector explícito, preferentemente `id:<id>`, antes de borrar ramas remotas o recurrir a Git manual;
- que cambios ejecutables/productivos siguen mediante rama + PR;
- que debe comenzar reconstruyendo el estado actual y no iniciar implementación hasta que el WP correspondiente esté definido y aprobado.

El contexto durable debe provenir del repositorio, no del historial de ChatGPT.