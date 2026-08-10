# 10 - Decisiones técnicas abiertas

Las reglas de negocio principales y las decisiones técnicas DT-001 a DT-038 están cerradas.

Las decisiones aprobadas se registran en:

- `12-decisiones-tecnicas.md` para arquitectura, backend/datos, frontend y calidad;
- `13-despliegue-y-operacion.md` para despliegue/operación;
- `14-gobernanza-agentes.md` para ramas, WPs, herramientas agénticas, revisión y autoridad.

Durante la construcción del PLAN se identificó una decisión contractual adicional que debe cerrarse antes de implementar el alcance afectado.

## DT-039 - Esquema del CSV de Orden del Día

La versión histórica utiliza:

```text
nro_votacion;tipo;tema;factor_de_mayoria;respecto
```

Botonera2 distingue explícitamente:

- mayoría `SIMPLE`, sin factor/base;
- mayoría `ESPECIAL`, con `factor` y base `PRESENTES | CUERPO`.

Debe definirse el contrato de archivo que utilizará Botonera2 y si se ofrecerá compatibilidad de lectura con el formato histórico.

Esta decisión bloquea únicamente `WP-016 - Parser backend de Orden del Día` y los alcances que dependan de él. El resto del PLAN puede continuar.

## Decisiones nuevas durante la implementación

Si durante un WP surge una cuestión que:

- modifica arquitectura, contratos o responsabilidades;
- cambia una decisión DT ya aprobada;
- incorpora una dependencia directa no prevista;
- altera reglas, criterios de aceptación, formatos canónicos, seguridad, auditoría, CI o despliegue;
- tiene consecuencias transversales o futuras relevantes;

el agente no debe resolverla unilateralmente.

Debe escalarla según DT-038 y, cuando corresponda, documentarla mediante un `DEC-XXX` aprobado antes de continuar el alcance afectado.

## Criterio de inicio de programación

DT-039 no bloquea WP-001 ni los WPs independientes de Orden del Día.

Antes de ejecutar un WP concreto deben cumplirse sus condiciones operativas:

1. el WP debe existir y estar aprobado en `docs/work-packages/`;
2. sus dependencias deben estar integradas o expresamente autorizadas;
3. no puede depender de una DT/DEC todavía abierta;
4. debe tener rama y `git worktree` propios;
5. debe registrarse el agente implementador cuando pase a `EN_CURSO`;
6. la entrega debe pasar CI y revisión independiente antes de integrarse.

Ningún agente puede improvisar trabajo fuera del PLAN o de un WP aprobado.