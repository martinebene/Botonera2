# AGENTS.md

## Propósito

Este repositorio contiene la especificación canónica y, posteriormente, la implementación de Botonera2, nueva versión del sistema de votación del Concejo Deliberante de Puerto Madryn.

Los agentes deben implementar lo documentado aquí; no reconstruir el producto a partir del repositorio histórico.

## Orden de lectura obligatorio

Antes de proponer o modificar código:

1. `README.md`
2. `docs/00-principios-y-alcance.md`
3. `docs/01-reglas-de-negocio.md`
4. `docs/02-modelo-de-dominio-y-estados.md`
5. `docs/03-casos-de-uso.md`
6. `docs/04-contratos-e-integraciones.md`
7. `docs/05-frontend-moderacion.md`
8. `docs/06-frontend-pantalla-recinto.md`
9. `docs/07-configuracion-datos-y-assets.md`
10. `docs/08-observabilidad-y-auditoria.md`
11. `docs/09-fuentes-y-trazabilidad.md`
12. `docs/10-preguntas-abiertas.md`
13. `docs/11-criterios-de-aceptacion.md`

## Autoridad documental

- La documentación de Botonera2 es la fuente normativa para la nueva implementación.
- El repositorio histórico `martinebene/Botonera`, rama `main`, solo puede consultarse cuando esta documentación lo indique para:
  - descargar imágenes/assets;
  - validar una regla histórica puntual;
  - comprobar compatibilidad con el bridge físico existente.
- No se debe copiar arquitectura, clases, endpoints internos, polling, serialización ni estructura del proyecto histórico por defecto.
- La rama histórica `v2` no es normativa.
- Si una implementación antigua contradice Botonera2, manda Botonera2.

## Arquitectura funcional obligatoria

La solución debe mantener separados:

- backend FastAPI;
- frontend Nuxt.js de Moderación;
- frontend Nuxt.js de Pantalla del Recinto;
- servicio externo de captura/remapeo de dispositivos físicos.

El backend es la única autoridad de:

- estado global;
- sesión;
- preparación;
- presencia recibida desde los dispositivos;
- votaciones y resultados;
- cola y uso de la palabra;
- autoridades institucionales;
- generación de eventos y registros CSV.

Los frontends representan estado y envían comandos permitidos. Nunca deciden reglas de negocio.

## Invariantes que no se pueden reinterpretar

- Estados globales: `SIN_PREPARAR`, `PREPARANDO`, `SESION_ABIERTA`.
- El estado operativo se mantiene en memoria y no se restaura después de una caída.
- Una interrupción técnica obliga a una nueva preparación y nueva apertura reglamentaria.
- Una sola votación activa por vez.
- Mayoría simple y mayoría especial son tipos distintos.
- Mayoría simple: `positivos > negativos`; las abstenciones quedan fuera del cálculo; igualdad produce empate.
- Mayoría especial: factor explícito y base `PRESENTES` o `CUERPO`; igualdad exacta con el factor aprueba (`>=`).
- En mayoría especial sobre presentes, la abstención forma parte de votos emitidos y por tanto del denominador.
- Si falta el voto de algún presente al finalizar manualmente, la votación es `INCONCLUSA`.
- La pérdida de quórum durante una votación la convierte inmediatamente en `INCONCLUSA`.
- Una votación cerrada nunca se recalcula.
- Un voto ordinario emitido es irreversible y no puede ser modificado por Moderación.
- Presidencia es un rol independiente del rol Concejal. Una persona puede ejercer ambos sin que un rol altere el otro.
- Presidencia desempata únicamente una mayoría simple `EMPATADA`, desde Moderación, con voto positivo o negativo irreversible.
- Secretaría Legislativa es un rol institucional sin acciones funcionales en el sistema.
- Los votos individuales no se revelan en la Pantalla del Recinto hasta que la votación cierre.
- El Orden del Día es opcional y meramente asistencial.
- Toda interacción relevante desde `PREPARANDO` hasta cierre/cancelación se escribe de inmediato en tres CSV jerárquicos.

## Dispositivos

Mapa funcional vigente:

- `1`: voto positivo;
- `2`: abstención;
- `3`: voto negativo;
- `7`: pedir/retirar palabra; si el concejal está hablando, finalizar su uso;
- `8`: test visual del dispositivo;
- `9`: alternar presencia.

Durante `PREPARANDO` solo deben producir efecto funcional `8` y `9`.

En `SIN_PREPARAR` ninguna pulsación produce efecto funcional ni pertenece a los CSV de una sesión.

Debe preservarse como requisito arquitectónico un futuro **remapeo rápido** de dispositivo a concejal, incluso durante una votación, sin modificar presencia ni votos ya emitidos. El remapeo se registra y afecta solo el estado en memoria; no reescribe automáticamente la configuración base.

## Registros y auditoría

- Se generan tres CSV por preparación/sesión.
- Comparten fecha y hora de inicio en el nombre para evitar colisiones.
- Nivel 1 contiene L1+L2+L3.
- Nivel 2 contiene L2+L3.
- Nivel 3 contiene solo L3.
- Se escribe inmediatamente cada evento.
- Hora local del servidor, precisión a segundos.
- Al cancelar preparación o cerrar sesión se escribe el evento final y los archivos no vuelven a modificarse.
- Ante caída abrupta, los archivos quedan hasta el último evento efectivamente persistido y no se reparan retrospectivamente.

## Restricciones de implementación para agentes

Hasta que `docs/10-preguntas-abiertas.md` no cierre las decisiones técnicas:

- no iniciar scaffold productivo;
- no elegir por cuenta propia base de datos, transporte realtime, gestor de estado frontend, librerías UI, formato definitivo de configuración, estrategia de despliegue o estructura de monorepo;
- no introducir persistencia de sesión activa;
- no introducir autenticación de operador salvo decisión posterior explícita;
- no sustituir CSV por una base de datos como registro institucional;
- no agregar edición/corrección de votos;
- no validar la autoridad o contenido político/administrativo del Orden del Día.

## Calidad esperada

Cada cambio futuro debe:

- corresponder a reglas/casos de uso documentados;
- incluir pruebas proporcionales al riesgo;
- preservar las invariantes anteriores;
- mantener backend y frontends desacoplados por contratos claros;
- evitar secretos y datos reales en el repositorio;
- mantener trazabilidad entre requisito, implementación y prueba.

Si aparece una contradicción real entre documentos, no adivinar: detener únicamente el alcance afectado y documentar la inconsistencia.