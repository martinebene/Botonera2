# 04 - Contratos e integraciones

Este documento define responsabilidades de integración y las decisiones técnicas ya cerradas para los contratos entre componentes.

## 1. Regla general

Toda transición de negocio se ejecuta en el backend FastAPI.

Los frontends y el bridge físico envían comandos/intenciones y reciben estado/proyecciones; no resuelven reglas localmente.

## 2. Bridge de dispositivos físicos

La implementación histórica envía pulsaciones al backend mediante:

`POST /entradas/tecla`

con cuerpo conceptual:

```json
{
  "dispositivo": "dev05",
  "tecla": "1"
}
```

Botonera2 debe preservar inicialmente una vía compatible o proveer una migración explícita para no bloquear el hardware existente.

### Responsabilidades del bridge

- detectar dispositivos físicos;
- normalizar teclas;
- resolver fingerprint físico -> identificador lógico;
- enviar pulsación al backend;
- en el futuro, facilitar remapeo operativo rápido.

### Responsabilidades que NO pertenecen al bridge

- presencia;
- quórum;
- validez de voto;
- cierre de votación;
- uso de palabra;
- resultado;
- registro institucional.

Todo ello pertenece al backend.

## 3. Semántica de pulsaciones

El backend interpreta:

- `1`: positivo;
- `2`: abstención;
- `3`: negativo;
- `7`: palabra;
- `8`: test;
- `9`: presencia.

La misma pulsación puede ser aceptada o rechazada según el estado global y el estado del concejal.

En `SIN_PREPARAR` ninguna pulsación tiene efecto funcional.

En `PREPARANDO` solo `8` y `9` tienen efecto funcional.

## 4. API nueva

La API interna de Botonera2 será REST y estará versionada bajo:

`/api/v1`

FastAPI + Pydantic definen los esquemas de entrada y salida. OpenAPI generado por FastAPI es la definición técnica canónica del contrato HTTP.

Los errores de dominio deben exponer identificadores estables legibles por máquina y no depender únicamente de textos humanos.

Los nombres exactos de cada recurso/ruta se fijarán al implementar el contrato concreto, respetando estas capacidades y sin copiar automáticamente las rutas históricas.

## 5. Respuesta conceptual de entrada física

El contrato debe permitir al bridge/diagnóstico distinguir al menos:

- aceptada/rechazada;
- motivo estable y legible por máquina;
- dispositivo;
- tecla;
- concejal cuando corresponda;
- resultado funcional relevante cuando corresponda.

## 6. Comandos de Moderación requeridos

El contrato backend debe ofrecer capacidades equivalentes a:

- preparar sala;
- cancelar preparación;
- actualizar número de sesión durante preparación;
- actualizar Presidencia;
- actualizar Secretaría Legislativa;
- abrir sesión;
- cerrar sesión;
- cargar/descartar Orden del Día;
- abrir votación;
- finalizar votación con motivo;
- emitir voto presidencial de desempate;
- otorgar palabra;
- quitar palabra;
- consultar estado;
- consultar eventos/proyección de registro;
- futuro remapeo rápido de dispositivo.

## 7. Proyección para Moderación

El backend generará un DTO/proyección específico **ModerationState**.

Debe exponer como mínimo:

- estado global;
- datos de preparación/sesión;
- Presidencia y Secretaría;
- concejales, bancas, presencia y test;
- cantidad de presentes, quórum y diferencia;
- votación activa y estado;
- votos individuales según la política temporal configurada;
- cola y orador;
- Orden del Día cargado;
- eventos aptos para Moderación;
- capacidades/comandos actualmente habilitados o información suficiente para representarlos sin duplicar reglas de negocio.

## 8. Proyección pública

El backend generará un DTO/proyección independiente **PublicState**.

Durante una votación `EN_CURSO`, `PublicState` no debe contener:

- votos individuales;
- eventos cuyo contenido revele votos;
- cualquier dato que permita inferirlos directamente.

El secreto temporal del voto se garantiza desde servidor. No se acepta entregar información secreta al navegador público para ocultarla luego mediante JavaScript o CSS.

## 9. Votaciones

El comando de apertura debe poder expresar explícitamente:

- número externo;
- tipo;
- tema;
- `tipo_mayoria = SIMPLE | ESPECIAL`;
- para especial: factor;
- para especial: base `PRESENTES | CUERPO`.

No usar `factor=0` o `factor=0.5` para inferir una mayoría simple.

Una vez abierta, la votación es inmutable.

## 10. Finalización manual

Debe ser un único comando conceptual `finalizar votacion` y requerir motivo no vacío.

No existe una operación reglamentaria separada de “cancelar” que produzca otro estado. Toda finalización anticipada no normal produce `INCONCLUSA`.

## 11. Desempate presidencial

Solo disponible para votación `SIMPLE` y `EMPATADA`.

Entrada conceptual:

- `POSITIVO` o `NEGATIVO`.

No recibe concejal ni modifica el listado de votos ordinarios.

La identidad de quien ocupa Presidencia surge del estado institucional actual y se registra junto con la decisión.

## 12. Orden del Día

La carga es una ayuda para Moderación.

El componente que la procese debe distinguir:

- error técnico de formato/lectura;
- datos interpretables.

No debe validar secuencia, unicidad o legitimidad institucional del contenido.

La ubicación técnica definitiva del parser permanece abierta en DT-013.

## 13. Sincronización frontend/backend

Se utilizará **REST + Server-Sent Events (SSE)**.

### REST

Se utiliza para:

- comandos de Moderación;
- pulsaciones del bridge;
- snapshot completo inicial;
- consultas puntuales.

### SSE

Se utiliza para notificar cambios de estado desde backend hacia Moderación y Recinto.

Flujo obligatorio de reconexión:

1. cargar/reconectar;
2. obtener snapshot completo por REST;
3. suscribirse al stream SSE correspondiente;
4. aplicar actualizaciones mientras la conexión permanezca válida;
5. ante duda de sincronización o reconexión, volver a obtener snapshot completo.

Moderación y Recinto deben consumir proyecciones separadas.

No se usará polling periódico como transporte normal de estado ni WebSocket salvo decisión técnica posterior que reemplace explícitamente DT-006.

## 14. Concurrencia

El backend debe imponer un orden determinista a comandos/pulsaciones concurrentes mediante un único mecanismo de serialización/exclusión sobre el estado activo.

El orden aceptado y persistido constituye el orden oficial del sistema.

El backend productivo se ejecutará con un único proceso/worker para garantizar que exista una sola copia del estado en memoria.

## 15. Registros CSV

Los frontends no escriben los CSV.

El backend debe persistir cada evento aceptado/relevante inmediatamente y controlar la apertura/cierre de los tres archivos asociados a una preparación.

La estructura exacta de columnas y mecanismo de escritura permanece abierta en DT-011/DT-012 sin alterar las reglas de niveles L1/L2/L3.

## 16. Reinicio

No existe endpoint ni flujo de “recuperar sesión”. Tras un reinicio, el backend inicia en `SIN_PREPARAR`.

La existencia de CSV anteriores nunca debe hacer que se reconstruya automáticamente una preparación o sesión.

## 17. Tipos compartidos

Cuando sea práctico, los tipos TypeScript consumidos por Nuxt deben generarse o derivarse de OpenAPI en lugar de mantener copias manuales de los modelos Pydantic.

La herramienta concreta de generación se decidirá junto con DT-018/DT-019.
