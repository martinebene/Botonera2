# AGENTS.md

## Propósito

Este repositorio contiene la especificación canónica y, posteriormente, la implementación de Botonera2, nueva versión del sistema de votación del Concejo Deliberante de Puerto Madryn.

Los agentes deben implementar lo documentado aquí; no reconstruir el producto a partir del repositorio histórico.

## Flujo de lectura obligatorio para implementación

Para un Work Package normal, antes de proponer o modificar código:

1. leer `AGENTS.md`;
2. leer el `docs/work-packages/WP-XXX.md` asignado;
3. leer únicamente las fuentes canónicas y secciones que ese WP declare obligatorias;
4. inspeccionar el código, contratos y pruebas directamente necesarios para ese alcance.

No recorrer indiscriminadamente toda la documentación o todo el monorepo cuando el WP ya delimita el contexto necesario.

Los agentes de planificación, auditoría global, revisión transversal o resolución de contradicciones pueden necesitar ampliar el contexto según su tarea.

## Documentos de orientación global

Cuando una tarea requiera reconstrucción global, las fuentes principales son:

- `README.md`;
- `docs/00-principios-y-alcance.md`;
- `docs/01-reglas-de-negocio.md`;
- `docs/02-modelo-de-dominio-y-estados.md`;
- `docs/03-casos-de-uso.md`;
- `docs/04-contratos-e-integraciones.md`;
- `docs/05-frontend-moderacion.md`;
- `docs/06-frontend-pantalla-recinto.md`;
- `docs/07-configuracion-datos-y-assets.md`;
- `docs/08-observabilidad-y-auditoria.md`;
- `docs/09-fuentes-y-trazabilidad.md`;
- `docs/10-preguntas-abiertas.md`;
- `docs/11-criterios-de-aceptacion.md`;
- `docs/12-decisiones-tecnicas.md`;
- `docs/13-despliegue-y-operacion.md`;
- `docs/14-gobernanza-agentes.md`;
- `docs/implementation/PLAN.md`.

## Autoridad documental

- La documentación de Botonera2 es la fuente normativa para la nueva implementación.
- El WP asignado define el alcance operativo, pero no puede contradecir reglas o decisiones canónicas.
- El repositorio histórico `martinebene/Botonera`, rama `main`, solo puede consultarse cuando la documentación/WP lo indique para descargar assets, validar una regla histórica puntual o comprobar compatibilidad con el bridge físico existente.
- No copiar arquitectura, clases, endpoints internos, polling, serialización ni estructura histórica por defecto.
- La rama histórica `v2` no es normativa.
- Si una implementación antigua contradice Botonera2, manda Botonera2.
- El prompt de ejecución no reemplaza la especificación versionada del WP ni puede ampliar silenciosamente su alcance.

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

## Stack técnico cerrado DT-001 a DT-026

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
- 1920×1080 es resolución de referencia, no dependencia rígida; ambos frontends deben ser adaptables.
- pytest + HTTPX + AnyIO para backend.
- Vitest + Nuxt Test Utils + Vue Test Utils para frontend.
- Playwright para E2E críticos.
- GitHub Actions por PR.
- Ruff + Pyright en Python; ESLint + Prettier + `nuxt typecheck` en frontend.

Estas decisiones están desarrolladas en `docs/12-decisiones-tecnicas.md` y no deben reconsiderarse dentro de un WP normal.

## Despliegue cerrado DT-027 a DT-032

Ver `docs/13-despliegue-y-operacion.md`.

Principios principales:

- Linux Mint 22.3 Cinnamon como plataforma de referencia;
- systemd nativo;
- Nuxt SPA estáticas;
- Nginx y mismo origen para frontends/API;
- releases inmutables con `current` y rollback;
- no desplegar deliberadamente durante preparación/sesión;
- CSV institucionales conservados localmente en la primera versión.

## Gobernanza cerrada DT-033 a DT-036

Ver `docs/14-gobernanza-agentes.md`.

- `main` es la única rama estable de integración.
- Cada WP usa rama corta `wp/NNN-descripcion-corta` y una PR.
- WPs pequeños, con un único resultado verificable.
- `docs/implementation/PLAN.md` ordena WPs, dependencias, estado y agente asignado.
- `docs/work-packages/WP-XXX.md` es el contrato versionado del trabajo.
- `docs/decisions/DEC-XXX-*.md` se reserva para decisiones nuevas realmente transversales/relevantes.
- `.github/pull_request_template.md` define el mínimo de entrega de cada PR.
- Codex es el implementador predeterminado; Claude Code y OpenCode son alternativas válidas por WP.
- Un WP tiene un único agente implementador.
- Cada WP `EN_CURSO` usa rama, `git worktree` y sesión de agente propios.
- Dos agentes solo pueden trabajar en paralelo sobre WPs independientes autorizados por PLAN.
- Está prohibido compartir working tree, rama o WP entre agentes simultáneos.
- La herramienta/modelo concreto no forma parte de la arquitectura permanente; debe registrarse en la PR.
- No se automatizan agentes generativos dentro de CI en la primera etapa.
- `AGENTS.md` es la fuente común de instrucciones; archivos específicos de herramienta deben remitir aquí y no duplicar reglas.

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

- No iniciar un alcance que dependa de una decisión aún abierta en `docs/10-preguntas-abiertas.md`.
- No ampliar silenciosamente el WP asignado.
- No modificar decisiones cerradas por iniciativa propia.
- No introducir base de datos ni persistencia de sesión activa.
- No sustituir stack, transporte, testing, calidad o despliegue sin decisión documentada.
- No introducir autenticación de operador salvo decisión explícita.
- No sustituir CSV como registro institucional.
- No agregar edición/corrección de votos.
- No validar autoridad o contenido político/administrativo del Orden del Día.
- No conectar frontends directamente al device-bridge.
- No diseñar UI dependiente exclusivamente de 1920×1080.
- No ejecutar dos agentes sobre el mismo working tree, rama o WP.

Si aparece trabajo fuera de alcance, registrarlo en el WP/PR como hallazgo. Si aparece una decisión transversal nueva, detener solo el alcance afectado y elevarla para posible `DEC-XXX`.

## Calidad esperada

Cada cambio debe:

- corresponder al WP y a fuentes canónicas indicadas;
- cumplir criterios de aceptación;
- incluir pruebas proporcionales al riesgo;
- preservar invariantes;
- mantener backend/frontends desacoplados por contratos claros;
- evitar secretos y datos reales;
- mantener trazabilidad `requisito -> WP -> aceptación -> prueba -> PR`.

Si aparece una contradicción real entre documentos, no adivinar: detener únicamente el alcance afectado y documentar la inconsistencia.
