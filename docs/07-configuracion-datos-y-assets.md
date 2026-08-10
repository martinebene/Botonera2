# 07 - Configuración, datos y assets

## 1. Principio

La configuración operacional se carga al iniciar `PREPARANDO` y queda congelada hasta cancelar preparación o cerrar sesión.

Los cambios posteriores en disco no afectan una ejecución activa.

## 2. Configuración mínima

Debe poder definir, como mínimo:

- fuente/padrón de concejales;
- quórum;
- disposición de bancas;
- tipos de votación permitidos para asistencia de carga;
- retardo para mostrar votos individuales en Moderación;
- temporizador inicial visual de votación;
- tiempo de permanencia del resultado público;
- directorio de registros CSV;
- assets de bancas/recinto que corresponda;
- parámetros técnicos del bridge que finalmente pertenezcan a su propio componente.

## 3. Valores actuales de referencia

La instalación histórica usa:

- quórum: 7;
- disposición por filas: 3, 4 y 5 bancas;
- total histórico: 12 concejales.

Estos valores son configuración de la instalación y no deben quedar dispersos como constantes de negocio.

## 4. Padrón de concejales

Esquema histórico de referencia:

`dni,nombre,apellido,bloque,presente,banca,dispositivo_votacion`

Para Botonera2:

- `dni`: obligatorio, identificador primario, único;
- `nombre`: obligatorio;
- `apellido`: obligatorio;
- `bloque`: puede estar vacío;
- `banca`: obligatoria, válida y única;
- `dispositivo_votacion`: obligatorio y único;
- cualquier valor histórico de `presente` se ignora funcionalmente al preparar: todos comienzan ausentes.

Un padrón inválido bloquea `Preparar sala`.

## 5. Congelamiento del padrón

Una vez iniciada la preparación, el conjunto de concejales y sus datos base no cambia durante esa preparación/sesión.

El remapeo rápido futuro será una excepción limitada a la asociación operativa dispositivo-concejal en memoria.

## 6. Tipos de votación

Deben provenir de archivo de configuración y no de código rígido ni de una pantalla administrativa cotidiana.

Lista histórica de referencia:

- Ratificación
- Despacho OP
- Despacho Gob
- Despacho AS
- Despacho HA
- Despacho Eco
- Mocion
- P. Sobre Tabla
- Otro

La lista definitiva instalada podrá cambiar sin modificar código.

El tipo es descriptivo y no reemplaza el campo explícito `tipo de mayoría`.

## 7. Mayorías

La configuración/formulario debe representar explícitamente:

- `SIMPLE`, sin factor;
- `ESPECIAL`, con factor y base `PRESENTES` o `CUERPO`.

No inferir mayoría simple a partir de factor 0, 0.5 ni valores nulos.

## 8. Temporizadores

Configurables.

Valores iniciales acordados:

- 4 s para retardo/cuenta regresiva visual inicial y referencia de visibilidad en Moderación;
- 6 s para permanencia del resultado en Pantalla del Recinto.

La semántica exacta de cada parámetro debe quedar nombrada explícitamente en la configuración para no acoplar temporizadores distintos accidentalmente.

## 9. Orden del Día

Formato histórico actual de referencia:

`nro_votacion;tipo;tema;factor_de_mayoria;respecto`

Separador `;`.

Su función es exclusivamente asistencial.

Botonera2 debe validar solo que pueda interpretar técnicamente el archivo. No debe imponer unicidad, secuencia ni legitimidad de los valores.

Si el archivo no puede leerse, la carga falla pero la sesión puede operar completamente con votaciones manuales.

## 10. Assets históricos

Fuente autorizada para descargar imágenes existentes:

`martinebene/Botonera`, rama `main`, ruta histórica:

`app/web/static/bancas/`

Incluye imágenes `1.png` a `12.png` usadas para representación de bancas.

Los agentes pueden copiar esos assets cuando se implemente la interfaz. No deben copiar el frontend histórico completo para obtenerlos.

## 11. Mapeo físico

La relación fingerprint físico -> dispositivo lógico pertenece al bridge de teclados.

El backend trabaja con identificadores lógicos de dispositivo y la asociación lógica dispositivo -> concejal cargada para la preparación.

El futuro remapeo rápido:

- modifica solo esta asociación en memoria;
- puede ocurrir durante votación;
- se registra;
- no modifica automáticamente archivos base.

## 12. Autoridades

Presidencia y Secretaría Legislativa no forman parte del padrón ni de la configuración fija. Se ingresan como texto libre en cada preparación y pueden cambiar durante la sesión.