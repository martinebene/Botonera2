# 09 — Fuentes y trazabilidad

## 1. Regla de autoridad usada para esta extracción

Para reconstruir el sistema vigente se utilizó esta jerarquía:

1. **código ejecutable de `martinebene/Botonera`, rama `main`**;
2. configuración y archivos de ejemplo efectivamente consumidos por ese código;
3. documentación, README y comentarios solo para contextualizar;
4. rama `v2` únicamente para detectar cambios no productivos, dudas o intentos de mejora.

Snapshot productivo analizado:

`537823b4a0045853c74a388058fa3739cf7457a5`

Snapshot `v2` observado:

`9330812aaed93bc79e5043d3d34061c6aa19a7a0`

A partir de ahora, la documentación de **Botonera2** es canónica. El repositorio histórico solo se consulta en los casos autorizados por `README.md` y `AGENTS.md`.

## 2. Matriz de reglas → código de producción

| Área | Fuente principal en `main` | Reglas extraídas |
|---|---|---|
| Sesión | `app/services/sesion_service.py` | unicidad, carga de concejales, apertura, cierre, cierre forzado de votación en curso |
| Modelo de sesión | `app/models/sesion.py` | campos de sesión, votaciones, cola y orador |
| Concejal | `app/models/concejal.py` | datos, banca, dispositivo, test visual |
| Carga de concejales | `app/services/concejal_service.py` | columnas CSV y tolerancias de carga |
| Entrada de teclados | `app/services/input_service.py` | mapa 1/2/3/7/8/9, presencia, palabra, validaciones |
| Endpoint físico | `app/api/routes/entradas.py` | `POST /entradas/tecla` y body dispositivo/tecla |
| Servicio físico | `devices_services/teclados_fisicos/input_devices_service.py` | POST real al endpoint, identificador lógico, normalización de teclas, mapeo externo |
| Votación | `app/models/votacion.py` | estados, voto único, autocierre, fórmulas, INCONCLUSA, desempate |
| Servicio de votación | `app/services/votacion_service.py` | precondiciones, quórum, cierre automático/forzado, empate pendiente |
| API de Moderación | `app/api/routes/moderacion.py` | comandos disponibles y parámetros históricos |
| Estado global | `app/api/routes/estados.py` | proyección histórica consumida por frontends |
| Configuración | `config.json`, `app/config/settings.py` | quórum y disposición de bancas configurables |
| Logging | `app/utils/logging.py` | niveles 1/2/3, secuencia y eventos recientes |
| Moderación UI | `app/web/static/moderacion/index.html`, `app/web/static/moderacion/app.js` | cuatro áreas, Orden del Día, controles y actualización |
| Pantalla pública | `app/web/static/pantalla/index.html`, `app/web/static/pantalla/app.js` | secreto de voto, cuenta regresiva, resultado 6 s, recinto, palabra |
| Assets | `app/web/static/bancas/` | imágenes 1.png a 12.png |
| Orden del Día real | `app/web/static/moderacion/Orden del dia 3.csv` y parser de `app.js` | separador `;` y cinco campos |

## 3. Contradicciones históricas detectadas

### 3.1 Mapa de teclas

Documentación histórica describe mapas anteriores. El código productivo `app/services/input_service.py` ejecuta:

- `1` Positivo;
- `2` Abstención;
- `3` Negativo;
- `7` palabra;
- `8` test;
- `9` presencia.

**Decisión de extracción:** prevalece el código.

### 3.2 Orden del Día

Manuales/comentarios antiguos mencionan CSV con coma y RFC4180.

El parser que realmente ejecuta `main` define:

`nro_votacion;tipo;tema;factor_de_mayoria;respecto`

y divide las filas por `;`. Los archivos reales de ejemplo de `main` también usan `;`.

**Decisión de extracción:** prevalece el código y los archivos consumidos por él.

### 3.3 Secreto de votos

Moderación y Pantalla pública no tienen el mismo comportamiento:

- Moderación: oculta inicialmente y luego puede revelar durante `EN_CURSO`;
- Pantalla pública: mantiene los votos ocultos mientras `EN_CURSO` y los revela al cierre.

No se unificó por inferencia. La política de Moderación queda abierta.

### 3.4 Acreditación previa a sesión

`main` rechaza cualquier tecla si no existe sesión activa.

`v2` introduce el concepto de preparar sesión y acreditar presencia antes de abrirla.

**Decisión de extracción:** no se adopta `v2` por no estar validada en producción. Queda como posible mejora futura.

## 4. Comportamientos sospechosos del código que NO se convierten en requisito

La existencia de un comportamiento en código no implica que un bug deba preservarse. Los siguientes casos deben caracterizarse y resolverse explícitamente.

### 4.1 Nueva votación con empate pendiente

`VotacionService.abrir_votacion()` bloquea únicamente si `votacion_actual.estado == EN_CURSO`.

Si `votacion_actual` está `EMPATADA`, el código puede permitir abrir otra votación y reemplazar la referencia a la empatada.

Esto contradice conceptualmente la idea de “votación pendiente de desempate”. Se trata como defecto/ambigüedad, no como regla.

### 4.2 Cierre de sesión con empate pendiente

`SesionService.cerrar_sesion()` fuerza cierre solo si la votación actual está `EN_CURSO`.

Una referencia `EMPATADA` puede quedar fuera del flujo normal al cerrar sesión.

No se adopta como requisito.

### 4.3 Mayoría especial sobre presentes con cierre forzado y cero votos

`Votacion.cerrar()` calcula primero la división de mayoría especial y recién después aplica `INCONCLUSA`.

Con cero votos y mayoría especial sobre presentes existe riesgo de división por cero.

Botonera2 debe definir y probar el caso; no reproducir el fallo.

### 4.4 Denominador “presentes”

El código usa `votos_emitidos` como denominador de mayoría especial sobre presentes, no `cantidad_presentes`.

Esto se documenta exactamente como comportamiento, pero requiere decisión semántica antes de considerar la regla definitiva de la nueva implementación.

### 4.5 Serialización histórica

`Sesion.to_dict()` entrega `en_uso_de_palabra` de forma distinta a la cola y depende de la serialización de FastAPI/Pydantic.

No es una regla funcional y no debe copiarse.

### 4.6 Estado en memoria

Los singletons del MVP son locales a cada proceso. Esto puede producir divergencias con múltiples workers.

No es requisito. Botonera2 debe diseñar una autoridad de estado coherente para su topología de despliegue.

## 5. Uso permitido del repositorio histórico en el futuro

Los agentes solo deben consultarlo para:

### Assets

`martinebene/Botonera@537823b.../app/web/static/bancas/`

### Validación excepcional de regla

Cuando un documento de Botonera2:

- marque una pregunta abierta;
- cite explícitamente un archivo histórico;
- o la tarea ordene verificar el comportamiento del sistema anterior.

No usarlo para copiar arquitectura, componentes o implementación.

## 6. Documentación histórica

Archivos como:

- `README.md`;
- `Manual_Usuario_Botonera.md`;
- `Instructivo Instalacion.pdf`;
- documentación agregada en `v2`;

pueden ayudar a comprender intención, operación o infraestructura pasada, pero **no son fuente de verdad para reglas de negocio**.

## 7. Regla para nuevas discrepancias

Si durante el desarrollo se descubre que:

- Botonera2 dice A;
- el código histórico dice B;

se implementa **A**, salvo que el responsable del producto decida actualizar la especificación.

Si Botonera2 no define el caso, el agente debe registrarlo como pregunta abierta y no resolverlo por analogía con el legado.
