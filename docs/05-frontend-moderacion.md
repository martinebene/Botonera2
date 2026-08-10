# 05 - Frontend de Moderación

Frontend Nuxt.js para el operador único del sistema. No contiene reglas de negocio: representa estado y envía comandos al backend.

## 1. Estados globales

### SIN_PREPARAR
Debe ofrecer como acción principal `Preparar sala`.

No debe mostrar controles de votación, palabra o presencia manual.

### PREPARANDO
Debe permitir:

- ver padrón y disposición de bancas;
- cargar/editar número de sesión;
- cargar/editar Presidencia;
- cargar/editar Secretaría Legislativa;
- observar acreditaciones físicas;
- observar test de dispositivos;
- ver quórum y faltantes;
- cargar Orden del Día opcional;
- abrir sesión cuando backend lo habilite;
- cancelar preparación.

### SESION_ABIERTA
Debe permitir:

- ver y cambiar Presidencia/Secretaría;
- ver presencia y quórum;
- operar votaciones;
- operar uso de palabra;
- utilizar Orden del Día como asistencia;
- ver eventos;
- cerrar sesión;
- en el futuro, remapear dispositivos.

## 2. Organización funcional

Se conserva como referencia útil la división de la interfaz vigente en cuatro áreas, sin obligar a copiar su HTML/CSS:

1. comandos y estado de sesión/votación;
2. Orden del Día;
3. recinto/bancas + uso de palabra;
4. eventos.

La implementación Nuxt puede reorganizar visualmente estas áreas si mejora la operación sin perder información ni simultaneidad.

## 3. Preparación

El operador no puede marcar presencia manualmente.

Cada banca debe reflejar:

- presente/ausente;
- test visual temporal;
- dispositivo lógico cuando resulte útil para diagnóstico.

Debe ser evidente si falta quórum y cuántos concejales faltan.

## 4. Autoridades

Presidencia y Secretaría son texto libre.

Pueden modificarse durante preparación o sesión, incluso durante una votación.

La interfaz no debe intentar decidir si el texto de Presidencia coincide con un concejal ni modificar el estado de ese concejal.

## 5. Apertura de sesión

El botón solo debe ser funcional cuando el backend confirme:

- quórum;
- número de sesión informado;
- Presidencia informada;
- Secretaría informada.

La interfaz puede explicar qué condición falta, pero la validación definitiva es del backend.

## 6. Orden del Día

Debe permitir:

- cargar CSV;
- informar errores técnicos de lectura/formato;
- listar puntos cargados;
- seleccionar un punto para precargar el formulario;
- editar todos los campos precargados antes de abrir;
- crear una votación manual sin usar el listado;
- seleccionar puntos en cualquier orden.

No debe presentar advertencias por números repetidos, secuencia u otras cuestiones institucionales que Botonera2 no valida.

## 7. Formulario de votación

Campos conceptuales:

- número;
- tipo configurable;
- tema;
- tipo de mayoría `SIMPLE` o `ESPECIAL`;
- si es especial: factor;
- si es especial: base `PRESENTES` o `CUERPO`.

La UI debe dejar visualmente claro que mayoría simple no equivale a factor 0,5.

Una vez abierta, los datos se muestran como inmutables.

## 8. Votación en curso

Debe mostrar:

- tema/tipo/número;
- regla de mayoría;
- presencia y quórum actual;
- cantidad de votos recibidos;
- votos individuales después del retardo configurable de Moderación;
- palabra/orador en paralelo.

No existe pausa. Los concejales pueden pedir/usarla palabra mientras continúan llegando votos.

## 9. Finalizar votación

Existe una sola acción conceptual `Finalizar votación`.

Puede usarse en cualquier momento de `EN_CURSO` y debe exigir un motivo no vacío.

El backend decide el resultado, normalmente `INCONCLUSA` si se finaliza antes de completar.

La interfaz no ofrece edición de votos ni modificación de una votación abierta.

## 10. Empate y Presidencia

Cuando una mayoría simple queda `EMPATADA`:

- se bloquea abrir otra votación;
- Moderación debe mostrar controles de desempate `POSITIVO` / `NEGATIVO`;
- no hay abstención;
- debe mostrar claramente quién figura actualmente como Presidencia;
- una vez enviado, el desempate es irreversible.

Si se cierra la sesión sin desempatar, el backend convertirá la votación a `INCONCLUSA`.

## 11. Uso de la palabra

Debe mostrar:

- orador actual;
- cola FIFO;
- controles para otorgar y quitar palabra.

Otorgar con alguien hablando reemplaza automáticamente al orador actual por el siguiente de la cola.

Los cambios de presencia pueden quitar automáticamente concejales de la cola o del uso actual.

## 12. Eventos

Debe mostrar una proyección legible de eventos recientes, independiente de los archivos CSV completos.

El crecimiento del listado debe usar scroll interno y **no aumentar la altura de los demás cuadrantes/áreas de la interfaz**.

## 13. Reconexión

Al recargar o recuperar conexión debe reconstruir toda la interfaz desde el estado actual del backend.

No debe depender de variables locales para saber si existe sesión/votación activa.

## 14. Errores

Los errores funcionales deben presentarse con mensajes claros, basados en identificadores estables del backend.

No se debe ocultar un rechazo de comando ni simular localmente que una acción tuvo éxito.

## 15. Remapeo rápido pendiente

La arquitectura visual debe reservar la posibilidad de una operación rápida de reemplazo de dispositivo:

- elegir concejal;
- asociar nuevo dispositivo lógico;
- confirmar;
- mostrar que el cambio es temporal/en memoria;
- no alterar presencia ni votos.

El diseño definitivo se resolverá después.