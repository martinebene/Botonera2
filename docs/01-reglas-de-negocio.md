# 01 — Reglas de negocio

Este documento consolida el **comportamiento observado en el código ejecutable de producción** de `martinebene/Botonera`, rama `main`, snapshot `537823b4a0045853c74a388058fa3739cf7457a5`.

Los manuales, README, comentarios y demás documentación del repositorio anterior se usan únicamente como contexto. **Si contradicen el comportamiento del código, prevalece el código.**

Las decisiones que el código no permite determinar con suficiente certeza se encuentran en `10-preguntas-abiertas.md`.

## RN-SES — Sesión

### RN-SES-001 — Unicidad
Solo puede existir **una sesión activa** a la vez.

### RN-SES-002 — Apertura
Para abrir una sesión debe poder cargarse una nómina de concejales válida y no vacía. La sesión recibe un número público y registra su hora de inicio.

### RN-SES-003 — Datos cargados al abrir
Al abrir la sesión se incorporan:

- concejales;
- presencia inicial definida en la fuente de datos;
- quórum configurado;
- disposición de bancas configurada.

### RN-SES-004 — Cierre
Una sesión activa puede cerrarse. Si existe una votación `EN_CURSO`, el código productivo fuerza primero su cierre.

Después del cierre deja de existir una sesión activa para el resto del sistema.

## RN-CON — Concejales, presencia y dispositivos

### RN-CON-001 — Datos mínimos
Cada concejal posee en el sistema productivo:

- `dni`;
- nombre;
- apellido;
- bloque;
- estado presente/ausente;
- número de banca;
- identificador lógico del dispositivo de votación.

Botonera2 puede usar otro identificador técnico interno, pero debe conservar una identidad inequívoca del concejal y estos datos funcionales.

### RN-CON-002 — Asociación dispositivo → concejal
Una pulsación solo puede producir una acción si el identificador lógico del dispositivo está asociado a un concejal de la sesión activa.

### RN-CON-003 — Presencia
En el código productivo la tecla **`9`** alterna el estado presente/ausente.

El cambio se refleja inmediatamente en el total de presentes.

### RN-CON-004 — Presencia durante votación
La presencia puede cambiar mientras una votación está `EN_CURSO`.

Después del cambio se reevalúa la condición de cierre automático de la votación.

### RN-CON-005 — Restricciones del ausente
Un concejal ausente no puede:

- emitir un voto;
- solicitar uso de la palabra mediante su teclado.

## RN-INP — Mapa de teclas productivo

Con sesión activa y dispositivo reconocido:

| Tecla | Acción |
|---|---|
| `1` | voto `Positivo` |
| `2` | voto `Abstención` |
| `3` | voto `Negativo` |
| `7` | alternar pedido de palabra; si el concejal es el orador actual, finalizar su uso de palabra |
| `8` | activar test visual temporal de la banca |
| `9` | alternar presencia/ausencia |

Cualquier otra tecla se rechaza como comando no soportado.

### RN-INP-001 — Sin sesión activa
En `main`, si no existe una sesión activa, **todas las pulsaciones son rechazadas antes de interpretar la tecla**.

La acreditación previa a la apertura aparece solamente en `v2`; por no estar validada en producción no se adopta como regla de Botonera2 sin decisión explícita.

## RN-VOT — Votaciones

### RN-VOT-001 — Condiciones de apertura
Para abrir una votación:

- debe existir una sesión activa;
- debe haber quórum: `cantidad_presentes >= quorum`;
- no debe existir otra votación con estado `EN_CURSO`.

El comportamiento frente a una votación `EMPATADA` pendiente de desempate tiene una inconsistencia en el MVP y se documenta como pregunta abierta.

### RN-VOT-002 — Datos funcionales
Una votación contiene:

- número;
- tipo;
- tema;
- criterio de cómputo: sobre presentes o sobre el cuerpo;
- factor de mayoría especial, donde `0` representa mayoría simple;
- estado;
- hora de inicio;
- hora de fin;
- votos ordinarios emitidos.

### RN-VOT-003 — Estados
Estados implementados:

- `EN_CURSO`;
- `APROBADA`;
- `RECHAZADA`;
- `EMPATADA`;
- `INCONCLUSA`.

### RN-VOT-004 — Condiciones para votar
Un voto ordinario requiere:

- sesión activa;
- votación `EN_CURSO`;
- dispositivo asociado a un concejal;
- concejal presente;
- concejal sin voto previo en esa votación.

### RN-VOT-005 — Un voto por concejal
Un concejal puede emitir **un único voto ordinario por votación**.

El código productivo no permite cambiar ni reemplazar un voto ya registrado.

### RN-VOT-006 — Valores
Valores ordinarios:

- `Positivo`;
- `Negativo`;
- `Abstención`.

### RN-VOT-007 — Cierre automático
Después de registrar cada voto y después de un cambio de presencia, la votación se cierra automáticamente cuando **todos los concejales que están presentes en ese momento figuran entre quienes ya votaron**.

Los votos ya registrados permanecen en la votación aunque luego cambie la presencia del concejal.

### RN-VOT-008 — Cierre forzado
Moderación puede cerrar manualmente una votación `EN_CURSO` antes de que voten todos los presentes.

Los presentes que no votaron se identifican en el registro operativo.

### RN-VOT-009 — Mayoría simple
Con factor de mayoría `0`:

- positivos > negativos → `APROBADA`;
- positivos < negativos → `RECHAZADA`;
- positivos = negativos → `EMPATADA`.

Las abstenciones no se agregan a positivos ni negativos para esta comparación.

### RN-VOT-010 — Mayoría especial sobre cuerpo
Con factor especial `f > 0` y cómputo sobre cuerpo, el código ejecuta:

`votos_positivos / cantidad_total_concejales >= f`

Si se cumple → `APROBADA`; si no → `RECHAZADA`.

### RN-VOT-011 — Mayoría especial sobre presentes: comportamiento exacto del MVP
Con factor especial `f > 0` y cómputo sobre presentes, el código ejecuta:

`votos_positivos / votos_emitidos >= f`

Este es el comportamiento que debe caracterizarse antes de cualquier cambio. Su equivalencia semántica con “sobre presentes” depende de cómo se cierre la votación y se registra como punto a confirmar.

### RN-VOT-012 — Resultado inconcluso
Después del cálculo anterior, el código reemplaza el resultado por `INCONCLUSA` si se cumple al menos una condición:

- `votos_emitidos < cantidad_concejales_presentes`;
- `votos_emitidos < quorum`;
- `votos_emitidos == 0`.

Esta regla afecta especialmente al cierre forzado.

### RN-VOT-013 — Empate y desempate
Una mayoría simple puede terminar `EMPATADA`.

Moderación dispone de una acción de desempate:

- desempate positivo → `APROBADA`;
- desempate negativo → `RECHAZADA`.

En el MVP el desempate:

- no se incorpora a la lista de votos ordinarios;
- no está asociado a un concejal;
- fija la hora de fin;
- finaliza la votación pendiente.

Botonera2 debe conservar al menos la distinción funcional entre votos ordinarios y decisión de desempate.

## RN-PAL — Uso de la palabra

### RN-PAL-001 — Pedido
Un concejal presente que presiona `7`, y que no es el orador actual, alterna su pertenencia a la cola:

- si no estaba en cola, se agrega al final;
- si ya estaba en cola, se retira.

### RN-PAL-002 — FIFO
La cola es **FIFO**: primero en ingresar, primero en salir cuando Moderación otorga la palabra.

### RN-PAL-003 — Otorgamiento
Moderación toma al primer concejal de la cola y lo establece como orador actual.

Si la cola está vacía, no se asigna orador.

El comportamiento si ya existe un orador y se vuelve a ejecutar “otorgar” debe definirse explícitamente para Botonera2.

### RN-PAL-004 — Finalización
Moderación puede quitar la palabra al orador actual.

Además, si el propio orador presiona `7`, finaliza su uso de la palabra.

## RN-OD — Orden del Día

### RN-OD-001 — Función
El Orden del Día es una ayuda local de Moderación para precargar parámetros de una votación. Cargar o seleccionar una fila no modifica por sí solo el estado del backend.

### RN-OD-002 — Formato ejecutado por el frontend productivo
El código productivo de Moderación espera cinco columnas separadas por **punto y coma (`;`)**:

`nro_votacion;tipo;tema;factor_de_mayoria;respecto`

Cada fila debe tener exactamente cinco campos.

### RN-OD-003 — Validación observada
- `nro_votacion`: solo dígitos y no vacío;
- `tema`: no vacío;
- `tipo`: se normaliza contra tipos conocidos; si no coincide se usa `Otro`;
- `respecto`: `Presentes` o `Cuerpo`, sin distinguir mayúsculas;
- `factor_de_mayoria`: vacío o `0` significa mayoría simple; de lo contrario debe ser un decimal entre 0 y 1 usando punto;
- no se acepta `%`;
- no se acepta coma decimal.

Si una fila es inválida, se rechaza el archivo completo y la tabla queda vacía.

### RN-OD-004 — Tipos canónicos observados
- `Ratificación`;
- `Despacho OP`;
- `Despacho Gob`;
- `Despacho AS`;
- `Despacho HA`;
- `Despacho Eco`;
- `Mocion`;
- `P. Sobre Tabla`;
- `Otro`.

### RN-OD-005 — Selección
Seleccionar una fila copia sus valores al formulario de votación. El operador debe ejecutar después la apertura explícita.

## RN-REC — Recinto y bancas

### RN-REC-001 — Disposición configurable
La disposición se expresa como filas con cantidad de columnas.

Para renderizar el recinto correctamente, la suma de posiciones debe coincidir con la cantidad de concejales cargados.

### RN-REC-002 — Numeración de bancas
La banca `1` se ubica abajo a la izquierda. La numeración continúa de izquierda a derecha, completa esa fila y sigue en la fila inmediatamente superior, avanzando de abajo hacia arriba.

### RN-REC-003 — Imagen por banca
Cada número de banca tiene asociada una imagen institucional utilizada por las interfaces.

### RN-REC-004 — Estados visuales de banca
La vista debe poder distinguir al menos:

- ausente;
- orador actual;
- test visual temporal;
- voto individual cuando su visualización esté permitida.

## RN-VIS — Secreto y visualización de votos

### RN-VIS-001 — Pantalla pública
Mientras una votación está `EN_CURSO`, la Pantalla de Recinto **no muestra los votos individuales**.

También oculta visualmente los eventos que podrían revelar votos individuales durante ese período.

### RN-VIS-002 — Revelación posterior al cierre
Una vez cerrada la votación, la Pantalla de Recinto muestra los votos individuales y el resultado durante aproximadamente **6 segundos**, y luego limpia los votos de las bancas.

### RN-VIS-003 — Cuenta regresiva
Al comenzar una nueva votación, la Pantalla de Recinto muestra una cuenta regresiva visual de **4 segundos**. Esto es una regla de presentación observada, no una demora para aceptar votos: el backend puede registrar votos desde que la votación queda `EN_CURSO`.

### RN-VIS-004 — Moderación
El frontend productivo de Moderación tiene un comportamiento diferente: mantiene inicialmente los votos ocultos por unos **4 segundos** y después puede mostrar los votos aun estando la votación en curso.

Este comportamiento no debe trasladarse automáticamente a Botonera2 sin confirmar la política deseada para el operador; se registra como decisión abierta.

## RN-LOG — Eventos

### RN-LOG-001 — Categorías observadas
El sistema registra eventos al menos de:

- sesión;
- votación;
- voto;
- entrada de teclado;
- uso de la palabra.

### RN-LOG-002 — Niveles
El MVP utiliza tres niveles:

- nivel 1: detalle completo;
- nivel 2: intermedio;
- nivel 3: eventos principales.

### RN-LOG-003 — Visualización
Los frontends pueden filtrar eventos por nivel. La Pantalla de Recinto no debe revelar mediante eventos información de votos mientras la votación está en curso.
