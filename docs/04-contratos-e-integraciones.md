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
- para especial: factor y base `PRESENTES | CUERPO`.

No inferir mayoría simple a partir de un factor. Una votación abierta es inmutable.

## 9. Finalización manual

Existe un único comando conceptual `finalizar votacion`, con motivo obligatorio. La finalización anticipada produce `INCONCLUSA` según las reglas de negocio.

## 10. Desempate presidencial

Solo disponible para votación `SIMPLE` y `EMPATADA`.

Entrada: `POSITIVO` o `NEGATIVO`.

No recibe concejal ni modifica votos ordinarios. Se registra Presidencia vigente, sentido y resultado.

## 11. Orden del Día

Moderación envía el archivo al backend y el backend es el único parser.

Contrato de importación canónico:

```text
nro_votacion,tipo,tema,tipo_mayoria,factor,base
```

- CSV separado por coma con soporte de quoting CSV normal;
- `tipo_mayoria` explícito: `SIMPLE | ESPECIAL`;
- `SIMPLE`: `factor` y `base` vacíos;
- `ESPECIAL`: `factor` obligatorio y `base = PRESENTES | CUERPO`;
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
