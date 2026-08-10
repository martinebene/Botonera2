# 06 - Frontend Pantalla del Recinto

Frontend Nuxt.js público, de solo lectura, destinado a la visualización en el recinto.

## 1. Principio de seguridad

La Pantalla del Recinto nunca debe poder modificar estado.

Durante una votación `EN_CURSO` no debe recibir ni mostrar votos individuales ni eventos que permitan inferirlos. Esta restricción debe aplicarse desde el backend/proyección pública, no solo mediante ocultamiento visual.

## 2. SIN_PREPARAR

Debe mostrar un estado neutro/sin sesión y limpiar cualquier información transitoria de la ejecución anterior.

## 3. PREPARANDO

Puede mostrar información apropiada de preparación, por ejemplo:

- sala en preparación;
- bancas y acreditaciones;
- test visual de dispositivos;
- quórum actual cuando resulte conveniente.

No debe sugerir que la sesión está formalmente abierta.

## 4. SESION_ABIERTA

Debe representar al menos:

- número de sesión informado;
- Presidencia;
- Secretaría Legislativa cuando corresponda al diseño público;
- cantidad de presentes/quórum;
- disposición del recinto;
- orador y pedidos de palabra;
- estado de la votación activa;
- eventos públicos aptos.

## 5. Bancas

La disposición proviene de configuración.

Regla visual histórica a conservar salvo decisión de diseño posterior:

- banca 1 comienza abajo a la izquierda;
- numeración de izquierda a derecha;
- al completar una fila, continúa en la fila superior.

Estados visuales que deben poder diferenciarse:

- ausente;
- presente;
- test físico temporal;
- en uso de la palabra;
- voto individual únicamente después del cierre de la votación.

## 6. Votación EN_CURSO

Debe mostrar información general de la votación pero ocultar completamente los votos individuales.

Puede mostrar una cuenta regresiva/efecto inicial configurable. Valor inicial de referencia: 4 segundos.

No existe límite temporal reglamentario para que los concejales voten. Una votación puede continuar mientras se producen pedidos y usos de la palabra.

## 7. Cierre de votación

Cuando la votación alcanza estado final:

- mostrar resultado;
- mostrar votos individuales de concejales;
- representar `INCONCLUSA` y `EMPATADA` de forma inequívoca;
- si hubo desempate, el resultado final debe reflejarlo sin incorporar el voto presidencial como un voto ordinario de banca.

La presentación del resultado permanece por un tiempo configurable. Valor inicial de referencia: 6 segundos.

Luego se limpia la información transitoria de votación, sin borrar el estado general de sesión.

## 8. Empate

Mientras una votación simple está `EMPATADA` esperando Presidencia, la pantalla puede mostrar que existe empate, pero no debe inventar un resultado.

Cuando Presidencia desempata, pasa a mostrar `APROBADA` o `RECHAZADA`.

## 9. Uso de la palabra

Debe mostrar claramente:

- concejal actualmente en uso;
- cola de solicitudes de forma adecuada para el público.

La palabra puede coexistir con una votación en curso.

## 10. Presencia y quórum

Los cambios de presencia deben reflejarse con baja latencia.

Si una votación termina `INCONCLUSA` por pérdida de quórum, la pantalla debe mostrar el estado final correspondiente.

## 11. Eventos públicos

La proyección pública de eventos debe excluir detalles técnicos innecesarios y, sobre todo, cualquier evento que revele un voto antes del cierre.

## 12. Reconexión

Tras recargar o reconectar, debe reconstruir la vista exclusivamente desde el backend.

No debe reproducir temporizadores antiguos como si acabaran de ocurrir; los temporizadores deberán derivarse de timestamps/estado actual de manera consistente.

## 13. Solo lectura

El frontend público no tendrá comandos de:

- presencia;
- votación;
- palabra;
- autoridades;
- sesión;
- configuración.

Cualquier ruta/API pública utilizada por esta aplicación debe diseñarse bajo ese principio.