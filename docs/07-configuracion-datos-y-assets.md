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

Contrato canónico de Botonera2:

```text
dni,nombre,apellido,bloque,banca,dispositivo_votacion,ruta_imagen
```

Reglas:

- `dni`: obligatorio, identificador primario, único;
- `nombre`: obligatorio;
- `apellido`: obligatorio;
- `bloque`: puede estar vacío;
- `banca`: obligatoria, válida y única;
- `dispositivo_votacion`: obligatorio y único;
- `ruta_imagen`: obligatoria y debe ser una ruta interna del propio sistema, no una URL externa.

La presencia **no forma parte del archivo de padrón**: es un dato operativo dinámico y toda preparación comienza con todos los concejales ausentes.

El padrón actualmente versionado contiene los datos de instalación tomados del sistema histórico en producción (`martinebene/Botonera`, SHA `537823b4a0045853c74a388058fa3739cf7457a5`). Esa procedencia determina las identidades, bloques, bancas y dispositivos lógicos instalados, pero no modifica el contrato estable de Botonera2: las filas se ordenan por banca, `ruta_imagen` permanece explícita y la columna histórica `presente` se omite porque la presencia sigue siendo estado dinámico.

La cantidad de filas del padrón debe coincidir exactamente con la cantidad total de bancas definida por la disposición configurada en `system.toml` (suma de `room.rows`). Las bancas deben ser únicas, estar dentro de esa capacidad y cubrir completamente la disposición configurada.

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

- `SIMPLE`, con entrada de factor omitida/nula/cero y base omitida o `VOTOS_COMPUTABLES`; se normaliza a factor `0` y base `VOTOS_COMPUTABLES`;
- `ESPECIAL`, con factor real finito `> 0 <= 1` y base `VOTOS_COMPUTABLES`, `PRESENTES` o `CUERPO`.

`tipo_mayoria` es autoritativo: no inferir mayoría simple o especial a partir del factor. `VOTOS_COMPUTABLES` cuenta positivos + negativos; `PRESENTES` cuenta votos emitidos, incluidas abstenciones; `CUERPO` usa el padrón congelado.

## 9. Temporizadores

Configurables.

Valores iniciales acordados:

- 4 s para retardo/cuenta regresiva visual inicial y referencia de visibilidad en Moderación;
- 6 s para permanencia del resultado en Pantalla del Recinto.

## 10. Orden del Día

Su función es exclusivamente asistencial. Moderación envía el archivo al backend y el backend es el único componente que lo parsea.

### Formato canónico Botonera2

Botonera2 acepta **únicamente** el nuevo CSV explícito:

```text
nro_votacion,tipo,tema,tipo_mayoria,factor,base
```

Reglas del contrato:

- formato CSV estándar con separador coma `,` y soporte de campos entre comillas cuando el contenido incluya comas;
- encabezado obligatorio con esas seis columnas y ese significado;
- `nro_votacion`: número externo usado para precargar el formulario; no se valida secuencia ni unicidad institucional;
- `tipo`: texto descriptivo que se copia al formulario;
- `tema`: texto descriptivo;
- `tipo_mayoria`: `SIMPLE` o `ESPECIAL`;
- si `tipo_mayoria = SIMPLE`, `factor` puede estar vacío o contener `0`, y `base` puede estar vacía o contener `VOTOS_COMPUTABLES`; el punto normalizado usa factor `0` y esa base;
- si `tipo_mayoria = ESPECIAL`, `factor` debe contener un real finito `> 0 <= 1` y `base` debe ser `VOTOS_COMPUTABLES`, `PRESENTES` o `CUERPO`;
- el parser puede normalizar mayúsculas/minúsculas de los valores enumerados, pero el modelo normalizado interno debe usar los valores canónicos anteriores;
- no se infiere el tipo de mayoría desde `factor=0`, factor vacío ni ningún otro valor: siempre manda `tipo_mayoria`.

El backend valida únicamente la legibilidad y coherencia técnica necesarias para interpretar este contrato. No impone unicidad, secuencia ni legitimidad institucional de los puntos.

Si el archivo no puede interpretarse, se rechaza la carga completa pero la sesión sigue pudiendo operar mediante votaciones manuales.

### Incompatibilidad deliberada con el formato histórico

El formato histórico de producción utilizaba cinco columnas:

```text
nro_votacion,tipo,tema,factor_de_mayoria,respecto
```

Ese formato **no es aceptado por Botonera2**. Debe convertirse al formato canónico antes de la importación.

No se implementará un adaptador automático que interprete `factor=0` o vacío como mayoría simple. Esta incompatibilidad evita reintroducir en la nueva arquitectura la semántica histórica implícita que DT-039 decidió eliminar.

## 11. Assets históricos

Fuente autorizada para descargar imágenes existentes:

`martinebene/Botonera`, rama `main`, ruta histórica:

`app/web/static/bancas/`

Incluye imágenes `1.png` a `12.png` usadas para representación de bancas.

Botonera2 no debe hardcodear la imagen por número de banca. La ruta interna correspondiente a cada concejal se declara en `ruta_imagen` dentro de `concejales.csv`.

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
