# 02 - Modelo de dominio y estados

Este documento define el modelo conceptual. No prescribe clases, ORM, tablas ni estructura de módulos.

## 1. EstadoGlobal

Valores válidos:

- `SIN_PREPARAR`
- `PREPARANDO`
- `SESION_ABIERTA`

Transiciones:

- `SIN_PREPARAR -> PREPARANDO`: `Preparar sala`.
- `PREPARANDO -> SIN_PREPARAR`: cancelar preparación.
- `PREPARANDO -> SESION_ABIERTA`: abrir sesión con quórum y datos obligatorios.
- `SESION_ABIERTA -> SIN_PREPARAR`: cerrar sesión.
- reinicio técnico desde cualquier estado -> `SIN_PREPARAR`.

No existe recuperación automática de estado activo.

## 2. Preparacion

Existe únicamente en `PREPARANDO` y luego se convierte conceptualmente en el contexto operativo de la sesión abierta.

Contiene como mínimo:

- fecha/hora de inicio;
- número de sesión propuesto;
- Presidencia;
- Secretaría Legislativa;
- configuración congelada;
- padrón congelado;
- presencias actuales;
- referencias a los tres CSV activos.

Todos los concejales comienzan ausentes.

## 3. Sesion

Representa una sesión formal abierta.

Atributos conceptuales mínimos:

- número informado externamente;
- fecha/hora de apertura;
- Presidencia actual;
- Secretaría Legislativa actual;
- concejales cargados;
- presencia actual;
- quórum configurado;
- disposición de bancas;
- votaciones realizadas;
- cola de palabra;
- orador actual;
- votación pendiente, si existe.

El número no es validado por unicidad ni secuencia.

## 4. Concejal

Atributos conceptuales:

- DNI, identidad primaria;
- nombre;
- apellido;
- bloque opcional;
- banca;
- dispositivo lógico asignado;
- presencia actual;
- estado visual temporal de test.

DNI, banca y dispositivo deben ser únicos dentro del padrón cargado.

La condición de concejal no se modifica si la misma persona ejerce además Presidencia.

## 5. AutoridadPresidencia

Rol institucional representado por texto libre.

No se enlaza automáticamente con un Concejal.

Responsabilidad funcional única en el dominio:

- emitir desde Moderación un voto extraordinario de desempate positivo o negativo cuando una votación de mayoría simple tiene resultado transitorio `EMPATADA`.

Si la persona que preside también es concejal, ambos roles son independientes.

## 6. SecretariaLegislativa

Rol institucional representado por texto libre. No ejecuta comandos de negocio; su valor y sus cambios deben registrarse.

## 7. Votacion

Representa una única votación. Conforme a DEC-010, su ciclo de vida y su resultado son dimensiones evolutivas distintas.

Atributos conceptuales mínimos:

- identificador interno técnico;
- número externo, no validado;
- tipo configurable;
- tema;
- tipo de mayoría: `SIMPLE` o `ESPECIAL`;
- factor y base normalizados conforme al tipo de mayoría;
- estado de recepción;
- resultado institucional, si existe;
- hora de apertura/cierre;
- votos ordinarios;
- si corresponde, voto presidencial de desempate;
- motivo de finalización manual cuando corresponda.

Desde la apertura son inmutables el identificador, número, tipo, tema, tipo de mayoría, factor, base y hora de apertura. El estado de recepción, el resultado, los votos y los datos de cierre permanecen evolutivos únicamente dentro de las transiciones expresamente autorizadas.

### Estado de recepción

Valores canónicos:

- `EN_CURSO`: todavía puede admitir votos ordinarios si se cumplen las precondiciones;
- `CERRADA`: ya no admite nuevos votos ordinarios.

Una votación recién abierta queda `EN_CURSO` y con `resultado = None`.

El cierre por completitud cambia la recepción a `CERRADA` y fija una única hora de cierre. Es un hecho separado del resultado: bajo la misma serialización, el backend calcula el resultado sin mutar, lo audita y recién entonces lo aplica. Si falla esa segunda auditoría, permanece legítimamente `CERRADA + resultado=None`, con la misma fecha y referencia activa, porque ese fue el último hecho institucional persistido.

### Resultado

Valores conceptuales:

- `None`: todavía no existe resultado institucional;
- `APROBADA`: resultado final;
- `RECHAZADA`: resultado final;
- `EMPATADA`: resultado transitorio exclusivo de mayoría simple y pendiente de desempate presidencial;
- `INCONCLUSA`: resultado final de una finalización que no consolidó un resultado ordinario.

`APROBADA`, `RECHAZADA`, `EMPATADA` e `INCONCLUSA` no son estados del ciclo de recepción.

Una votación con `resultado = EMPATADA` permanece `CERRADA`, continúa pendiente y bloquea una nueva apertura. El desempate actúa sobre la misma instancia y cambia únicamente su resultado a `APROBADA` o `RECHAZADA`; la auditoría conserva el hecho previo del empate y el posterior desempate.

### Transiciones principales

```text
EN_CURSO + resultado=None
    -> CERRADA + resultado=None
```

cuando se completa normalmente la recepción de votos.

Sobre esa misma votación cerrada, el cálculo ordinario produce:

```text
CERRADA + resultado=None
    -> CERRADA + resultado=APROBADA|RECHAZADA|EMPATADA
```

La mayoría SIMPLE puede producir `EMPATADA`; la ESPECIAL no.

Al aplicar `APROBADA` o `RECHAZADA`, la misma entidad permanece en el historial y deja libre la referencia de votación activa. Al aplicar `EMPATADA`, esa misma entidad conserva la referencia activa y continúa pendiente.

El desempate presidencial produce:

```text
CERRADA + resultado=EMPATADA
    -> CERRADA + resultado=EMPATADA + VotoDesempate
    -> CERRADA + resultado=APROBADA|RECHAZADA
```

La etapa intermedia solo es observable en memoria si falla la auditoría del resultado después de persistir y almacenar el voto presidencial. Es un estado técnico de fallo cerrado: no habilita un segundo voto, retry ni recovery. Tras el segundo hecho durable, el sentido ya almacenado determina directamente el resultado y se libera la referencia activa.

Una finalización manual, la pérdida de quórum durante `EN_CURSO` o el cierre de sesión producen sobre la misma instancia:

```text
EN_CURSO + resultado=None
    -> CERRADA + resultado=INCONCLUSA

CERRADA + resultado=EMPATADA
    -> CERRADA + resultado=INCONCLUSA  # solo al cerrar sesión
```

La primera transición fija una única fecha/hora de cierre; la segunda conserva la que ya tenía el empate. Solo la causa manual almacena un motivo humano normalizado, inmutable y separado de las causas institucionales `PERDIDA_QUORUM` y `CIERRE_SESION`.

Un resultado final (`APROBADA`, `RECHAZADA` o `INCONCLUSA`) nunca vuelve a abrirse ni se recalcula. `EMPATADA` no es final y debe resolverse por desempate o por el cierre explícito de sesión. Una pérdida posterior de quórum no modifica por sí sola el empate.

## 8. TipoMayoria

### SIMPLE

Su representación normalizada usa `factor = 0` y `base = VOTOS_COMPUTABLES`, aunque la entrada pueda omitir factor/base o enviar factor nulo. `VOTOS_COMPUTABLES` significa positivos + negativos.

- positivos > negativos: aprobada;
- positivos < negativos: rechazada;
- positivos = negativos: empatada.

Abstenciones fuera del cálculo.

### ESPECIAL

Tiene:

- `factor` real finito `> 0` y `<= 1`;
- `base = VOTOS_COMPUTABLES | PRESENTES | CUERPO`.

Aprueba con cociente `>= factor`, comparando directamente los valores numéricos congelados y calculados, sin redondeo ni tolerancia.

`VOTOS_COMPUTABLES`: denominador = positivos + negativos; si al cierre normal solo hubo abstenciones, el resultado especial es `RECHAZADA` sin dividir por cero.

`PRESENTES`: denominación institucional de quienes emitieron voto ordinario; denominador = positivos + negativos + abstenciones. Una persona que votó continúa integrándolo aunque luego se retire, y quien ingresa durante `EN_CURSO` y alcanza a votar también lo integra.

`CUERPO`: denominador = cantidad total de concejales cargados.

Una mayoría especial no puede requerir desempate presidencial.

## 9. VotoOrdinario

Representa el voto de un concejal.

- vinculado por DNI al concejal;
- valor `POSITIVO`, `NEGATIVO` o `ABSTENCION`;
- uno por concejal/votación;
- irreversible;
- permanece aunque el concejal pase a ausente;
- nunca puede cargarse o corregirse desde Moderación.

## 10. VotoDesempate

Representa una decisión del rol Presidencia, no un voto ordinario de concejal.

- solo cuando una votación simple cerrada tiene `resultado = EMPATADA`;
- valor `POSITIVO` o `NEGATIVO`;
- identidad textual de la Presidencia vigente al ejecutar bajo el serializador;
- ingresado desde Moderación;
- irreversible;
- opcional al crear la votación y asignable una sola vez;
- debe quedar registrado explícitamente.

No contiene DNI ni banca y no debe agregarse como si fuera otro voto ordinario dentro del conteo de concejales. Tampoco modifica la fecha de cierre ni los conteos. `POSITIVO` deriva en `APROBADA` y `NEGATIVO` en `RECHAZADA` sin recalcular la mayoría simple.

## 11. Presencia

Estado dinámico de cada concejal: presente/ausente.

Se modifica solo por tecla `9` del dispositivo asignado.

Puede cambiar durante la sesión y durante una votación.

La pérdida de quórum mientras la recepción está `EN_CURSO` finaliza inmediatamente la votación con `estado = CERRADA` y `resultado = INCONCLUSA`. Esta regla se evalúa antes que la completitud que pudiera derivarse del mismo retiro.

## 12. ColaUsoPalabra

Estructura conceptual FIFO.

La sesión conserva una única cola de DNI resueltos contra el padrón congelado y
un único DNI opcional como orador actual. No se copian entidades `Concejal` ni
se mantienen listas paralelas en API o servicios.

Estados posibles de un concejal respecto de palabra:

- sin solicitud;
- esperando;
- en uso.

Un ausente no puede permanecer esperando ni en uso.

Pedir y usar palabra es independiente de que exista una votación en curso.

Finalizar el uso propio, quitarlo desde Moderación o perderlo por ausencia deja
la cola intacta y sin nuevo orador. Únicamente el comando explícito
`Otorgar palabra` retira el primer pedido FIFO y lo convierte en orador.

## 13. OrdenDelDia

Colección opcional y temporal de propuestas de votación precargadas.

No es fuente de autoridad institucional para el sistema. Un elemento seleccionado se transforma en datos editables del formulario antes de abrir la votación.

## 14. EventoRegistro

Representa una interacción o transición persistida en los CSV.

Campos mínimos conceptuales:

- timestamp local a segundos;
- nivel L1/L2/L3;
- categoría/tag;
- mensaje o datos suficientes para reconstruir el hecho;
- secuencia/orden determinista cuando sea necesario técnicamente.

La estructura CSV exacta se decidirá técnicamente, pero debe preservar la semántica de tres niveles acumulativos.

## 15. MapeoDispositivo

Asocia un dispositivo lógico a un concejal.

Normalmente proviene de la configuración congelada al preparar. El futuro remapeo rápido podrá cambiar esta asociación en memoria sin modificar la identidad, presencia o votos del concejal.

## 16. Invariantes

- máximo una preparación/sesión activa;
- máximo una votación pendiente;
- una votación `EN_CURSO`, `CERRADA` sin resultado o `EMPATADA` bloquea otra apertura;
- un voto ordinario por concejal/votación;
- sesión solo abre con quórum y autoridades completas;
- votación solo abre con sesión y quórum;
- pérdida de quórum durante recepción `EN_CURSO` => cierre con resultado `INCONCLUSA`, con prioridad sobre completitud;
- ningún resultado final se revierte;
- máximo un `VotoDesempate` irreversible por votación simple empatada;
- `EMPATADA` es transitorio y solo se resuelve mediante los flujos autorizados;
- estado activo solo en memoria;
- máximo un DNI por posición de la cola de palabra y máximo un orador;
- el orador no aparece simultáneamente en la cola;
- ningún ausente permanece en cola ni como orador;
- finalizar un uso de palabra no promueve implícitamente al siguiente;
- frontends no son autoridad de dominio.
