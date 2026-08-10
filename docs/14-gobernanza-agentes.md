# 14 - Gobernanza del trabajo con agentes

Este documento registra las decisiones cerradas sobre ramas, unidades de trabajo, documentación operativa, herramientas agénticas, revisión y autoridad de cambios.

Las decisiones todavía abiertas permanecen en `10-preguntas-abiertas.md`.

## DT-033 - Modelo de ramas

Botonera2 utilizará un modelo **trunk-based simple** con `main` como única rama estable de integración.

### Reglas

- `main` debe mantenerse siempre integrable.
- No se permiten commits directos a `main`.
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

### Ejemplo

```text
main
  ↓
wp/003-auditoria-csv
  ↓ implementación + tests
Pull Request
  ↓ CI + revisión
squash merge
  ↓
main
```

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

Ejemplo:

```text
WP-006 - Votación simple
depende de:
- WP-002 - Estado global
- WP-004 - Auditoría
- WP-005 - Presencia y quórum
```

### Una PR por WP

Cada WP termina en una única Pull Request.

Si durante la implementación aparece trabajo necesario pero fuera del alcance aprobado:

- el agente no lo incorpora silenciosamente;
- lo registra como hallazgo o candidato a un WP separado;
- solo modifica el alcance si existe una decisión humana/documentada que lo autorice.

### Ejemplos de granularidad adecuada

```text
WP-001 Inicializar monorepo y toolchains
WP-002 Implementar modelo de estado global
WP-003 Implementar preparación de sala
WP-004 Implementar auditoría CSV
WP-005 Implementar presencia y quórum
WP-006 Implementar votación simple
WP-007 Implementar mayoría especial
WP-008 Implementar uso de la palabra
```

No son adecuados WPs excesivamente amplios como `Implementar todo el backend`, ni micro-WPs sin resultado verificable independiente como `Crear enum X` salvo que formen parte de una corrección aislada plenamente justificable.
