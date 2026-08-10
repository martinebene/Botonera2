# 10 - Decisiones técnicas abiertas

Las reglas de negocio principales ya están cerradas en `01-reglas-de-negocio.md`.

Las decisiones técnicas aprobadas se registran en `12-decisiones-tecnicas.md` y, para despliegue/operación, en `13-despliegue-y-operacion.md`.

Este archivo contiene **únicamente decisiones técnicas todavía abiertas**. Los agentes no deben resolverlas unilateralmente.

## Arquitectura, backend/datos, frontend, calidad y despliegue ya cerrados

Quedaron resueltas DT-001 a DT-032.

Ver:

- `12-decisiones-tecnicas.md` para DT-001 a DT-026;
- `13-despliegue-y-operacion.md` para DT-027 a DT-032.

Resumen de despliegue cerrado:

- Linux Mint 22.3 Cinnamon como plataforma de producción de referencia;
- servicios nativos mediante systemd, sin Docker/Compose;
- frontends Nuxt como SPA estáticas servidas por Nginx;
- Moderación, Recinto y `/api/v1` bajo un mismo origen;
- releases inmutables con symlink `current` y rollback a la release anterior;
- configuración y logs fuera del árbol de releases;
- ningún despliegue deliberado durante `PREPARANDO` o `SESION_ABIERTA`;
- CSV institucionales conservados localmente en la primera versión, sin backup automático externo.

## Prioridad F - Trabajo con agentes

### DT-033 Modelo de ramas
Definir rama estable, ramas de trabajo, PR obligatoria y política de merge.

### DT-034 Tamaño de unidades de trabajo
Definir cómo descomponer la implementación en work packages pequeños y verificables.

### DT-035 Documentación para agentes
Definir artefactos adicionales: decisiones técnicas, planes, matrices de trazabilidad, especificaciones de work packages y checklist de entrega.

### DT-036 Agentes/herramientas
Definir herramientas principales (Codex, Claude Code, OpenCode, etc.), funciones de cada una y cómo evitar que varios agentes modifiquen el mismo alcance simultáneamente.

### DT-037 Revisión independiente
Definir que un agente distinto del implementador revise cada PR crítica y qué fuentes debe usar.

### DT-038 Autoridad de cambios
Definir qué decisiones puede tomar un agente por sí mismo y cuáles requieren decisión humana/documentada.

## Criterio para comenzar a programar

Antes del primer scaffold productivo deben estar cerradas DT-033 a DT-038.

Una vez cerradas, el repositorio tendrá definidas las reglas de negocio, arquitectura, stack, calidad, despliegue y gobernanza mínima necesaria para comenzar implementación incremental con agentes.

Cada decisión aprobada debe retirarse de este archivo y trasladarse a documentación canónica antes de que los agentes dependan de ella.
