# AGENTS.md

## Propósito

Este repositorio contiene la especificación canónica y, posteriormente, la implementación de Botonera2, nueva versión del sistema de votación del Concejo Deliberante de Puerto Madryn.

Los agentes deben implementar lo documentado aquí; no reconstruir el producto a partir del repositorio histórico.

## Orden de lectura obligatorio

Antes de proponer o modificar código:

1. `README.md`
2. `docs/00-principios-y-alcance.md`
3. `docs/01-reglas-de-negocio.md`
4. `docs/02-modelo-de-dominio-y-estados.md`
5. `docs/03-casos-de-uso.md`
6. `docs/04-contratos-e-integraciones.md`
7. `docs/05-frontend-moderacion.md`
8. `docs/06-frontend-pantalla-recinto.md`
9. `docs/07-configuracion-datos-y-assets.md`
10. `docs/08-observabilidad-y-auditoria.md`
11. `docs/09-fuentes-y-trazabilidad.md`
12. `docs/10-preguntas-abiertas.md`
13. `docs/11-criterios-de-aceptacion.md`
14. `docs/12-decisiones-tecnicas.md`

## Autoridad documental

- La documentación de Botonera2 es la fuente normativa para la nueva implementación.
- El repositorio histórico `martinebene/Botonera`, rama `main`, solo puede consultarse cuando esta documentación lo indique para descargar assets, validar una regla histórica puntual o comprobar compatibilidad con el bridge físico existente.
- No copiar arquitectura, clases, endpoints internos, polling, serialización ni estructura histórica por defecto.
- La rama histórica `v2` no es normativa.
- Si una implementación antigua contradice Botonera2, manda Botonera2.

## Arquitectura funcional obligatoria

La solución se implementa como **monorepo** con responsabilidades separadas:

- `apps/backend`: FastAPI;
- `apps/moderacion`: Nuxt 4;
- `apps/recinto`: Nuxt 4;
- `services/device-bridge`: captura/remapeo físico;
- `packages/api-client`: cliente REST/SSE y tipos compartidos;
- `packages/frontend-shared`: solo código realmente común;
- `config`: configuración del backend/padrón.

El backend es la única autoridad de estado global, preparación, sesión, presencia, votaciones/resultados, palabra, autoridades y auditoría institucional.

Los frontends representan estado y envían comandos permitidos. Nunca deciden reglas de negocio.

## Stack técnico cerrado DT-001 a DT-020

- Python **3.14** con **uv** y `uv.lock`.
- Node.js **24 LTS** con **pnpm workspaces** y `pnpm-lock.yaml`.
- FastAPI con un único proceso/worker y un único estado operativo en memoria.
- Toda mutación pasa por un mecanismo único de serialización/exclusión.
- Sin base de datos en la primera versión.
- API REST `/api/v1`, Pydantic y OpenAPI.
- REST para comandos/snapshots; **SSE** para actualización continua.
- Proyecciones independientes `ModerationState` y `PublicState`.
- Configuración funcional en `config/system.toml`.
- Padrón en `config/concejales.csv`.
- Mapeo físico del bridge en `services/device-bridge/config/devices.json`.
- Orden del Día parseado exclusivamente por backend.
- Auditoría CSV: `seq;timestamp;level;tag;event_code;message`, delimitador `;`, UTF-8 con BOM.
- Persistencia de auditoría con escritura síncrona + `flush` + `fsync`; ante imposibilidad de auditar, fallo cerrado para nuevas mutaciones.
- Remapeo urgente: nuevo fingerprint físico -> mismo identificador lógico dentro del bridge.
- Nuxt 4 + Vue 3 + TypeScript estricto.
- Tailwind CSS v4 + componentes propios; sin Nuxt UI inicial.
- Sin Pinia inicialmente; estado frontend mediante composables/primitives.
- `packages/api-client/` concentra REST/SSE/reconexión/tipos.
- Compartición de UI mínima, no una librería común extensa preventiva.
- 1920×1080 es resolución de referencia, no dependencia rígida; ambos frontends deben ser adaptables a hardware/resoluciones razonables.

Estas decisiones están desarrolladas en `docs/12-decisiones-tecnicas.md` y no deben reconsiderarse dentro de un work package normal.

## Invariantes que no se pueden reinterpretar

- Estados globales: `SIN_PREPARAR`, `PREPARANDO`, `SESION_ABIERTA`.
- El estado operativo se mantiene en memoria y no se restaura después de una caída.
- Una interrupción técnica obliga a nueva preparación y nueva apertura reglamentaria.
- Una sola votación activa por vez.
- Mayoría simple y especial son tipos distintos.
- Mayoría simple: `positivos > negativos`; abstenciones fuera del cálculo; igualdad produce empate.
- Mayoría especial: factor explícito y base `PRESENTES` o `CUERPO`; igualdad exacta con factor aprueba (`>=`).
- En especial sobre presentes, la abstención forma parte de votos emitidos y del denominador.
- Si falta voto de algún presente al finalizar manualmente, la votación es `INCONCLUSA`.
- La pérdida de quórum durante votación la convierte inmediatamente en `INCONCLUSA`.
- Una votación cerrada nunca se recalcula.
- Un voto ordinario es irreversible y Moderación no puede modificarlo.
- Presidencia es rol independiente del rol Concejal; una persona puede ejercer ambos sin interferencia funcional.
- Presidencia desempata solo mayoría simple `EMPATADA`, desde Moderación, con voto positivo/negativo irreversible.
- Secretaría Legislativa es rol institucional sin acciones funcionales.
- Los votos individuales no se revelan en Recinto hasta cierre.
- El Orden del Día es opcional y asistencial.
- Toda interacción relevante desde `PREPARANDO` hasta cierre/cancelación se registra de inmediato en tres CSV jerárquicos.

## Dispositivos

Mapa funcional:

- `1`: voto positivo;
- `2`: abstención;
- `3`: voto negativo;
- `7`: pedir/retirar palabra; si habla, finalizar su uso;
- `8`: test visual;
- `9`: alternar presencia.

Durante `PREPARANDO` solo tienen efecto funcional `8` y `9`.

En `SIN_PREPARAR` ninguna pulsación produce efecto funcional ni pertenece a CSV de sesión.

### Remapeo rápido

La relación técnica es:

```text
fingerprint físico -> device-bridge -> identificador lógico -> backend -> concejal
```

Ante falla, el bridge reasigna un nuevo fingerprint al **mismo identificador lógico**. No se cambia concejal, presencia, votos ni padrón. Puede ocurrir durante una votación y debe registrarse.

## Registros y auditoría

- Tres CSV por preparación/sesión.
- Fecha y hora de inicio en el nombre.
- L1 contiene L1+L2+L3; L2 contiene L2+L3; L3 contiene L3.
- Formato canónico: `seq;timestamp;level;tag;event_code;message`.
- Delimitador `;`, UTF-8 con BOM, hora local, precisión a segundos.
- Persistencia inmediata con `flush` + `fsync`.
- Si no puede garantizarse auditoría, no confirmar nuevas mutaciones como exitosas.
- Al cancelar preparación/cerrar sesión se escribe evento final y los archivos quedan cerrados.
- Ante caída abrupta, quedan hasta el último evento efectivamente persistido y no se reparan retrospectivamente.

## Restricciones de implementación para agentes

Hasta cerrar las decisiones técnicas requeridas por el alcance en `docs/10-preguntas-abiertas.md`:

- no iniciar un alcance que dependa de una decisión aún abierta;
- no modificar DT-001 a DT-020 por iniciativa propia;
- no introducir base de datos ni persistencia de sesión activa;
- no sustituir `uv`, `pnpm`, REST+SSE, Nuxt 4, Tailwind v4 o la estrategia de estado sin decisión documentada;
- no introducir autenticación de operador salvo decisión explícita;
- no sustituir CSV como registro institucional;
- no agregar edición/corrección de votos;
- no validar autoridad o contenido político/administrativo del Orden del Día;
- no conectar los frontends directamente al device-bridge;
- no diseñar una UI dependiente exclusivamente de 1920×1080.

## Calidad esperada

Cada cambio futuro debe:

- corresponder a reglas/casos de uso documentados;
- incluir pruebas proporcionales al riesgo;
- preservar invariantes;
- mantener backend/frontends desacoplados por contratos claros;
- evitar secretos y datos reales;
- mantener trazabilidad entre requisito, implementación y prueba.

Si aparece una contradicción real entre documentos, no adivinar: detener únicamente el alcance afectado y documentar la inconsistencia.
