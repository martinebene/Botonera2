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

Todos los WPs de implementación heredan además `docs/decisions/DEC-001-estilo-codigo-y-referencia-produccion.md`, aunque no se repita como fuente específica del dominio.

## Alcance

- Cambios permitidos y responsabilidades incluidas.

## Fuera de alcance

- Cambios explícitamente excluidos.

## Componentes previsiblemente afectados

- Rutas, paquetes, aplicaciones o servicios que razonablemente pueden modificarse.

La lista orienta el alcance pero no sustituye las reglas y exclusiones anteriores.

## Criterios de aceptación

- Criterios observables y verificables que determinan que el WP está completo.
- El código propio nuevo respeta nomenclatura en español según DEC-001.
- La documentación/comentarios pedagógicos del código son suficientes para comprender clases, funciones y flujos no triviales.

## Pruebas obligatorias

- Unitarias, integración, E2E o checks aplicables.

## Invariantes y restricciones

- Reglas que este WP no puede alterar.
- Restricciones de DT-038 aplicables al alcance.
- Reglas transversales de DEC-001 sobre idioma del código, comentarios pedagógicos y fallback a producción.

## Consulta a producción si existe ambigüedad funcional/UX/visual

Si durante el WP aparece una regla de negocio, experiencia de usuario o decisión de diseño visual no claramente definida por Botonera2:

1. verificar primero las fuentes canónicas del WP;
2. si siguen siendo insuficientes, consultar únicamente el código necesario de `martinebene/Botonera/main` vigente;
3. registrar qué se verificó y qué archivos se consultaron;
4. si producción tampoco lo define inequívocamente, escalar antes de inventar.

No utilizar producción como fallback para decisiones técnicas.

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
- [ ] Código propio nuevo nombrado en español según DEC-001, salvo excepciones justificadas.
- [ ] Clases, funciones y flujos no triviales documentados/comentados en español con finalidad pedagógica.
- [ ] Si se consultó producción, la consulta funcional/UX/visual quedó trazada en WP/PR.
- [ ] Pruebas obligatorias agregadas/actualizadas y verdes.
- [ ] No se relajaron pruebas ni criterios para hacer pasar CI.
- [ ] Calidad estática y builds aplicables verdes.
- [ ] Documentación actualizada.
- [ ] Hallazgos fuera de alcance registrados.
- [ ] PR vinculada a este WP con explicación para principiantes.
- [ ] Revisión independiente completada antes de integración.
