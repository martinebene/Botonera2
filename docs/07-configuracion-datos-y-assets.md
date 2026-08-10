# 07 - Configuración, datos y assets

## 1. Principio

La configuración operacional se carga al iniciar `PREPARANDO` y queda congelada hasta cancelar preparación o cerrar sesión.

Los cambios posteriores en disco no afectan una ejecución activa.

La primera versión no utiliza base de datos: estado operativo en memoria, configuración en archivos, padrón en CSV y auditoría en CSV.

## 2. Estructura de configuración

Estructura inicial canónica:

```text
config/
├── system.toml
└── concejales.csv

services/device-bridge/
└── config/
    └── devices.json
```

`system.toml` concentra configuración funcional/técnica del backend; `concejales.csv` contiene el padrón; `devices.json` pertenece exclusivamente al bridge físico.

## 3. Configuración mínima de `system.toml`

Debe poder definir, como mínimo:

- fuente/padrón de concejales;
- quórum;
- disposición de bancas;
- tipos de votación permitidos para asistencia de carga;
- retardo para mostrar votos individuales en Moderación;
- temporizador/efecto visual inicial de votación;
- tiempo de permanencia del resultado público;
- directorio de registros CSV;
- assets de bancas/recinto cuando corresponda.

Cada parámetro debe tener nombre semántico explícito. No reutilizar una única constante para temporizadores que representen comportamientos distintos aunque inicialmente compartan valor.

## 4. Valores actuales de referencia

La instalación histórica usa:

- quórum: 7;
- disposición por filas: 3, 4 y 5 bancas;
- total histórico: 12 concejales.

Son configuración de instalación y no constantes de negocio.

## 5. Padrón de concejales

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

## 6. Congelamiento del padrón

Una vez iniciada la preparación, el conjunto de concejales y sus datos base no cambia durante esa preparación/sesión.

El reemplazo urgente de un teclado **no modifica el padrón ni la relación lógica concejal-dispositivo del backend**. Se resuelve en el bridge reasignando un nuevo fingerprint físico al mismo identificador lógico.

## 7. Tipos de votación

Deben provenir de `system.toml` y no de código rígido ni de una pantalla administrativa cotidiana.

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

La lista instalada puede cambiar sin modificar código.

El tipo es descriptivo y no reemplaza el campo explícito `tipo de mayoría`.

## 8. Mayorías

La configuración/formulario representa explícitamente:

- `SIMPLE`, sin factor;
- `ESPECIAL`, con factor y base `PRESENTES` o `CUERPO`.

No inferir mayoría simple a partir de factor 0, 0.5 ni valores nulos.

## 9. Temporizadores

Configurables.

Valores iniciales acordados:

- 4 s para retardo/cuenta regresiva visual inicial y referencia de visibilidad en Moderación;
- 6 s para permanencia del resultado en Pantalla del Recinto.

## 10. Orden del Día

Formato histórico actual de referencia:

`nro_votacion;tipo;tema;factor_de_mayoria;respecto`

Separador `;`.

Su función es exclusivamente asistencial.

El archivo se envía al backend, que realiza el parseo y valida solo que pueda interpretarlo técnicamente. No impone unicidad, secuencia ni legitimidad de valores.

Si no puede leerse, la carga falla pero la sesión puede operar completamente con votaciones manuales.

## 11. Assets históricos

Fuente autorizada para descargar imágenes existentes:

`martinebene/Botonera`, rama `main`, ruta histórica:

`app/web/static/bancas/`

Incluye imágenes `1.png` a `12.png` usadas para representación de bancas.

Los agentes pueden copiar esos assets cuando implementen la interfaz. No deben copiar el frontend histórico completo para obtenerlos.

## 12. Mapeo físico

Responsabilidades separadas:

```text
fingerprint físico -> device-bridge -> identificador lógico -> backend -> concejal
```

`devices.json` contiene la asociación física del bridge.

El backend recibe identificadores lógicos y conserva estable durante la preparación la asociación lógica cargada desde el padrón.

El remapeo rápido:

- reemplaza en el bridge el fingerprint físico asociado a un identificador lógico existente;
- puede ocurrir durante votación;
- no altera presencia, votos ni identidad del concejal;
- se registra;
- no modifica automáticamente los archivos base;
- se inicia desde Moderación a través del backend, nunca mediante conexión directa del navegador al bridge.

## 13. Autoridades

Presidencia y Secretaría Legislativa no forman parte del padrón ni de la configuración fija. Se ingresan como texto libre en cada preparación y pueden cambiar durante la sesión.

## 14. Dependencias y versiones

- Python: 3.14, gestionado con `uv` y `uv.lock`.
- Node.js: 24 LTS.
- JavaScript/TypeScript: `pnpm` workspaces y `pnpm-lock.yaml`.
- Frontends: Nuxt 4 + TypeScript estricto.
- Estilos: Tailwind CSS v4 + componentes propios.

Las actualizaciones de dependencias deben ser deliberadas y revisadas; nunca una actualización automática de producción.
