# Instrucciones para agentes de programación

Este archivo contiene reglas obligatorias para cualquier agente que analice, diseñe o implemente Botonera2.

## 1. Fuente canónica

La fuente canónica es **este repositorio** y, dentro de él, la documentación de `docs/`.

El repositorio histórico `martinebene/Botonera` NO es una dependencia de desarrollo y no debe utilizarse como sustituto de la especificación.

Solo puede consultarse cuando:

- se necesiten copiar las imágenes de bancas indicadas en `docs/07-configuracion-datos-y-assets.md`;
- una regla esté marcada como pendiente o requiera validación histórica según `docs/09-fuentes-y-trazabilidad.md` o `docs/10-preguntas-abiertas.md`.

Está prohibido copiar o portar código Python, JavaScript, HTML o CSS del sistema anterior como mecanismo de implementación. Botonera2 es una reimplementación desde cero.

## 2. Jerarquía documental

Ante contradicciones, aplicar este orden:

1. decisiones explícitas más recientes asentadas en `Botonera2`;
2. `docs/01-reglas-de-negocio.md` y `docs/02-modelo-de-dominio-y-estados.md`;
3. documentación específica del caso de uso o frontend;
4. criterios de aceptación;
5. fuentes históricas citadas, únicamente como evidencia.

Una contradicción entre una fuente histórica y Botonera2 **no autoriza** a cambiar la documentación ni la regla.

## 3. Orden de lectura mínimo

Antes de implementar una tarea funcional:

1. `README.md`;
2. `AGENTS.md`;
3. `docs/00-principios-y-alcance.md`;
4. `docs/01-reglas-de-negocio.md`;
5. `docs/02-modelo-de-dominio-y-estados.md`;
6. el documento propietario de la superficie afectada;
7. `docs/10-preguntas-abiertas.md`;
8. los escenarios pertinentes de `docs/11-criterios-de-aceptacion.md`.

No es necesario releer todos los documentos para cada cambio si el alcance es inequívoco.

## 4. Arquitectura objetivo obligatoria

La solución tendrá exactamente estas aplicaciones principales:

- backend: **FastAPI**;
- frontend de operación: **Nuxt.js — Moderación**;
- frontend público: **Nuxt.js — Pantalla de Recinto**.

El servicio que captura teclados físicos es una **integración externa** y se comunica con el backend por HTTP. No debe incorporar lógica de negocio.

El monitor técnico del sistema histórico no constituye un tercer frontend funcional requerido.

No introducir otra arquitectura principal, framework frontend o backend alternativo sin una decisión documental explícita.

## 5. Reglas que los agentes no pueden decidir

Un agente no puede inventar ni modificar por conveniencia técnica:

- quórum;
- reglas de mayoría;
- tratamiento de abstenciones;
- condiciones de apertura o cierre de votación;
- condiciones de empate y desempate;
- mapa de teclas;
- presencia/ausencia;
- cola y uso de la palabra;
- secreto y momento de revelación de votos;
- formato funcional del Orden del Día;
- identidad y numeración de bancas.

Si una decisión aparece en `docs/10-preguntas-abiertas.md`, debe permanecer abierta hasta que sea resuelta por el responsable del producto.

## 6. Diferenciar requisito de legado

No reproducir automáticamente defectos o decisiones accidentales del MVP.

Ejemplos de detalles históricos que NO son por sí solos reglas obligatorias:

- estado mantenido mediante singletons Python;
- almacenamiento únicamente en RAM;
- forma exacta de todos los JSON históricos;
- frontends estáticos;
- polling de 250/300 ms como única tecnología posible;
- nombres internos de clases o módulos;
- errores de serialización o mensajes inconsistentes;
- peculiaridades de rutas usadas solo por los frontends viejos.

Sí deben preservarse los comportamientos funcionales y contratos externos que la documentación declare expresamente.

## 7. Compatibilidad de hardware

El contrato externo mínimo a conservar es la recepción de una pulsación identificada por:

```json
{
  "dispositivo": "dev01",
  "tecla": "1"
}
```

El backend debe resolver dispositivo → concejal y aplicar todas las validaciones de negocio. El servicio físico solo detecta, identifica y transmite.

No incorporar fingerprints reales, rutas de dispositivos, credenciales ni mapeos institucionales al repositorio.

## 8. Implementación por capas

Mantener separación conceptual entre:

- dominio: entidades, estados y reglas puras;
- aplicación: casos de uso y coordinación;
- API: validación de transporte y DTOs;
- infraestructura: persistencia, configuración, logging e integraciones;
- Nuxt: presentación y comandos del usuario.

La interfaz no debe recalcular resultados legislativos que sean autoridad del backend. El backend debe ser la única autoridad sobre sesión, presencia, quórum, votos, resultados y uso de la palabra.

## 9. Pruebas obligatorias

Toda regla implementada debe tener pruebas automatizadas cuando sea razonablemente verificable sin interfaz.

Como mínimo:

- pruebas unitarias de reglas de votación y estados;
- pruebas de integración de los casos de uso y API;
- pruebas de contrato para la entrada de teclados;
- pruebas del frontend para estados críticos;
- recorrido end-to-end de los escenarios de `docs/11-criterios-de-aceptacion.md` antes de considerar una versión liberable.

Las pruebas deben usar datos ficticios. No incorporar datos personales reales del Concejo.

## 10. Cambios documentales

Si una implementación exige una decisión funcional no documentada:

1. no asumirla;
2. registrar o ampliar la pregunta abierta;
3. explicar el bloqueo en la entrega.

Cuando una pregunta sea resuelta, actualizar primero el documento propietario, después los criterios de aceptación y finalmente el código.

## 11. Entrega esperada

Cada cambio debe informar:

- objetivo;
- reglas afectadas;
- archivos modificados;
- pruebas ejecutadas;
- compatibilidad preservada;
- riesgos o decisiones pendientes.

No presentar como validado aquello que no haya sido probado.

## 12. Seguridad del repositorio histórico

Las referencias históricas existen para trazabilidad, no para navegación indiscriminada. No descargar logs históricos, datos personales, configuraciones operativas ni mapeos físicos si no son indispensables para una tarea explícita.
