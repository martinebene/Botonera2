# Botonera2

Reimplementación desde cero del sistema de votación del Concejo Deliberante de Puerto Madryn.

## Objetivo

Construir una nueva versión mantenible y verificable compuesta por:

- backend FastAPI como única autoridad de estado y reglas de negocio;
- frontend Nuxt.js de Moderación;
- frontend Nuxt.js de Pantalla del Recinto;
- servicio/bridge independiente para capturar los teclados físicos y enviar sus pulsaciones al backend.

La documentación de este repositorio es la especificación canónica para Botonera2 y debe permitir que agentes de programación implementen el sistema sin reinterpretar las reglas institucionales.

## Fuentes históricas

El sistema actualmente en producción está en `martinebene/Botonera`, rama `main`.

Referencia histórica de producción:
- repositorio: `https://github.com/martinebene/Botonera`
- rama: `main`
- snapshot usado para el relevamiento inicial: `537823b4a0045853c74a388058fa3739cf7457a5`

Existe además una rama histórica `v2`, no validada en producción. Puede aportar contexto técnico, pero no es fuente normativa.

### Regla de autoridad

1. La documentación vigente de **Botonera2** manda para la nueva implementación.
2. Para reglas extraídas del sistema anterior, se tomó como fuente de verdad el **código ejecutable de `Botonera/main`**, no su documentación antigua.
3. `Botonera/v2`, README, manuales, comentarios y documentación histórica sirven solo como contexto salvo referencia expresa.
4. El repositorio histórico solo debe consultarse en el futuro para descargar assets o validar explícitamente una regla dudosa.

## Ciclo funcional global

El sistema tiene tres estados globales:

`SIN_PREPARAR -> PREPARANDO -> SESION_ABIERTA -> SIN_PREPARAR`

- `SIN_PREPARAR`: no existe interacción funcional con los dispositivos.
- `PREPARANDO`: se cargan configuración y concejales, se identifican autoridades, se acredita presencia y se prueban teclados.
- `SESION_ABIERTA`: se habilitan votaciones y uso de la palabra.
- Cancelar preparación o cerrar sesión devuelve el sistema a `SIN_PREPARAR`.

El estado operativo es deliberadamente **volátil y en memoria**. Una interrupción técnica no se recupera: reglamentariamente corresponde preparar nuevamente la sala y abrir una nueva sesión.

## Principios funcionales centrales

- Una sola preparación/sesión activa por vez.
- Una sola votación activa por vez.
- El backend decide toda transición de negocio.
- La presencia la cambia únicamente el dispositivo físico del concejal.
- Cada concejal puede emitir como máximo un voto ordinario por votación y ese voto es irreversible.
- Presidencia es un rol institucional independiente del rol Concejal.
- El voto presidencial de desempate existe solo para mayorías simples empatadas.
- Mayoría simple y mayoría especial son conceptos distintos.
- Las votaciones públicas mantienen secretos los votos individuales hasta el cierre.
- Todas las interacciones relevantes se escriben inmediatamente en tres archivos CSV jerárquicos.
- El Orden del Día es solo una ayuda de carga; no es autoridad para el sistema y no limita qué puede votar el cuerpo.

## Lectura obligatoria para agentes

1. `AGENTS.md`
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

`docs/10-preguntas-abiertas.md` ya no contiene preguntas reglamentarias principales: desde ahora concentra decisiones técnicas previas a la implementación.

## Estado actual

Las reglas de negocio principales fueron relevadas y resueltas antes de iniciar la nueva implementación. Todavía no debe escribirse código de producto hasta cerrar las decisiones técnicas de arquitectura, stack, contratos, estructura del repositorio, pruebas, despliegue y flujo de trabajo con agentes.