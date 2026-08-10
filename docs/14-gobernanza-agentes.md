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
- estado `PENDIENTE`, `EN_CURSO`, `INTEGRADO` o `BLOQUEADO`.

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
