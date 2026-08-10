# 10 — Preguntas abiertas y decisiones pendientes

Estos puntos **no deben ser decididos por agentes de programación**. Surgen de ambigüedades, defectos posibles o mejoras presentes fuera del código productivo validado.

Cuando se resuelva una pregunta, actualizar primero los documentos funcionales correspondientes y luego este archivo.

## PA-001 — Mayoría especial “sobre presentes”

**Código de `main`:** usa

`positivos / votos_emitidos >= factor`

**Pregunta:** ¿la regla institucional correcta debe usar realmente votos emitidos o cantidad de concejales presentes al cierre?

Esto importa especialmente si existe cierre forzado o cambios de presencia.

**Estado:** abierta.

## PA-002 — Empate pendiente bloquea una nueva votación

El código conserva una votación empatada para el desempate, pero la validación de apertura solo bloquea otra votación `EN_CURSO`.

**Pregunta:** ¿debe estar prohibido abrir cualquier nueva votación hasta resolver o cancelar el empate pendiente?

**Recomendación funcional a validar:** sí, porque de otro modo se pierde la referencia operativa al desempate.

**Estado:** abierta.

## PA-003 — Cerrar sesión con votación empatada

**Pregunta:** si existe un empate pendiente, ¿el operador debe estar obligado a resolverlo antes de cerrar sesión, puede cerrar la sesión dejando la votación empatada como resultado final, o debe existir una acción explícita de cancelación/inconclusa?

**Estado:** abierta.

## PA-004 — Visibilidad de votos en Moderación

Pantalla pública: voto secreto durante toda la votación.

Moderación productiva: oculta aproximadamente 4 s y luego puede mostrar votos individuales aun con votación en curso.

**Pregunta:** en Botonera2, ¿Moderación debe:

1. mantener voto secreto hasta el cierre;
2. conservar la conducta de revelación después de 4 s;
3. tener una opción manual/controlada?

**Estado:** abierta.

## PA-005 — Acreditación antes de abrir sesión

`main` exige sesión activa para procesar tecla `9`.

`v2` introduce “preparar sesión” para acreditar presencia antes de la apertura formal, pero esa versión no fue validada en producción.

**Pregunta:** ¿Botonera2 debe incorporar un estado PREPARADA/ACREDITACIÓN previo a ABIERTA?

**Estado:** abierta. No forma parte del comportamiento canónico inicial hasta decisión.

## PA-006 — Otorgar palabra cuando ya hay orador

El código permite que la acción de otorgar tome otro concejal de la cola y reemplace la referencia al orador actual.

**Pregunta:** ¿debe bloquearse “Otorgar” mientras alguien habla, reemplazarse automáticamente, o finalizar primero al orador actual?

**Estado:** abierta.

## PA-007 — Orador que pasa a ausente

La tecla `9` puede marcar ausente al orador actual y el código no le quita automáticamente la palabra.

**Pregunta:** ¿la ausencia debe finalizar automáticamente el uso de la palabra?

**Estado:** abierta.

## PA-008 — Persistencia de sesiones y votos

El MVP mantiene el dominio en memoria y los logs en archivos. Al reiniciar el backend se pierde el estado activo/histórico estructurado.

**Pregunta:** ¿Botonera2 debe persistir:

- sesiones finalizadas;
- votaciones;
- votos;
- presencia;
- cola de palabra;
- estado de una sesión activa para recuperación tras reinicio?

La respuesta condicionará base de datos, recuperación y despliegue.

**Estado:** abierta.

## PA-009 — Recuperación tras caída del backend durante una sesión

Relacionado con PA-008.

**Pregunta:** ¿se exige recuperar automáticamente una sesión en curso después de reiniciar el servidor, o es aceptable reiniciar operacionalmente la sesión/sistema?

**Estado:** abierta.

## PA-010 — Catálogo de tipos de votación

El frontend productivo ofrece:

- Ratificación;
- Despacho OP;
- Despacho Gob;
- Despacho AS;
- Despacho HA;
- Despacho Eco;
- Mocion;
- P. Sobre Tabla;
- Otro.

**Pregunta:** ¿este catálogo debe ser fijo/configurable y cuál es la ortografía institucional definitiva (`Moción`, `P. Sobre Tabla`, etc.)?

**Estado:** abierta para normalización; preservar valores funcionales hasta resolver.

## PA-011 — Regla exacta del formato del Orden del Día

El código productivo usa `;` y un parser simple por línea. Eso no permite un `;` dentro del tema.

**Pregunta:** ¿Botonera2 debe mantener exactamente ese formato simple o adoptar CSV robusto con quoting conservando `;` como delimitador?

**Estado:** abierta en cuanto a robustez. El delimitador funcional vigente es `;`.

## PA-012 — Duraciones visuales

Valores observados:

- cuenta regresiva pública: 4 s;
- votos/resultados en pantalla tras cierre: aproximadamente 6 s;
- test de banca: backend aproximadamente 0,6 s.

**Pregunta:** ¿estos valores son requisitos institucionales o deben ser configurables?

**Estado:** abierta. Para caracterización inicial usar los valores observados.

## PA-013 — Resultado de cierre forzado con cero votos y mayoría especial

El MVP puede dividir por cero antes de llegar a la regla `INCONCLUSA`.

**Pregunta funcional:** ¿un cierre sin votos debe resultar siempre `INCONCLUSA` independientemente del tipo de mayoría?

**Recomendación a validar:** sí.

**Estado:** abierta hasta confirmación, aunque Botonera2 no debe reproducir una excepción técnica.

## PA-014 — Identidad de la autoridad de desempate

El MVP registra el desempate sin concejal asociado.

**Pregunta:** ¿para auditoría debe registrarse quién/qué rol emitió la decisión de desempate, aunque siga separada de los votos ordinarios?

**Estado:** abierta.

## PA-015 — Autenticación de Moderación

El MVP opera en LAN sin autenticación en las rutas observadas.

**Pregunta:** ¿Botonera2 debe incorporar autenticación/autorización para comandos de Moderación?

**Estado:** fuera del comportamiento vigente; abierta como requisito de seguridad futuro.

## PA-016 — Técnica de actualización

Polling de 250–300 ms funciona en el MVP.

**Pregunta técnica:** ¿mantener polling o adoptar SSE/WebSocket?

Esta decisión no cambia reglas de negocio y debe resolverse en arquitectura considerando simplicidad, red local y recuperación.

**Estado:** abierta.

## PA-017 — Despliegue de los dos Nuxt

**Pregunta técnica:** ¿se servirán como dos aplicaciones/procesos independientes, builds estáticos detrás de proxy, o mediante otra topología?

Debe seguir habiendo dos superficies independientes aunque compartan componentes/librerías.

**Estado:** abierta.
