# 07 — Configuración, datos y assets

## 1. Principio

Botonera2 debe distinguir entre:

- configuración del sistema;
- datos institucionales variables;
- datos de una sesión;
- assets visuales.

No debe incorporar datos reales sensibles en fixtures, pruebas o documentación técnica.

## 2. Configuración observada en producción

El `config.json` de `main` contiene conceptualmente:

- ruta de archivo de concejales;
- directorio de logs;
- quórum;
- disposición de bancas.

El valor productivo observado de quórum es `7`, pero **quórum es configuración**, no una constante de dominio embebida en código.

La disposición observada es:

```json
{
  "filas": [
    { "fila": 3, "columnas": 5 },
    { "fila": 2, "columnas": 4 },
    { "fila": 1, "columnas": 3 }
  ]
}
```

Esto suma 12 bancas.

Botonera2 debe validar:

- filas válidas;
- columnas positivas;
- bancas suficientes y no duplicadas;
- consistencia con la nómina de concejales de la sesión.

## 3. Fuente de concejales

El MVP carga un CSV con columnas:

```text
dni,nombre,apellido,bloque,presente,banca,dispositivo_votacion
```

Comportamiento observado:

- filas sin `dni` se ignoran;
- `presente` reconoce variantes como `true`, `1`, `si`, `sí`, `yes`;
- banca inválida termina como `0` en el MVP;
- campos de texto se recortan con `trim`/`strip`.

### Requisito para Botonera2

La nueva implementación no debe copiar silenciosamente tolerancias peligrosas como convertir una banca inválida en `0`.

Debe validar explícitamente los datos antes de permitir abrir una sesión y reportar errores comprensibles.

La fuente inicial puede seguir siendo archivo si eso simplifica la primera versión, pero la persistencia definitiva es una decisión técnica separada.

## 4. Datos reales

No duplicar en esta documentación:

- DNI reales;
- mapeos físicos de teclados;
- fingerprints;
- logs de sesiones reales.

Las pruebas deben usar concejales ficticios.

## 5. Identificador lógico de dispositivo

El backend trabaja con identificadores lógicos como:

```text
dev01
dev02
...
```

El servicio físico mantiene por separado la relación fingerprint físico → identificador lógico.

Botonera2 solo necesita conocer el identificador lógico para resolver la relación con el concejal.

## 6. Mapeo físico

En el código productivo del servicio de teclados, el mapeo se guarda fuera del backend en:

`devices_services/teclados_fisicos/data/mapeo_teclados.json`

No copiar ese archivo ni sus valores reales a Botonera2.

## 7. Assets de bancas

### Fuente histórica autorizada

Las imágenes vigentes pueden descargarse desde:

- repositorio: `martinebene/Botonera`;
- rama: `main`;
- snapshot de referencia: `537823b4a0045853c74a388058fa3739cf7457a5`;
- ruta: `app/web/static/bancas/`;
- archivos observados: `1.png` a `12.png`.

Estas imágenes son una de las dos razones expresamente autorizadas para consultar el repositorio anterior.

### Regla de incorporación

Cuando comience la implementación:

1. descargar solo los assets necesarios;
2. incorporarlos al nuevo repositorio en una ubicación propia del frontend/shared assets;
3. conservar correspondencia nombre/número de banca;
4. no importar HTML, CSS o JS junto con las imágenes;
5. documentar la procedencia en el commit o archivo de assets.

## 8. Orden del Día

El archivo del Orden del Día es un dato operativo local del frontend, no configuración permanente del sistema.

Formato canónico inicial extraído del código productivo:

```text
nro_votacion;tipo;tema;factor_de_mayoria;respecto
```

No versionar órdenes del día reales dentro de Botonera2.

Para pruebas, usar archivos ficticios mínimos que cubran:

- mayoría simple;
- mayoría especial;
- Presentes;
- Cuerpo;
- tipo conocido;
- tipo desconocido → Otro;
- archivo inválido.

## 9. Rutas y entorno

El MVP depende fuertemente de rutas relativas y del directorio actual de ejecución. Eso es un detalle técnico legado, no un requisito.

Botonera2 debe resolver configuración y rutas de forma reproducible desde entornos de desarrollo y producción.

## 10. Configuración que deberá quedar explícita

Como mínimo:

- quórum;
- fuente de concejales;
- disposición de bancas;
- configuración de persistencia;
- política de logs;
- origen permitido de los frontends/CORS si se despliegan separados;
- endpoint y credenciales solo si alguna integración futura las requiere.

No incluir secretos en Git.
