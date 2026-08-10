# 04 - Contratos e integraciones

Este documento define responsabilidades de integración. Los nombres definitivos de endpoints y el transporte de actualización en tiempo real siguen siendo decisiones técnicas.

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

## 4. Respuesta conceptual de entrada

El contrato debe permitir al bridge/diagnóstico distinguir al menos:

- aceptada/rechazada;
- motivo estable y legible por máquina;
- dispositivo;
- tecla;
- concejal cuando corresponda;
- resultado funcional relevante cuando corresponda.

Los identificadores de error deben ser estables y no depender de textos de interfaz.

## 5. Comandos de Moderación requeridos

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

No se exige conservar los nombres de rutas del sistema histórico salvo compatibilidad física explícita.

## 6. Proyección para Moderación

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
- capacidades/comandos actualmente habilitados o información suficiente para derivarlos sin duplicar reglas.

## 7. Proyección pública

Se recomienda una proyección/API diferenciada de la de Moderación.

Debe impedir desde el backend que durante `EN_CURSO` se expongan:

- votos individuales;
- eventos cuyo texto revele votos;
- cualquier dato que permita inferirlos directamente.

La seguridad temporal del voto no debe depender únicamente de ocultar elementos en JavaScript/CSS.

## 8. Votaciones

El comando de apertura debe poder expresar explícitamente:

- número externo;
- tipo;
- tema;
- `tipo_mayoria = SIMPLE | ESPECIAL`;
- para especial: factor;
- para especial: base `PRESENTES | CUERPO`.

No usar `factor=0` o `factor=0.5` para inferir una mayoría simple.

Una vez abierta, la votación es inmutable.

## 9. Finalización manual

Debe ser un único comando conceptual `finalizar votacion` y requerir motivo no vacío.

No existe una operación reglamentaria separada de “cancelar” que produzca otro estado. Toda finalización anticipada no normal produce `INCONCLUSA`.

## 10. Desempate presidencial

Solo disponible para votación `SIMPLE` y `EMPATADA`.

Entrada conceptual:

- `POSITIVO` o `NEGATIVO`.

No recibe concejal ni modifica el listado de votos ordinarios.

La identidad de quien ocupa Presidencia surge del estado institucional actual y se registra junto con la decisión.

## 11. Orden del Día

La carga es una ayuda del frontend de Moderación.

El backend/servicio que la procese debe distinguir:

- error técnico de formato/lectura;
- datos interpretables.

No debe validar secuencia, unicidad o legitimidad institucional del contenido.

## 12. Actualización de estado

Polling, Server-Sent Events (SSE), WebSocket u otra estrategia todavía son decisiones técnicas.

Cualquiera que se elija debe garantizar:

- reconstrucción completa tras recarga;
- baja latencia adecuada para votación presencial;
- orden consistente de eventos;
- tolerancia a reconexión;
- que la lógica no dependa de que un frontend haya permanecido conectado.

## 13. Concurrencia

El backend debe imponer un orden determinista a comandos/pulsaciones concurrentes. El orden aceptado y persistido constituye el orden oficial del sistema.

Esto debe resolverse de forma compatible con el modelo de estado único en memoria.

## 14. Registros CSV

Los frontends no escriben los CSV.

El backend debe persistir cada evento aceptado/relevante inmediatamente y controlar la apertura/cierre de los tres archivos asociados a una preparación.

La estructura exacta de columnas y mecanismo de escritura se definirá técnicamente sin alterar las reglas de niveles L1/L2/L3.

## 15. Reinicio

No existe endpoint ni flujo de “recuperar sesión”. Tras un reinicio, el backend inicia en `SIN_PREPARAR`.

La existencia de CSV anteriores nunca debe hacer que se reconstruya automáticamente una preparación o sesión.