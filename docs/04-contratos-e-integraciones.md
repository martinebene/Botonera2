# 04 — Contratos e integraciones

Este documento define los límites funcionales que la implementación debe respetar. Salvo el contrato externo de teclados, no obliga a conservar las rutas exactas del MVP.

## 1. Principio de autoridad

El backend FastAPI es la única autoridad sobre:

- sesión activa;
- presencia;
- quórum;
- votación activa;
- elegibilidad para votar;
- votos registrados;
- cálculo del resultado;
- empate y desempate;
- cola de palabra;
- orador actual;
- eventos de negocio.

Los frontends envían comandos y representan proyecciones; no duplican estas reglas como fuente de verdad.

## 2. Integración externa de teclados

### Contrato mínimo a conservar

El servicio de captura debe poder enviar al backend una pulsación con esta semántica:

```json
{
  "dispositivo": "dev01",
  "tecla": "1"
}
```

En el MVP productivo el endpoint es:

`POST /entradas/tecla`

Por compatibilidad con el servicio físico existente, Botonera2 debe **mantener este endpoint y cuerpo**, al menos durante la migración inicial, salvo que se modifique también de forma coordinada el servicio de teclados.

### Responsabilidades del servicio físico

- detectar dispositivo físico;
- identificarlo mediante su mapeo;
- traducirlo a identificador lógico como `dev01`;
- detectar la tecla;
- enviar el evento HTTP.

### Responsabilidades que NO pertenecen al servicio físico

- decidir si hay sesión;
- comprobar presencia;
- decidir qué significa legislativamente una tecla;
- validar voto duplicado;
- calcular quórum;
- calcular resultados;
- administrar palabra.

## 3. Resultado de procesar una tecla

La API debe responder de manera estructurada indicando como mínimo:

- si la entrada fue aceptada;
- motivo o código de resultado;
- dispositivo;
- tecla;
- concejal cuando haya sido resuelto;
- dato funcional adicional cuando corresponda, por ejemplo valor de voto.

Códigos funcionales que deben poder distinguirse:

- `no_hay_sesion_abierta`;
- `dispositivo_no_asignado`;
- `concejal_ausente`;
- `no_hay_votacion_abierta`;
- `concejal_ya_voto`;
- `voto_registrado`;
- `cambio_presencia`;
- `tecla_uso_palabra`;
- `fin_uso_palabra`;
- `tecla_no_soportada`;
- test visual aceptado.

Los nombres exactos pueden normalizarse en Botonera2 siempre que el servicio consumidor no dependa de ellos.

## 4. Capacidades requeridas de la API de Moderación

El backend debe exponer operaciones equivalentes a:

- abrir sesión;
- cerrar sesión;
- abrir votación;
- cerrar votación forzadamente;
- resolver desempate positivo/negativo;
- otorgar palabra;
- quitar palabra.

Las rutas históricas de `main` son:

```text
POST /moderacion/abrir_sesion
POST /moderacion/cerrar_sesion
POST /moderacion/abrir_votacion
POST /moderacion/cerrar_votacion
POST /moderacion/voto_desempate
POST /moderacion/otorgar_uso_palabra
POST /moderacion/quitar_uso_palabra
```

Estas rutas son evidencia del comportamiento actual, no obligación arquitectónica para los dos Nuxt nuevos. Si se reemplazan, ambos frontends deben migrar en conjunto y el contrato nuevo debe documentarse antes de implementarse.

## 5. Datos mínimos para abrir votación

La operación debe recibir conceptualmente:

```json
{
  "numero": 37,
  "tipo": "Despacho OP",
  "tema": "...",
  "computa_sobre_los_presentes": true,
  "factor_mayoria_especial": 0.66
}
```

Reglas:

- `numero`: entero público de votación;
- `tipo`: texto/catálogo definido;
- `tema`: texto;
- `computa_sobre_los_presentes`: `true` para Presentes, `false` para Cuerpo;
- `factor_mayoria_especial`: `0` para mayoría simple; valor > 0 para mayoría especial.

Botonera2 debería definir DTOs (Data Transfer Objects, objetos de transferencia de datos) explícitos y validados para estos contratos.

## 6. Lecturas requeridas por los frontends

Los Nuxt necesitan al menos las siguientes proyecciones conceptuales.

### Estado general de sesión

- hay/no hay sesión;
- número;
- hora de inicio;
- total de concejales;
- presentes;
- quórum;
- disposición de bancas;
- concejales y estados visuales;
- cola de palabra;
- orador.

### Estado de votación

- identificador;
- número;
- tipo;
- tema;
- factor;
- criterio Presentes/Cuerpo;
- estado;
- hora de inicio/fin;
- conteos;
- votos individuales solo cuando la proyección/superficie esté autorizada a recibirlos.

### Eventos

- secuencia/ID;
- hora;
- nivel;
- categoría;
- mensaje;
- datos estructurados opcionales.

## 7. Separación de proyecciones por seguridad funcional

La Pantalla de Recinto no debería depender de recibir datos secretos para luego esconderlos solo con CSS.

Objetivo recomendado para Botonera2:

- Moderación recibe la información operativa que necesite según política aprobada;
- Pantalla pública recibe una proyección que **no incluya votos individuales mientras la votación esté `EN_CURSO`**;
- al cierre, el backend habilita esos datos durante el estado de resultado si así lo requiere la UI.

Esto reduce el riesgo de revelar votos por consola, herramientas del navegador o errores de render.

## 8. Actualización en tiempo real

El MVP usa polling cada 250–300 ms. Lo que debe preservarse funcionalmente es:

- actualización perceptiblemente inmediata;
- recuperación automática ante desconexión temporal;
- reconstrucción desde el backend;
- ausencia de estado crítico exclusivamente local en los frontends.

La implementación puede elegir polling, Server-Sent Events, WebSocket u otra técnica, pero esa decisión debe tomarse explícitamente en la arquitectura técnica y probarse bajo la red local real.

## 9. Idempotencia y concurrencia

Botonera2 debe manejar explícitamente eventos cercanos o repetidos.

En particular:

- dos pulsaciones rápidas del mismo voto no pueden crear dos votos;
- dos solicitudes simultáneas de apertura no pueden crear dos sesiones/votaciones activas;
- un cierre concurrente con el último voto debe producir un único estado terminal coherente;
- una pulsación que llega después del cierre debe ser rechazada de forma determinística.

## 10. Errores

La API nueva debe diferenciar:

- error de validación del request;
- rechazo por regla de negocio;
- recurso/estado inexistente;
- fallo interno.

No debe depender de textos humanos como única forma de distinguir causas.

## 11. Datos sensibles

No exponer ni persistir innecesariamente en los frontends:

- fingerprints físicos de dispositivos;
- rutas `/dev/input/...`;
- datos de infraestructura;
- secretos;
- información personal que no sea necesaria para la interfaz.

El identificador lógico `devXX` es suficiente para el contrato de negocio con el servicio físico.
