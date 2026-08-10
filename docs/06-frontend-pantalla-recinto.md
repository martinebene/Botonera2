# 06 — Frontend Nuxt: Pantalla de Recinto

## 1. Propósito

Interfaz pública destinada a la proyección dentro del recinto. Es una aplicación **Nuxt.js** independiente de Moderación y no debe ejecutar comandos legislativos.

Su prioridad es mostrar de forma clara y segura:

- estado de sesión;
- quórum;
- votación;
- tema;
- resultado;
- disposición y estado de las bancas;
- pedidos de palabra;
- eventos principales permitidos.

## 2. Solo lectura

La Pantalla de Recinto no debe:

- abrir/cerrar sesiones;
- abrir/cerrar votaciones;
- resolver desempates;
- modificar presencia;
- otorgar/quitar palabra;
- alterar datos del backend.

## 3. Cabecera

Mientras existe sesión activa debe poder mostrar:

- institución;
- número de sesión;
- presentes / total;
- fecha/hora local;
- estado de conexión.

Sin sesión activa no debe inventar número ni participantes.

## 4. Resumen de votación

Debe representar:

- tipo;
- número;
- criterio de cómputo Presentes/Cuerpo;
- mayoría simple o factor especial;
- tema;
- estado;
- cantidad/conteos cuando corresponda.

Estados humanos mínimos:

- En curso;
- Aprobada;
- Rechazada;
- Empatada;
- Inconclusa.

## 5. Quórum

La implementación productiva muestra la diferencia:

`presentes - quorum`

Debe quedar claro visualmente si la sesión está por encima, exactamente en o por debajo del mínimo.

## 6. Plano del recinto

### Disposición

Se genera dinámicamente a partir de la configuración de filas/columnas y de los concejales.

### Numeración

- banca 1: abajo a la izquierda;
- continúa izquierda → derecha;
- al terminar una fila continúa en la fila superior;
- recorrido global: abajo → arriba.

### Integridad

Si la cantidad total de posiciones de la disposición no coincide con la cantidad de concejales, la zona del recinto debe mostrar un error controlado en lugar de asignar personas a bancas incorrectas.

## 7. Estado visual de banca

Cada banca debe poder representar:

### Ausente

El MVP reduce visualmente la presencia de la imagen/banca. Botonera2 puede usar una presentación equivalente siempre que la ausencia sea inequívoca.

### Orador actual

Debe destacarse claramente la banca del concejal que posee el uso de la palabra.

### Test visual

Al recibir el estado temporal activado por tecla `8`, la banca correspondiente debe mostrar una señal visible para verificar la asociación dispositivo ↔ banca.

### Voto

Solo cuando las reglas de secreto permiten mostrarlo:

- Positivo;
- Negativo;
- Abstención.

La codificación por color puede acompañar texto/iconografía, pero no debe ser la única forma de distinguir los valores.

## 8. Secreto del voto

### Durante `EN_CURSO`

La pantalla pública no debe mostrar votos individuales.

Requisito de arquitectura recomendado: la proyección de backend destinada a esta pantalla **no debe incluir esos votos** mientras estén secretos.

### Eventos durante `EN_CURSO`

No deben mostrarse eventos que revelen quién votó ni qué votó.

### Al cierre

El comportamiento productivo muestra los votos individuales por banca durante aproximadamente **6 segundos** y luego los limpia.

El resultado general también debe quedar visible durante una ventana suficiente para ser comprendido; la política exacta de persistencia del texto se valida con los criterios de aceptación.

## 9. Cuenta regresiva inicial

Al detectar una nueva votación `EN_CURSO`, el MVP muestra una cuenta regresiva de **4 segundos**.

Esta cuenta regresiva es visual: no impide que el backend acepte votos desde la apertura.

Durante esos cuatro segundos, los votos siguen secretos de todos modos.

## 10. Pedidos de palabra

Mostrar la cola FIFO.

La pantalla productiva utiliza una versión abreviada del nombre (`Apellido N.`). Botonera2 puede conservar ese formato o uno equivalente que resulte legible en proyección.

El orador actual se identifica en el plano de bancas; la cola contiene los pedidos pendientes.

## 11. Eventos

La pantalla puede mostrar una consola o banda de eventos operativos.

Requisitos:

- filtro de nivel cuando se mantenga esa funcionalidad;
- scroll interno;
- no deformar la distribución global;
- no revelar votos durante votación en curso;
- deduplicar eventos recibidos.

## 12. Actualización y desconexión

La pantalla debe:

- actualizarse en tiempo casi real;
- indicar conexión/desconexión;
- mantener una última vista coherente ante una caída breve si así se decide en UI;
- reconstruirse desde backend al reconectar;
- no afectar el desarrollo de la sesión si se recarga o se cierra el navegador.

## 13. Independencia de Moderación

La Pantalla de Recinto no consume estado local de la aplicación Nuxt de Moderación. Ambas deben obtener la información desde el backend.

Reiniciar uno de los frontends no puede afectar al otro ni a la sesión.

## 14. Requisitos de legibilidad

Por tratarse de una pantalla proyectada:

- la información principal debe ser legible a distancia;
- evitar scroll global;
- preservar jerarquía clara entre tema, estado, quórum, recinto y palabra;
- diseñar estados de error que no sustituyan toda la pantalla si el problema está localizado;
- soportar la resolución/aspect ratio real del recinto, a definir durante implementación.
