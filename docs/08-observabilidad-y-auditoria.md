# 08 — Observabilidad y auditoría

## 1. Objetivo

El sistema opera durante sesiones reales. Debe permitir comprender qué ocurrió sin depender exclusivamente de lo que muestra un navegador en ese instante.

## 2. Eventos funcionales mínimos

Registrar al menos:

### Sesión

- apertura exitosa;
- intento de apertura rechazado;
- cierre;
- intento de cierre inválido.

### Presencia

- concejal presente;
- concejal ausente;
- intento inválido cuando corresponda.

### Votación

- apertura;
- rechazo de apertura por falta de sesión;
- rechazo por falta de quórum;
- rechazo por otra votación activa;
- cierre automático;
- cierre forzado;
- resultado;
- empate;
- desempate.

### Voto

- voto registrado;
- intento duplicado;
- intento sin votación;
- intento de ausente.

### Uso de la palabra

- pedido;
- retiro de pedido;
- otorgamiento;
- finalización;
- intento de otorgar con cola vacía.

### Entrada física

- dispositivo;
- tecla;
- aceptación/rechazo;
- motivo.

## 3. Niveles observados

El MVP usa:

- `L1`: detalle completo;
- `L2`: eventos intermedios;
- `L3`: eventos principales.

Botonera2 puede conservar esos nombres o modelar severidad/categoría de forma más estructurada. Si la UI mantiene los filtros Principales / Intermedios / Sistema, debe existir un mapeo inequívoco.

## 4. Estructura recomendada

No guardar únicamente una línea de texto. Cada evento debería tener al menos:

```text
id o secuencia
fecha_hora
nivel
categoria
codigo
mensaje
contexto estructurado opcional
```

Ejemplo conceptual:

```json
{
  "seq": 1234,
  "timestamp": "...",
  "nivel": 3,
  "categoria": "VOTACION",
  "codigo": "votacion_cerrada",
  "mensaje": "Votación Nº37 completada",
  "datos": {
    "estado": "APROBADA",
    "positivos": 7,
    "negativos": 3,
    "abstenciones": 2
  }
}
```

## 5. Orden y deduplicación

Los frontends deben poder determinar si un evento ya fue recibido.

Por eso los eventos expuestos a UI requieren un ID o secuencia monotónica dentro del ámbito elegido.

El MVP usa una secuencia incremental en RAM y un buffer circular de los últimos 20 eventos. El número `20` no es requisito; sí lo son:

- orden estable;
- deduplicación;
- recuperación razonable de eventos recientes.

## 6. Persistencia

El MVP escribe archivos diarios separados por nivel. Botonera2 puede cambiar la implementación, pero debe conservar una forma persistente de auditoría para hechos relevantes de sesión.

La estrategia definitiva de persistencia general se decidirá en arquitectura técnica.

## 7. Privacidad del voto durante la votación

Los eventos no deben provocar una fuga del voto secreto en la Pantalla de Recinto.

Recomendación fuerte:

- no enviar a la proyección pública eventos con identidad + valor de voto mientras la votación esté `EN_CURSO`;
- no confiar solo en esconder texto con CSS.

Moderación tendrá la política de visibilidad que se defina expresamente.

## 8. Logs técnicos vs eventos de negocio

Separar conceptualmente:

### Eventos de negocio

Comprensibles para operación y auditoría de sesión.

### Logs técnicos

- stack traces;
- errores HTTP;
- conexiones;
- consultas/persistencia;
- tiempos;
- fallos de infraestructura.

No exponer stack traces ni detalles técnicos sensibles en las interfaces públicas.

## 9. Timestamps

Todos los hechos relevantes deben tener fecha/hora consistente.

Para almacenamiento es preferible usar timestamps con zona horaria o UTC y convertir a hora local de Argentina en UI. No depender de strings sin zona si luego se necesitará auditoría histórica.

## 10. Correlación

Cuando sea posible, asociar eventos con:

- sesión;
- votación;
- concejal;
- dispositivo lógico;
- request/acción.

Esto facilita reconstruir incidentes sin recurrir al código antiguo.

## 11. Errores operativos

Los frontends deben presentar errores accionables, pero los eventos persistentes deben contener suficiente detalle para diagnóstico posterior.

Ejemplo: “No hay quórum” para el operador; internamente registrar presentes, quórum requerido y operación intentada.

## 12. No incorporar datos históricos

Los logs existentes en `martinebene/Botonera` son evidencia operativa histórica y **no deben copiarse** a Botonera2 como documentación, fixtures ni ejemplos.
