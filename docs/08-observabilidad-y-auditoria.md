# 08 - Observabilidad y auditoría

## 1. Principio institucional

El registro electrónico forma parte del comportamiento funcional del sistema, no es solo diagnóstico técnico.

Desde `PREPARANDO` hasta cancelación/cierre deben registrarse inmediatamente las interacciones relevantes.

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

## 3. Formato

Botonera2 utilizará **CSV**, no los `.txt` de la versión histórica.

La estructura exacta de columnas es una decisión técnica pendiente, pero debe permitir como mínimo representar:

- timestamp;
- nivel;
- categoría/tag;
- descripción/datos del evento;
- orden inequívoco entre eventos procesados.

No es necesario convertir los CSV en una base de datos ni usarlos para restaurar estado.

## 4. Ciclo de archivos

Al ejecutar `Preparar sala`:

1. tomar fecha/hora local del servidor;
2. crear un identificador de nombre basado en esa fecha y hora;
3. abrir tres CSV nuevos;
4. registrar el inicio de preparación.

El nombre debe incluir hora para permitir varias preparaciones/sesiones en el mismo día sin superposición.

Al cancelar preparación o cerrar sesión:

- escribir el evento final;
- cerrar el conjunto;
- no volver a modificar esos archivos desde Botonera2.

## 5. Persistencia inmediata

Cada evento debe escribirse cuando ocurre, no acumularse hasta el cierre.

Objetivo: si hay una falla técnica, conservar todo lo que efectivamente sucedió hasta la última escritura exitosa.

## 6. Interrupciones

Ante caída abrupta:

- no existe oportunidad garantizada de escribir un evento de cierre;
- los CSV quedan terminados en el último evento persistido;
- al reiniciar no se buscan ni reparan los archivos anteriores;
- no se agrega retrospectivamente una marca de interrupción;
- el sistema vuelve a `SIN_PREPARAR`.

## 7. Tiempo

- zona: hora local del servidor;
- precisión reglamentaria requerida: segundos;
- formato exacto de timestamp: decisión técnica, pero debe ser inequívoco y ordenable.

## 8. Orden de eventos

Las entradas concurrentes deben serializarse en el backend.

El orden en que el backend acepta, procesa y persiste los eventos es el orden oficial del sistema.

Si técnicamente se utiliza un número de secuencia, debe ser monotónico dentro de la ejecución correspondiente.

## 9. Categorías mínimas a cubrir

La implementación debe registrar apropiadamente, según nivel:

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
- resultado de votación;
- empate;
- voto presidencial de desempate explícito `POSITIVO/NEGATIVO`;
- resultado posterior al desempate;
- remapeo de dispositivo cuando se implemente;
- errores técnicos relevantes.

## 10. Identidad de concejales en registros

La implementación histórica usa principalmente nombre, apellido y número de banca en mensajes funcionales.

Botonera2 debe conservar como mínimo esa legibilidad humana. El formato CSV puede añadir DNI estructurado si resulta útil técnicamente, pero no debe reducir el registro a identificadores opacos.

La decisión de columnas exactas se cerrará antes de implementar el logger.

## 11. Presidencia

El desempate debe registrar explícitamente:

- quién figuraba como Presidencia en ese momento;
- sentido `POSITIVO` o `NEGATIVO`;
- resultado final.

No debe registrarse como si fuera un voto ordinario de banca.

## 12. Proyección de eventos a frontends

Los CSV son el registro persistente; los frontends pueden consumir una proyección reciente en memoria.

No se exige conservar el buffer histórico de 20 eventos de la versión anterior.

La proyección pública debe filtrar cualquier evento que revele un voto individual mientras la votación está `EN_CURSO`.

## 13. Edición posterior

Botonera2 no ofrecerá edición de archivos cerrados.

Una corrección externa institucional puede existir fuera del sistema, pero Botonera2 no reabre ni reescribe automáticamente registros históricos.

## 14. Referencia histórica

La implementación actual usa:

- `L1 -> archivo 1`;
- `L2 -> archivos 1 y 2`;
- `L3 -> archivos 1, 2 y 3`;
- líneas `HH:MM:SS | Lx | TAG | mensaje`;
- escritura inmediata.

Botonera2 conserva esa semántica, adaptándola a CSV y a un conjunto de archivos por preparación/sesión identificado por fecha y hora.