# 09 - Fuentes y trazabilidad

## 1. Jerarquía de autoridad

Para Botonera2:

1. documentación vigente de este repositorio;
2. decisiones explícitas incorporadas posteriormente a esta documentación;
3. código histórico de `martinebene/Botonera/main` solo para validar comportamiento previo cuando una regla no esté definida aquí;
4. documentación histórica y rama `v2` como contexto no normativo.

Una vez que una regla fue resuelta y documentada en Botonera2, no debe reabrirse por encontrar un comportamiento distinto en el sistema anterior.

## 2. Snapshot histórico principal

Repositorio: `martinebene/Botonera`

Rama: `main`

Commit usado en el relevamiento inicial:

`537823b4a0045853c74a388058fa3739cf7457a5`

Rama secundaria analizada como contexto:

`v2`

Snapshot observado:

`9330812aaed93bc79e5043d3d34061c6aa19a7a0`

`v2` no fue validada en producción y no define reglas de Botonera2.

## 3. Mapa de fuentes históricas relevantes

### Sesión

- `app/services/sesion_service.py`
- `app/models/sesion.py`

Aportó comportamiento de una sesión en memoria, apertura/cierre, palabra y quórum.

### Votación

- `app/models/votacion.py`
- `app/services/votacion_service.py`
- `app/models/voto.py`

Aportó estados históricos, autocierre, voto único, cierre forzado y desempate.

### Entradas físicas

- `app/services/input_service.py`
- `app/api/routes/entradas.py`
- `devices_services/teclados_fisicos/input_devices_service.py`

Aportó mapa real de teclas y contrato físico actual.

### Moderación

- `app/api/routes/moderacion.py`
- `app/web/static/moderacion/`

Aportó operaciones y organización visual histórica.

### Pantalla pública

- `app/web/static/pantalla/`

Aportó política histórica de secreto de votos, disposición de bancas y temporizadores visuales.

### Configuración y padrón

- `config.json`
- `app/services/concejal_service.py`
- `data/concejales.csv`

Aportó esquema y valores de la instalación vigente.

### Logging

- `app/utils/logging.py`

Aportó la semántica de tres niveles acumulativos y escritura inmediata.

## 4. Contradicciones históricas ya resueltas

### Mapa de teclas

Documentos antiguos diferían del código. Botonera2 adopta el código vigente:

- 1 positivo;
- 2 abstención;
- 3 negativo;
- 7 palabra;
- 8 test;
- 9 presencia.

### Orden del Día

La implementación real usa `;` y el Orden del Día es solo asistencia. Botonera2 no adopta validaciones institucionales de su contenido.

### Presencia previa a sesión

`main` rechazaba toda interacción sin sesión abierta. Botonera2 adopta explícitamente `PREPARANDO`, donde presencia y test están habilitados antes de la apertura formal.

### Mayoría simple

La implementación histórica representaba mayoría simple mediante factor especial `0`. Botonera2 lo reemplaza por tipo explícito `SIMPLE` y lo separa de cualquier factor numérico.

### Presidencia

El sistema anterior resolvía desempate desde Moderación sin modelar plenamente autoridades. Botonera2 define Presidencia como rol institucional independiente del rol Concejal y registra explícitamente su voto de desempate.

### Logs

La versión histórica escribe `.txt` por día. Botonera2 conserva los tres niveles acumulativos pero adopta tres CSV por preparación/sesión, nombrados con fecha y hora de inicio.

### Estado ante reinicio

Botonera2 confirma deliberadamente estado solo en memoria y prohíbe recuperación automática de sesión/preparación.

## 5. Comportamientos históricos descartados como bugs o insuficiencias

No deben copiarse como requisitos:

- permitir abrir otra votación mientras una anterior permanece `EMPATADA`;
- dejar una votación empatada colgante al cerrar sesión;
- posible división por cero al cerrar mayoría especial sin votos;
- serializaciones o IDs internos propios del modelo viejo;
- acoplamiento de estado a singleton/clases concretas como decisión arquitectónica obligatoria;
- exposición de votos al frontend público y ocultamiento solo del lado cliente;
- archivos de log compartidos por todas las sesiones de un mismo día.

Las reglas correctas están en `01-reglas-de-negocio.md`.

## 6. Assets autorizados

Las imágenes históricas de bancas pueden copiarse desde:

`martinebene/Botonera/main/app/web/static/bancas/`

Su reutilización no habilita a copiar la implementación frontend histórica.

## 7. Compatibilidad externa relevante

El bridge físico actual usa conceptualmente:

`POST /entradas/tecla`

con `dispositivo` y `tecla`.

Esta integración sí debe considerarse al diseñar Botonera2 para evitar una migración física innecesaria, salvo decisión técnica explícita.

## 8. Regla para futuros agentes

No navegar indiscriminadamente el repositorio histórico.

Si una tarea requiere consultar una fuente anterior:

1. identificar la regla/asset concreto;
2. consultar únicamente los archivos necesarios;
3. documentar por qué se consultó;
4. no sustituir una regla ya definida en Botonera2.

## 9. Trazabilidad futura

Al comenzar la implementación, cada unidad funcional debe poder relacionarse con:

- regla `RN-*`;
- caso de uso `CU-*`;
- criterio de aceptación correspondiente;
- pruebas automáticas relevantes.

Las decisiones técnicas que se adopten antes de programar deberán registrarse en documentación propia y dejar de figurar como preguntas abiertas.