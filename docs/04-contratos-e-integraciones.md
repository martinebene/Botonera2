# 04 - Contratos e integraciones

Este documento define responsabilidades de integración y las decisiones técnicas ya cerradas para los contratos entre componentes.

## 1. Regla general

Toda transición de negocio se ejecuta en el backend FastAPI.

Los frontends y el bridge físico envían comandos/intenciones y reciben estado/proyecciones; no resuelven reglas localmente.

## 2. Bridge de dispositivos físicos

La implementación histórica envía pulsaciones al backend mediante `POST /entradas/tecla` con un identificador lógico de dispositivo y tecla.

Botonera2 debe preservar inicialmente una vía compatible o proveer una migración explícita para no bloquear el hardware existente.

### Responsabilidades del bridge

- detectar dispositivos físicos;
- normalizar teclas;
- resolver fingerprint físico -> identificador lógico;
- enviar pulsación al backend;
- ejecutar/capturar remapeo rápido físico -> lógico solicitado desde Moderación a través del backend.

### Responsabilidades que NO pertenecen al bridge

- presencia;
- quórum;
- validez de voto;
- cierre de votación;
- uso de palabra;
- resultado;
- registro institucional.

Todo ello pertenece al backend.

## 3. Semántica de pulsaciones

El backend interpreta:

- `1`: positivo;
- `2`: abstención;
- `3`: negativo;
- `7`: palabra;
- `8`: test;
- `9`: presencia.

La misma pulsación puede ser aceptada o rechazada según estado global y concejal.

En `SIN_PREPARAR` ninguna pulsación tiene efecto funcional. En `PREPARANDO` solo `8` y `9` tienen efecto funcional.

## 4. API nueva

La API interna será REST bajo `/api/v1`.

FastAPI + Pydantic definen esquemas de entrada/salida y OpenAPI generado por FastAPI es el contrato HTTP técnico canónico.

Los errores de dominio exponen identificadores estables legibles por máquina.

## 5. Entrada física

La respuesta al bridge/diagnóstico permite distinguir al menos:

- aceptada/rechazada;
- motivo estable;
- dispositivo lógico;
- tecla;
- concejal cuando corresponda;
- resultado funcional relevante cuando corresponda.

## 6. Comandos de Moderación requeridos

El backend debe ofrecer capacidades equivalentes a:

- preparar/cancelar preparación;
- actualizar número de sesión, Presidencia y Secretaría;
- abrir/cerrar sesión;
- cargar/descartar Orden del Día;
- abrir/finalizar votación;
- emitir desempate presidencial;
- otorgar/quitar palabra;
- consultar estado/eventos;
- iniciar/confirmar remapeo rápido cuando se implemente.

### Contrato REST de preparación

El recurso de preparación utiliza estas operaciones canónicas:

- `POST /api/v1/preparacion`: inicia una nueva preparación desde `SIN_PREPARAR`;
- `PATCH /api/v1/preparacion`: actualiza uno o más datos institucionales durante `PREPARANDO`;
- `DELETE /api/v1/preparacion`: cancela la preparación activa desde `PREPARANDO`.

`POST` y `DELETE` se invocan sin body. `PATCH` recibe un objeto parcial con al menos uno de estos campos:

```json
{
  "numero_sesion": 59,
  "presidencia": "Nombre",
  "secretaria_legislativa": "Nombre"
}
```

`numero_sesion` es un entero estricto mayor o igual a uno. Las autoridades son texto libre normalizado con `strip` y un texto vacío permite limpiar el valor durante preparación. Todos los comandos exitosos responden `204 No Content`.

`POST /api/v1/preparacion` carga los archivos canónicos de configuración y padrón del backend (`config/system.toml` y `config/concejales.csv`). El directorio de auditoría proviene de la configuración cargada; las rutas no se suministran desde el cliente.

`DELETE /api/v1/preparacion` no recibe ni exige motivo de cancelación.

### Contrato REST de sesión

La sesión formal se administra sobre un único recurso:

- `POST /api/v1/sesion`: abre desde `PREPARANDO`, sin body;
- `PATCH /api/v1/sesion`: actualiza Presidencia y/o Secretaría Legislativa durante `SESION_ABIERTA`;
- `DELETE /api/v1/sesion`: cierra, sin body; antes resuelve como `INCONCLUSA` una votación `EN_CURSO` o `EMPATADA`.

`PATCH /api/v1/sesion` no admite `numero_sesion`: el número queda inmutable desde la apertura. Cada autoridad suministrada debe conservar contenido después de `strip`; durante una sesión abierta no puede limpiarse. Un cambio que normaliza al valor vigente es un no-op exitoso sin evento ficticio. Las tres operaciones responden `204 No Content` cuando completan.

La apertura exige, en este orden, `PREPARANDO`, quórum, número, Presidencia y Secretaría Legislativa. Cambiar presencia fuera de una votación actualiza el quórum sin cerrar ni reemplazar la sesión.

Los errores funcionales/técnicos de estas operaciones conservan la forma estable:

```json
{
  "codigo": "CODIGO_ESTABLE",
  "mensaje": "Mensaje legible por personas."
}
```

Mapeo mínimo:

- `409 Conflict` + `ESTADO_INCOMPATIBLE`: el comando no es válido para el estado global actual;
- `409 Conflict` + `QUORUM_INSUFICIENTE`: no hay quórum para abrir;
- `409 Conflict` + `NUMERO_SESION_REQUERIDO`: falta el número para abrir;
- `409 Conflict` + `PRESIDENCIA_REQUERIDA`: falta Presidencia para abrir;
- `409 Conflict` + `SECRETARIA_LEGISLATIVA_REQUERIDA`: falta Secretaría Legislativa para abrir;
- `409 Conflict` + `VOTACION_PENDIENTE`: existe una votación pendiente en un estado técnico o no autorizado para el flujo solicitado; `EN_CURSO` y `EMPATADA` sí son resueltas por el cierre de sesión;
- `503 Service Unavailable` + `CONFIGURACION_INVALIDA`: `system.toml` no puede cargarse o validarse;
- `503 Service Unavailable` + `PADRON_INVALIDO`: `concejales.csv` no cumple el contrato canónico;
- `503 Service Unavailable` + `AUDITORIA_NO_DISPONIBLE`: no puede garantizarse la auditoría obligatoria;
- `500 Internal Server Error` + `ERROR_INTERNO`: fallo inesperado no clasificado por los contratos anteriores.

Configuración/padrón inválidos se tratan como indisponibilidad técnica del backend para preparar, no como un `422` del cliente, porque el comando no recibe esos archivos en su body.

## 7. Proyecciones

### ModerationState

Incluye estado global, preparación/sesión, autoridades, concejales/bancas/presencia/test, quórum, votación, votos cuando corresponda, palabra, Orden del Día, eventos y capacidades de operación.

### PublicState

Es independiente. Durante `EN_CURSO` no contiene votos individuales, eventos que los revelen ni datos que permitan inferirlos.

El secreto temporal se garantiza en servidor.

## 8. Votaciones

La apertura expresa explícitamente:

- número externo;
- tipo;
- tema;
- `tipo_mayoria = SIMPLE | ESPECIAL`;
- para `SIMPLE`: factor omitido/nulo/cero y base omitida o `VOTOS_COMPUTABLES`, normalizados a `0` y `VOTOS_COMPUTABLES`;
- para `ESPECIAL`: factor real finito `> 0 <= 1` y base `VOTOS_COMPUTABLES | PRESENTES | CUERPO`.

No inferir el tipo de mayoría a partir de un factor. `PRESENTES` representa a quienes emitieron voto ordinario, incluidas abstenciones. Los datos constitutivos de una votación abierta son inmutables; votos, estado de recepción y fecha de cierre evolucionan únicamente mediante las transiciones autorizadas.

Los votos ordinarios ingresan exclusivamente por `POST /api/v1/entradas/tecla`: `1 -> POSITIVO`, `2 -> ABSTENCION`, `3 -> NEGATIVO`. La respuesta funcional agrega la variante tipada `VOTO`, con el valor aceptado y `estado_recepcion = EN_CURSO | CERRADA`, sin exponer todavía resultado ni cómputo de mayoría.

La recepción completa con quórum pasa a `CERRADA` y fija una única fecha/hora. Sin liberar el `EjecutorMutaciones`, el backend calcula desde sus votos ordinarios y datos constitutivos, persiste un evento L3 de resultado y lo aplica sobre la misma instancia. `APROBADA`/`RECHAZADA` liberan `votacion_activa`; `EMPATADA` la conserva y continúa bloqueando otra apertura hasta un flujo autorizado.

El contrato HTTP no agrega un comando de cálculo ni amplía el body de entrada. `POST /api/v1/entradas/tecla` puede seguir respondiendo la variante `VOTO` con `estado_recepcion=CERRADA` cuando la pulsación completó el flujo; el resultado institucional no se incorpora a esa respuesta.

Si la auditoría del resultado falla después de persistir y aplicar el cierre, la operación responde como indisponibilidad de auditoría y queda `CERRADA + resultado=None` con la misma referencia activa. No se publica un resultado sin su hecho institucional durable.

## 9. Finalización manual

El único endpoint es `POST /api/v1/votaciones/{id}/finalizacion`, con body `{ "motivo": "Texto obligatorio" }` y respuesta `204 No Content`. `motivo` es string estricto, se normaliza con `strip`, no admite vacío ni campos extra. Los bodies inválidos responden `422 Unprocessable Entity`.

El comando exige `SESION_ABIERTA`, una referencia activa `EN_CURSO + resultado=None` y coincidencia exacta de `{id}`. Los conflictos responden `409` con `ESTADO_INCOMPATIBLE`, `VOTACION_NO_COINCIDE` o `VOTACION_NO_EN_CURSO`; los fallos de auditoría responden `503 AUDITORIA_NO_DISPONIBLE` y los inesperados `500 ERROR_INTERNO`.

Una finalización manual válida siempre produce `CERRADA + INCONCLUSA` sobre la misma instancia, conserva votos y datos constitutivos, fija una única fecha de cierre y almacena el motivo normalizado. No convierte `EMPATADA` ni el estado técnico `CERRADA + resultado=None`.

## 10. Desempate presidencial

El único endpoint es:

```text
POST /api/v1/votaciones/{id}/desempate
```

Body cerrado:

```json
{
  "sentido": "POSITIVO"
}
```

`sentido` es obligatorio y admite exclusivamente `POSITIVO` o `NEGATIVO`; no admite `ABSTENCION`, `null`, booleanos, números, listas, objetos, strings arbitrarios ni campos extra. Presidencia, DNI, banca, concejal, resultado y motivo no pertenecen al body. Los errores de esquema responden `422`.

El comando exige `SESION_ABIERTA`, coincidencia exacta del id con la referencia activa y una votación `CERRADA + EMPATADA + SIMPLE` sin voto presidencial previo. Todas esas validaciones y la captura de la Presidencia vigente ocurren dentro del único `EjecutorMutaciones`. No se exige quórum posterior al empate.

Éxito responde `204 No Content`. Los conflictos responden `409` con `ESTADO_INCOMPATIBLE`, `VOTACION_NO_COINCIDE`, `VOTACION_NO_EMPATADA` o `DESEMPATE_YA_EMITIDO`. Auditoría no disponible responde `503 AUDITORIA_NO_DISPONIBLE`; un fallo inesperado conserva `500 ERROR_INTERNO`.

La operación persiste primero L3 `VOTO_DESEMPATE_PRESIDENCIAL`, almacena el voto separado, persiste después L3 `VOTACION_RESULTADO_DESEMPATE`, aplica el resultado derivado y libera la referencia activa. No recalcula SIMPLE, no altera votos ordinarios ni fecha de cierre y no expone un endpoint adicional de lectura.

Si falla el primer evento no existe voto presidencial. Si falla el segundo, el voto ya almacenado permanece irreversible mientras el resultado sigue `EMPATADA` y la votación continúa activa. El estado parcial no habilita retry ni recovery. Los rechazos funcionales con contexto auditable persisten L2 antes de devolver `409`; si esa escritura falla prevalece el `503`.

## 11. Orden del Día

Moderación envía el archivo al backend y el backend es el único parser.

Contrato de importación canónico:

```text
nro_votacion,tipo,tema,tipo_mayoria,factor,base
```

- CSV separado por coma con soporte de quoting CSV normal;
- `tipo_mayoria` explícito: `SIMPLE | ESPECIAL`;
- `SIMPLE`: `factor` vacío o `0` y `base` vacía o `VOTOS_COMPUTABLES`, normalizados a esos valores canónicos;
- `ESPECIAL`: factor real finito obligatorio `> 0 <= 1` y `base = VOTOS_COMPUTABLES | PRESENTES | CUERPO`;
- el formato histórico de cinco columnas no es compatible ni se adapta automáticamente;
- no se infiere el tipo de mayoría a partir del factor.

El backend distingue error técnico de lectura/formato de datos interpretables y no valida secuencia, unicidad ni legitimidad institucional del contenido.

## 12. REST + SSE

REST se utiliza para comandos, snapshots y consultas puntuales. SSE se utiliza para actualizaciones backend -> frontend.

Flujo:

1. obtener snapshot completo;
2. abrir stream SSE correspondiente;
3. aplicar actualizaciones ordenadas;
4. ante reconexión o duda de sincronización, recuperar snapshot antes de continuar.

No se usa polling periódico como mecanismo normal ni WebSocket salvo decisión futura documentada.

## 13. Cliente compartido

`packages/api-client/` concentra:

- tipos derivados de OpenAPI;
- REST;
- SSE;
- reconexión;
- snapshot;
- errores estables;
- control de secuencia/sincronización.

Los componentes no duplican estas responsabilidades.

## 14. Concurrencia

El backend impone un orden determinista mediante un único mecanismo de serialización/exclusión sobre el estado activo.

El orden aceptado y persistido es el orden oficial. Producción usa un solo proceso/worker.

## 15. Auditoría CSV

Los frontends no escriben CSV.

El backend persiste los eventos obligatorios en el conjunto L1/L2/L3 con formato:

`seq;timestamp;level;tag;event_code;message`

Cada persistencia utiliza escritura síncrona, `flush` y `fsync`. Si la auditoría obligatoria no puede garantizarse, el backend no confirma nuevas mutaciones como exitosas.

## 16. Remapeo rápido

Modelo:

```text
fingerprint físico -> device-bridge -> identificador lógico -> backend -> concejal
```

El remapeo reemplaza en el bridge el fingerprint físico asociado a un identificador lógico existente.

La UI inicia la operación por backend; nunca habla directamente con el bridge. El cambio no altera presencia, votos, identidad ni padrón.

## 17. Reinicio

No existe flujo de recuperación. Tras reinicio el backend inicia en `SIN_PREPARAR`; CSV previos nunca reconstruyen estado.

## 18. Tipos compartidos

Cuando sea práctico, los tipos TypeScript se generan/derivan de OpenAPI y se consumen a través de `packages/api-client/`, evitando copias manuales de modelos Pydantic.
