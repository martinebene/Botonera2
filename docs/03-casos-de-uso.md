# 03 - Casos de uso

Los casos de uso describen comportamiento observable. Los nombres de endpoints, componentes o clases se decidirán después.

## CU-01 Preparar recinto

**Actor:** Moderación.

**Precondición:** estado `SIN_PREPARAR`.

**Flujo:**
1. Cargar configuración y padrón.
2. Validar datos obligatorios y unicidad del padrón.
3. Congelar configuración/padrón para esta preparación.
4. Poner a todos los concejales ausentes.
5. Crear los tres CSV con fecha/hora de inicio.
6. Pasar a `PREPARANDO`.
7. Permitir cargar número de sesión, Presidencia y Secretaría.
8. Habilitar solo presencia y test desde dispositivos.

## CU-02 Cancelar preparación

**Actor:** Moderación.

Registra el evento de cancelación sin requerir motivo, cierra definitivamente los tres CSV y vuelve a `SIN_PREPARAR`.

## CU-03 Acreditar o retirar presencia

**Actor:** Concejal mediante dispositivo.

En `PREPARANDO` o `SESION_ABIERTA`, tecla `9` alterna su presencia.

Consecuencias:
- recalcular cantidad de presentes y quórum;
- si está en cola y pasa a ausente, retirarlo de la cola;
- si está usando la palabra y pasa a ausente, finalizar su uso sin otorgar automáticamente la palabra al siguiente de la cola;
- si hay votación `EN_CURSO`, evaluar primero pérdida de quórum y solo si todavía existe quórum evaluar autocierre por completitud.

## CU-04 Probar dispositivo

**Actor:** Concejal mediante dispositivo.

Tecla `8` activa una señal visual temporal de su banca. Funciona en preparación, sesión y votación y no cambia ningún estado de negocio.

## CU-05 Abrir sesión

**Actor:** Moderación.

**Precondiciones:**
- `PREPARANDO`;
- quórum alcanzado;
- número de sesión informado;
- Presidencia informada;
- Secretaría Legislativa informada.

Conserva las presencias ya acreditadas y pasa a `SESION_ABIERTA`.

## CU-06 Cambiar autoridades

**Actor:** Moderación.

Puede cambiar Presidencia o Secretaría en preparación o sesión, incluso durante votación. El cambio se registra y no altera las reglas de concejales ni votaciones.

## CU-07 Cerrar sesión

**Actor:** Moderación.

Si existe un orador actual o al menos un pedido de palabra en cola, la interfaz de Moderación debe advertir antes de enviar el comando que existen concejales con uso/pedido de palabra pendiente y pedir confirmación. Cancelar la advertencia no cierra la sesión. Confirmarla permite continuar; la advertencia no constituye una nueva precondición reglamentaria del backend.

Si hay votación `EN_CURSO`, se finaliza primero como `INCONCLUSA`, aun con cero votos o un conteo parcial aparentemente decisivo.

Si hay votación `EMPATADA`, la misma instancia pasa a `INCONCLUSA` y conserva su fecha de cierre y sus votos.

Luego se registra cierre, se cierran los CSV y se vuelve a `SIN_PREPARAR`.

## CU-08 Cargar Orden del Día

**Actor:** Moderación.

Carga opcional de CSV para precargar votaciones.

Solo se exige formato técnicamente interpretable. Un archivo inválido se rechaza sin bloquear el resto del sistema.

## CU-09 Seleccionar punto del Orden del Día

**Actor:** Moderación.

Copia los datos del punto a un formulario editable. El operador puede modificar cualquier campo antes de abrir la votación.

Los puntos pueden seleccionarse en cualquier orden.

## CU-10 Crear votación manual

**Actor:** Moderación.

Permite cargar una votación no incluida en el Orden del Día.

El sistema no valida secuencia ni unicidad de número de votación.

## CU-11 Abrir votación

**Actor:** Moderación.

**Precondiciones:**
- sesión abierta;
- quórum;
- ninguna votación activa o empatada pendiente;
- datos de votación completos y técnicamente válidos.

Si existe un orador actual o al menos un pedido de palabra en cola, la interfaz de Moderación debe advertir antes de enviar el comando que abrir la votación implica continuar mientras existe un concejal con uso/pedido de palabra pendiente y pedir confirmación. Cancelar no abre la votación. Confirmar permite continuar y **no altera** al orador ni la cola: el uso de la palabra puede coexistir con la votación.

La advertencia es una salvaguarda operativa de Moderación y no una nueva precondición reglamentaria del backend.

Al abrir, `tipo_mayoria` es explícito y los datos quedan normalizados e inmutables. `SIMPLE` usa `factor = 0` y `base = VOTOS_COMPUTABLES`; `ESPECIAL` exige factor real finito `> 0 <= 1` y base `VOTOS_COMPUTABLES`, `PRESENTES` o `CUERPO`.

## CU-12 Emitir voto ordinario

**Actor:** Concejal presente mediante su dispositivo.

- `1`: positivo.
- `2`: abstención.
- `3`: negativo.

Solo durante `EN_CURSO`. Un concejal que ya votó no puede volver a votar aunque se ausente y regrese.

Cada voto aceptado se persiste inmediatamente, queda vinculado al DNI del padrón congelado y no puede editarse ni eliminarse.

## CU-13 Autocerrar votación

Después de cada voto o cambio de presencia, si todos los concejales actualmente presentes ya votaron y se mantiene quórum, cerrar automáticamente la recepción.

El autocierre fija `estado = CERRADA`, conserva los votos y registra una única fecha/hora. Sin liberar el serializador, continúa con CU-16 o CU-17: calcula desde los votos de la misma instancia, audita el resultado y lo aplica. `APROBADA`/`RECHAZADA` liberan la referencia activa; `EMPATADA` la conserva.

Si el cierre pudo persistirse pero falla la auditoría del resultado, no se revierte: la votación queda `CERRADA + resultado=None`, con su fecha y referencia activa, y la operación externa informa fallo técnico.

## CU-14 Finalizar votación manualmente

**Actor:** Moderación.

Disponible en cualquier momento de `EN_CURSO`, incluso con cero votos. El identificador del comando debe coincidir exactamente con la referencia activa para impedir que una intención obsoleta afecte una votación posterior.

Exige motivo obligatorio.

Toda finalización manual válida produce `CERRADA + INCONCLUSA`, conserva votos y datos constitutivos, y almacena el motivo normalizado. No invoca el cálculo ordinario.

No existe estado `CANCELADA`.

## CU-15 Finalizar por pérdida de quórum

Si durante `EN_CURSO` la presencia cae por debajo del quórum, finalizar inmediatamente como `INCONCLUSA`, conservar todos los votos emitidos y registrar el evento. Esta decisión precede al autocierre por completitud; una votación ya `EMPATADA` no cambia por una pérdida posterior.

## CU-16 Calcular mayoría simple

Al cierre normal:

- positivos > negativos => `APROBADA`;
- positivos < negativos => `RECHAZADA`;
- igualdad => `EMPATADA`.

Abstenciones excluidas del cálculo.

Solo abstenciones después de un cierre normal producen `EMPATADA`, no `INCONCLUSA`.

## CU-17 Calcular mayoría especial

Al cierre normal:

- base `VOTOS_COMPUTABLES`: positivos / (positivos + negativos);
- base `PRESENTES`: positivos / votos emitidos, incluyendo abstenciones;
- base `CUERPO`: positivos / total de concejales cargados;
- aprueba si `cociente >= factor`.

Si `VOTOS_COMPUTABLES` vale cero porque solo se emitieron abstenciones, resulta `RECHAZADA` sin efectuar una división por cero.

La comparación usa el factor numérico exacto congelado, sin redondeo ni tolerancia. Por eso `8/12` alcanza un factor efectivo `2/3`, pero no alcanza `0.6666666667`.

Si la finalización es anticipada con presentes sin votar, prevalece `INCONCLUSA`.

## CU-18 Desempatar mayoría simple

**Actor:** Presidencia a través de Moderación.

**Precondición:** sesión abierta y la votación identificada es la activa, permanece `CERRADA + EMPATADA`, es `SIMPLE` y todavía no posee voto presidencial.

Moderación envía `POST /api/v1/votaciones/{id}/desempate` con únicamente `sentido=POSITIVO|NEGATIVO`. El backend valida id y estado y toma la Presidencia vigente dentro del único serializador. No exige quórum posterior al empate ni relaciona esa autoridad con presencia o voto ordinario de un Concejal.

Primero persiste `VOTO_DESEMPATE_PRESIDENCIAL` y almacena el voto irreversible. Luego persiste `VOTACION_RESULTADO_DESEMPATE`, aplica `POSITIVO -> APROBADA` o `NEGATIVO -> RECHAZADA` y libera la referencia activa. La misma instancia conserva fecha de cierre, votos y conteos ordinarios.

El voto de Presidencia no se agrega al conteo de votos ordinarios.

Si falla el primer evento, no se almacena voto. Si falla el segundo, se conserva el voto presidencial ya durable pero el resultado permanece `EMPATADA` y la referencia sigue activa. Ninguno de esos fallos implementa rollback, repetición o recuperación.

## CU-19 Pedir/retirar palabra

**Actor:** Concejal presente.

Tecla `7`:
- si no espera, entra al final de la cola FIFO;
- si ya espera, retira su pedido;
- si está hablando, termina su propio uso y **no** se otorga automáticamente la palabra al siguiente de la cola.

Funciona también durante una votación.

## CU-20 Otorgar palabra

**Actor:** Moderación.

La acción `Otorgar palabra` reproduce la semántica operativa vigente:

- si hay orador actual, finaliza su uso;
- si existe al menos una solicitud en cola, otorga la palabra al primero de la cola;
- si no hay solicitudes en cola, no queda un nuevo orador.

Esta es la acción de Moderación que permite avanzar deliberadamente al siguiente pedido.

## CU-21 Quitar palabra

**Actor:** Moderación.

Finaliza al orador actual y registra el hecho.

`Quitar palabra` **no** otorga automáticamente la palabra al siguiente de la cola. Si existen pedidos pendientes, permanecen en la cola hasta una acción posterior de `Otorgar palabra`.

## CU-22 Ausencia durante palabra

Al pasar a ausente:
- si estaba en cola, quitarlo y hacerle perder ese lugar;
- si estaba hablando, finalizar automáticamente su uso;
- en ninguno de ambos casos se otorga automáticamente la palabra al siguiente de la cola.

## CU-23 Moción durante votación

Los concejales pueden usar la palabra mientras sigue `EN_CURSO`. Si una moción aprobada obliga a alterar la votación, Moderación debe finalizarla manualmente como `INCONCLUSA` con motivo y continuar según lo decidido fuera de esa votación.

## CU-24 Mostrar estado a Moderación

Mostrar estado global, autoridades, presencia/quórum, votación, votos según política configurada, Orden del Día, cola/orador y eventos.

## CU-25 Mostrar estado al Recinto

Proyección de solo lectura que nunca expone votos individuales mientras `EN_CURSO`.

Al cerrar muestra resultado/votos durante el tiempo configurado y luego limpia la presentación transitoria.

## CU-26 Reconexión de frontend

Cualquier frontend que recargue o reconecte debe poder reconstruir su vista consultando el backend; no depende de haber observado los eventos anteriores.

## CU-27 Remapear dispositivo (requisito pendiente de diseño)

**Actor:** Moderación/operación técnica.

Ante falla física, reasignar rápidamente otro dispositivo al mismo concejal, incluso durante votación.

No cambia presencia, identidad ni votos emitidos. Se registra y solo modifica el mapeo en memoria.

## CU-28 Interrupción técnica

Si el backend reinicia durante preparación o sesión:

1. los CSV anteriores quedan hasta el último evento escrito;
2. no se modifican ni reparan retrospectivamente;
3. el estado reinicia en `SIN_PREPARAR`;
4. no se continúa la sesión anterior.
