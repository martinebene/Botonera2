# 02 — Modelo de dominio y estados

Este documento describe el modelo conceptual que debe preservar Botonera2. No obliga a copiar las clases del MVP.

## 1. Entidades principales

### Concejal

Representa a una persona habilitada para participar de una sesión.

Atributos funcionales mínimos:

- identificador único;
- nombre;
- apellido;
- bloque;
- número de banca;
- identificador lógico del dispositivo de votación;
- estado de presencia dentro de la sesión.

La presencia es un estado de la participación en la sesión, aunque el MVP la almacene dentro del objeto Concejal.

### Sesión

Agregado que contiene el desarrollo operativo de una sesión del Concejo.

Atributos mínimos:

- número de sesión;
- estado;
- hora de inicio;
- hora de cierre;
- concejales participantes;
- quórum requerido;
- disposición de bancas;
- votaciones realizadas;
- cola de pedidos de palabra;
- orador actual.

### Votación

Pertenece a una sesión.

Atributos mínimos:

- identificador interno;
- número público;
- tipo;
- tema;
- criterio de mayoría;
- factor de mayoría;
- estado;
- hora de inicio;
- hora de fin;
- votos ordinarios;
- decisión de desempate, cuando corresponda.

### Voto ordinario

Asocia:

- una votación;
- un concejal;
- un valor (`Positivo`, `Negativo`, `Abstención`);
- hora de emisión.

La combinación votación + concejal debe ser única.

### Pedido de palabra

El MVP representa la cola directamente mediante concejales. Botonera2 puede modelarla como entidad o relación explícita siempre que conserve:

- orden FIFO;
- identidad del concejal;
- posibilidad de retirar el pedido;
- transición a orador actual.

### Evento operativo

Registro de una acción o hecho relevante del sistema.

Debe poder expresar como mínimo:

- secuencia u orden;
- fecha/hora;
- nivel;
- categoría;
- descripción;
- datos estructurados cuando resulten útiles para auditoría.

## 2. Máquina de estados de Sesión

Modelo funcional mínimo:

```text
SIN_SESION
   |
   | abrir sesión
   v
ABIERTA
   |
   | cerrar sesión
   v
CERRADA / finalizada
```

Para operación en vivo solo existe una sesión activa a la vez.

En el MVP, después del cierre la referencia activa se elimina. Botonera2 puede persistir sesiones finalizadas; eso no cambia la regla de unicidad de la sesión activa.

## 3. Máquina de estados de Votación

```text
                 +--------------+
                 |   EN_CURSO   |
                 +--------------+
                    |   |   |
          cierre    |   |   | cierre con empate
                    |   |   v
                    |   | +------------+
                    |   | |  EMPATADA  |
                    |   | +------------+
                    |   |       |
                    |   |       | desempate +/-
                    |   |       v
                    |   | APROBADA / RECHAZADA
                    |   |
                    |   +----> INCONCLUSA
                    |
                    +-------> APROBADA / RECHAZADA
```

Estados terminales normales:

- `APROBADA`;
- `RECHAZADA`;
- `INCONCLUSA`.

`EMPATADA` es un estado intermedio pendiente de decisión de desempate.

## 4. Transiciones de Votación

### Crear → EN_CURSO

Precondiciones:

- sesión activa;
- quórum suficiente;
- ninguna otra votación activa según la política final definida para empate pendiente.

### EN_CURSO → resultado

Puede dispararse por:

- voto que completa a todos los presentes;
- cambio de presencia que hace que todos los presentes restantes ya hayan votado;
- cierre manual de Moderación;
- cierre de sesión que fuerza el cierre de una votación en curso.

El resultado se calcula con las reglas de `01-reglas-de-negocio.md`.

### EMPATADA → APROBADA / RECHAZADA

Solo mediante decisión de desempate de Moderación.

## 5. Estado de presencia

Cada participante tiene:

```text
AUSENTE <---- tecla 9 ----> PRESENTE
```

En `main` esta transición solo se procesa cuando existe una sesión activa.

Una transición de presencia durante una votación en curso obliga a reevaluar el cierre automático, pero no elimina votos ya registrados.

## 6. Estado de uso de la palabra

Para un concejal presente que no es orador:

```text
SIN_PEDIDO -- tecla 7 --> EN_COLA
EN_COLA    -- tecla 7 --> SIN_PEDIDO
```

Para la cola:

```text
EN_COLA -- otorgar palabra --> ORADOR_ACTUAL
```

Para el orador:

```text
ORADOR_ACTUAL -- quitar palabra --> SIN_PEDIDO
ORADOR_ACTUAL -- tecla 7 --------> SIN_PEDIDO
```

El comportamiento de “otorgar palabra” cuando ya existe orador se define en `10-preguntas-abiertas.md`.

## 7. Invariantes

El diseño debe hacer cumplir explícitamente:

1. máximo una sesión activa;
2. máximo una votación realmente activa para recepción de votos;
3. máximo un voto ordinario por concejal y votación;
4. un dispositivo lógico debe resolver a como máximo un concejal participante de la sesión;
5. una banca debe identificar como máximo a un concejal dentro de la disposición de una sesión;
6. un concejal no debe aparecer dos veces simultáneamente en la cola de palabra;
7. un orador no debe permanecer además en la cola;
8. el backend es autoridad sobre estados y transiciones;
9. los frontends nunca deben inferir un resultado diferente al entregado por el backend.

## 8. Datos derivados

No necesitan persistirse como autoridad si pueden calcularse de forma consistente:

- cantidad total de concejales;
- cantidad de presentes;
- diferencia respecto del quórum;
- conteo de positivos/negativos/abstenciones;
- si todos los presentes ya votaron;
- resultado textual para UI.

## 9. Legado que no debe copiarse

No son parte del modelo canónico:

- contadores `_next_id` en memoria;
- referencia desde `Votacion` al singleton `SesionService`;
- serialización de objetos de dominio directamente desde FastAPI;
- guardar `disposicion_bancas` como string JSON dentro de la sesión;
- utilizar un `deque` concreto como contrato externo.

Botonera2 debe expresar las mismas reglas con un modelo explícito, tipado y testeable.
