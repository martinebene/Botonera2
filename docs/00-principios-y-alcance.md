# 00 — Principios y alcance

## 1. Propósito

Botonera2 reemplazará mediante una implementación nueva al sistema de gestión de sesiones y votación electrónica actualmente operativo en el Concejo Deliberante de Puerto Madryn.

El objetivo de esta fase documental es separar con claridad:

- **qué debe hacer el sistema**;
- **qué comportamiento está comprobado en producción**;
- **qué aspectos del MVP son solo detalles técnicos históricos**;
- **qué decisiones todavía requieren definición**.

## 2. Alcance funcional

El sistema debe cubrir:

1. gestión de una sesión legislativa activa;
2. carga de la nómina de concejales y asignación de banca/dispositivo;
3. acreditación de presencia durante una sesión;
4. cálculo y visualización de quórum;
5. apertura, desarrollo y cierre de votaciones;
6. mayoría simple y mayoría especial;
7. cómputo de mayoría especial respecto de presentes o cuerpo;
8. abstenciones;
9. empate y voto de desempate;
10. cierre automático y cierre forzado de votaciones;
11. pedidos, cola y otorgamiento de uso de la palabra;
12. recepción de pulsaciones desde dispositivos físicos externos;
13. carga local de Orden del Día para agilizar la moderación;
14. visualización del recinto, presencia, palabra y resultados;
15. registro de eventos operativos;
16. dos interfaces independientes: Moderación y Pantalla de Recinto.

## 3. Arquitectura objetivo fijada

### Backend

- FastAPI.
- Autoridad única del estado y de las reglas de negocio.
- Expone comandos y lecturas a los dos frontends y a la integración de teclados.

### Frontend 1 — Moderación

- Nuxt.js.
- Uso operativo por la autoridad o personal de sesión.
- Permite comandar sesión, votaciones y palabra, además de visualizar estado y eventos.

### Frontend 2 — Pantalla de Recinto

- Nuxt.js.
- Solo lectura funcional.
- Destinada a proyección pública en el recinto.
- Debe respetar especialmente el secreto de los votos mientras la votación esté en curso.

### Integración de teclados

- Servicio externo al backend.
- Detecta dispositivos físicos y transforma su identidad física en un identificador lógico.
- Envía pulsaciones al backend mediante HTTP.
- No decide si una tecla puede o no producir una acción.

## 4. Fuera de alcance inicial

No se considera requisito extraído del MVP:

- autenticación o autorización de usuarios;
- operación por Internet;
- multi-organismo o multi-tenant;
- múltiples sesiones simultáneas;
- múltiples votaciones simultáneas;
- firma digital;
- expediente electrónico;
- almacenamiento histórico consultable mediante UI;
- edición de concejales desde la interfaz;
- administración de dispositivos físicos desde Nuxt;
- un tercer frontend de monitor técnico.

Estos puntos requieren una decisión propia antes de incorporarse.

## 5. Reimplementación limpia

La nueva solución no debe portar la estructura interna del MVP. Debe conservar el comportamiento expresamente documentado y puede mejorar:

- tipado;
- separación de responsabilidades;
- validaciones;
- pruebas;
- persistencia;
- serialización;
- manejo de errores;
- contrato entre backend y Nuxt;
- observabilidad;
- mantenibilidad.

Una mejora técnica no puede cambiar el resultado funcional de una regla sin decisión previa.

## 6. Fuente histórica

Fuente primaria de extracción:

- `martinebene/Botonera`, rama `main`, snapshot `537823b4a0045853c74a388058fa3739cf7457a5`.

Fuente secundaria no normativa:

- `martinebene/Botonera`, rama `v2`, snapshot `9330812aaed93bc79e5043d3d34061c6aa19a7a0`.

La rama `v2` contiene comportamientos y una refactorización no validados en producción. Ninguna diferencia de `v2` se adopta automáticamente.

## 7. Regla de interpretación

Cuando código productivo, comentarios y manual histórico discrepan, para reconstruir el comportamiento vigente se tomó como evidencia principal **el camino ejecutable de `main`**. Las discrepancias relevantes se registran en `docs/09-fuentes-y-trazabilidad.md` y `docs/10-preguntas-abiertas.md`.

Desde este momento, las reglas consolidadas de Botonera2 pasan a ser la fuente canónica.
