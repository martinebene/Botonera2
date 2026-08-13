# DEC-004 - Orquestación, revisión secuencial y sincronización Git

## Estado

`APROBADA`

## Contexto

Durante la ejecución de los primeros Work Packages de Botonera2 se consolidó un flujo operativo en el que la planificación y coordinación se realizan desde una conversación de ChatGPT Web con acceso independiente al repositorio de GitHub, mientras que los agentes de implementación y revisión se ejecutan localmente desde terminales administradas por el operador.

El flujo demostró buena trazabilidad, pero también dejó pasos repetitivos que no aportan aislamiento real, especialmente la creación de un segundo `git worktree` dedicado exclusivamente a revisión. También se identificó que los cambios administrativos mínimos de `PLAN.md` generan Pull Requests sin cambio sustantivo de producto, y que toda transición entre implementación, revisión, integración y siguiente WP necesita una regla explícita de sincronización entre GitHub y el clon local.

Esta decisión ajusta la gobernanza operativa sin modificar arquitectura de producto, contratos funcionales, reglas de negocio, criterios de aceptación ni el principio de revisión independiente.

## Decisión

### 1. ChatGPT Web como orquestador operativo preferido

La coordinación del trabajo se realiza preferentemente desde una conversación de **ChatGPT Web** que actúa como orquestador y mantiene una responsabilidad diferente de los agentes implementadores y revisores.

El orquestador debe:

- disponer de acceso independiente al repositorio `martinebene/Botonera2` en GitHub mediante la integración disponible;
- consultar GitHub directamente para verificar `main`, ramas, PR, SHA, CI y merges;
- no considerar las salidas pegadas desde terminal como única evidencia del estado remoto;
- indicar al operador los comandos y prompts que debe copiar y pegar en sus terminales locales;
- recibir del operador las salidas relevantes de Git y de los agentes locales;
- contrastar esas salidas con GitHub antes de autorizar una transición importante;
- reconstruir el estado de trabajo desde el repositorio cuando se inicia una nueva conversación, en lugar de depender de memoria de conversaciones anteriores.

Si la conversación de orquestación no dispone de acceso independiente a GitHub, no debe afirmar estados remotos, merges, SHA o CI por inferencia. El operador debe restablecer esa capacidad o tratar la sesión como asistencia local no autoritativa para la orquestación.

La herramienta concreta de orquestación puede cambiar en el futuro por decisión humana, pero ChatGPT Web es la superficie preferida mientras este DEC permanezca vigente.

### 2. Un único worktree por WP, compartido solo de forma secuencial

Se mantiene la regla de que cada WP `EN_CURSO` tiene:

- una rama propia `wp/NNN-descripcion-corta`;
- un `git worktree` propio;
- un único agente implementador responsable.

La revisión independiente **no requiere por defecto un segundo worktree**.

El revisor independiente puede usar el mismo worktree del WP una vez que el implementador haya terminado el candidato y se cumplan todas estas condiciones:

1. el implementador dejó de trabajar activamente en ese worktree;
2. `git status` está limpio;
3. todos los commits del candidato están pusheados;
4. `HEAD` local coincide con el SHA de la rama/PR que se va a revisar;
5. el revisor trabaja en una sesión distinta y en modo solo lectura;
6. nunca hay dos agentes actuando simultáneamente sobre ese working tree, rama o WP.

La independencia definida por DT-037 sigue dependiendo de **sesión/agente/modelo efectivo**, no de tener un segundo directorio de trabajo.

Si el revisor encuentra una corrección necesaria:

1. termina o deja inactiva su revisión;
2. vuelve el implementador original al mismo worktree;
3. implementa y pushea la corrección;
4. se repiten sincronización, validaciones y revisión sobre el nuevo SHA.

Un worktree separado de revisión sigue permitido como excepción cuando aporte aislamiento real, por ejemplo para mantener sesiones simultáneamente abiertas por una razón justificada, preservar un candidato mientras se investiga otro estado o realizar una auditoría especialmente sensible.

### 3. Excepción acotada para commits administrativos directos a `main`

Se modifica la prohibición general de commits directos a `main` de DT-033 mediante una excepción estrictamente administrativa.

El orquestador ChatGPT Web, con acceso independiente a GitHub y bajo instrucción humana explícita, puede realizar un commit directo a `main` **únicamente** para mantenimiento operativo de `docs/implementation/PLAN.md`.

La excepción permite solamente:

- cambiar el `Estado` de un WP entre valores ya permitidos por PLAN cuando la transición está respaldada por hechos ya verificados;
- asignar o retirar el `Agente` operativo de un WP;
- actualizar el texto de `Próximo punto de control` para reflejar el estado operativo ya aprobado;
- autorizar el inicio de un WP mediante `PENDIENTE -> EN_CURSO` + agente únicamente cuando el `WP-XXX.md` ya está `APROBADO`, sus dependencias están `INTEGRADO` y existe decisión humana explícita de iniciarlo;
- registrar `EN_CURSO -> INTEGRADO` únicamente después de verificar en GitHub que la PR productiva correspondiente fue efectivamente integrada.

La excepción **no permite** modificar directamente en `main`:

- objetivos o alcance de un WP;
- dependencias entre WPs;
- criterios de aceptación;
- archivos `WP-XXX.md`;
- `AGENTS.md`;
- decisiones `DEC-XXX`;
- reglas de negocio;
- contratos/API/DTO;
- arquitectura;
- dependencias de software;
- CI, testing, calidad o despliegue;
- código de producto;
- cualquier otro archivo distinto de `docs/implementation/PLAN.md`.

Todo cambio sustantivo o normativo continúa requiriendo rama + Pull Request conforme a DT-033/DT-037.

Después de un commit administrativo directo a `main`:

1. el orquestador registra el SHA resultante;
2. se espera la CI de `main` aplicable;
3. no se inicia una nueva ejecución dependiente mientras esa CI esté fallando;
4. el clon coordinador local debe sincronizarse por fast-forward antes de continuar.

Esta excepción existe para eliminar PRs puramente burocráticas, no para convertir `main` en una rama de edición general.

### 4. Sincronización obligatoria entre GitHub y entorno local

La sincronización GitHub/local pasa a ser una puerta explícita en todas las transiciones relevantes.

#### Antes de iniciar un WP

El checkout coordinador debe:

```text
git switch main
git status --short
git fetch origin
git pull --ff-only origin main
```

Debe estar limpio y actualizado antes de ejecutar `scripts/iniciar_wp.py`.

DEC-002 mantiene autoridad para automatizar estas verificaciones dentro del lanzador.

#### Antes de publicar o revisar un candidato

El worktree del WP debe:

1. estar limpio antes de integrar cambios remotos;
2. ejecutar `git fetch origin`;
3. comprobar si `origin/main` avanzó desde la base del WP;
4. si avanzó, incorporar `origin/main` mediante **merge normal**, sin rebase ni force-push;
5. resolver solamente conflictos mecánicos dentro de la autoridad del WP; cualquier decisión reservada por DT-038 se escala;
6. volver a ejecutar todas las validaciones aplicables sobre el estado combinado;
7. pushear la rama;
8. verificar que el SHA local coincide con el HEAD remoto de la PR.

El candidato que recibe revisión independiente debe incluir el `main` vigente a ese punto de control.

#### Antes de integrar una PR

El orquestador debe verificar directamente en GitHub:

- que la PR sigue abierta y mergeable;
- que el SHA revisado sigue siendo el HEAD de la PR;
- que la CI aplicable está verde;
- que no quedan hallazgos BLOQUEANTES o IMPORTANTES;
- que la revisión registrada corresponde al SHA candidato vigente.

Si el HEAD cambia después de la revisión, el nuevo candidato debe volver a validarse y revisarse en la medida necesaria.

#### Después de integrar una PR o hacer un commit administrativo en `main`

Antes del siguiente WP o de cualquier operación local dependiente:

```text
git switch main
git fetch origin
git pull --ff-only origin main
```

El orquestador verifica además el merge/SHA en GitHub de forma independiente.

#### Antes de limpiar rama/worktree

Se exige:

- merge verificado en GitHub;
- `git status --short` vacío en el worktree;
- ninguna corrección local pendiente.

Solo entonces se elimina worktree y rama local/remota según corresponda.

### 5. Secuencia operativa canónica

El flujo preferido queda:

```text
ChatGPT Web orquestador
  -> verifica GitHub y autorización documental
  -> garantiza main local sincronizado
  -> operador ejecuta scripts/iniciar_wp.py
  -> implementador trabaja en worktree del WP
  -> candidato se sincroniza con origin/main
  -> validaciones completas + push
  -> revisor independiente usa secuencialmente el mismo worktree en solo lectura
  -> correcciones vuelven al implementador si existen
  -> orquestador verifica SHA + CI + revisión en GitHub
  -> operador realiza squash merge de la PR productiva
  -> orquestador verifica merge
  -> sincronización y limpieza local
  -> actualización administrativa de PLAN, directa a main solo si entra en la excepción de este DEC
  -> CI de main verde
  -> siguiente WP
```

## Relación con decisiones anteriores

### DT-033

Se mantiene rama + PR + squash merge para todo cambio productivo o normativo. Se agrega únicamente la excepción administrativa acotada de `PLAN.md` definida aquí.

### DT-036

Se mantiene un worktree propio por WP y la prohibición de trabajo simultáneo de dos agentes sobre el mismo working tree. Se aclara que implementador y revisor pueden usar ese worktree **secuencialmente**.

### DT-037

Se mantiene íntegramente la revisión independiente obligatoria. Se aclara que la independencia no exige un segundo worktree; exige sesión/agente/modelo independiente y revisión en modo solo lectura.

### DT-038

No cambia. Toda decisión reservada continúa requiriendo aprobación humana/documentada.

### DEC-002

El lanzador sigue siendo el mecanismo preferido para iniciar WPs y conserva sus validaciones. Este DEC refuerza que el coordinador y el worktree deben sincronizarse con GitHub en los puntos de control indicados.

## Alternativas consideradas

### Mantener un worktree exclusivo para cada revisión

Se descarta como regla general porque la revisión ocurre después de que el implementador termina y su independencia no depende del directorio físico. Se conserva como opción excepcional.

### Mantener PR administrativa para todo cambio de PLAN

Se descarta para cambios puramente operativos y verificables porque agrega pasos sin una revisión sustantiva equivalente. Se conserva PR obligatoria para cualquier cambio normativo o sustantivo.

### Permitir commits directos amplios desde el orquestador

Se rechaza. La excepción queda limitada a campos operativos de `PLAN.md` para preservar `main` como rama estable y trazable.

### Confiar solo en salidas pegadas desde terminal

Se rechaza para la orquestación. El orquestador debe contrastar de forma independiente el estado remoto en GitHub.

## Consecuencias

- Menos worktrees y pasos de limpieza por WP.
- La revisión independiente conserva su separación real sin aislamiento redundante.
- Los cierres/autorizaciones puramente administrativos pueden registrarse con menos burocracia.
- La sincronización entre GitHub y el clon local deja de depender de memoria o costumbre.
- Una conversación nueva de orquestación puede reconstruir el estado desde GitHub sin cargar el historial de conversaciones anteriores.
- Los cambios sustantivos continúan protegidos por rama, PR, CI y revisión independiente.

## Documentos y WPs afectados

- `docs/14-gobernanza-agentes.md`, precisado por esta decisión;
- `docs/decisions/DEC-002-lanzador-work-packages.md`, complementado en sincronización;
- `docs/implementation/PLAN.md`, para la excepción administrativa;
- todos los WPs posteriores en sus puntos de inicio, revisión, integración y limpieza;
- `docs/implementation/ORQUESTACION.md`, procedimiento operativo derivado de esta decisión.
