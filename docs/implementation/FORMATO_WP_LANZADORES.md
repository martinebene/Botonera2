# Formato documental parseable por los lanzadores de Work Packages

Este documento describe el **contrato de formato Markdown que consumen actualmente** `scripts/iniciar_wp.py` y `scripts/iniciar_wp_orca.py` a través de `scripts/comun_lanzador.py`.

Su objetivo es evitar que una redacción documental correcta para una persona sea interpretada de forma distinta por los lanzadores. Es obligatorio para ChatGPT Web/orquestadores, agentes que mantengan documentación de WPs y cualquier modificación futura del parser.

No reemplaza `docs/work-packages/TEMPLATE.md`, `PLAN.md`, DEC-002 ni DEC-007. Precisa cómo deben escribirse los campos que el tooling interpreta automáticamente.

## Regla general

Los documentos `WP-XXX.md` tienen partes descriptivas libres y partes que funcionan como **entrada estructurada para scripts**. En estas últimas no debe utilizarse prosa ambigua, negaciones, ejemplos ni referencias a otros WPs que no representen exactamente el dato esperado por el parser.

Antes de aprobar un WP y antes de pasarlo a `EN_CURSO`, el orquestador debe verificar explícitamente este contrato.

## 1. Nombre de archivo

El archivo debe existir exactamente en:

```text
docs/work-packages/WP-NNN.md
```

`NNN` son tres dígitos. Ejemplo:

```text
docs/work-packages/WP-007.md
```

## 2. Encabezado principal

La primera identificación del WP debe respetar:

```text
# WP-NNN - Título
```

Ejemplo válido:

```text
# WP-007 - Simulador CLI reproducible de dispositivos
```

El lanzador utiliza este título para derivar el slug/nombre del worktree. No cambiar el prefijo, el número de tres dígitos ni el separador ` - `.

## 3. Estado documental

Debe existir exactamente una sección de segundo nivel:

```text
## Estado documental
```

En un WP real debe contener **un único estado**, nunca el placeholder del template.

Durante borrador:

```text
`BORRADOR`
```

Una vez aprobado explícitamente por el humano:

```text
`APROBADO`
```

No dejar en un WP real:

```text
`BORRADOR | APROBADO`
```

El parser actual comprueba la presencia de la cadena backticked `APROBADO`; por ello conservar un placeholder compuesto sería ambiguo y no está permitido aunque el resto del flujo normalmente agregue otras puertas.

## 4. Sección `Dependencias`: campo máquina, no prosa general

Debe existir exactamente:

```text
## Dependencias
```

Dentro de esta sección, **toda aparición con forma `WP-NNN` es interpretada por el lanzador como una dependencia real del WP**, salvo una referencia al propio WP.

Por lo tanto, en esta sección solo pueden aparecer identificadores `WP-NNN` que sean dependencias verdaderas y que deban estar `INTEGRADO` antes de iniciar el trabajo.

Ejemplo correcto:

```markdown
## Dependencias

- WP-006 `INTEGRADO`: contrato de entrada lógica ya disponible.
- WP-001 `INTEGRADO`: scaffolding y tooling base.
- DEC-006 `APROBADA`: contrato transversal aplicable.
```

Ejemplo **incorrecto**:

```markdown
## Dependencias

- WP-006 `INTEGRADO`.
- No depende de WP-008.
```

Aunque una persona entiende la negación, el parser ve `WP-008` y lo agrega a la lista de dependencias.

Tampoco deben colocarse dentro de `## Dependencias`:

- ejemplos que nombren WPs no requeridos;
- comparaciones con WPs futuros;
- frases como `no depende de WP-XXX`;
- referencias históricas a otros WPs;
- aclaraciones sobre trabajo excluido que incluyan identificadores `WP-NNN` no dependientes.

Esas aclaraciones deben ir en `Fuera de alcance`, `Alcance`, `Resultado esperado`, `Hallazgos fuera de alcance` u otra sección descriptiva.

Las referencias `DEC-XXX`, `DT-XXX` y documentos sin forma `WP-NNN` pueden figurar en la sección: no son interpretadas como dependencias de PLAN por el parser actual.

## 5. Tabla de `PLAN.md`

El lanzador lee las filas Markdown de `docs/implementation/PLAN.md` por posición de columnas.

La forma canónica continúa siendo:

```text
| WP | Objetivo | Estado | Depende de | Agente |
|---|---|---|---|---|
| WP-007 | Crear simulador CLI | EN_CURSO | WP-006 | antigravity |
```

Para una fila operativa:

- columna 1 debe ser exactamente `WP-NNN`;
- columna 3 es el estado utilizado por el lanzador;
- columna 5 es el agente asignado utilizado por el lanzador;
- para iniciar, el estado debe ser exactamente `EN_CURSO`;
- el agente solicitado al lanzador debe coincidir con el agente de la columna 5 (la comparación es insensible a mayúsculas/minúsculas);
- en el lanzador Orca vigente, los identificadores de agente admitidos son `antigravity`, `opencode`, `codex` y `claude`; usar `claude` en PLAN cuando Claude Code sea el implementador autorizado;
- cada dependencia extraída del `WP-NNN.md` debe existir en PLAN y tener estado exactamente `INTEGRADO`.

La columna `Depende de` de PLAN mantiene valor documental/humano, pero la validación efectiva de dependencias del lanzador se construye actualmente desde la sección `## Dependencias` del archivo del WP. Ambas representaciones deben ser coherentes.

## 6. Títulos de secciones consumidas por scripts

No renombrar ni variar estos títulos en un WP real:

```text
## Estado documental
## Dependencias
```

El parser busca esos encabezados de segundo nivel por nombre exacto y toma su contenido hasta el siguiente encabezado `##`.

Los encabezados `###` dentro de una sección no delimitan el campo para el parser; por lo tanto, una referencia `WP-NNN` colocada en cualquier subsección situada todavía dentro de `## Dependencias` seguirá contando como dependencia.

## 7. Preflight obligatorio del orquestador antes de aprobar/iniciar

Al redactar o modificar un WP, ChatGPT Web/orquestador debe comprobar antes de registrar `APROBADO` y nuevamente antes de `EN_CURSO`:

1. archivo `WP-NNN.md` con número de tres dígitos;
2. encabezado `# WP-NNN - Título` correcto;
3. `## Estado documental` presente y con un único valor real;
4. si se aprobará, valor exactamente `` `APROBADO` ``;
5. `## Dependencias` presente;
6. cada aparición `WP-NNN` dentro de esa sección corresponde realmente a una dependencia;
7. no existen negaciones, ejemplos o WPs futuros dentro de esa sección;
8. todas las dependencias reales figuran `INTEGRADO` en PLAN antes del inicio;
9. la fila de PLAN usa el esquema de cinco columnas canónico;
10. para iniciar, PLAN indica `EN_CURSO` y el agente exacto acordado;
11. checkout coordinador y `origin/main` quedan sincronizados antes de ejecutar el lanzador.

Este preflight forma parte de la planificación documental y no debe delegarse al fallo del script como mecanismo normal de detección.

## 8. Si cambia el parser

Si una PR modifica `scripts/comun_lanzador.py`, `scripts/iniciar_wp.py` o `scripts/iniciar_wp_orca.py` de forma que cambie el formato documental aceptado, esa misma entrega debe evaluar y actualizar, cuando corresponda:

- este documento;
- `docs/work-packages/TEMPLATE.md`;
- `docs/implementation/ORQUESTACION.md` si cambia el procedimiento operativo;
- pruebas del parser/lanzadores.

No debe existir una divergencia silenciosa entre el formato que enseñan los documentos y el que interpreta el código.

## 9. Incidente que motivó esta precisión

Al preparar WP-007 se incluyó dentro de `## Dependencias` una aclaración humana equivalente a “no depende del WP funcional posterior de sesión”. El parser, correctamente según su implementación vigente pero sin comprensión semántica de la negación, interpretó esa referencia como dependencia y bloqueó el lanzamiento.

La corrección consistió en retirar ese identificador de la sección máquina y conservar la aclaración con redacción descriptiva sin una referencia `WP-NNN` allí.

La regla resultante es permanente: **dentro de `## Dependencias`, mencionar un `WP-NNN` significa declarar una dependencia real**.