# 08 - Observabilidad y auditoría

## 1. Principio institucional

El registro electrónico forma parte del comportamiento funcional del sistema, no es solo diagnóstico técnico.

Desde `PREPARANDO` hasta cancelación/cierre deben registrarse inmediatamente las interacciones relevantes.

La primera versión no usa base de datos para auditoría ni para recuperar estado.

## 2. Tres niveles acumulativos

Se conserva la lógica de profundidad de la implementación actual:

- archivo nivel 1: eventos L1 + L2 + L3;
- archivo nivel 2: eventos L2 + L3;
- archivo nivel 3: solo eventos L3.

Interpretación general:

- **L1:** máximo detalle técnico/operativo;
- **L2:** operación normal, entradas, rechazos y diagnóstico útil;
- **L3:** hechos institucionales y funcionales importantes.

La asignación concreta de cada evento debe conservar el espíritu de producción y extenderlo para cubrir las nuevas reglas.

## 3. Formato CSV canónico

Botonera2 utiliza **CSV** con:

```text
seq;timestamp;level;tag;event_code;message
```

Reglas:

- delimitador `;`;
- UTF-8 con BOM;
- timestamp `AAAA-MM-DD HH:MM:SS`;
- hora local del servidor;
- precisión a segundos;
- `seq` monotónico dentro de la preparación/sesión;
- `event_code` estable y legible por máquina;
- `message` legible por personas.

Los códigos estructurados no reemplazan la descripción humana.

## 4. Ciclo y nombres de archivos

Al ejecutar `Preparar sala` se toma fecha/hora local del servidor y se crea un conjunto nuevo:

```text
logs/
└── AAAA-MM-DD/
    ├── AAAA-MM-DD_HH-MM-SS-L1.csv
    ├── AAAA-MM-DD_HH-MM-SS-L2.csv
    └── AAAA-MM-DD_HH-MM-SS-L3.csv
```

La hora en el nombre evita superposición entre múltiples preparaciones/sesiones del mismo día.

Al cancelar preparación o cerrar sesión:

- se escribe el evento final;
- se cierra el conjunto;
- Botonera2 no vuelve a modificar esos archivos.

## 5. Persistencia inmediata y durabilidad

Cada evento se escribe sin acumularlo hasta el cierre.

Por cada persistencia obligatoria se realiza, bajo el mecanismo que serializa las operaciones del backend:

1. escritura de la fila;
2. `flush`;
3. `fsync`.

Una operación que requiera registro no debe confirmarse como exitosa antes de garantizar la persistencia definida.

## 6. Fallo cerrado de auditoría

Si durante `PREPARANDO` o `SESION_ABIERTA` deja de ser posible garantizar escritura en los CSV:

- el sistema debe exponer una falla técnica grave a Moderación;
- no debe continuar aceptando nuevas operaciones que muten estado como si la auditoría siguiera disponible;
- no debe confirmar parcialmente una operación cuyos registros obligatorios no pudieron persistirse coherentemente.

El detalle de la transición técnica a modo de fallo debe implementarse sin inventar un nuevo estado reglamentario de sesión.

## 7. Interrupciones abruptas

Ante caída del proceso/equipo:

- no existe garantía de poder escribir un evento final;
- los CSV quedan terminados en el último evento persistido;
- al reiniciar no se buscan ni reparan archivos anteriores;
- no se agrega retrospectivamente una marca de interrupción;
- el sistema vuelve a `SIN_PREPARAR`.

## 8. Orden de eventos

Las entradas concurrentes se serializan en el backend.

El orden en que el backend acepta, procesa y persiste los eventos es el orden oficial del sistema.

`seq` representa ese orden dentro del conjunto de archivos de una preparación/sesión.

## 9. Categorías mínimas

Deben registrarse apropiadamente, según nivel:

- inicio/cancelación de preparación;
- cambios de Presidencia;
- cambios de Secretaría Legislativa;
- apertura/cierre de sesión;
- pulsaciones físicas recibidas durante una preparación/sesión;
- presencia/ausencia;
- test de dispositivo cuando corresponda al nivel detallado;
- pedidos/retiros de palabra;
- otorgamiento/finalización de palabra;
- apertura de votación;
- voto ordinario individual;
- rechazos de voto/interacción;
- autocierre;
- pérdida de quórum;
- finalización manual y motivo;
- resultado;
- empate;
- voto presidencial de desempate explícito `POSITIVO/NEGATIVO`;
- resultado posterior al desempate;
- remapeo físico de dispositivo cuando se implemente;
- errores técnicos relevantes.

## 10. Identidad de concejales

La implementación histórica usa principalmente nombre, apellido y banca en mensajes funcionales.

Botonera2 conserva como mínimo esa legibilidad humana en `message`. Los códigos/estructuras internas no deben reducir el registro a identificadores opacos.

Las seis columnas canónicas son suficientes para la primera versión; información adicional del evento puede expresarse de forma consistente en `message` y mediante `event_code`.

## 11. Presidencia

El desempate registra explícitamente:

- quién figuraba como Presidencia;
- sentido `POSITIVO` o `NEGATIVO`;
- resultado final.

No se registra como voto ordinario de banca.

## 12. Remapeo

El evento de remapeo debe permitir reconstruir qué identificador lógico fue reasignado desde qué fingerprint físico hacia qué nuevo fingerprint, sin alterar ni reescribir votos/presencia del concejal asociado.

## 13. Proyección de eventos a frontends

Los CSV son el registro persistente; los frontends consumen una proyección reciente en memoria.

No se exige conservar el buffer histórico de 20 eventos de la versión anterior.

La proyección pública filtra cualquier evento que revele un voto individual mientras la votación está `EN_CURSO`.

## 14. Edición posterior

Botonera2 no ofrece edición de archivos cerrados.

Una corrección externa institucional puede existir fuera del sistema, pero Botonera2 no reabre ni reescribe automáticamente registros históricos.

## 15. Referencia histórica

La implementación actual usa:

- `L1 -> archivo 1`;
- `L2 -> archivos 1 y 2`;
- `L3 -> archivos 1, 2 y 3`;
- líneas `HH:MM:SS | Lx | TAG | mensaje`;
- escritura inmediata.

Botonera2 conserva esa semántica de profundidad y la adapta al formato CSV estructurado definido aquí.
