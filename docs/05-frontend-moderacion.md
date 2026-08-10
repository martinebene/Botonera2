# 05 - Frontend de Moderación

Frontend **Nuxt 4 + TypeScript estricto**, con Tailwind CSS v4 y componentes propios, destinado al operador único del sistema. No contiene reglas de negocio: representa estado y envía comandos al backend.

El estado autoritativo vive en FastAPI. La primera versión no usa Pinia: la proyección recibida y el estado visual local se manejan con composables/primitives de Vue/Nuxt.

## 1. Sincronización

- snapshot completo por REST al cargar/reconectar;
- actualizaciones por SSE;
- comandos por REST `/api/v1`;
- cliente común en `packages/api-client/`;
- ante reconexión SSE se recupera snapshot antes de asumir continuidad.

La UI no reconstruye reglas de negocio localmente.

## 2. Estados globales

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
- ejecutar el remapeo rápido cuando se implemente.

## 3. Organización funcional

Se conserva como referencia útil la división vigente en cuatro áreas, sin obligar a copiar su HTML/CSS:

1. comandos y estado de sesión/votación;
2. Orden del Día;
3. recinto/bancas + uso de palabra;
4. eventos.

La implementación Nuxt puede reorganizar visualmente estas áreas si mejora la operación sin perder información ni simultaneidad.

## 4. Preparación

El operador no puede marcar presencia manualmente.

Cada banca debe reflejar:

- identidad del concejal;
- imagen indicada por `ruta_imagen` en el padrón, sin hardcodear una imagen por número de banca;
- presente/ausente;
- test visual temporal;
- dispositivo lógico cuando resulte útil para diagnóstico.

Debe ser evidente si falta quórum y cuántos concejales faltan.

## 5. Autoridades

Presidencia y Secretaría son texto libre.

Pueden modificarse durante preparación o sesión, incluso durante una votación.

La interfaz no intenta decidir si el texto de Presidencia coincide con un concejal ni modifica su estado.

## 6. Apertura de sesión

El botón solo debe ser funcional cuando el backend confirme:

- quórum;
- número de sesión informado;
- Presidencia informada;
- Secretaría informada.

La interfaz puede explicar qué condición falta, pero la validación definitiva es del backend.

## 7. Orden del Día

Debe permitir:

- cargar CSV y enviarlo al backend para parseo;
- informar errores técnicos de lectura/formato;
- listar puntos devueltos;
- seleccionar un punto para precargar el formulario;
- editar todos los campos precargados antes de abrir;
- crear una votación manual;
- seleccionar puntos en cualquier orden.

No debe advertir por números repetidos, secuencia u otras cuestiones institucionales que Botonera2 no valida.

## 8. Formulario de votación

Campos conceptuales:

- número;
- tipo configurable;
- tema;
- tipo de mayoría `SIMPLE` o `ESPECIAL`;
- si es especial: factor;
- si es especial: base `PRESENTES` o `CUERPO`.

La UI debe dejar claro que mayoría simple no equivale a factor 0,5.

Una vez abierta, los datos son inmutables.

## 9. Votación en curso

Debe mostrar:

- tema/tipo/número;
- regla de mayoría;
- presencia y quórum actual;
- cantidad de votos recibidos;
- votos individuales después del retardo configurable de Moderación;
- palabra/orador en paralelo.

No existe pausa. Los concejales pueden pedir/usarla palabra mientras continúan llegando votos.

## 10. Finalizar votación

Existe una sola acción conceptual `Finalizar votación`.

Puede usarse en cualquier momento de `EN_CURSO` y exige motivo no vacío.

El backend decide el resultado, normalmente `INCONCLUSA` si se finaliza antes de completar.

La interfaz no ofrece edición de votos ni modificación de una votación abierta.

## 11. Empate y Presidencia

Cuando una mayoría simple queda `EMPATADA`:

- se bloquea abrir otra votación;
- Moderación muestra controles `POSITIVO` / `NEGATIVO`;
- no hay abstención;
- muestra quién figura como Presidencia;
- el desempate es irreversible.

Si se cierra la sesión sin desempatar, el backend convierte la votación a `INCONCLUSA`.

## 12. Uso de la palabra

Debe mostrar:

- orador actual;
- cola FIFO;
- controles para otorgar y quitar palabra.

Otorgar con alguien hablando reemplaza automáticamente al orador actual por el siguiente de la cola.

Los cambios de presencia pueden quitar automáticamente concejales de la cola o del uso actual.

## 13. Eventos

Debe mostrar una proyección legible de eventos recientes, independiente de los CSV completos.

El crecimiento del listado usa scroll interno y **no aumenta la altura de las demás áreas**.

## 14. Remapeo rápido

La operación futura se inicia desde Moderación pero se ejecuta técnicamente a través de backend + `device-bridge`.

Flujo conceptual:

1. identificar la banca/concejal afectado y su identificador lógico actual;
2. iniciar modo de reemplazo;
3. el bridge detecta/captura el nuevo teclado físico;
4. reasigna el nuevo fingerprint al **mismo identificador lógico**;
5. confirmar visualmente el éxito.

No cambia concejal, presencia, votos ni padrón y no conecta el navegador directamente con el bridge.

## 15. Responsive y hardware

Resolución de referencia actual: **1920×1080 (Full HD)**.

No es una dependencia rígida. La interfaz debe:

- conservar funcionalidad ante resoluciones menores razonables y cambios de escala;
- evitar solapamientos y controles inaccesibles;
- usar layouts fluidos/grid/flex y límites mínimos/máximos apropiados;
- usar scroll interno en áreas extensas;
- mantener información crítica visible y legible.

No se aceptan soluciones que solo funcionen correctamente con coordenadas/tamaños fijos para Full HD.

## 16. Reconexión

Al recargar o recuperar conexión debe reconstruir toda la interfaz desde `ModerationState` del backend.

No depende de variables locales para determinar sesión/votación activa.

## 17. Errores

Los errores funcionales se presentan con mensajes claros basados en identificadores estables del backend.

No se oculta un rechazo ni se simula localmente que una acción tuvo éxito.

Si el backend informa que la auditoría obligatoria no puede persistirse, debe mostrarse como condición técnica grave y bloquear visualmente nuevas acciones que el backend no acepte.