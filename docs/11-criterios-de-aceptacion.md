# 11 — Criterios de aceptación

Estos escenarios constituyen la base de pruebas de caracterización de Botonera2. Deben automatizarse en backend siempre que sea posible y complementarse con pruebas de interfaz.

Los nombres y datos personales usados en tests deben ser ficticios.

## CA-SES-01 — No abrir dos sesiones

**Dado** una sesión activa
**Cuando** Moderación intenta abrir otra
**Entonces** la operación se rechaza y la sesión original permanece activa.

## CA-SES-02 — Abrir sin concejales

**Dado** que la fuente de concejales no existe o está vacía
**Cuando** se intenta abrir sesión
**Entonces** la operación se rechaza y no queda sesión activa.

## CA-SES-03 — Cierre normal

**Dado** una sesión activa sin votación en curso
**Cuando** se cierra
**Entonces** deja de existir sesión activa y las pulsaciones posteriores se rechazan.

## CA-SES-04 — Cierre con votación en curso

**Dado** una sesión activa con votación `EN_CURSO`
**Cuando** se cierra la sesión
**Entonces** la votación se cierra forzadamente antes del cierre de sesión y queda un resultado coherente.

## CA-INP-01 — Dispositivo desconocido

**Dado** una sesión activa
**Cuando** llega una pulsación desde un identificador no asignado
**Entonces** no cambia ningún estado y la entrada se rechaza como dispositivo no asignado.

## CA-INP-02 — Sin sesión

**Dado** que no existe sesión activa
**Cuando** llega cualquier tecla, incluida `9`
**Entonces** la entrada se rechaza según el comportamiento productivo de `main`.

Este escenario cambiará solo si se resuelve PA-005 incorporando preparación/acreditación.

## CA-PRE-01 — Alternar presencia

**Dado** un concejal presente
**Cuando** su dispositivo envía `9`
**Entonces** queda ausente y disminuye el total de presentes.

**Cuando** vuelve a enviar `9`
**Entonces** queda presente y aumenta el total.

## CA-PRE-02 — Ausente no vota

**Dado** un concejal ausente y una votación en curso
**Cuando** envía `1`, `2` o `3`
**Entonces** el voto no se registra.

## CA-PRE-03 — Ausente no pide palabra

**Dado** un concejal ausente
**Cuando** envía `7`
**Entonces** no entra en la cola.

## CA-VOT-01 — No abrir sin sesión

**Dado** que no hay sesión activa
**Cuando** Moderación intenta abrir una votación
**Entonces** se rechaza.

## CA-VOT-02 — No abrir sin quórum

**Dado** quórum 7 y solo 6 presentes
**Cuando** se intenta abrir una votación
**Entonces** se rechaza por falta de quórum.

## CA-VOT-03 — Un voto por concejal

**Dado** una votación `EN_CURSO` y un concejal presente
**Cuando** vota Positivo
**Y luego** intenta votar nuevamente
**Entonces** existe un único voto ordinario y el segundo intento se rechaza.

## CA-VOT-04 — Mapeo de teclas

En votación `EN_CURSO`:

- tecla `1` registra `Positivo`;
- tecla `2` registra `Abstención`;
- tecla `3` registra `Negativo`.

## CA-VOT-05 — Mayoría simple aprobada

**Dado** 7 presentes, todos votan
**Y** el resultado es 4 Positivos, 3 Negativos, 0 Abstenciones
**Entonces** la votación termina `APROBADA`.

## CA-VOT-06 — Mayoría simple rechazada

**Dado** 7 presentes, todos votan
**Y** el resultado es 3 Positivos, 4 Negativos
**Entonces** termina `RECHAZADA`.

## CA-VOT-07 — Mayoría simple empatada

**Dado** 7 presentes, todos votan
**Y** hay 3 Positivos, 3 Negativos y 1 Abstención
**Entonces** termina `EMPATADA` porque positivos y negativos son iguales.

## CA-VOT-08 — Desempate positivo

**Dado** una votación `EMPATADA`
**Cuando** Moderación ejecuta desempate Positivo
**Entonces** termina `APROBADA` y la decisión no aparece como voto ordinario de un concejal.

## CA-VOT-09 — Desempate negativo

Igual al anterior, pero la decisión Negativa produce `RECHAZADA`.

## CA-VOT-10 — Mayoría especial sobre cuerpo

**Dado** cuerpo total de 12 y factor `0.66`
**Cuando** hay 8 votos Positivos
**Entonces** `8/12 >= 0.66` y el criterio especial se considera cumplido.

**Cuando** hay 7 Positivos
**Entonces** `7/12 < 0.66` y se considera no cumplido.

La aplicación posterior de `INCONCLUSA` debe evaluarse según presentes, quórum y votos emitidos.

## CA-VOT-11 — Mayoría especial sobre presentes, caracterización del MVP

Hasta resolver PA-001:

**Dado** factor `0.66`
**Y** una votación que cierra con 9 votos emitidos
**Y** 6 son Positivos
**Entonces** la caracterización del MVP evalúa `6/9 >= 0.66`.

El test debe dejar explícito que el denominador observado es `votos_emitidos`.

## CA-VOT-12 — Autocierre por último voto

**Dado** 7 presentes y 6 de ellos ya votaron
**Cuando** vota el séptimo
**Entonces** la votación deja de estar `EN_CURSO` automáticamente y calcula resultado.

## CA-VOT-13 — Autocierre por ausencia

**Dado** 8 presentes
**Y** 7 ya votaron
**Y** el único presente sin votar pasa a ausente con tecla `9`
**Entonces** se cumple que todos los presentes actuales ya votaron y la votación se cierra automáticamente.

## CA-VOT-14 — Voto previo no se borra al ausentarse

**Dado** un concejal que ya votó
**Cuando** pasa a ausente
**Entonces** su voto sigue formando parte de la votación.

## CA-VOT-15 — Cierre forzado incompleto

**Dado** 8 presentes, quórum 7 y solo 5 votos emitidos
**Cuando** Moderación fuerza el cierre
**Entonces** el resultado termina `INCONCLUSA` porque faltaron presentes por votar y los votos emitidos son inferiores al quórum.

## CA-VOT-16 — Cierre con cero votos

**Dado** una votación en curso sin votos
**Cuando** se fuerza el cierre
**Entonces** Botonera2 no debe producir una excepción técnica. El resultado funcional definitivo depende de PA-013; la caracterización esperada es `INCONCLUSA`.

## CA-PAL-01 — Encolar pedido

**Dado** un concejal presente fuera de la cola
**Cuando** presiona `7`
**Entonces** se agrega al final.

## CA-PAL-02 — Retirar pedido

**Dado** un concejal ya en cola
**Cuando** presiona `7`
**Entonces** sale de la cola.

## CA-PAL-03 — Orden FIFO

**Dado** que A pide palabra antes que B
**Cuando** Moderación otorga palabra
**Entonces** A pasa a ser orador y B queda primero en cola.

## CA-PAL-04 — El orador finaliza con tecla 7

**Dado** que A es orador
**Cuando** A presiona `7`
**Entonces** deja de ser orador y no se agrega a la cola.

## CA-PAL-05 — Quitar palabra desde Moderación

**Dado** un orador actual
**Cuando** Moderación ejecuta Quitar palabra
**Entonces** deja de existir orador actual.

## CA-TST-01 — Test visual

**Dado** sesión activa y dispositivo reconocido
**Cuando** se envía tecla `8`
**Entonces** solo la banca asociada muestra el indicador temporal de test y no cambia presencia, voto ni palabra.

## CA-OD-01 — Archivo válido

**Dado** un archivo con cabecera:

`nro_votacion;tipo;tema;factor_de_mayoria;respecto`

**Y** filas válidas
**Cuando** se carga
**Entonces** se muestran todas las filas.

## CA-OD-02 — Rechazo atómico

**Dado** un archivo donde una fila es inválida
**Cuando** se carga
**Entonces** no queda ninguna fila cargada.

## CA-OD-03 — Tipo desconocido

**Dado** una fila válida cuyo tipo no coincide con el catálogo
**Entonces** el tipo resultante es `Otro`.

## CA-OD-04 — Selección no abre votación

**Dado** una fila seleccionada
**Entonces** sus datos aparecen en el formulario
**Y** el backend no crea votación hasta la acción explícita Abrir votación.

## CA-REC-01 — Disposición de 12 bancas

Con la configuración histórica 3+4+5:

- fila 1 inferior: bancas 1–3;
- fila 2: bancas 4–7;
- fila 3 superior: bancas 8–12;
- dentro de cada fila la numeración va izquierda → derecha.

## CA-REC-02 — Disposición inconsistente

**Dado** que la suma de posiciones no coincide con concejales
**Entonces** el frontend muestra error controlado en el recinto y no asigna personas a posiciones arbitrarias.

## CA-PUB-01 — Voto secreto mientras está en curso

**Dado** una votación `EN_CURSO`
**Y** votos ya registrados
**Entonces** Pantalla de Recinto no muestra identidad/valor de esos votos.

Idealmente la respuesta de backend para esa superficie tampoco los contiene.

## CA-PUB-02 — Eventos no filtran el secreto

Durante `EN_CURSO`, la Pantalla pública no muestra eventos que permitan inferir qué concejal votó qué valor.

## CA-PUB-03 — Revelación al cierre

**Dado** que una votación acaba de finalizar
**Entonces** Pantalla de Recinto muestra temporalmente cada voto por banca y el resultado.

Como referencia de caracterización, la ventana observada es aproximadamente 6 s.

## CA-PUB-04 — Limpieza posterior

Pasada la ventana de resultado, las bancas vuelven a no mostrar el voto anterior.

## CA-PUB-05 — Cuenta regresiva

Al comenzar una nueva votación la Pantalla pública muestra una cuenta regresiva visual de 4 s sin bloquear la recepción de votos en backend.

## CA-CON-01 — Recarga de frontend

**Dado** una sesión y votación en curso
**Cuando** se recarga uno de los frontends
**Entonces** reconstruye su vista desde backend y no modifica la sesión.

## CA-CON-02 — Frontends independientes

Cerrar o reiniciar Pantalla de Recinto no afecta Moderación ni backend, y viceversa.

## CA-CON-03 — Reconexión

Tras una pérdida temporal de conexión, la UI debe volver a un estado consistente a partir del backend sin requerir reconstrucción manual de los votos/cola/presencia.

## CA-CONC-01 — Doble pulsación concurrente

Dos requests casi simultáneos del mismo concejal para votar deben producir como máximo un voto válido.

## CA-CONC-02 — Doble apertura concurrente

Dos requests casi simultáneos para abrir sesión o votación deben preservar la invariante de una sola activa.

## Criterio de liberación funcional

Una versión candidata no se considera equivalente al sistema vigente hasta que:

1. todos los escenarios no marcados como dependientes de preguntas abiertas pasen;
2. las preguntas abiertas que afecten esa versión estén resueltas;
3. se haya ejecutado un recorrido end-to-end con teclados reales o un emulador que use exactamente el contrato `/entradas/tecla`;
4. se haya verificado Moderación y Pantalla de Recinto simultáneamente;
5. se haya probado cierre automático, forzado, empate y pérdida/reconexión de interfaz.
