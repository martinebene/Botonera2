# Configuración funcional

Ubicación reservada para la configuración y el padrón canónicos. WP-001 no
crea datos institucionales ni implementa todavía su lectura.

## Mensajes precargados de Apoyo Técnico

`apoyo-tecnico/mensajes.csv` guarda la biblioteca de mensajes que el puesto de
Apoyo Técnico puede publicar como aviso (WP-055). Es el **único** archivo de
`config/` que el backend escribe: lo administra por REST y lo reemplaza de
forma atómica.

Formato canónico, en UTF-8:

```
id,texto,destino
```

- `id`: identificador estable de 1 a 64 caracteres alfanuméricos, `-` o `_`.
  Lo genera el backend al crear el mensaje y no cambia al editarlo.
- `texto`: contenido de una sola línea, hasta 500 caracteres.
- `destino`: `MODERACION`, `RECINTO` o `AMBOS`.

Si el archivo no existe, la biblioteca simplemente está vacía. Si existe pero
no cumple el formato, el backend arranca igual, publica la biblioteca como no
disponible y **rechaza toda escritura** para no destruir su contenido: hay que
corregir el archivo a mano y reiniciar el backend.

Por eso el archivo vive en su propio subdirectorio: reemplazarlo de forma
atómica exige que el usuario del backend pueda escribir en el directorio que lo
contiene, mientras `system.toml` y `concejales.csv` siguen siendo de solo
lectura para el servicio.
