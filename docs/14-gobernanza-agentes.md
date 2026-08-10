# 14 - Gobernanza del trabajo con agentes

Este documento registra las decisiones cerradas sobre ramas, unidades de trabajo, documentación operativa, herramientas agénticas, revisión y autoridad de cambios.

Las decisiones todavía abiertas permanecen en `10-preguntas-abiertas.md`.

## DT-033 - Modelo de ramas

Botonera2 utilizará un modelo **trunk-based simple** con `main` como única rama estable de integración.

### Reglas

- `main` debe mantenerse siempre integrable.
- No se permiten commits directos a `main` durante la implementación productiva.
- Cada **Work Package (WP)** se implementa en una rama corta propia.
- Convención inicial de ramas: `wp/NNN-descripcion-corta`.
- Cada rama nace desde `main` actualizado.
- Un agente trabaja exclusivamente sobre el WP que tenga asignado.
- No se permite que dos agentes implementen simultáneamente sobre la misma rama.
- Todo cambio de producto entra mediante Pull Request.
- La CI definida para el alcance debe estar verde antes de integrar.
- La política de revisión independiente se completa en DT-037.
- El merge se realiza mediante **squash merge**, dejando un único commit final trazable al WP.
- El título del PR y el commit resultante deben incluir el identificador del WP.
- Después del merge se elimina la rama de trabajo.
- Las versiones desplegables se identifican posteriormente mediante tags/releases.

### No adoptar

No se utilizará GitFlow, una rama `develop` permanente ni ramas de integración largas. La coordinación se hace mediante WPs pequeños y PRs cortas contra `main`.

## DT-034 - Tamaño de los Work Packages

Los WPs serán **pequeños y orientados a un resultado verificable**, no a una cantidad arbitraria de líneas, archivos o tiempo.

### Cada WP debe contener

- un único objetivo principal;
- alcance explícito;
- exclusiones claras;
- dependencias previas;
- componentes/áreas previsiblemente afectadas;
- criterios de aceptación verificables;
- pruebas que deben pasar;
- documentación que deba actualizarse;
- ninguna decisión arquitectónica o reglamentaria abierta necesaria para completar el alcance.

### Regla de división

Un WP debe poder ser comprendido y revisado por un agente implementador y un agente revisor sin necesidad de cargar innecesariamente todo el proyecto.

Debe dividirse cuando aparezca cualquiera de estas señales:

- más de un objetivo funcional independiente;
- cambios grandes simultáneos en backend, ambos frontends y bridge sin necesidad atómica;
- demasiados criterios de aceptación independientes;
- una parte pueda integrarse y probarse de forma autónoma;
- la revisión requiera reconstruir demasiado contexto no relacionado.

No se impondrán límites rígidos de líneas o cantidad de archivos.

### Dependencias

Los WPs pueden declarar dependencias explícitas entre sí. Un WP dependiente no debe comenzar sobre supuestos de otro WP todavía no integrado salvo que el plan de trabajo lo autorice expresamente.

### Una PR por WP

Cada WP termina en una única Pull Request.

Si durante la implementación aparece trabajo necesario pero fuera del alcance aprobado:

- el agente no lo incorpora silenciosamente;
- lo registra como hallazgo o candidato a un WP separado;
- solo modifica el alcance si existe una decisión humana/documentada que lo autorice.

## DT-035 - Documentación operativa para agentes

La implementación se coordinará mediante una estructura documental **explícita pero liviana**. No se mantendrán matrices o documentos redundantes sin una necesidad concreta.

### Artefactos canónicos

```text
docs/
├── implementation/
│   └── PLAN.md
├── work-packages/
│   ├── TEMPLATE.md
│   ├── WP-001.md
│   └── ...
└── decisions/
    ├── README.md
    └── DEC-NNN-....md

.github/
└── pull_request_template.md
```

### `docs/implementation/PLAN.md`

Es el mapa de implementación. Debe contener:

- secuencia de WPs;
- dependencias;
- objetivo breve;
- estado `PENDIENTE`, `EN_CURSO`, `INTEGRADO` o `BLOQUEADO`;
- agente/herramienta asignado cuando un WP esté en ejecución.

No debe duplicar reglas de negocio ni diseño técnico ya documentado.

### `docs/work-packages/WP-XXX.md`

Cada WP es el contrato operativo de trabajo del agente. Debe declarar como mínimo:

- identificador y título;
- objetivo;
- resultado esperado;
- dependencias;
- **fuentes canónicas obligatorias y secciones propietarias del alcance**;
- alcance;
- fuera de alcance;
- componentes previsiblemente afectados;
- criterios de aceptación;
- pruebas obligatorias;
- invariantes/restricciones;
- documentación a actualizar;
- hallazgos fuera de alcance;
- checklist de entrega.

`docs/work-packages/TEMPLATE.md` es la plantilla inicial obligatoria.

### Lectura de contexto por agentes

Para un WP normal, el agente no debe cargar de forma indiscriminada toda la documentación del proyecto.

Orden normal:

1. `AGENTS.md`;
2. el `WP-XXX.md` asignado;
3. únicamente las fuentes canónicas y secciones indicadas por ese WP;
4. código/contratos directamente necesarios para el alcance.

Un agente de planificación, auditoría global o resolución de una contradicción puede necesitar un contexto documental más amplio.

### Decisiones `DEC-XXX`

`docs/decisions/` se reserva para decisiones nuevas que aparezcan durante la implementación y que tengan consecuencias arquitectónicas, contractuales o transversales relevantes.

No se creará un DEC para cada detalle local de implementación.

Un DEC corresponde cuando la decisión, por ejemplo:

- afecta a más de un WP/componente;
- modifica una decisión técnica ya aprobada;
- establece un contrato global nuevo;
- presenta alternativas relevantes con consecuencias futuras;
- requiere aprobación humana antes de continuar.

La política detallada está en `docs/decisions/README.md`.

### Trazabilidad

La trazabilidad principal se mantiene dentro del propio flujo:

```text
regla/requisito -> WP -> criterio de aceptación -> prueba -> PR
```

No se mantendrá inicialmente una matriz global duplicada. Puede agregarse más adelante si el volumen del proyecto la vuelve útil.

### Pull Requests

`.github/pull_request_template.md` exige como mínimo:

- WP implementado;
- agente/herramienta que lo implementó;
- qué cambió;
- qué explícitamente no cambió;
- criterios de aceptación;
- pruebas ejecutadas;
- estado de CI;
- documentación actualizada;
- decisiones/desviaciones;
- hallazgos fuera de alcance;
- riesgos pendientes.

El prompt entregado a un agente puede aportar instrucciones de ejecución, pero **no reemplaza el WP documentado como fuente canónica del alcance**.

## DT-036 - Estrategia multiagente y herramientas

La gobernanza se define por **roles y responsabilidades**, no por una herramienta o modelo concreto.

### Roles

#### Planificación y autoridad documental

La planificación, creación/modificación de WPs, mantenimiento de `PLAN.md` y aprobación de decisiones canónicas se realiza bajo control humano mediante las herramientas de planificación/documentación disponibles.

El agente implementador no redefine unilateralmente su propio alcance ni convierte una decisión abierta en una decisión aprobada.

#### Implementación

Cada WP tiene un único agente implementador responsable.

- **Codex** es el implementador predeterminado.
- **Claude Code** u **OpenCode** pueden ejecutar un WP cuando convenga por capacidad, disponibilidad, cuota o naturaleza de la tarea.
- El WP debe permanecer agnóstico respecto de la herramienta concreta: las mismas fuentes, alcance, criterios y pruebas rigen para cualquier implementador.
- No se fijarán modelos/versiones concretas en la documentación canónica porque cambian con mayor frecuencia que la arquitectura del proyecto.
- La PR debe registrar qué herramienta/agente ejecutó realmente el WP.

OpenCode se considera un arnés multiproveedor; la independencia de una revisión se evalúa por el agente/modelo efectivo utilizado, no por el nombre de la aplicación contenedora.

#### Revisión

La revisión independiente se define en DT-037. La herramienta de revisión puede ser Codex, Claude Code, OpenCode con otro modelo u otra capacidad equivalente, siempre que cumpla la independencia que se establezca allí.

### Aislamiento obligatorio de trabajo

Dos agentes pueden trabajar en paralelo únicamente sobre WPs independientes y autorizados por `PLAN.md`.

Cada WP en ejecución debe usar:

- rama propia `wp/NNN-descripcion-corta`;
- **`git worktree` propio**;
- sesión de agente propia;
- WP propio.

Está prohibido que dos agentes editen simultáneamente:

- el mismo working tree;
- la misma rama;
- el mismo WP.

Ejemplo:

```text
WP-006 -> worktree A -> wp/006-votacion-simple -> Codex
WP-008 -> worktree B -> wp/008-uso-palabra -> Claude Code
WP-009 -> worktree C -> wp/009-cliente-api -> OpenCode
```

Si aparece una dependencia no prevista o una superposición importante de archivos/contratos, los WPs se serializan o se replantea el PLAN; no se resuelve haciendo trabajar varios agentes sobre el mismo árbol.

### Registro en PLAN

`PLAN.md` debe permitir registrar, como mínimo:

```text
WP       Estado      Agente
WP-006   EN_CURSO    Codex
WP-007   PENDIENTE   -
WP-008   EN_CURSO    Claude Code
```

El nombre del agente/herramienta es información operativa, no una decisión arquitectónica permanente.

### Archivos de instrucciones por herramienta

`AGENTS.md` es la fuente común de instrucciones para agentes.

Cuando una herramienta requiera su propio archivo de entrada, este debe ser **mínimo** y remitir a `AGENTS.md` en lugar de duplicar reglas. En particular, `CLAUDE.md` debe limitarse a cargar/remitir a `AGENTS.md` y a indicar que el WP asignado y sus fuentes canónicas gobiernan el alcance.

No deben mantenerse copias completas y divergentes de las mismas reglas en archivos específicos de cada herramienta.

### Automatización agéntica

En la primera etapa no se incorporarán agentes generativos que modifiquen automáticamente PRs desde GitHub Actions.

La CI será determinista. La invocación de agentes para implementar o revisar será deliberada y trazable.

Una automatización futura de agentes requiere una decisión nueva documentada.
