# 13 - Despliegue y operación

Este documento registra las decisiones técnicas cerradas para el despliegue inicial de Botonera2.

Complementa `12-decisiones-tecnicas.md`. Las decisiones todavía abiertas permanecen en `10-preguntas-abiertas.md`.

## DT-027 - Sistema operativo objetivo

La plataforma de producción de referencia será **Linux Mint 22.3 Cinnamon**.

La implementación no debe acoplarse innecesariamente a Linux Mint: backend, frontends, tooling y scripts deben conservar compatibilidad razonable con Linux estándar cuando no exista una necesidad específica del hardware.

Linux Mint se adopta como referencia porque la máquina de producción también opera navegador, pantallas y dispositivos físicos del recinto.

## DT-028 - Servicios nativos con systemd

La primera versión se desplegará de forma nativa mediante **systemd**, sin Docker/Compose.

Servicios principales previstos:

- `botonera2-backend.service`;
- `botonera2-device-bridge.service`;
- Nginx como servicio del sistema.

El backend mantiene un único proceso/worker según DT-005.

No introducir contenedores por iniciativa propia. Una futura migración a contenedores requiere decisión técnica explícita, especialmente por la interacción del bridge con hardware físico.

## DT-029 - Frontends Nuxt como SPA estáticas

Los frontends de Moderación y Pantalla del Recinto se construirán como aplicaciones Nuxt client-side/SPA estáticas.

Principios:

- no habrá servidores Node/Nitro permanentes en producción para estos frontends;
- Nginx servirá los archivos HTML/CSS/JS generados;
- Moderación y Recinto consumirán FastAPI mediante REST + SSE;
- no se necesita SSR para el objetivo institucional de Botonera2.

La configuración concreta de build debe respetar Nuxt 4 y el funcionamiento bajo subrutas definido en DT-030.

## DT-030 - Nginx y mismo origen

La instalación utilizará **Nginx** como punto de entrada HTTP y un único origen lógico.

Estructura objetivo conceptual:

```text
http://botonera/
├── /moderacion/
├── /recinto/
└── /api/v1/
```

Nginx:

- sirve ambos frontends estáticos;
- hace proxy de `/api/v1/` hacia FastAPI en loopback;
- configura correctamente los endpoints SSE para entrega inmediata sin buffering indebido;
- evita la necesidad normal de CORS entre frontend y backend al mantenerlos bajo el mismo origen.

Los puertos internos exactos pueden ser configuración de despliegue siempre que no cambien este contrato externo.

## DT-031 - Releases inmutables y rollback

Producción no se actualizará mediante `git pull` sobre el árbol activo.

Estructura objetivo conceptual:

```text
/opt/botonera2/
├── releases/
│   ├── <release-A>/
│   ├── <release-B>/
│   └── <release-C>/
├── current -> releases/<release-activa>
├── config/
└── logs/
```

Cada release debe ser inmutable y estar identificada de forma trazable, preferentemente por commit o artefacto derivado de un commit conocido.

Procedimiento general:

1. partir de una versión cuya CI esté aprobada;
2. preparar/buildar una nueva release sin alterar `current`;
3. comprobar que el sistema operativo esté en `SIN_PREPARAR` antes de reemplazar la versión activa;
4. cambiar el enlace `current` a la nueva release;
5. reiniciar los servicios necesarios;
6. ejecutar verificaciones de salud;
7. si la nueva versión falla, volver al enlace de la release anterior y reiniciar.

No se despliega ni reinicia deliberadamente Botonera2 durante `PREPARANDO` o `SESION_ABIERTA`, porque el estado activo es volátil y una interrupción obliga reglamentariamente a comenzar nuevamente.

Configuración y registros viven fuera de `releases/` para que actualización y rollback no los sustituyan ni eliminen.

## DT-032 - Registros conservados solo localmente en la primera versión

En la primera versión **no se implementará backup automático externo** de los CSV institucionales.

Los registros:

- se conservan localmente en el directorio de logs definido por configuración;
- permanecen fuera del árbol de releases;
- no deben eliminarse por despliegues, rollback, builds o limpieza de versiones;
- mantienen la retención indefinida definida funcionalmente salvo intervención administrativa externa.

Una política futura de segunda copia, NAS, nube, cifrado o retención automatizada requerirá una decisión técnica posterior.

Esta decisión no reduce las garantías de escritura inmediata `flush` + `fsync` de DT-012: únicamente define que la primera versión no agrega una segunda copia automática.

## Consecuencias para los agentes

Sin una decisión posterior documentada, los agentes no deben:

- sustituir Linux Mint como plataforma de referencia productiva por otra distribución asumida;
- introducir Docker/Compose;
- desplegar Nuxt mediante servidores Node permanentes;
- separar frontend y API en orígenes públicos diferentes sin necesidad explícita;
- actualizar producción mediante `git pull` sobre la instalación activa;
- colocar configuración o logs dentro de una release inmutable;
- desplegar mientras exista preparación o sesión activa;
- agregar por iniciativa propia servicios de backup remoto o dependencias de nube.
