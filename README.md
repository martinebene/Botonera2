# Botonera2

Reimplementación desde cero del sistema de gestión de sesiones y votación electrónica del Concejo Deliberante de Puerto Madryn.

## Objetivo

Este repositorio será la **fuente canónica de requisitos y desarrollo** del nuevo sistema. La implementación objetivo estará compuesta por:

- backend en **FastAPI**;
- frontend de **Moderación** en **Nuxt.js**;
- frontend de **Pantalla de Recinto** en **Nuxt.js**;
- integración con el servicio externo de teclados físicos mediante una API HTTP.

No se trata de una refactorización del código anterior: la nueva implementación debe construirse desde cero a partir de la documentación de este repositorio.

## Autoridad de las fuentes

Las reglas documentadas aquí fueron reconstruidas principalmente desde el sistema actualmente en producción:

- repositorio histórico: `martinebene/Botonera`;
- rama productiva analizada: `main`;
- snapshot de referencia: `537823b4a0045853c74a388058fa3739cf7457a5`.

La rama histórica `v2` fue revisada solo como fuente secundaria para detectar inconsistencias e ideas no validadas. **No es fuente normativa de reglas de negocio.**

A partir de la creación de este repositorio, la documentación de `Botonera2` prevalece sobre el código y los documentos del repositorio anterior. Los agentes no deben copiar la implementación histórica ni depender de ella durante el desarrollo.

El repositorio anterior podrá consultarse únicamente para:

1. descargar las imágenes institucionales de las bancas;
2. validar una regla cuando esta documentación indique expresamente una duda o una referencia histórica.

Si al consultar el sistema anterior aparece una contradicción con esta documentación, el agente debe detener el cambio funcional y registrar la discrepancia; no debe modificar silenciosamente la regla.

## Documentación

Leer en este orden:

1. [`AGENTS.md`](AGENTS.md) — reglas obligatorias para agentes de programación.
2. [`docs/00-principios-y-alcance.md`](docs/00-principios-y-alcance.md) — alcance y decisiones de base.
3. [`docs/01-reglas-de-negocio.md`](docs/01-reglas-de-negocio.md) — reglas funcionales extraídas de producción.
4. [`docs/02-modelo-de-dominio-y-estados.md`](docs/02-modelo-de-dominio-y-estados.md) — entidades, estados y transiciones.
5. [`docs/03-casos-de-uso.md`](docs/03-casos-de-uso.md) — recorridos operativos.
6. [`docs/04-contratos-e-integraciones.md`](docs/04-contratos-e-integraciones.md) — límites del backend e integración con hardware.
7. [`docs/05-frontend-moderacion.md`](docs/05-frontend-moderacion.md) — comportamiento del frontend de moderación.
8. [`docs/06-frontend-pantalla-recinto.md`](docs/06-frontend-pantalla-recinto.md) — comportamiento de la pantalla pública.
9. [`docs/07-configuracion-datos-y-assets.md`](docs/07-configuracion-datos-y-assets.md) — configuración, archivos e imágenes.
10. [`docs/08-observabilidad-y-auditoria.md`](docs/08-observabilidad-y-auditoria.md) — eventos y trazabilidad operativa.
11. [`docs/09-fuentes-y-trazabilidad.md`](docs/09-fuentes-y-trazabilidad.md) — evidencia de cada grupo de reglas.
12. [`docs/10-preguntas-abiertas.md`](docs/10-preguntas-abiertas.md) — decisiones que no deben ser inventadas por agentes.
13. [`docs/11-criterios-de-aceptacion.md`](docs/11-criterios-de-aceptacion.md) — escenarios mínimos que debe superar la nueva implementación.

## Principio central

**Comportamiento antes que implementación.**

Los detalles técnicos del sistema anterior —singletons, HTML/JS estático, polling concreto, almacenamiento exclusivamente en memoria, estructura de carpetas o peculiaridades accidentales de su API— no se consideran automáticamente requisitos del nuevo sistema. Solo se preservan cuando representan una regla funcional, una restricción operativa o una integración externa documentada aquí.

## Estado

Fase actual: **especificación funcional previa a implementación**.

No debe iniciarse la codificación de una regla marcada como abierta hasta que la decisión correspondiente quede asentada en esta documentación.
