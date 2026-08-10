# 03 — Casos de uso

Los casos de uso describen comportamiento observable. No fijan la estructura interna del código.

## CU-01 — Abrir sesión

**Actor:** Moderación.

**Precondiciones:**

- no existe otra sesión activa;
- la configuración necesaria está disponible;
- existe una nómina no vacía de concejales.

**Entrada:** número de sesión.

**Flujo:**

1. Moderación solicita apertura.
2. El backend carga los concejales y configuración de la sesión.
3. Crea la sesión activa.
4. Registra hora de inicio.
5. Publica el nuevo estado a las interfaces.
6. Registra evento de apertura.

**Resultado:** sesión activa con presencia inicial, quórum y bancas disponibles.

**Rechazos:** sesión ya activa, fuente de concejales inexistente o vacía, configuración inválida.

## CU-02 — Cerrar sesión

**Actor:** Moderación.

**Precondición:** existe sesión activa.

**Flujo:**

1. Moderación solicita cierre.
2. Si existe una votación `EN_CURSO`, se ejecuta su cierre forzado.
3. Se registra hora de cierre de la sesión.
4. La sesión deja de estar activa.
5. Se registra evento.
6. Los frontends pasan al estado sin sesión activa.

**Resultado:** no pueden procesarse nuevas acciones legislativas de teclado hasta una nueva sesión.

## CU-03 — Cambiar presencia

**Actor:** Concejal mediante teclado.

**Entrada externa:** dispositivo + tecla `9`.

**Precondiciones de `main`:**

- existe sesión activa;
- dispositivo asociado a un concejal.

**Flujo:**

1. El backend identifica al concejal.
2. Invierte presente/ausente.
3. Recalcula cantidad de presentes y quórum mostrado.
4. Si existe votación `EN_CURSO`, reevalúa su cierre automático.
5. Registra evento.

**Resultado:** todas las vistas reflejan la nueva presencia.

## CU-04 — Abrir votación

**Actor:** Moderación.

**Entradas:**

- número;
- tipo;
- tema;
- factor de mayoría;
- criterio `Presentes` o `Cuerpo`.

**Precondiciones:**

- sesión activa;
- quórum suficiente;
- sin otra votación activa según la política final.

**Flujo:**

1. Backend valida condiciones.
2. Crea votación `EN_CURSO`.
3. Registra hora de inicio.
4. La agrega al historial de la sesión.
5. Registra evento.
6. Pantallas pasan a modo votación.

**Resultado:** se aceptan votos ordinarios válidos.

## CU-05 — Emitir voto ordinario

**Actor:** Concejal mediante teclado.

**Entradas:**

- `1` → Positivo;
- `2` → Abstención;
- `3` → Negativo.

**Precondiciones:**

- sesión activa;
- votación `EN_CURSO`;
- dispositivo reconocido;
- concejal presente;
- concejal aún no votó.

**Flujo:**

1. Se identifica concejal y valor.
2. Se valida elegibilidad.
3. Se registra voto y hora.
4. Se registra evento.
5. Se evalúa si todos los presentes ya votaron.
6. Si corresponde, se cierra automáticamente y calcula resultado.

**Rechazos:** sin sesión, sin votación, ausente, dispositivo desconocido, voto duplicado o tecla inválida.

## CU-06 — Cierre automático de votación

**Disparador:** último voto necesario o cambio de presencia.

**Precondición:** votación `EN_CURSO` y todos los presentes actuales incluidos entre quienes votaron.

**Flujo:**

1. Se cuentan votos.
2. Se calcula mayoría simple o especial.
3. Se aplica la regla de `INCONCLUSA` cuando corresponda.
4. Se fija hora de fin.
5. Si queda `EMPATADA`, permanece pendiente de desempate.
6. En otro resultado se considera finalizada.
7. Se registra evento de resultado.

## CU-07 — Cerrar votación forzadamente

**Actor:** Moderación.

**Precondiciones:** sesión activa y votación `EN_CURSO`.

**Flujo:**

1. Se identifican presentes sin voto.
2. Se calcula el resultado con los votos existentes.
3. Se aplica regla de `INCONCLUSA`.
4. Se fija hora de fin.
5. Se registra evento incluyendo presentes sin voto.

**Resultado:** la votación deja de recibir votos.

## CU-08 — Desempatar votación

**Actor:** Moderación.

**Precondición:** votación pendiente en estado `EMPATADA`.

**Entrada:** decisión Positiva o Negativa.

**Flujo:**

1. Backend valida que exista empate pendiente.
2. Registra la decisión de desempate separada de los votos ordinarios.
3. Positiva → `APROBADA`; Negativa → `RECHAZADA`.
4. Fija hora de finalización si corresponde.
5. Registra evento.

**Resultado:** votación finalizada.

## CU-09 — Solicitar o retirar uso de la palabra

**Actor:** Concejal mediante tecla `7`.

**Precondiciones:** sesión activa, dispositivo reconocido, concejal presente.

**Flujo si no es orador:**

- fuera de cola → se agrega al final;
- dentro de cola → se retira.

**Flujo si es orador:** finaliza su propio uso de la palabra.

**Resultado:** vistas actualizadas y evento registrado.

## CU-10 — Otorgar palabra

**Actor:** Moderación.

**Precondición:** sesión activa.

**Flujo normal:**

1. Toma el primer concejal de la cola.
2. Lo elimina de la cola.
3. Lo establece como orador actual.
4. Actualiza visualización de la banca.
5. Registra evento.

**Cola vacía:** no se asigna orador y se registra el intento.

## CU-11 — Quitar palabra

**Actor:** Moderación.

**Precondición:** sesión activa.

**Flujo:** si existe orador actual, deja de serlo y se registra evento. Si no existe, no cambia estado.

## CU-12 — Activar test visual de banca

**Actor:** Concejal/técnico mediante tecla `8`.

**Precondiciones de `main`:** sesión activa y dispositivo reconocido.

**Flujo:**

1. Se activa temporalmente un indicador visual de la banca correspondiente.
2. El estado se publica a las pantallas.
3. El indicador se desactiva automáticamente.

**Duración observada en backend:** aproximadamente 0,6 s.

El test no modifica presencia, palabra ni votaciones.

## CU-13 — Cargar Orden del Día

**Actor:** Moderación.

**Entrada:** archivo CSV local.

**Flujo:**

1. El frontend lee el archivo localmente.
2. Valida cabecera, cinco columnas y contenido.
3. Si todo es válido, muestra las filas.
4. Si cualquier fila es inválida, rechaza toda la carga y vacía la tabla.

**Resultado:** datos disponibles solo en el frontend hasta seleccionar una fila.

## CU-14 — Seleccionar ítem del Orden del Día

**Actor:** Moderación.

**Precondición:** Orden del Día válido cargado.

**Flujo:**

1. Operador selecciona una fila.
2. Se copian número, tipo, tema, factor y criterio al formulario de votación.
3. El operador puede revisar los datos.
4. La votación solo se crea cuando ejecuta “Abrir votación”.

## CU-15 — Consultar estado operativo

**Actor:** ambos frontends.

El backend debe permitir obtener una proyección coherente del estado actual que incluya lo necesario para representar:

- existencia y datos de sesión;
- concejales y presencia;
- quórum;
- disposición de bancas;
- votación actual/última e historial necesario;
- votos cuando la superficie esté autorizada a recibirlos;
- cola y orador;
- eventos permitidos.

Botonera2 no debe depender necesariamente del gran JSON exacto de `/estados/estado_global` del MVP.

## CU-16 — Pantalla pública durante votación

**Actor:** Pantalla de Recinto.

**Flujo:**

1. Detecta una votación `EN_CURSO`.
2. Muestra datos generales de la votación.
3. Mantiene ocultos los votos individuales.
4. Evita mostrar eventos que revelen votos.
5. Puede mostrar la cuenta regresiva inicial de presentación.
6. Al cierre muestra resultado y votos individuales por la ventana temporal definida.
7. Luego limpia la indicación de voto de cada banca.

## CU-17 — Pérdida temporal de conexión de frontend

**Actor:** Nuxt Moderación / Nuxt Pantalla.

**Comportamiento requerido:**

- la caída de un frontend no altera el backend;
- la interfaz indica pérdida de conexión;
- al reconectar reconstruye la vista desde el estado autoritativo del backend;
- no debe depender de conservar estado local crítico para reconstruir la sesión.
