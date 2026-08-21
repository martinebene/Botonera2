# DEC-008 - Sesión, autoridades y contrato REST de WP-008

## Estado

`APROBADA`

## Contexto

WP-008 debe completar el paso funcional desde `PREPARANDO` hacia `SESION_ABIERTA`, permitir mantener los datos institucionales necesarios y cerrar una sesión cuando no existe votación activa.

Las fuentes canónicas ya fijan que:

- abrir sesión exige quórum, número de sesión, Presidencia y Secretaría Legislativa;
- las presencias acreditadas durante `PREPARANDO` se conservan;
- Presidencia y Secretaría Legislativa son texto libre e independientes del padrón;
- ambas autoridades pueden cambiar durante `PREPARANDO` o `SESION_ABIERTA`;
- el número de sesión es un dato externo sin validación de secuencia ni unicidad;
- presencia por tecla `9` y test por tecla `8` deben continuar funcionando durante `SESION_ABIERTA`;
- el cierre normal vuelve a `SIN_PREPARAR`, registra el evento final y cierra definitivamente los CSV;
- el tratamiento del cierre con votación `EN_CURSO` o `EMPATADA` pertenece a WPs posteriores.

El operador resolvió explícitamente las decisiones de planificación de WP-008 el 2026-08-21.

## Decisiones

### 1. Número de sesión

El número de sesión es un entero estricto positivo, `>= 1`.

No se valida:

- secuencia;
- unicidad;
- repetición respecto de sesiones anteriores;
- continuidad con ningún número previo.

Por lo tanto, repetir un número o utilizar uno fuera de secuencia es válido. Valores `0`, negativos, booleanos, decimales o texto no cumplen el contrato de entrada.

El número puede cargarse y editarse mientras el sistema está `PREPARANDO`. Una vez abierta la sesión queda inmutable.

### 2. Autoridades

Presidencia y Secretaría Legislativa son texto libre y no se vinculan automáticamente con concejales.

Durante `PREPARANDO`:

- pueden estar todavía sin informar;
- pueden editarse libremente;
- una cadena vacía o compuesta solo por espacios se normaliza a ausencia de valor;
- los valores no vacíos se normalizan retirando espacios exteriores.

Durante `SESION_ABIERTA`:

- ambas deben permanecer siempre informadas;
- pueden reemplazarse por otro texto no vacío;
- no puede utilizarse una actualización para dejarlas vacías.

El número de sesión no puede modificarse durante `SESION_ABIERTA`.

### 3. Contrato REST centrado en recursos

No se utilizan rutas de acción del estilo `/abrir_sesion`, `/cerrar_sesion` ni subrecursos separados para cada dato institucional.

El contrato canónico de WP-008 es:

```text
PATCH  /api/v1/preparacion
POST   /api/v1/sesion
PATCH  /api/v1/sesion
DELETE /api/v1/sesion
```

#### `PATCH /api/v1/preparacion`

Solo válido en `PREPARANDO`.

Body parcial:

```json
{
  "numero_sesion": 59,
  "presidencia": "Nombre de Presidencia",
  "secretaria_legislativa": "Nombre de Secretaría"
}
```

Los tres campos son opcionales individualmente, pero el body debe incluir al menos uno.

Semántica:

- `numero_sesion`, si se suministra, debe cumplir el entero positivo definido en esta decisión;
- `presidencia` y `secretaria_legislativa`, si se suministran, pueden ser texto no vacío o texto vacío/blanco para limpiar el valor durante `PREPARANDO`;
- una actualización puede cambiar uno, dos o los tres campos en una sola operación;
- solo se consideran cambios los valores efectivos distintos del estado previo;
- una actualización válida que no cambia ningún valor es un no-op exitoso y no genera eventos ficticios de cambio.

Respuesta exitosa: `204 No Content`.

#### `POST /api/v1/sesion`

Abre la sesión utilizando exclusivamente los datos ya almacenados en la preparación activa.

No recibe body.

Precondiciones de dominio:

- estado global `PREPARANDO`;
- quórum alcanzado;
- número de sesión informado;
- Presidencia informada;
- Secretaría Legislativa informada.

Si todas se cumplen:

- conserva configuración y padrón congelados;
- conserva todas las presencias;
- conserva los tests visuales todavía vigentes y sus expiraciones originales;
- conserva el mismo conjunto de auditoría ya abierto;
- registra la apertura antes de confirmar la mutación;
- pasa a `SESION_ABIERTA`.

Respuesta exitosa: `204 No Content`.

#### `PATCH /api/v1/sesion`

Solo válido en `SESION_ABIERTA`.

Body parcial:

```json
{
  "presidencia": "Nueva Presidencia",
  "secretaria_legislativa": "Nueva Secretaría"
}
```

Ambos campos son opcionales individualmente, pero debe incluirse al menos uno.

Cada valor suministrado debe ser no vacío después de retirar espacios exteriores.

No existe `numero_sesion` en este contrato.

Una actualización válida sin cambio efectivo es un no-op exitoso y no genera un evento ficticio.

Respuesta exitosa: `204 No Content`.

#### `DELETE /api/v1/sesion`

Solo válido en `SESION_ABIERTA`.

No recibe body.

WP-008 solo implementa el cierre cuando no existe una votación activa o empatada pendiente. Si el estado contiene una votación que requiera tratamiento, el backend debe rechazar el cierre en este WP sin intentar finalizarla; la integración con los estados de votación pertenece al WP funcional posterior correspondiente.

En un cierre normal:

1. persistir el evento institucional de cierre;
2. cerrar definitivamente el escritor L1/L2/L3;
3. solo después descartar el contexto operativo en memoria;
4. volver a `SIN_PREPARAR`.

Respuesta exitosa: `204 No Content`.

### 4. Errores y validación HTTP

Los errores conservan la forma estable existente:

```json
{
  "codigo": "CODIGO_ESTABLE",
  "mensaje": "Mensaje legible por personas."
}
```

Reglas mínimas:

- body técnicamente inválido: `422 Unprocessable Entity`;
- operación no válida para el estado global actual: `409 Conflict` + `ESTADO_INCOMPATIBLE`;
- apertura sin quórum: `409 Conflict` + `QUORUM_INSUFICIENTE`;
- apertura sin número de sesión: `409 Conflict` + `NUMERO_SESION_REQUERIDO`;
- apertura sin Presidencia: `409 Conflict` + `PRESIDENCIA_REQUERIDA`;
- apertura sin Secretaría Legislativa: `409 Conflict` + `SECRETARIA_LEGISLATIVA_REQUERIDA`;
- cierre de WP-008 cuando existe votación pendiente que este WP no debe resolver: `409 Conflict` + `VOTACION_PENDIENTE`;
- auditoría obligatoria no disponible: `503 Service Unavailable` + `AUDITORIA_NO_DISPONIBLE`;
- fallo inesperado no clasificado: `500 Internal Server Error` + `ERROR_INTERNO`.

Si varias precondiciones de apertura faltan simultáneamente, el backend puede evaluar en orden determinista: estado global, quórum, número, Presidencia, Secretaría. No se exige devolver múltiples errores a la vez.

### 5. Auditoría de datos institucionales y ciclo de sesión

Todo cambio efectivo aceptado se persiste antes de mutar el estado.

Eventos L3 mínimos y estables:

- `SESION | NUMERO_SESION_ACTUALIZADO`;
- `SESION | PRESIDENCIA_ACTUALIZADA`;
- `SESION | SECRETARIA_LEGISLATIVA_ACTUALIZADA`;
- `SESION | SESION_ABIERTA`;
- `SESION | SESION_CERRADA`.

Para los tres eventos de actualización, el mensaje humano debe expresar con claridad el valor anterior y el valor nuevo. Cuando el valor anterior no estaba informado se representa legiblemente como `sin informar`.

Si un único `PATCH /api/v1/preparacion` cambia varios campos, se registra un evento independiente por cada cambio efectivo, en un orden determinista: número de sesión, Presidencia, Secretaría Legislativa.

Los eventos de apertura y cierre deben incluir el número de sesión en el mensaje humano.

Los rechazos funcionales relevantes de comandos de sesión que ocurran mientras existe auditoría activa deben registrarse a nivel L2 antes de devolver la respuesta de rechazo, siempre que la propia auditoría esté disponible. Se utiliza `SESION | COMANDO_SESION_RECHAZADO` con un mensaje que identifique la operación y el código estable del motivo.

Un body rechazado por FastAPI/Pydantic antes de entrar al dominio no requiere evento institucional porque la mutación nunca llegó al servicio.

### 6. Fallo cerrado

Las operaciones de actualización, apertura y cierre se ejecutan mediante el `EjecutorMutaciones` único.

Si un evento obligatorio no puede persistirse:

- la mutación funcional posterior no se confirma;
- no se crea otro escritor;
- no se reabre ni reemplaza el conjunto vigente;
- no se borra evidencia parcial;
- se propaga `AUDITORIA_NO_DISPONIBLE` conforme al mecanismo ya integrado.

En el cierre, si el evento final se persistió pero el cierre físico del escritor falla, el sistema no confirma el cierre ni limpia el estado en memoria; queda en fallo cerrado y requiere recuperación operativa mediante reinicio, siguiendo las reglas ya existentes.

### 7. Transición de `Preparacion` a `Sesion`

La implementación interna debe preservar una sola fuente de verdad de cada dato operativo.

Al abrir:

- no se recarga configuración ni padrón desde disco;
- no se recrea el escritor CSV;
- no se reinician presencias;
- no se reinician tests visuales;
- no se duplica el estado dinámico en dos estructuras activas independientes.

El diseño concreto de clases/helpers puede variar, pero después de la transición el sistema debe tener un único contexto operativo autoritativo para `SESION_ABIERTA` y `EstadoOperativo.sesion_activa` debe dejar de ser un placeholder sin uso.

### 8. Entradas lógicas durante `SESION_ABIERTA`

WP-008 extiende la base de WP-006 para que las teclas `8` y `9` continúen funcionando durante una sesión abierta.

Se conserva exactamente la semántica ya integrada para:

- resolución `dispositivo lógico -> concejal`;
- respuesta base de `/api/v1/entradas/tecla`;
- auditoría de pulsación/test/presencia;
- test temporal;
- presencia dinámica;
- cálculo de presentes y quórum;
- fallo cerrado;
- serialización.

Durante `SESION_ABIERTA`, las teclas de WPs todavía no implementados (`1`, `2`, `3`, `7`) siguen rechazándose con el motivo estable de tecla no habilitada hasta que el WP propietario extienda su semántica.

Perder quórum sin votación no cierra la sesión. Recuperarlo tampoco requiere una acción adicional. WP-008 debe permitir observar correctamente esa evolución mediante las mismas primitivas derivadas de presencia/quórum, sin implementar todavía apertura de votaciones.

### 9. Tests visuales vigentes al abrir

Los tests de dispositivo activos al momento de abrir la sesión conservan su expiración monotónica original.

Abrir la sesión no reinicia, extiende, acorta ni limpia esa ventana visual.

### 10. Fuera de alcance de esta decisión

No se define aquí:

- apertura ni finalización de votaciones;
- voto ordinario;
- empate ni desempate;
- cierre de sesión que deba finalizar `EN_CURSO` o convertir `EMPATADA`;
- uso de palabra;
- snapshots `ModerationState`/`PublicState`;
- frontend de Moderación;
- Orden del Día;
- remapeo físico.

## Consecuencias

- WP-008 puede implementarse sin decidir nombres/semántica de endpoints durante la delegación.
- La edición preparatoria queda concentrada en el recurso `/preparacion` y la edición de autoridades de una sesión abierta en `/sesion`.
- El número queda inmutable una vez abierta la sesión.
- El ciclo conserva estado operativo y auditoría sin reinicios artificiales al abrir.
- El backend queda preparado para que WPs posteriores amplíen votaciones y palabra sin reescribir el ciclo base de sesión.
