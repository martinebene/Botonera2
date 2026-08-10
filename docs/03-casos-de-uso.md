# 03 - Casos de uso

Los casos de uso describen comportamiento observable. Los nombres de endpoints, componentes o clases se decidirán después.

## CU-01 Preparar sala

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

Registra motivo/evento de cancelación, cierra definitivamente los tres CSV y vuelve a `SIN_PREPARAR`.

## CU-03 Acreditar o retirar presencia

**Actor:** Concejal mediante dispositivo.

En `PREPARANDO` o `SESION_ABIERTA`, tecla `9` alterna su presencia.

Consecuencias:
- recalcular cantidad de presentes y quórum;
- si está en cola/orador y pasa a ausente, retirarlo;
- si hay votación `EN_CURSO`, aplicar pérdida de quórum o autocierre según corresponda.

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

Si hay votación `EN_CURSO`, se finaliza primero; si no estaba completa queda `INCONCLUSA`.

Si hay votación `EMPATADA`, pasa a `INCONCLUSA`.

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

Al abrir, los datos quedan inmutables.

## CU-12 Emitir voto ordinario

**Actor:** Concejal presente mediante su dispositivo.

- `1`: positivo.
- `2`: abstención.
- `3`: negativo.

Solo durante `EN_CURSO`. Un concejal que ya votó no puede volver a votar aunque se ausente y regrese.

Cada voto aceptado se persiste inmediatamente.

## CU-13 Autocerrar votación

Después de cada voto o cambio de presencia, si todos los concejales actualmente presentes ya votaron y se mantiene quórum, calcular el resultado y cerrar automáticamente.

Mayoría simple puede quedar `EMPATADA`; mayoría especial no.

## CU-14 Finalizar votación manualmente

**Actor:** Moderación.

Disponible en cualquier momento de `EN_CURSO`, incluso sin votos.

Exige motivo obligatorio.

Si la votación no estaba completa, resultado `INCONCLUSA`.

No existe estado `CANCELADA`.

## CU-15 Finalizar por pérdida de quórum

Si durante `EN_CURSO` la presencia cae por debajo del quórum, finalizar inmediatamente como `INCONCLUSA`, conservar todos los votos emitidos y registrar el evento.

## CU-16 Calcular mayoría simple

Al cierre normal:

- positivos > negativos => `APROBADA`;
- positivos < negativos => `RECHAZADA`;
- igualdad => `EMPATADA`.

Abstenciones excluidas del cálculo.

## CU-17 Calcular mayoría especial

Al cierre normal:

- base `PRESENTES`: positivos / votos emitidos, incluyendo abstenciones;
- base `CUERPO`: positivos / total de concejales cargados;
- aprueba si `cociente >= factor`.

Si la finalización es anticipada con presentes sin votar, prevalece `INCONCLUSA`.

## CU-18 Desempatar mayoría simple

**Actor:** Presidencia a través de Moderación.

**Precondición:** votación simple `EMPATADA`.

El operador selecciona positivo o negativo. No existe abstención. La decisión es irreversible, se registra explícitamente y produce `APROBADA` o `RECHAZADA`.

El voto de Presidencia no se agrega al conteo de votos ordinarios.

## CU-19 Pedir/retirar palabra

**Actor:** Concejal presente.

Tecla `7`:
- si no espera, entra al final de la cola FIFO;
- si ya espera, retira su pedido;
- si está hablando, termina su propio uso.

Funciona también durante una votación.

## CU-20 Otorgar palabra

**Actor:** Moderación.

Si hay orador actual, finalizarlo automáticamente. Luego otorgar al primero de la cola.

Si no hay solicitudes, no se crea orador.

## CU-21 Quitar palabra

**Actor:** Moderación.

Finaliza al orador actual y registra el hecho.

## CU-22 Ausencia durante palabra

Al pasar a ausente:
- si estaba en cola, quitarlo;
- si estaba hablando, finalizar automáticamente su uso.

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