# DEC-011 - Finalización inconclusa y cierre de sesión con votación pendiente

## Estado

`APROBADA`

## Contexto

WP-011 dejó integrado el resultado ordinario de una votación cerrada normalmente: `APROBADA` y `RECHAZADA` son finales y liberan la referencia activa; `EMPATADA` es transitorio y mantiene la misma instancia como pendiente.

Las reglas de negocio ya establecen tres situaciones posteriores que pueden producir `INCONCLUSA`:

- finalización manual anticipada solicitada por Moderación;
- pérdida de quórum mientras la votación está `EN_CURSO`;
- cierre explícito de sesión cuando existe una votación `EN_CURSO` o `EMPATADA` pendiente.

También estaba cerrado que:

- una finalización manual exige motivo obligatorio;
- recuperar quórum no reabre una votación ya `INCONCLUSA`;
- los votos ordinarios emitidos se conservan;
- perder quórum después de que la votación ya quedó `EMPATADA` no altera el empate;
- cerrar sesión con `EMPATADA` sí debe convertir esa misma votación a `INCONCLUSA` antes de cerrar la sesión;
- todo debe ejecutarse bajo el único `EjecutorMutaciones` y respetar auditoría persistida antes de la mutación funcional asociada.

Faltaba cerrar el contrato REST de finalización manual y precisar el orden institucional/fallo cerrado de estos flujos.

La alternativa elegida explícitamente por el responsable humano es identificar la votación en el path, en lugar de usar una ruta implícita de “votación activa”. Así un comando atrasado de una UI no puede finalizar accidentalmente una votación distinta que haya ocupado la referencia activa después.

## Decisiones

### 1. Contrato REST de finalización manual

La finalización manual se expone como:

```text
POST /api/v1/votaciones/{id}/finalizacion
```

Body:

```json
{
  "motivo": "Texto obligatorio"
}
```

Respuesta exitosa:

```text
204 No Content
```

El body:

- exige exactamente `motivo`;
- `motivo` debe ser un string estricto;
- se normaliza con `strip`;
- después de normalizar no puede quedar vacío;
- campos adicionales no forman parte del contrato.

Un body técnicamente inválido se rechaza como `422 Unprocessable Entity` antes de ejecutar la mutación de dominio.

### 2. Protección mediante `{id}`

El `{id}` debe coincidir exactamente con el identificador técnico de la misma instancia publicada como `EstadoOperativo.votacion_activa`.

La finalización manual solo es válida si además:

```text
estado_global = SESION_ABIERTA
votacion_activa != None
votacion_activa.id = {id}
votacion_activa.estado = EN_CURSO
votacion_activa.resultado = None
```

Si existe una votación activa distinta de la identificada por el path, el comando se rechaza sin afectar a ninguna votación.

Se utilizarán errores funcionales estables que distingan al menos:

- `ESTADO_INCOMPATIBLE`: no existe una sesión abierta compatible;
- `VOTACION_NO_COINCIDE`: existe una referencia activa, pero su id no coincide con el solicitado;
- `VOTACION_NO_EN_CURSO`: no existe una votación finalizable en `EN_CURSO + resultado=None`.

Los rechazos que alcanzan el servicio y disponen de auditoría activa se registran a nivel L2 antes de devolver el error, siguiendo el patrón ya integrado para comandos de sesión/votación.

### 3. Efecto de la finalización manual

Una finalización manual válida no intenta calcular mayoría ordinaria.

Produce sobre la misma instancia:

```text
EN_CURSO + resultado=None
    -> CERRADA + resultado=INCONCLUSA
```

Además:

- fija una única `fecha_hora_cierre`;
- conserva todos los votos ordinarios ya emitidos;
- conserva datos constitutivos;
- registra el motivo manual normalizado;
- libera `EstadoOperativo.votacion_activa` después de auditar y aplicar la finalización;
- mantiene la misma entidad en `Sesion.votaciones`.

`INCONCLUSA` es final e irreversible. No se recalcula aunque después cambie la presencia o se recupere quórum.

### 4. Motivo manual como dato de dominio

`Votacion` debe conservar conceptualmente el motivo de finalización manual cuando la causa sea manual.

Ese campo:

- empieza ausente;
- solo puede fijarse una vez;
- no existe para cierres normales;
- no debe inventarse para pérdida de quórum ni cierre de sesión;
- queda inmutable después de la finalización.

La auditoría sigue siendo la fuente histórica persistente, pero la instancia activa/histórica debe poder expresar el motivo manual mientras la sesión viva en memoria.

### 5. Pérdida de quórum durante `EN_CURSO`

Después de una tecla `9` aceptada durante `SESION_ABIERTA`, una vez persistido y aplicado el nuevo estado de presencia, si existe una votación:

```text
estado = EN_CURSO
resultado = None
```

y el nuevo estado derivado ya no alcanza quórum, esa misma operación debe finalizar inmediatamente la votación como:

```text
CERRADA + INCONCLUSA
```

con causa institucional `PERDIDA_QUORUM`.

Debe:

- conservar todos los votos ya emitidos;
- fijar `fecha_hora_cierre` una sola vez;
- no calcular SIMPLE ni ESPECIAL;
- no asignar motivo manual;
- liberar `votacion_activa` después de auditar/aplicar;
- conservar la entidad en el historial.

### 6. Prioridad pérdida de quórum sobre completitud

Ante un mismo cambio de presencia durante `EN_CURSO`, primero se evalúa el quórum resultante.

Si el cambio deja al cuerpo sin quórum:

```text
PERDIDA_QUORUM -> INCONCLUSA
```

prevalece aunque, al retirar a esa persona, todos los presentes restantes ya hubieran votado.

Solo si el quórum continúa alcanzado se evalúa después el autocierre normal por completitud y el cálculo ordinario integrado por WP-010/WP-011.

No puede existir un resultado ordinario `APROBADA`, `RECHAZADA` o `EMPATADA` derivado de una completitud que se produjo simultáneamente con pérdida de quórum.

### 7. Pérdida de quórum posterior a `EMPATADA`

Una votación ya `EMPATADA` permanece `CERRADA`.

Un cambio posterior de presencia que deje la sesión sin quórum:

- no cambia `EMPATADA`;
- no la transforma automáticamente en `INCONCLUSA`;
- no borra ni altera votos;
- no libera la referencia activa;
- no impide el futuro desempate presidencial.

La única transición a `INCONCLUSA` de una `EMPATADA` dentro de este alcance ocurre por el cierre explícito de sesión.

### 8. `DELETE /api/v1/sesion` conserva contrato sin body

El contrato de cierre de sesión permanece:

```text
DELETE /api/v1/sesion
```

sin body y con respuesta exitosa `204 No Content`.

No se exige al operador suministrar un motivo adicional para resolver una votación pendiente durante el cierre de sesión. La causa institucional es interna y estable:

```text
CIERRE_SESION
```

### 9. Cierre de sesión con votación `EN_CURSO`

Si `DELETE /api/v1/sesion` entra al serializador y encuentra la misma sesión abierta con una votación:

```text
EN_CURSO + resultado=None
```

la secuencia es:

1. auditar la finalización de esa votación como `INCONCLUSA` con causa `CIERRE_SESION`;
2. aplicar sobre la misma instancia `CERRADA + INCONCLUSA`, fijando su fecha/hora de cierre y conservando votos;
3. liberar `votacion_activa`;
4. persistir el evento institucional normal de cierre de sesión;
5. cerrar físicamente el writer conforme a DEC-008;
6. limpiar el contexto operativo y volver a `SIN_PREPARAR` solo después de completar correctamente el cierre físico.

Todo ocurre dentro de una única adquisición del `EjecutorMutaciones`.

No se exige ni se registra un “motivo manual” porque el operador ejecutó el comando de cierre de sesión y la causa ya es `CIERRE_SESION`.

### 10. Cierre de sesión con votación `EMPATADA`

Si `DELETE /api/v1/sesion` encuentra una votación:

```text
CERRADA + resultado=EMPATADA
```

se actúa sobre la misma instancia:

```text
CERRADA + EMPATADA
    -> CERRADA + INCONCLUSA
```

La `fecha_hora_cierre` original del cierre normal no se modifica.

Se conserva en auditoría el evento previo de empate. Luego se registra la finalización inconclusa por `CIERRE_SESION`, se aplica `INCONCLUSA`, se libera la referencia activa y recién entonces continúa el cierre de sesión.

No se agrega voto presidencial y no se ejecuta un desempate implícito.

### 11. Cierre de sesión sin votación pendiente

Cuando `votacion_activa` ya es `None`, `DELETE /api/v1/sesion` conserva exactamente el comportamiento integrado por DEC-008:

- persistir `SESION_CERRADA`;
- cerrar writer;
- limpiar el contexto;
- volver a `SIN_PREPARAR`.

No se crean eventos ficticios de finalización de votación.

### 12. Votación `CERRADA + resultado=None` por fallo técnico previo

`CERRADA + resultado=None` continúa siendo una votación pendiente válida únicamente como consecuencia técnica posible del fallo cerrado ya definido.

WP-013 no introduce un mecanismo de recuperación, reparación o finalización manual de ese estado.

Como el writer se encuentra en fallo cerrado cuando surge por el caso previsto, cualquier mutación posterior que requiera auditoría seguirá fallando técnicamente. Un reinicio vuelve a `SIN_PREPARAR` conforme a la política general.

### 13. Evento institucional de `INCONCLUSA`

Las tres causas de este WP deben persistirse antes de mutar la votación mediante un evento L3 estable de finalización inconclusa.

Se adopta conceptualmente:

```text
VOTACION_FINALIZADA_INCONCLUSA
```

El mensaje debe permitir reconstruir como mínimo:

- número e id de votación;
- causa: `MANUAL`, `PERDIDA_QUORUM` o `CIERRE_SESION`;
- estado/resultado previo relevante;
- cantidad de votos ordinarios conservados;
- resultado final `INCONCLUSA`.

Además:

- `MANUAL` incluye el motivo normalizado;
- `PERDIDA_QUORUM` incluye presentes efectivos y quórum requerido/configurado;
- `CIERRE_SESION` deja explícito que la votación se resolvió por cierre de la sesión;
- para una votación previamente `EMPATADA` debe quedar explícito ese resultado previo.

Este único hecho institucional satisface tanto la categoría de finalización como el resultado `INCONCLUSA`: no se exige una segunda mutación ni un segundo evento redundante para aplicar el mismo hecho.

### 14. Fallo cerrado: finalización manual

La secuencia es:

```text
VALIDAR
-> AUDITAR VOTACION_FINALIZADA_INCONCLUSA
-> MUTAR CERRADA + INCONCLUSA
-> LIBERAR votacion_activa
```

Si falla la auditoría del evento:

- la votación permanece `EN_CURSO + resultado=None`;
- no se fija fecha de cierre;
- no se fija motivo manual;
- no se libera la referencia activa;
- el writer queda en fallo cerrado;
- la API responde `503 AUDITORIA_NO_DISPONIBLE` conforme al mecanismo existente.

### 15. Fallo cerrado: pérdida de quórum derivada de presencia

La presencia aceptada es un hecho institucional anterior e independiente.

Si:

1. la pulsación/presencia fue auditada;
2. la presencia fue aplicada;
3. esa presencia causó pérdida de quórum;
4. falla la persistencia de `VOTACION_FINALIZADA_INCONCLUSA`;

entonces:

- NO se revierte la presencia ya auditada/aplicada;
- la votación permanece `EN_CURSO + resultado=None`;
- no se fija fecha de cierre;
- `votacion_activa` permanece;
- el writer queda en fallo cerrado;
- la operación externa no se informa como éxito técnico.

El estado refleja el último hecho institucional cuya persistencia quedó garantizada.

### 16. Fallo cerrado: cierre de sesión con votación pendiente

Si falla el evento de finalización inconclusa antes de mutar la votación:

- la votación permanece como estaba;
- no se registra ni aplica el cierre de sesión;
- no se limpia el contexto.

Si la finalización inconclusa ya fue auditada y aplicada, pero después falla `SESION_CERRADA`:

- NO se revierte `INCONCLUSA`;
- la votación permanece en el historial con su resultado final;
- `votacion_activa` permanece liberada;
- la sesión sigue en memoria porque su cierre no pudo institucionalizarse;
- el writer queda en fallo cerrado;
- no se informa éxito técnico.

Si `SESION_CERRADA` se persistió pero falla el cierre físico del writer, se conserva la semántica ya fijada por DEC-008: no se limpia el contexto ni se confirma el cierre funcional.

### 17. Concurrencia

Todos estos flujos reutilizan el único `EjecutorMutaciones`.

No se agregan locks, colas, workers ni tareas background.

El orden de adquisición resuelve las carreras:

- finalización manual vs. último voto;
- finalización manual vs. pérdida de quórum;
- cierre de sesión vs. voto/presencia;
- cierre de sesión vs. finalización manual.

La primera operación que adquiere el serializador completa su transición institucional antes de que la siguiente evalúe el estado actualizado.

Un comando con `{id}` obsoleto nunca se redirige silenciosamente a una votación diferente.

## Contrato de errores mínimo

Además de los errores ya existentes de la API, la finalización manual debe exponer de manera estable:

- `422 Unprocessable Entity`: body/path técnicamente inválido cuando corresponda a validación de transporte;
- `409 Conflict` + `ESTADO_INCOMPATIBLE`: estado global incompatible;
- `409 Conflict` + `VOTACION_NO_COINCIDE`: el id solicitado no corresponde a la votación activa;
- `409 Conflict` + `VOTACION_NO_EN_CURSO`: no existe una votación manualmente finalizable en `EN_CURSO + resultado=None`;
- `503 Service Unavailable` + `AUDITORIA_NO_DISPONIBLE`: no puede garantizarse el registro obligatorio;
- `500 Internal Server Error` + `ERROR_INTERNO`: fallo inesperado no clasificado.

`DELETE /api/v1/sesion` deja de responder `VOTACION_PENDIENTE` por el mero hecho de encontrar una votación `EN_CURSO` o `EMPATADA`: WP-013 es precisamente el propietario de resolver esos casos antes de continuar el cierre.

## Fuera de alcance

Esta decisión no implementa:

- desempate presidencial;
- finalización manual de una votación ya `EMPATADA`;
- recuperación de `CERRADA + resultado=None` tras fallo de auditoría;
- reapertura o recalculo de `INCONCLUSA`;
- frontend de Moderación ni su confirmación visual;
- uso de palabra;
- Orden del Día;
- SSE/snapshots;
- persistencia de estado operativo ni recovery.

## Consecuencias

- La ruta con `{id}` evita aplicar una intención obsoleta a otra votación.
- `INCONCLUSA` se consolida como resultado final sobre la misma instancia.
- La pérdida de quórum domina al autocierre normal cuando ambas condiciones aparecen por el mismo cambio de presencia.
- La finalización derivada no revierte hechos previos ya persistidos si un evento posterior falla.
- `DELETE /sesion` conserva su contrato sin body y gana la capacidad de resolver internamente una votación pendiente antes de cerrar.
- Una `EMPATADA` solo cambia automáticamente por cierre explícito de sesión; la mera pérdida posterior de quórum no la afecta.

## Autoridad

Esta decisión fue aprobada explícitamente por el responsable humano durante la planificación de WP-013 y prevalece sobre el comportamiento transitorio de WP-008 que rechazaba `DELETE /api/v1/sesion` con `VOTACION_PENDIENTE` cuando aún no existía el WP propietario de resolver la votación.