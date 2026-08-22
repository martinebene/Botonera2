# DEC-012 - Desempate presidencial, contrato REST y fallo cerrado

**Estado:** `APROBADA`

## Contexto

DEC-010 separó el estado de recepción de una votación de su resultado institucional y definió `EMPATADA` como un resultado transitorio exclusivo de mayoría `SIMPLE`. WP-011 implementó el cálculo ordinario y deja la misma instancia `Votacion` en `CERRADA + EMPATADA`, conservándola como `votacion_activa` para bloquear una nueva apertura. WP-013 implementó las finalizaciones `INCONCLUSA`, incluido el cierre de sesión de una votación empatada, sin resolver todavía el desempate presidencial.

Las reglas funcionales ya aprobadas establecen que:

- solo una votación `SIMPLE` y `EMPATADA` puede requerir desempate;
- Presidencia actúa como rol institucional independiente del rol Concejal;
- el desempate se emite desde Moderación, no desde dispositivo físico;
- solo admite `POSITIVO` o `NEGATIVO`;
- es irreversible;
- no incrementa ni altera el conjunto de votos ordinarios;
- una pérdida de quórum posterior al empate no invalida ni impide el desempate;
- la auditoría debe identificar a la Presidencia vigente, el sentido del desempate y el resultado final;
- la misma instancia `Votacion` debe evolucionar desde `EMPATADA` hacia `APROBADA` o `RECHAZADA`.

Faltaba cerrar de forma explícita el contrato HTTP, la protección frente a comandos obsoletos y la frontera de auditoría/fallo cerrado entre el voto presidencial y la consolidación del resultado final.

## Decisión

### 1. Endpoint REST único

El comando canónico será:

```text
POST /api/v1/votaciones/{id}/desempate
```

Body:

```json
{
  "sentido": "POSITIVO"
}
```

O:

```json
{
  "sentido": "NEGATIVO"
}
```

Respuesta exitosa:

```text
204 No Content
```

No se agregará un endpoint alternativo basado solamente en `votacion_activa` ni otro alias semántico equivalente.

### 2. Validación de transporte

El body debe:

- prohibir campos extra;
- exigir el campo `sentido`;
- aceptar únicamente los valores exactos `POSITIVO` o `NEGATIVO`;
- rechazar `ABSTENCION`, `null`, booleanos, números, listas, objetos y strings arbitrarios;
- responder `422 Unprocessable Entity` ante errores de transporte/esquema.

El contrato HTTP no recibe DNI, banca, nombre de concejal ni identidad de Presidencia desde el cliente.

### 3. Presidencia autoritativa

La identidad institucional que se registra como autora del desempate es la **Presidencia vigente en la sesión al momento en que el comando adquiere el `EjecutorMutaciones` y es validado**.

El cliente no puede enviar ni sustituir esa identidad.

Si la Presidencia cambió desde que la UI mostró el empate hasta que el comando fue procesado, la operación usa el valor vigente en backend.

La condición de que la persona que preside también sea Concejal, haya votado ordinariamente, esté presente o ausente como Concejal no altera la facultad presidencial de desempate. Ambos roles son independientes.

### 4. Protección contra comandos obsoletos

El `{id}` del path debe coincidir exactamente con `EstadoOperativo.votacion_activa.id` dentro de la misma sección crítica del `EjecutorMutaciones`.

La validación no puede realizarse solamente antes de adquirir el serializador.

Como mínimo, dentro del lock debe verificarse:

1. `estado_global = SESION_ABIERTA`;
2. existe `votacion_activa`;
3. `{id}` coincide exactamente con la votación activa;
4. la votación está `CERRADA`;
5. `resultado = EMPATADA`;
6. `tipo_mayoria = SIMPLE`;
7. no existe ya un voto presidencial de desempate almacenado.

Un comando atrasado para una votación A no puede aplicarse a otra votación B que haya pasado a ser activa.

### 5. Voto presidencial como dato evolutivo separado

`Votacion` debe representar conceptualmente un `VotoDesempate` distinto del voto ordinario.

El voto presidencial:

- comienza ausente (`None`);
- solo puede fijarse una vez;
- contiene como mínimo el sentido `POSITIVO | NEGATIVO`;
- debe conservar la identidad textual de la Presidencia vigente que lo emitió, o información equivalente suficiente para reconstruirla sin consultar estado mutable posterior;
- es irreversible;
- no se agrega a `votos_ordinarios`;
- no se vincula a DNI ni banca;
- no altera positivos/negativos/abstenciones ordinarios.

El resultado final se deriva exclusivamente del sentido presidencial:

```text
POSITIVO -> APROBADA
NEGATIVO -> RECHAZADA
```

No se vuelve a ejecutar el cálculo ordinario de mayoría SIMPLE.

### 6. Dos hechos institucionales diferenciados

La secuencia `EMPATADA -> desempate -> resultado final` debe preservar dos hechos L3 diferenciados.

Primer hecho:

```text
VOTO_DESEMPATE_PRESIDENCIAL
```

Debe registrar como mínimo:

- número de votación;
- id técnico;
- Presidencia vigente;
- sentido `POSITIVO | NEGATIVO`;
- resultado previo `EMPATADA`;
- cantidad de votos ordinarios preservados.

Segundo hecho:

```text
VOTACION_RESULTADO_DESEMPATE
```

Debe registrar como mínimo:

- número de votación;
- id técnico;
- Presidencia que emitió el desempate;
- sentido presidencial;
- resultado previo `EMPATADA`;
- resultado final `APROBADA | RECHAZADA`;
- conteos ordinarios preservados o información suficiente para demostrar que no fueron alterados.

El segundo evento no reemplaza ni resume retrospectivamente el primero.

### 7. Orden obligatorio de auditoría y mutación

Dentro de una sola adquisición del `EjecutorMutaciones`, la operación exitosa sigue este orden:

```text
VALIDAR
-> CONSTRUIR HECHO DE VOTO PRESIDENCIAL
-> AUDITAR L3 VOTO_DESEMPATE_PRESIDENCIAL
-> ALMACENAR VOTO PRESIDENCIAL IRREVERSIBLE
-> CONSTRUIR HECHO DE RESULTADO FINAL
-> AUDITAR L3 VOTACION_RESULTADO_DESEMPATE
-> CAMBIAR resultado EMPATADA -> APROBADA|RECHAZADA
-> LIBERAR votacion_activa
```

No se readquiere el lock entre ambos hechos.

La fecha/hora de cierre original de la recepción se conserva sin cambios.

### 8. Fallo cerrado antes del voto presidencial

Si falla la persistencia de `VOTO_DESEMPATE_PRESIDENCIAL`:

- la votación permanece `CERRADA + EMPATADA`;
- no se almacena voto presidencial;
- no se cambia el resultado;
- `votacion_activa` sigue apuntando a la misma instancia;
- la fecha de cierre se conserva;
- los votos ordinarios permanecen intactos;
- el writer queda en fallo cerrado;
- la operación externa responde `503 AUDITORIA_NO_DISPONIBLE`.

No existe mutación funcional previa al primer hecho durable.

### 9. Fallo cerrado entre el voto presidencial y el resultado final

Si `VOTO_DESEMPATE_PRESIDENCIAL` ya fue persistido y el voto presidencial ya fue almacenado, pero falla la persistencia de `VOTACION_RESULTADO_DESEMPATE`:

- **no se revierte** el voto presidencial;
- la votación permanece `CERRADA`;
- `resultado` permanece `EMPATADA` porque no existe un hecho durable que permita publicar el resultado final;
- el `VotoDesempate` queda almacenado e irreversible;
- `votacion_activa` continúa apuntando a la misma instancia;
- la fecha de cierre y los votos ordinarios permanecen intactos;
- el writer queda en fallo cerrado;
- la operación externa responde `503 AUDITORIA_NO_DISPONIBLE`.

Este estado representa el último hecho institucional durable y es un **estado técnico de fallo cerrado**, no una situación reglamentaria normal que permita volver a emitir otro desempate.

WP-014 no implementará recovery, repetición ni reparación de este estado. Tras un fallo cerrado, las reglas generales vigentes requieren recuperación operativa/reinicio, no una segunda decisión presidencial.

### 10. Fallo después del resultado auditado

Una vez persistido `VOTACION_RESULTADO_DESEMPATE`, la aplicación en memoria debe ser una transición interna determinista previamente validada.

El diseño debe evitar una segunda validación divergente que pueda fallar entre el evento durable y la mutación esperada.

Si aparece un fallo inesperado de programación en esa frontera, no se inventará rollback del CSV. Debe propagarse como error técnico y tratarse como condición grave; la implementación debe estructurarse para que ese caso sea inalcanzable bajo invariantes válidas y cubrir la coherencia mediante pruebas.

### 11. Liberación de la referencia activa

Solo después de persistir el resultado final y aplicarlo sobre la misma `Votacion`:

```text
resultado = APROBADA | RECHAZADA
```

se libera:

```text
EstadoOperativo.votacion_activa = None
```

La misma entidad permanece en `Sesion.votaciones` con:

- votos ordinarios originales;
- voto presidencial registrado;
- fecha/hora de cierre original;
- resultado final.

### 12. Pérdida de quórum posterior al empate

No se exige quórum para desempatar una votación que ya está `EMPATADA`.

Una pérdida de quórum posterior al cierre ordinario:

- no cambia `EMPATADA`;
- no elimina la referencia activa;
- no impide el comando presidencial;
- no cambia la Presidencia vigente;
- no altera votos ni fecha de cierre.

El desempate solo exige que la sesión continúe abierta y que la misma votación siga siendo la activa `CERRADA + EMPATADA` sin voto presidencial previo.

### 13. Cierre de sesión en carrera con desempate

El cierre de sesión y el desempate comparten el mismo `EjecutorMutaciones`.

No existe prioridad artificial entre ambos comandos.

- si el desempate adquiere primero el lock, completa sus dos hechos, consolida `APROBADA/RECHAZADA`, libera la votación activa y el cierre posterior cierra normalmente la sesión;
- si el cierre de sesión adquiere primero el lock, WP-013 transforma la `EMPATADA` en `INCONCLUSA`, libera la referencia y cierra la sesión; el comando de desempate posterior observa el nuevo estado y no puede modificar esa votación.

La primera adquisición que complete su transición institucional determina el estado observado por la segunda.

### 14. Rechazos funcionales

Los rechazos del comando que alcancen un contexto auditable deben registrar un evento L2 estable antes de devolver el conflicto.

Como mínimo deben distinguirse causas equivalentes a:

```text
ESTADO_INCOMPATIBLE
VOTACION_NO_COINCIDE
VOTACION_NO_EMPATADA
DESEMPATE_YA_EMITIDO
```

La implementación puede reutilizar errores existentes cuando expresen exactamente la condición, pero no debe degradar todos los rechazos a mensajes ad hoc.

Los conflictos funcionales responden `409 Conflict`.

Si la auditoría del rechazo falla, prevalece `503 AUDITORIA_NO_DISPONIBLE`.

### 15. Contrato de errores

El endpoint debe documentar como mínimo:

- `204 No Content`: desempate completado;
- `409 Conflict`: precondición funcional incumplida;
- `422 Unprocessable Entity`: body/path inválido;
- `503 Service Unavailable`: auditoría no disponible;
- `500 Internal Server Error`: fallo inesperado no clasificado.

La forma estable de error continúa siendo:

```json
{
  "codigo": "CODIGO_ESTABLE",
  "mensaje": "Mensaje legible por personas."
}
```

### 16. Concurrencia

Toda la operación, incluidos los dos hechos de auditoría, se ejecuta bajo el único `EjecutorMutaciones` compartido.

Deben probarse explícitamente carreras significativas, al menos:

- desempate vs cierre de sesión, ambos órdenes;
- desempate vs cambio de Presidencia, ambos órdenes;
- dos comandos de desempate concurrentes;
- comando obsoleto por id frente a otra votación activa;
- pérdida de quórum posterior al empate frente al desempate.

Las pruebas deben ordenar adquisiciones reales del serializador, no depender del scheduling casual de `asyncio.gather`.

## Consecuencias

- queda cerrado el contrato HTTP de WP-014;
- el id en el path protege contra intenciones obsoletas;
- la Presidencia efectiva proviene siempre del backend y del instante serializado de ejecución;
- el voto presidencial es una entidad/dato de dominio separado de los votos ordinarios;
- la trazabilidad conserva dos hechos institucionales: voto presidencial y resultado final;
- un fallo entre ambos hechos conserva el voto presidencial durable pero no publica un resultado final no auditado;
- no se implementa recovery ni repetición de un desempate parcialmente durabilizado;
- la votación se libera únicamente cuando el resultado final fue auditado y aplicado;
- no se requiere quórum posterior al empate;
- cierre de sesión y desempate se resuelven por orden real del único serializador.

## Autoridad

Esta decisión fue aprobada explícitamente por el responsable humano del proyecto al planificar WP-014. Complementa DEC-010 y las reglas `RN-DES`, `CU-18`, `CA-038`, `CA-039`, `CA-040` y `CA-041`, y prevalece ante cualquier formulación anterior que no hubiera fijado endpoint, protección por id o fallo cerrado entre los dos hechos de auditoría.