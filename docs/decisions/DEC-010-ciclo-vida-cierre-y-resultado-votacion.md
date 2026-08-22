# DEC-010 - Ciclo de vida, cierre y resultado de una votación

**Estado:** `APROBADA`

## Contexto

WP-009 dejó integrada la apertura de una votación con sus datos constitutivos inmutables y una única instancia `Votacion` compartida entre el historial de la sesión y `EstadoOperativo.votacion_activa`.

La planificación posterior separaba originalmente el voto ordinario, el cálculo de mayoría SIMPLE y el cálculo de mayoría ESPECIAL en WPs distintos, pero esa división mezclaba dos conceptos diferentes dentro de un único `EstadoVotacion`:

- si la votación todavía acepta votos o ya cerró su recepción;
- qué resultado institucional produjo el conjunto de votos una vez cerrado.

La decisión humana es separar explícitamente ambos conceptos. Esto permite construir primero la votación completa —incluidos voto único, irreversibilidad y autocierre por completitud— sin obligar a calcular todavía el resultado, y luego resolver en un único WP la mayoría SIMPLE o ESPECIAL conforme a los parámetros que quedaron congelados al abrir.

## Decisión

### 1. Ciclo de vida y resultado son conceptos distintos

La entidad `Votacion` tendrá conceptualmente dos dimensiones evolutivas independientes:

```text
EstadoVotacion
- EN_CURSO
- CERRADA

ResultadoVotacion
- None
- APROBADA
- RECHAZADA
- EMPATADA
- INCONCLUSA
```

`EstadoVotacion` responde únicamente si la votación sigue admitiendo votos ordinarios.

`ResultadoVotacion` expresa la interpretación institucional de una votación ya cerrada o finalizada.

Los datos constitutivos fijados por WP-009 continúan siendo inmutables:

- id técnico;
- número de votación;
- tipo;
- tema;
- tipo de mayoría;
- factor;
- base;
- fecha/hora de apertura.

El estado, el resultado, los votos y los datos de cierre son evolutivos dentro de las transiciones expresamente autorizadas por los WPs posteriores.

### 2. Apertura

Una votación recién abierta queda en:

```text
estado = EN_CURSO
resultado = None
```

Mientras `estado = EN_CURSO`, puede aceptar votos ordinarios si se cumplen las reglas de presencia, unicidad y demás precondiciones aplicables.

### 3. Autocierre por completitud sin cálculo de resultado

WP-010 implementará la recepción de votos ordinarios y la detección de completitud.

Cuando todos los concejales actualmente presentes hayan emitido su voto y se mantenga el quórum requerido:

```text
estado = CERRADA
resultado = None
fecha_hora_cierre = <instante de cierre>
```

Ese autocierre significa únicamente que ya no se aceptan más votos.

WP-010 no decide si la votación fue aprobada, rechazada o empatada.

Durante la implementación incremental, entre WP-010 y WP-011 podrá existir una votación `CERRADA` con `resultado = None`. Es una etapa técnica transitoria del desarrollo y no un nuevo resultado reglamentario.

Una votación cerrada sin resultado continúa siendo una votación pendiente y no habilita la apertura de otra.

### 4. Cálculo unificado del resultado

WP-011 será propietario del cálculo ordinario del resultado para ambos tipos de mayoría.

Tomará la votación ya cerrada y utilizará los datos constitutivos congelados al abrir:

```text
tipo_mayoria
factor
base
```

Si `tipo_mayoria = SIMPLE`, aplicará la regla SIMPLE vigente sobre positivos y negativos, excluyendo abstenciones.

Si `tipo_mayoria = ESPECIAL`, aplicará el factor y la base declarados al abrir:

- `VOTOS_COMPUTABLES`;
- `PRESENTES`;
- `CUERPO`.

No existirá un WP separado para el cálculo ESPECIAL: el alcance que estaba previsto para WP-012 queda absorbido por WP-011.

En la implementación completa, el cálculo ordinario debe encadenarse al cierre normal bajo la serialización única del backend, de modo que no exista una ventana funcional en la que otra operación pueda tratar una votación cerrada pero aún no evaluada como si estuviera resuelta.

### 5. Resultados finales y resultado transitorio EMPATADA

Los resultados finales ordinarios son:

```text
APROBADA
RECHAZADA
```

`INCONCLUSA` es también un resultado final, pero su producción pertenece a los flujos posteriores de finalización manual, pérdida de quórum o cierre de sesión definidos por sus WPs propietarios.

`EMPATADA` NO es un resultado final.

Solo puede surgir de una mayoría SIMPLE. Representa una situación transitoria pendiente de resolución presidencial.

Cuando el cálculo SIMPLE produce igualdad:

1. la misma instancia `Votacion` conserva `estado = CERRADA`;
2. `resultado` pasa a `EMPATADA`;
3. se registra institucionalmente el empate;
4. la votación continúa pendiente y bloquea la apertura de otra;
5. Presidencia debe emitir posteriormente el desempate conforme al WP propietario de esa capacidad.

No se crea una segunda votación ni una copia del objeto para el desempate.

### 6. Desempate sobre la misma instancia

El desempate presidencial modifica únicamente el resultado evolutivo de la misma instancia `Votacion`:

```text
EMPATADA -> APROBADA
```

o

```text
EMPATADA -> RECHAZADA
```

La votación permanece `CERRADA` durante toda esta secuencia.

No es necesario conservar en memoria una segunda entidad o una versión histórica separada del objeto para representar que antes estuvo empatada.

La trazabilidad histórica corresponde a la auditoría institucional.

### 7. Auditoría obligatoria del empate y del desempate

Aunque `resultado` se actualice sobre la misma instancia, el registro persistente debe permitir reconstruir toda la secuencia.

Como mínimo deben quedar eventos institucionales diferenciados para:

- cierre normal de la recepción de votos;
- resultado `EMPATADA` cuando corresponda;
- sentido del voto presidencial de desempate;
- resultado final `APROBADA` o `RECHAZADA` posterior al desempate.

Por lo tanto, que el objeto en memoria termine con `resultado = APROBADA` o `RECHAZADA` no elimina ni reemplaza el evento previo que registró el empate.

La auditoría continúa obedeciendo el principio de persistir antes de confirmar la mutación funcional correspondiente.

### 8. Liberación de la votación pendiente

Mientras la votación esté en cualquiera de estas situaciones, debe continuar bloqueando una nueva apertura:

- `estado = EN_CURSO`;
- `estado = CERRADA` y `resultado = None`;
- `resultado = EMPATADA`.

Cuando alcance un resultado final (`APROBADA`, `RECHAZADA` o `INCONCLUSA`) podrá dejar de ser la votación activa/pending del estado operativo, conservándose la misma entidad en el historial de la sesión.

El detalle de cada transición y su liberación se implementará en el WP propietario correspondiente, siempre bajo el único `EjecutorMutaciones`.

### 9. Presencia, completitud y quórum

La completitud continúa definida respecto de los concejales actualmente presentes:

- un concejal presente que aún no votó mantiene la votación `EN_CURSO`;
- quien ya votó conserva su voto aunque luego pase a ausente;
- quien ingresa como presente durante `EN_CURSO` puede votar si todavía no lo hizo;
- un cambio de presencia puede hacer que todos los presentes restantes ya hayan votado y provocar autocierre normal, únicamente si se mantiene quórum.

La pérdida de quórum durante `EN_CURSO` no debe confundirse con autocierre normal. Su resultado `INCONCLUSA` pertenece al WP posterior que implementará esa regla.

Hasta que ese WP esté integrado, WP-010 no debe cerrar normalmente una votación que haya perdido quórum solo porque los presentes restantes ya hayan votado.

## Reparto de Work Packages

### WP-010

Implementar:

- votos ordinarios `POSITIVO`, `ABSTENCION`, `NEGATIVO` mediante teclas `1`, `2`, `3`;
- requisito de presencia para votar;
- un voto por concejal/votación;
- irreversibilidad;
- conservación del voto ante cambios posteriores de presencia;
- incorporación de un nuevo presente durante `EN_CURSO` si todavía no votó;
- detección de completitud;
- autocierre de recepción por completitud con quórum;
- `estado = CERRADA` y fecha/hora de cierre;
- `resultado = None`;
- auditoría inmediata de votos y cierre;
- no calcular mayorías ni resultados.

### WP-011

Implementar en un único WP:

- cálculo SIMPLE;
- cálculo ESPECIAL;
- uso de `tipo_mayoria`, `factor` y `base` congelados al abrir;
- resultados `APROBADA` y `RECHAZADA`;
- resultado transitorio `EMPATADA` solo para SIMPLE;
- registro del resultado;
- liberación de la votación activa cuando el resultado sea final;
- conservación de la votación como pendiente cuando resulte `EMPATADA`.

### WP-012

El alcance anteriormente previsto para WP-012 queda absorbido por WP-011.

No se creará `WP-012.md` para ese alcance y la numeración posterior no se renumera, para preservar la trazabilidad histórica del PLAN.

### WP-013 y WP-014

WP-013 conserva la responsabilidad de finalización manual, pérdida de quórum, resultado `INCONCLUSA` y cierre de sesión con votación pendiente.

WP-014 conserva la responsabilidad del desempate presidencial y aplicará la transición del mismo objeto desde `resultado = EMPATADA` hacia `APROBADA` o `RECHAZADA`, registrando explícitamente ambos hechos.

## Consecuencias

- `APROBADA`, `RECHAZADA`, `EMPATADA` e `INCONCLUSA` dejan de modelarse como estados del ciclo de vida y pasan a ser resultados.
- `CERRADA` no significa por sí misma que exista un resultado calculado.
- `EMPATADA` es observable y auditable, pero no final.
- no se abre una nueva votación mientras exista un empate pendiente;
- no se duplica la entidad para representar el desempate;
- la auditoría, y no una copia histórica del objeto en memoria, conserva la secuencia empate -> desempate -> resultado final;
- WP-011 concentra toda la lógica de interpretación de mayorías y elimina la división artificial SIMPLE/ESPECIAL entre dos WPs.

## Autoridad

Esta decisión fue aprobada explícitamente por el responsable humano del proyecto durante la planificación de WP-010 y prevalece sobre formulaciones anteriores que utilicen `APROBADA`, `RECHAZADA`, `EMPATADA` o `INCONCLUSA` como si fueran estados de ciclo de vida de `Votacion`.

Los documentos generales deberán alinearse con esta separación antes de delegar la implementación afectada.