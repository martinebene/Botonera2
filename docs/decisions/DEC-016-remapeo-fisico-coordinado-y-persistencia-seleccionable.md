# DEC-016 - Remapeo físico coordinado y persistencia seleccionable

## Estado

`APROBADA`

## Fecha

2026-08-24

## Contexto

WP-019 integró el bridge físico Linux y dejó fija la separación:

```text
fingerprint físico -> device-bridge -> identificador lógico devXX -> backend -> concejal
```

El padrón del backend conserva durante una preparación/sesión la relación lógica `devXX -> concejal`. El bridge conserva la relación física `fingerprint -> devXX`.

DT-014 y DEC-015 ya establecen que un remapeo urgente debe sustituir únicamente el fingerprint físico asociado al mismo identificador lógico, sin alterar identidad, presencia, votos ni uso de palabra, y que debe iniciarse desde Moderación pasando por el backend, nunca mediante navegador directo al bridge.

Para WP-020 faltaba cerrar el contrato de coordinación, captura, concurrencia con pulsaciones normales y persistencia del cambio. El operador aprobó explícitamente estas decisiones.

## Decisión

### 1. Transporte backend <-> bridge

La coordinación de remapeo utiliza HTTP local sobre loopback.

- Moderación se comunica únicamente con FastAPI.
- FastAPI coordina con el bridge por una API de control local del bridge.
- El bridge puede informar al backend el candidato capturado mediante un endpoint interno del backend.
- El navegador nunca se conecta directamente al bridge.
- La API de control del bridge debe escuchar únicamente en loopback por defecto y su URL/puerto deben ser configurables.
- Tanto el servidor de control del bridge como el cliente backend->bridge se implementan con biblioteca estándar de Python, sin nueva dependencia directa.

No se introduce polling periódico, WebSocket ni otra vía paralela de sincronización frontend/backend.

### 2. Una única operación de remapeo activa

Solo puede existir una operación de remapeo activa globalmente.

El backend crea un `remapeo_id` único e impredecible, basado en UUID, y lo utiliza como identidad estable de toda la operación.

Una operación distingue al menos estos estados conceptuales:

```text
CAPTURANDO
CANDIDATO
CONFIRMANDO
```

La operación termina en aplicación exitosa o cancelación. Un fallo técnico conserva suficiente identidad para que una repetición del mismo comando pueda resolverse idempotentemente y nunca se confunda con otro remapeo.

### 3. Estados globales permitidos

El remapeo puede iniciarse durante:

- `PREPARANDO`;
- `SESION_ABIERTA`, incluida una votación activa.

No puede iniciarse en `SIN_PREPARAR`, porque el backend todavía no tiene un padrón activo desde el cual validar el `devXX` objetivo.

El backend valida que el identificador lógico solicitado pertenezca al padrón activo. El remapeo no modifica esa relación lógica.

### 4. Captura no bloqueante y tráfico normal durante el remapeo

Entrar en modo captura NO detiene la operación normal del bridge.

Mientras existe una captura activa:

- todo fingerprint actualmente mapeado continúa procesando sus pulsaciones por el flujo normal de WP-019;
- esas pulsaciones siguen llegando a `POST /api/v1/entradas/tecla` y pueden registrar presencia, voto, test o palabra según decida el backend;
- ningún fingerprint actualmente mapeado puede convertirse accidentalmente en candidato de remapeo;
- el bridge continúa filtrando únicamente `keydown`, por lo que `keyup` y autorepeat no participan de la captura.

Esto permite remapear un teclado averiado mientras otros concejales continúan usando normalmente sus dispositivos, incluso durante una votación.

### 5. Elegibilidad del candidato físico

El candidato se obtiene de la primera pulsación `keydown` de un fingerprint físicamente detectado que sea elegible para el `devXX` objetivo.

Un fingerprint es elegible cuando:

1. no pertenece al mapping efectivo vigente de ningún `devXX`; y
2. si todavía aparece en la configuración base `devices.json`, únicamente puede estar asociado al mismo `devXX` objetivo.

La segunda regla permite volver al fingerprint base de un `devXX` que estaba temporalmente remapeado, pero impide apropiarse del fingerprint base perteneciente a otro dispositivo lógico.

Un fingerprint mapeado a otro `devXX` nunca se "roba" ni se reasigna automáticamente.

Cuando ya existe un candidato para la operación, otras pulsaciones de fingerprints no mapeados no reemplazan silenciosamente ese candidato. Los dispositivos mapeados siguen funcionando normalmente.

### 6. Flujo en dos fases

El flujo funcional es:

1. Moderación solicita iniciar remapeo para un `devXX`.
2. Backend valida estado, padrón y ausencia de otro remapeo activo.
3. Backend crea `remapeo_id` e instruye al bridge para comenzar captura.
4. Bridge mantiene funcionando todos los dispositivos ya mapeados.
5. La primera pulsación de un fingerprint elegible se captura como candidato y no se envía al endpoint normal de pulsaciones.
6. Bridge informa al backend el candidato asociado al mismo `remapeo_id`.
7. Moderación muestra el candidato al operador.
8. El operador puede cancelar o confirmar.
9. Al confirmar, el operador elige explícitamente `TEMPORAL` o `PERSISTENTE`.
10. Solo después de la confirmación se modifica el mapping efectivo.

No existe aplicación inmediata del primer dispositivo desconocido sin confirmación humana.

### 7. Persistencia seleccionable por el operador

La confirmación exige elegir exactamente uno de estos modos:

```text
TEMPORAL
PERSISTENTE
```

#### TEMPORAL

- sustituye únicamente el mapping efectivo en memoria del bridge;
- no modifica `devices.json`;
- conserva la configuración base para poder volver posteriormente al fingerprint original;
- permanece vigente mientras el proceso del bridge continúe ejecutándose o hasta que otro remapeo del mismo `devXX` la reemplace;
- un reinicio del bridge reconstruye el mapping desde `devices.json` y por lo tanto elimina el remapeo temporal;
- cerrar sesión o cancelar preparación no reescribe ni revierte automáticamente el mapping temporal, porque la relación física pertenece al bridge y no al ciclo de negocio del backend.

El operador puede volver al teclado base mediante un nuevo remapeo del mismo `devXX`; el fingerprint base resulta elegible porque deja de formar parte del mapping efectivo y sigue asociado al mismo objetivo en `devices.json`.

#### PERSISTENTE

- representa una decisión humana explícita de sustituir el teclado físico base del `devXX`;
- el bridge reemplaza en `services/device-bridge/config/devices.json` el fingerprint asociado al `devXX` objetivo por el nuevo fingerprint;
- se conservan intactas todas las demás asociaciones;
- el cambio debe escribirse de forma atómica y segura: construir/validar el mapping completo, escribir un archivo temporal en el mismo directorio, sincronizarlo y reemplazar el archivo canónico mediante una operación atómica del sistema de archivos;
- solo después de una escritura persistente exitosa se instala el nuevo mapping efectivo;
- si la persistencia falla, el mapping efectivo anterior se conserva y la operación se informa como fallo; no puede quedar un cambio "persistente" aplicado solo en memoria;
- el cambio sobrevive reinicios posteriores del bridge.

Esta escritura de `devices.json` NO contradice la regla previa de "no modificar automáticamente archivos base": solo ocurre después de que el operador elige expresamente `PERSISTENTE` y confirma el remapeo. La operación cotidiana del bridge nunca reescribe el archivo por sí sola.

### 8. Backend como coordinador y bridge como autoridad física

El backend decide si el comando de remapeo puede ejecutarse según estado global y padrón activo.

El bridge decide únicamente cuestiones físicas y técnicas:

- qué fingerprints están efectivamente mapeados;
- si el candidato es físicamente elegible;
- instalar el mapping efectivo;
- persistir `devices.json` cuando el modo confirmado sea `PERSISTENTE`.

El bridge no carga `concejales.csv` ni modifica identidad, presencia, votos o cola de palabra.

### 9. Contrato REST de Moderación/backend

WP-020 debe implementar al menos estas capacidades REST canónicas:

```text
POST   /api/v1/remapeos
POST   /api/v1/remapeos/{remapeo_id}/confirmacion
DELETE /api/v1/remapeos/{remapeo_id}
```

Inicio:

```json
{
  "dispositivo": "dev05"
}
```

Confirmación:

```json
{
  "persistencia": "TEMPORAL"
}
```

o:

```json
{
  "persistencia": "PERSISTENTE"
}
```

La captura del candidato llega desde el bridge por un endpoint backend interno vinculado al `remapeo_id`; no es una operación que deba emitir directamente el navegador.

El estado de Moderación debe exponer la operación activa y su candidato mediante la proyección existente, de modo que REST snapshot + SSE continúen siendo la sincronización frontend canónica.

### 10. API de control local del bridge

El bridge debe ofrecer una superficie HTTP local mínima e idempotente para:

- iniciar captura para un `remapeo_id` y `devXX`;
- consultar estado por `remapeo_id` cuando sea necesario para resolver una respuesta perdida;
- confirmar/aplicar un candidato con fingerprint esperado y modo `TEMPORAL|PERSISTENTE`;
- cancelar la operación.

Los nombres internos exactos de paths pueden concretarse en WP-020, pero deben quedar versionados, estables y restringidos a loopback por defecto.

Una repetición del mismo comando con el mismo `remapeo_id` y contenido debe producir el mismo resultado observable o informar que ya fue aplicado/cancelado, sin crear un segundo remapeo. El mismo ID con parámetros incompatibles debe rechazarse.

La idempotencia de estos comandos de control no modifica la regla de WP-019: las pulsaciones físicas normales continúan sin retry automático.

### 11. Auditoría y autorización previa

Un remapeo confirmado es una acción institucional relevante y debe quedar registrado por el backend.

Antes de instruir al bridge para cambiar el mapping, el backend debe persistir mediante la auditoría canónica un evento L3 que represente inequívocamente la autorización humana del remapeo e incluya al menos:

- `remapeo_id`;
- `devXX` objetivo;
- fingerprint efectivo anterior conocido;
- fingerprint candidato;
- modo `TEMPORAL|PERSISTENTE`.

El evento debe describir una autorización/confirmación, no afirmar falsamente que el bridge ya aplicó el cambio.

Si la auditoría obligatoria no puede persistirse, prevalece `AUDITORIA_NO_DISPONIBLE` y el backend no autoriza al bridge a aplicar el remapeo.

Si la autorización quedó auditada pero la comunicación con el bridge resulta incierta, el backend usa la identidad idempotente de la operación y el estado del bridge para reconciliar el resultado; no crea una segunda operación ni duplica el cambio.

### 12. Sin impacto sobre hechos institucionales existentes

Confirmar un remapeo, temporal o persistente:

- no cambia el concejal asociado al `devXX`;
- no cambia presencia;
- no modifica votos ya emitidos;
- no cambia pedidos ni uso de palabra;
- no recalcula quórum;
- no cierra ni reabre votaciones;
- no reinicia la sesión;
- no reescribe el padrón.

Después de la aplicación, las nuevas pulsaciones del nuevo fingerprint llegan al backend con el mismo `devXX` y siguen las reglas de negocio normales.

### 13. Sin nuevas dependencias directas

WP-020 no requiere nuevas dependencias directas.

- bridge control HTTP: biblioteca estándar;
- backend->bridge HTTP: biblioteca estándar;
- UUID, persistencia atómica, sincronización y threading necesarios: biblioteca estándar.

Cualquier dependencia directa adicional requiere nueva aprobación conforme DT-038.

### 14. UI fuera de WP-020

WP-020 implementa contratos, estado backend, coordinación y comportamiento del bridge.

La interfaz visual de Moderación que permita elegir dispositivo, mostrar candidato y presentar las opciones `TEMPORAL`/`PERSISTENTE` pertenece al WP de Moderación correspondiente. Ese frontend deberá consumir exclusivamente el backend/API client definidos aquí.

## Consecuencias

- un teclado averiado puede sustituirse sin detener una votación ni bloquear los demás dispositivos;
- pulsar un teclado ya mapeado durante la captura conserva su significado normal y no puede remapearlo accidentalmente;
- un cambio temporal permite resolver fallas transitorias como batería/pilas sin alterar la configuración base;
- un cambio persistente permite reemplazar definitivamente un dispositivo destruido o inutilizable sin exigir edición manual posterior de `devices.json`;
- la decisión de persistencia siempre es humana y explícita;
- el padrón y toda la historia institucional permanecen asociados al mismo `devXX`;
- los comandos de control pueden reconciliar respuestas perdidas mediante `remapeo_id` sin relajar la política de cero retry de pulsaciones físicas.

## Relación con decisiones previas

Esta DEC concreta y complementa:

- DT-004: estado/mutaciones bajo autoridad del backend;
- DT-006: REST + SSE como sincronización frontend/backend;
- DT-007: `/api/v1` y OpenAPI;
- DT-010: `devices.json` como configuración física del bridge;
- DT-012: fallo cerrado ante auditoría no disponible;
- DT-014: remapeo físico manteniendo estable `devXX`;
- DT-018: cliente TypeScript derivado del contrato OpenAPI;
- DT-025/DT-026: CI y calidad;
- DT-038: aprobación humana de contratos/dependencias reservadas;
- DEC-013: proyección Moderación + SSE;
- DEC-014: `api-client` derivado de OpenAPI;
- DEC-015: bridge Linux, fingerprint, `devices.json` y pulsaciones sin retries.

No modifica la semántica de `POST /api/v1/entradas/tecla` ni el contrato de voto/presencia/palabra.

## Pruebas exigidas por la decisión

WP-020 deberá probar de forma determinista al menos:

- inicio rechazado en `SIN_PREPARAR`;
- inicio permitido en `PREPARANDO` y `SESION_ABIERTA`;
- un único remapeo activo;
- `devXX` objetivo perteneciente al padrón activo;
- tráfico normal de fingerprints mapeados mientras existe captura;
- un fingerprint mapeado nunca se convierte en candidato;
- captura del primer fingerprint elegible no mapeado;
- fingerprint base del mismo objetivo elegible durante un override temporal;
- fingerprint base perteneciente a otro `devXX` no elegible;
- cancelación sin cambio de mapping;
- confirmación `TEMPORAL` sin tocar `devices.json`;
- pérdida del override temporal al reiniciar/recrear el bridge;
- confirmación `PERSISTENTE` con reemplazo atómico de `devices.json`;
- fallo de persistencia que deja mapping efectivo y archivo anterior intactos;
- reinicio después de persistencia conserva el nuevo mapping;
- auditoría obligatoria anterior a la aplicación;
- auditoría caída impide aplicar;
- idempotencia por `remapeo_id`;
- respuesta de control perdida/reconciliación sin aplicar dos veces;
- presencia, votos, palabra e identidad inalterados durante remapeo;
- OpenAPI, tipos TypeScript y proyección/SSE sincronizados;
- CI sin hardware físico real ni conectividad externa.
