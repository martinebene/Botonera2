# Política de prompts operativos para agentes

Este documento define cómo debe redactar ChatGPT Web/orquestador los prompts que delegan trabajo a agentes implementadores y revisores de Botonera2.

Complementa `AGENTS.md`, `docs/implementation/ORQUESTACION.md`, `PLAN.md`, los Work Packages y las decisiones vigentes. El prompt operativo **no reemplaza** esas fuentes: las convierte en instrucciones de ejecución concretas, ordenadas y difíciles de interpretar de forma ambigua.

## Principio rector

El orquestador debe aprovechar deliberadamente su mayor capacidad de razonamiento para reducir la carga de inferencia que queda en los agentes delegados.

En el flujo operativo vigente, ChatGPT Web utiliza GPT-5.6 Sol como modelo de orquestación de alta capacidad. Esta referencia es operativa y puede cambiar en el futuro: la regla durable es utilizar para orquestación el modelo de mayor capacidad/razonamiento disponible que resulte adecuado, y hacer que ese orquestador traduzca el WP y la gobernanza en prompts explícitos antes de delegar.

Los implementadores y revisores pueden utilizar modelos de menor capacidad, más rápidos o más económicos. Por eso **no se debe asumir que inferirán correctamente pasos implícitos**, aunque esos pasos también estén documentados en el repositorio.

La redundancia intencional entre documentación y prompt es una salvaguarda, no un defecto.

## Regla de explicitud

Todo prompt de delegación importante debe ser autosuficiente respecto del procedimiento operativo de esa tarea.

No alcanza con expresiones genéricas como:

```text
Implementá WP-007.
Revisá esta PR.
Corregí los hallazgos.
```

El orquestador debe indicar de forma expresa:

- qué rol tiene el agente;
- cuál es el objetivo verificable;
- qué fuentes debe leer y en qué orden;
- qué alcance puede modificar;
- qué queda prohibido o fuera de alcance;
- qué decisiones debe escalar en lugar de inventar;
- qué estado Git/worktree se espera;
- qué pasos de implementación o revisión debe ejecutar;
- qué validaciones concretas debe correr;
- qué política de sincronización con `origin/main` aplica;
- si debe o no hacer commits;
- si debe o no hacer push;
- si debe o no abrir/actualizar PR;
- si está expresamente prohibido hacer merge;
- qué evidencia exacta debe devolver al finalizar.

Cuando el WP ya documenta alguno de estos puntos, el prompt puede referenciarlo, pero debe repetir explícitamente los pasos operativos críticos cuya omisión pueda romper el flujo.

## Responsabilidad del orquestador

Antes de lanzar un agente, ChatGPT Web/orquestador debe:

1. reconstruir el estado real desde GitHub;
2. conocer el WP, SHA/base y entorno operativo actual;
3. identificar el rol concreto: implementación, corrección, revisión o investigación;
4. resolver previamente las decisiones humanas necesarias;
5. redactar un prompt específico para ese momento del flujo;
6. comprobar que el prompt no contradice el WP ni decisiones canónicas;
7. eliminar ambigüedades sobre Git, PR, validaciones, límites y salida esperada;
8. no delegar al agente decisiones reservadas por DT-038;
9. no confiar en que el agente recuerde conversaciones anteriores;
10. exigir evidencia verificable al terminar.

El orquestador debe preferir un prompt algo redundante antes que uno elegante pero dependiente de inferencias tácitas.

## Prompt inicial de un implementador

El prompt inicial de implementación debe contener, como mínimo, los siguientes bloques conceptuales.

### 1. Rol y objetivo

Debe declarar que el agente es **implementador** del WP concreto y que su responsabilidad no termina cuando el código funciona localmente.

Debe distinguir:

```text
IMPLEMENTACIÓN LOCAL COMPLETA
```

Código y pruebas locales terminados.

De:

```text
CANDIDATO ENTREGADO PARA REVISIÓN
```

Trabajo confirmado en commits, sincronizado con `origin/main`, validado nuevamente, publicado, con PR abierta y SHA candidato identificable.

La tarea normal del implementador termina recién en el segundo estado, salvo que el prompt indique expresamente una investigación o intervención parcial.

### 2. Lecturas obligatorias

Indicar expresamente:

1. `AGENTS.md`;
2. `docs/work-packages/WP-NNN.md`;
3. únicamente las fuentes canónicas exigidas por ese WP;
4. decisiones transversales aplicables.

No pedir exploración indiscriminada del repositorio cuando el WP ya delimita el contexto.

### 3. Alcance y prohibiciones

El prompt debe repetir los límites de mayor riesgo del WP y aclarar expresamente, cuando corresponda:

- no ampliar alcance;
- no modificar contratos ajenos;
- no introducir dependencias no aprobadas;
- no copiar arquitectura histórica por analogía;
- no resolver unilateralmente decisiones DT-038;
- no usar rebase ni force-push salvo autorización específica;
- no hacer merge de la PR;
- no borrar worktree/rama al finalizar.

### 4. Ejecución y calidad

El prompt debe enumerar los checks aplicables **por su comando real**, no decir solamente “corré las pruebas”.

Ejemplo Python cuando aplique:

```text
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest
git diff --check
```

Si el WP requiere otros checks, deben enumerarse también.

### 5. Entrega Git obligatoria

Para una implementación normal destinada a revisión independiente, el prompt debe indicar expresamente:

1. inspeccionar `git status` y cambios realizados;
2. crear commits normales del WP;
3. `git fetch origin`;
4. incorporar `origin/main` mediante merge normal si avanzó;
5. detenerse y escalar conflictos no triviales en vez de inventar soluciones de contrato;
6. repetir todos los checks después de la sincronización;
7. exigir `git status` limpio;
8. publicar la rama sin renombrarla por detrás del entorno que la administra;
9. abrir o actualizar PR contra `main`;
10. no hacer merge.

El hecho de que `AGENTS.md`, el WP u ORQUESTACION describan este flujo **no autoriza a omitirlo del prompt**.

### 6. Contenido mínimo de la PR

Cuando el implementador debe crear la PR, el prompt debe pedir como mínimo:

- referencia al WP;
- objetivo y alcance implementado;
- explicación apta para una persona que no conozca la implementación;
- archivos/componentes principales afectados;
- decisiones o escalaciones relevantes;
- agente y modelo efectivo cuando sea relevante;
- comandos y resultados finales de validación;
- confirmación de que no amplió alcance ni hizo merge;
- hallazgos fuera de alcance.

### 7. Salida final obligatoria

El implementador debe devolver un informe estructurado con al menos:

```text
Worktree:
Rama local/remota:
Base incorporada:
SHA candidato:
PR:
Commits:
Archivos cambiados:
Validaciones:
CI si ya existe:
Git status final:
Hallazgos/escalaciones:
```

El orquestador no debe aceptar “terminado”, “todo verde” o un resumen funcional como sustituto de estos identificadores cuando la tarea debía llegar a candidato remoto.

## Prompt de corrección al implementador

Si una revisión encuentra problemas, el prompt de corrección debe especificar:

- SHA revisado;
- hallazgos exactos que debe corregir;
- cuáles NO debe tocar;
- que vuelve a actuar el implementador original;
- que debe conservar la rama/worktree existente;
- que debe repetir sincronización y checks aplicables;
- que debe pushar el nuevo candidato;
- que no debe hacer merge;
- que debe devolver el nuevo SHA y evidencia de cada hallazgo resuelto.

No usar prompts vagos como “arreglá lo que dijo el revisor”.

## Prompt inicial de un revisor independiente

La revisión es una tarea distinta y su prompt debe ser igualmente explícito.

Debe indicar:

### 1. Identidad exacta del candidato

- repositorio;
- número de WP;
- PR;
- rama;
- SHA exacto a revisar;
- base `main`/SHA relevante.

El revisor no debe revisar “lo último” sin congelar primero la identidad del candidato.

### 2. Modo de trabajo

Por defecto:

- mismo worktree del WP de forma secuencial;
- implementador inactivo durante la revisión;
- revisión en **solo lectura**;
- no modificar archivos;
- no crear commits;
- no hacer push;
- no hacer merge;
- finalizar con `git status` limpio.

### 3. Qué revisar

El prompt debe pedir explícitamente:

- cumplimiento del WP y sus criterios;
- respeto de alcance/fuera de alcance;
- contratos e invariantes;
- errores funcionales;
- concurrencia/seguridad cuando corresponda;
- cobertura y calidad de tests;
- calidad estática;
- regresiones;
- documentación requerida;
- comportamiento ante errores;
- cualquier decisión DT-038 introducida sin autorización.

### 4. Validaciones

Enumerar los comandos aplicables y pedir que el revisor contraste también la CI del SHA revisado cuando pueda hacerlo.

### 5. Formato de hallazgos

Cada hallazgo debe incluir:

```text
Severidad: BLOQUEANTE | IMPORTANTE | MENOR
Archivo/línea o componente:
Problema:
Impacto:
Evidencia:
Corrección requerida o recomendada:
```

El veredicto final debe ser inequívoco:

```text
LISTA PARA INTEGRAR
```

o

```text
REQUIERE CORRECCIONES
```

Un veredicto positivo exige cero hallazgos BLOQUEANTES e IMPORTANTES pendientes.

## Prompt de re-revisión

Después de correcciones, el revisor debe recibir un nuevo prompt que identifique el **nuevo SHA** y pida:

- verificar específicamente cada hallazgo previo;
- comprobar que no aparecieron regresiones nuevas;
- repetir validaciones relevantes;
- confirmar `git status` limpio;
- emitir nuevo veredicto sobre ese SHA, no reutilizar el anterior.

## Prompts para investigación o diagnóstico

Incluso cuando no haya implementación, el prompt debe especificar:

- pregunta concreta;
- fuentes permitidas/prioridad de evidencia;
- si puede modificar algo o es solo lectura;
- qué hipótesis debe validar;
- qué no debe cambiar;
- formato de informe;
- cuándo debe detenerse y escalar.

## Relación con el launcher

Los lanzadores son responsables de crear/validar el entorno operativo y de iniciar el agente, pero el prompt que entreguen debe cumplir esta política.

Un prompt automático excesivamente corto que solo diga “implementá WP-NNN” **no es suficiente** para el flujo normal.

Mientras exista una versión integrada del launcher cuyo prompt automático no cumpla este documento, el orquestador debe considerar esa situación una deuda operativa explícita y no asumir que el agente recibió instrucciones suficientes.

La corrección del código del launcher debe realizarse mediante un WP normal, rama, PR, CI y revisión independiente. No corresponde modificar scripts directamente en `main` desde ChatGPT Web.

## Preflight del prompt antes de delegar

Antes de enviar un prompt a cualquier agente, el orquestador debe preguntarse:

1. ¿El agente sabe exactamente qué rol cumple?
2. ¿Sabe qué debe leer y qué no necesita leer?
3. ¿Sabe qué puede modificar?
4. ¿Sabe qué está prohibido modificar?
5. ¿Sabe qué debe escalar?
6. ¿Sabe qué comandos de validación ejecutar?
7. ¿Sabe qué hacer con `origin/main`?
8. ¿Sabe si debe commit/push/PR?
9. ¿Sabe explícitamente que no debe hacer merge?
10. ¿Sabe qué información exacta debe devolver?

Si alguna respuesta es no, el prompt todavía no está listo.

## Persistencia entre conversaciones

Una conversación nueva de ChatGPT Web debe reconstruir esta política desde el repositorio. No debe depender de memoria de la conversación que originalmente definió esta regla.

La explicitud de los prompts forma parte de la responsabilidad de orquestación y debe conservarse aunque cambien los agentes, los modelos implementadores/revisores, Orca u otras herramientas de ejecución.