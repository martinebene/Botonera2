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

Esta decisión no define todavía el tamaño exacto de un WP ni qué artefactos documentales debe contener; eso corresponde a DT-034 y DT-035.
