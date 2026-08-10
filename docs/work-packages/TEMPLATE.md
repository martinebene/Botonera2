# WP-XXX - Título

## Estado documental

`BORRADOR | APROBADO`

Un WP no puede pasar a `EN_CURSO` en `PLAN.md` mientras no esté `APROBADO`.

## Objetivo

Resultado único y verificable que debe producir este WP.

## Resultado esperado

Descripción concreta del estado que debe quedar integrado al completar el WP.

## Dependencias

- WP previos requeridos.
- Decisiones/documentos previos requeridos.

## Fuentes canónicas obligatorias

Indicar únicamente los documentos y secciones propietarios de este alcance. El agente debe leer `AGENTS.md`, este WP y estas fuentes antes de modificar código.

## Alcance

- Cambios permitidos y responsabilidades incluidas.

## Fuera de alcance

- Cambios explícitamente excluidos.

## Componentes previsiblemente afectados

- Rutas, paquetes, aplicaciones o servicios que razonablemente pueden modificarse.

La lista orienta el alcance pero no sustituye las reglas y exclusiones anteriores.

## Criterios de aceptación

- Criterios observables y verificables que determinan que el WP está completo.

## Pruebas obligatorias

- Unitarias, integración, E2E o checks aplicables.

## Invariantes y restricciones

- Reglas que este WP no puede alterar.
- Restricciones de DT-038 aplicables al alcance.

## Decisiones que requieren escalamiento

Si aparece una decisión reservada por DT-038, no resolverla unilateralmente. Registrar:

```text
Decisión requerida:
Motivo:
Alternativas:
Impacto:
Recomendación:
Alcance bloqueado:
```

Detener únicamente la parte dependiente y continuar trabajo independiente seguro.

## Documentación a actualizar

- Documentos que deben quedar consistentes con el cambio.

## Hallazgos fuera de alcance

Registrar aquí trabajo detectado que no debe incorporarse silenciosamente a este WP.

## Checklist de entrega

- [ ] Alcance implementado sin ampliaciones no autorizadas.
- [ ] No se introdujeron decisiones reservadas por DT-038 sin aprobación.
- [ ] Criterios de aceptación cumplidos.
- [ ] Pruebas obligatorias agregadas/actualizadas y verdes.
- [ ] No se relajaron pruebas ni criterios para hacer pasar CI.
- [ ] Calidad estática y builds aplicables verdes.
- [ ] Documentación actualizada.
- [ ] Hallazgos fuera de alcance registrados.
- [ ] PR vinculada a este WP.
- [ ] Revisión independiente completada antes de integración.