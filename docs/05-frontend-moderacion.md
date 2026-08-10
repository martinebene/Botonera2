# 05 — Frontend Nuxt: Moderación

## 1. Propósito

Interfaz operativa utilizada por quien conduce o asiste la sesión. Debe permitir comandar el sistema y comprender su estado sin acceder a herramientas técnicas del backend.

La implementación será una aplicación **Nuxt.js** independiente de la Pantalla de Recinto.

## 2. Responsabilidades

Moderación debe permitir:

- abrir y cerrar sesión;
- visualizar presentes, total y diferencia respecto del quórum;
- configurar y abrir una votación;
- cerrar una votación forzadamente;
- visualizar su estado y resultado;
- resolver un empate;
- cargar y seleccionar filas del Orden del Día;
- observar el plano del recinto y presencia;
- observar la cola de uso de la palabra;
- otorgar y quitar palabra;
- observar eventos filtrados por nivel;
- conocer el estado de conexión con el backend.

## 3. Organización funcional observada

El frontend productivo está organizado en cuatro áreas. Botonera2 debe conservar estas agrupaciones funcionales; el diseño visual puede evolucionar sin perder claridad operativa.

### Área 1 — Comandos

Contiene:

- número de sesión;
- Abrir sesión;
- Cerrar sesión;
- presentes / total;
- diferencia respecto del quórum;
- número de votación;
- tipo;
- factor de mayoría;
- criterio Presentes/Cuerpo;
- tema;
- Abrir votación;
- Cerrar votación;
- resumen de estado;
- acciones de desempate cuando corresponde.

### Área 2 — Orden del Día

Contiene:

- Cargar CSV;
- Limpiar;
- información de archivo/cantidad de filas;
- tabla de número, tipo, tema, factor y respecto;
- selección de fila para copiar datos al formulario de votación.

El archivo se procesa localmente en el navegador; seleccionar una fila no ejecuta una acción en el backend.

### Área 3 — Estado del recinto

Contiene:

- disposición gráfica de bancas;
- presencia/ausencia;
- test visual;
- indicación del orador;
- indicación de votos según la política de visibilidad definida para Moderación;
- cola de pedidos de palabra;
- botones Otorgar palabra / Quitar palabra.

### Área 4 — Eventos

Contiene consola o lista de eventos y selector de nivel:

- Principales → equivalente a L3;
- Intermedios → L2 y L3;
- Sistema → L1, L2 y L3.

Debe conservar scroll interno; el crecimiento del historial no debe deformar el resto de la pantalla.

## 4. Estados de la interfaz

### Sin sesión

- formulario de número de sesión editable;
- acción Abrir sesión disponible;
- datos de recinto/votación sin estado activo;
- no mostrar una sesión ficticia.

### Sesión abierta, sin votación

- número de sesión fijado al estado backend;
- presencia y quórum visibles;
- formulario de votación editable;
- acciones de palabra disponibles;
- recinto actualizado.

### Votación EN_CURSO

- parámetros de la votación actual deben reflejar el backend y no permitir editarse como si fueran otra votación;
- mostrar cantidad de votos emitidos;
- Cerrar votación disponible;
- no ofrecer apertura de otra votación activa;
- presencia y palabra siguen representándose según las reglas de negocio.

### Votación EMPATADA

- mostrar claramente que requiere desempate;
- ofrecer únicamente las decisiones de desempate pertinentes: Positivo / Negativo;
- no presentar el empate como resultado final normal.

### Votación finalizada

- mostrar resultado y conteos durante un tiempo suficiente para operación;
- luego permitir preparar la siguiente votación;
- no borrar del backend la votación histórica por limpiar el formulario.

### Sin conexión

- indicar explícitamente pérdida de conexión;
- no inventar cambios de estado;
- al reconectar, reconstruir desde el backend.

## 5. Quórum

La interfaz productiva muestra la **diferencia**:

`presentes - quorum`

Ejemplos:

- `+2`: dos presentes por encima del mínimo;
- `0`: quórum exacto;
- `-1`: falta un concejal.

Debe distinguir visualmente si hay o no quórum, sin que el color sea la única señal.

## 6. Formulario de votación

Campos mínimos:

- número;
- tipo;
- tema;
- factor de mayoría;
- Presentes/Cuerpo.

### Factor

- vacío puede tratarse en UI como mayoría simple y enviarse al backend como `0`;
- el backend realiza la validación autoritativa;
- la UI puede normalizar entrada decimal para conveniencia, pero no debe alterar silenciosamente el valor con una semántica diferente.

## 7. Orden del Día

La UI debe implementar las reglas `RN-OD-*`.

Requisitos importantes:

- carga local;
- rechazo atómico del archivo inválido;
- selección visible de fila;
- copia de valores sin apertura automática;
- tipo no reconocido → `Otro` según comportamiento vigente;
- factor vacío/0 → mayoría simple.

## 8. Recinto en Moderación

Debe usar la disposición definida por backend/configuración.

Numeración:

- banca 1 abajo-izquierda;
- izquierda → derecha;
- continuar de abajo → arriba.

Validar que cantidad de posiciones coincida con cantidad de concejales. Si no coincide, mostrar error operativo en esa zona sin romper el resto de la interfaz.

## 9. Uso de la palabra

Mostrar cola en orden FIFO.

El orador actual debe ser distinguible en el plano del recinto y no aparecer simultáneamente en la cola.

Los controles de otorgar/quitar son comandos al backend; la UI no debe manipular la cola localmente como autoridad.

## 10. Eventos

La interfaz puede acumular localmente eventos ya recibidos para facilitar visualización, pero debe deduplicarlos mediante un identificador/secuencia.

El backend debe ser la fuente de los eventos.

## 11. Estado local permitido

Puede existir estado puramente de interfaz, por ejemplo:

- archivo de Orden del Día cargado;
- fila seleccionada;
- filtro de eventos;
- apertura/cierre de paneles;
- notificaciones visuales.

No debe existir como autoridad local:

- sesión;
- presencia;
- votación;
- votos;
- resultado;
- cola de palabra;
- orador.

## 12. Requisitos de robustez

- ninguna lista debe aumentar la altura global de la pantalla indefinidamente;
- usar scroll interno donde corresponda;
- una respuesta lenta no debe iniciar múltiples bucles duplicados de actualización;
- los botones deben prevenir dobles envíos accidentales mientras una acción equivalente está pendiente;
- los errores de una sección no deben dejar inutilizable toda la interfaz;
- debe ser usable en la resolución del puesto de operación definida durante implementación.

## 13. Política de visualización de votos en Moderación

El MVP de `main` oculta inicialmente los votos unos 4 segundos y luego puede mostrarlos durante la votación. La Pantalla pública, en cambio, mantiene secreto hasta el cierre.

Esta diferencia queda **pendiente de confirmación** para Botonera2. No implementar una política nueva por inferencia; consultar `10-preguntas-abiertas.md`.
