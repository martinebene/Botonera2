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
- votación activa, si existe.

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

- emitir desde Moderación un voto extraordinario de desempate positivo o negativo cuando una votación de mayoría simple se encuentra `EMPATADA`.

Si la persona que preside también es concejal, ambos roles son independientes.

## 6. SecretariaLegislativa

Rol institucional representado por texto libre. No ejecuta comandos de negocio; su valor y sus cambios deben registrarse.

## 7. Votacion

Atributos conceptuales mínimos:

- identificador interno técnico;
- número externo, no validado;
- tipo configurable;
- tema;
- tipo de mayoría: `SIMPLE` o `ESPECIAL`;
- factor y base normalizados conforme al tipo de mayoría;
- estado;
- hora de apertura/cierre;
- votos ordinarios;
- si corresponde, voto presidencial de desempate;
- motivo de finalización manual cuando corresponda.

Desde la apertura son inmutables el identificador, número, tipo, tema, tipo de mayoría, factor, base y hora de apertura. El estado, los votos y los datos de cierre permanecen conceptualmente evolutivos para sus WPs propietarios.

### Estados

- `EN_CURSO`
- `APROBADA`
- `RECHAZADA`
- `EMPATADA`
- `INCONCLUSA`

No existen `PAUSADA` ni `CANCELADA`.

### Transiciones principales

`EN_CURSO -> APROBADA|RECHAZADA|EMPATADA`
cuando votaron todos los presentes y el resultado puede calcularse.

`EN_CURSO -> INCONCLUSA`
por pérdida de quórum o finalización manual antes de completar normalmente.

`EMPATADA -> APROBADA|RECHAZADA`
por voto presidencial de desempate.

`EMPATADA -> INCONCLUSA`
al cerrar la sesión sin resolver el empate.

Una votación en estado final nunca vuelve a abrirse ni se recalcula.

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

Aprueba con cociente `>= factor`.

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

- solo en votación simple `EMPATADA`;
- valor `POSITIVO` o `NEGATIVO`;
- ingresado desde Moderación;
- irreversible;
- debe quedar registrado explícitamente.

No debe agregarse como si fuera otro voto ordinario dentro del conteo de concejales.

## 11. Presencia

Estado dinámico de cada concejal: presente/ausente.

Se modifica solo por tecla `9` del dispositivo asignado.

Puede cambiar durante la sesión y durante una votación.

La pérdida de quórum en `EN_CURSO` finaliza inmediatamente la votación como `INCONCLUSA`.

## 12. ColaUsoPalabra

Estructura conceptual FIFO.

Estados posibles de un concejal respecto de palabra:

- sin solicitud;
- esperando;
- en uso.

Un ausente no puede permanecer esperando ni en uso.

Pedir y usar palabra es independiente de que exista una votación en curso.

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
- máximo una votación activa;
- una votación empatada bloquea otra;
- un voto ordinario por concejal/votación;
- sesión solo abre con quórum y autoridades completas;
- votación solo abre con sesión y quórum;
- pérdida de quórum en votación => `INCONCLUSA`;
- ninguna transición cerrada se revierte;
- estado activo solo en memoria;
- frontends no son autoridad de dominio.
