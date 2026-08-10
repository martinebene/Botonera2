# 06 - Frontend Pantalla del Recinto

Frontend público de solo lectura construido con **Nuxt 4 + TypeScript estricto**, Tailwind CSS v4 y componentes propios.

El estado autoritativo vive en FastAPI. La primera versión no usa Pinia.

## 1. Principio de seguridad

La Pantalla del Recinto nunca puede modificar estado.

Durante una votación `EN_CURSO` no recibe ni muestra votos individuales ni eventos que permitan inferirlos. La restricción se aplica en la proyección `PublicState` del backend, no mediante ocultamiento visual.

## 2. Sincronización

- snapshot completo de `PublicState` por REST al cargar/reconectar;
- actualizaciones por SSE;
- cliente común en `packages/api-client/`;
- ante reconexión del stream se recupera snapshot antes de continuar.

No utiliza polling periódico como mecanismo normal.

## 3. SIN_PREPARAR

Debe mostrar un estado neutro/sin sesión y limpiar cualquier información transitoria de la ejecución anterior.

## 4. PREPARANDO

Puede mostrar información apropiada de preparación, por ejemplo:

- sala en preparación;
- bancas y acreditaciones;
- test visual de dispositivos;
- quórum actual cuando resulte conveniente.

No debe sugerir que la sesión está formalmente abierta.

## 5. SESION_ABIERTA

Debe representar al menos:

- número de sesión informado;
- Presidencia;
- Secretaría Legislativa cuando corresponda al diseño público;
- cantidad de presentes/quórum;
- disposición del recinto;
- orador y pedidos de palabra;
- estado de la votación activa;
- eventos públicos aptos.

## 6. Bancas

La disposición proviene de configuración.

Regla visual histórica a conservar salvo decisión de diseño posterior:

- banca 1 comienza abajo a la izquierda;
- numeración de izquierda a derecha;
- al completar una fila, continúa en la fila superior.

Estados visuales diferenciables:

- ausente;
- presente;
- test físico temporal;
- en uso de la palabra;
- voto individual únicamente después del cierre.

## 7. Votación EN_CURSO

Muestra información general de la votación pero no votos individuales.

Puede mostrar una cuenta regresiva/efecto inicial configurable. Valor inicial: 4 segundos.

No existe límite temporal reglamentario para votar. La votación puede continuar mientras existen pedidos/usos de palabra.

## 8. Cierre de votación

Cuando alcanza estado final:

- mostrar resultado;
- mostrar votos individuales;
- representar `INCONCLUSA` y `EMPATADA` inequívocamente;
- si hubo desempate, reflejar resultado final sin incorporar el voto presidencial como voto ordinario de banca.

El resultado permanece un tiempo configurable, inicialmente 6 segundos, y luego se limpia la información transitoria sin borrar el estado general de sesión.

## 9. Empate

Mientras una mayoría simple está `EMPATADA` esperando Presidencia, puede mostrar el empate sin inventar un resultado.

Al desempatar Presidencia, pasa a `APROBADA` o `RECHAZADA`.

## 10. Uso de la palabra

Debe mostrar claramente:

- concejal en uso;
- cola de solicitudes de forma adecuada para público.

La palabra puede coexistir con votación en curso.

## 11. Presencia y quórum

Los cambios de presencia deben reflejarse con baja latencia.

Si una votación termina `INCONCLUSA` por pérdida de quórum, debe mostrar ese estado final.

## 12. Eventos públicos

`PublicState`/stream público excluye detalles técnicos innecesarios y cualquier evento que revele un voto antes del cierre.

## 13. Responsive y hardware

Resolución de referencia actual: **1920×1080 Full HD**, preferentemente en composición 16:9.

No es un requisito rígido. La pantalla debe:

- adaptarse a cambios razonables de resolución, escala y relación de aspecto;
- mantener jerarquía y legibilidad de bancas, nombres, resultado, quórum y orador;
- evitar recortes/solapamientos que oculten información crítica;
- responder de forma controlada ante pantallas que no sean 16:9;
- evitar coordenadas/tamaños absolutos que hagan necesario reescribir la aplicación al cambiar hardware.

Las pruebas visuales/E2E deben incluir Full HD y al menos otra resolución representativa.

## 14. Reconexión y temporizadores

Tras recargar o reconectar, reconstruye la vista desde backend.

No reproduce temporizadores antiguos como si acabaran de ocurrir. Countdown y permanencia se derivan de timestamps/estado actual de forma consistente.

## 15. Solo lectura

No tendrá comandos de:

- presencia;
- votación;
- palabra;
- autoridades;
- sesión;
- configuración.

Cualquier API usada por esta aplicación respeta ese principio.
