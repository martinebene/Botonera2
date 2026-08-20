"""Traducción uniforme de errores de dominio/técnicos a respuestas HTTP.

El contrato de errores de la API (documento 04, sección 6) exige una forma
estable para que los clientes decidan por ``codigo`` y no por textos
variables:

```json
{
  "codigo": "CODIGO_ESTABLE",
  "mensaje": "Mensaje legible por personas."
}
```

Este módulo concentra los manejadores de excepciones de FastAPI que producen
esa forma. Registrar manejadores por tipo (en lugar de ``try/except`` en cada
endpoint) permite que los Work Packages posteriores reutilicen exactamente el
mismo mapeo para sus propios comandos: basta con que el servicio lance la
excepción de dominio adecuada.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from botonera2_backend.auditoria import ErrorAuditoria
from botonera2_backend.configuracion.errores import (
    ErrorPadronInvalido,
    ErrorTomlInvalido,
    ErrorValidacionConfiguracion,
)
from botonera2_backend.dominio.errores import ErrorEstadoIncompatible


class ErrorRespuesta(BaseModel):
    """Cuerpo JSON estable de toda respuesta de error funcional/técnica.

    ``codigo`` es el identificador estable legible por máquina; ``mensaje``
    aporta diagnóstico humano seguro (nunca trazas ni datos internos).
    """

    codigo: str
    mensaje: str


def _respuesta_error(status_code: int, codigo: str, mensaje: str) -> JSONResponse:
    """Construye el ``JSONResponse`` con la forma canónica del contrato."""

    return JSONResponse(
        status_code=status_code,
        content=ErrorRespuesta(codigo=codigo, mensaje=mensaje).model_dump(),
    )


# Los manejadores declaran el parámetro como ``Exception`` (y no como el tipo
# concreto) porque esa es la firma que FastAPI/Starlette tipan para
# ``add_exception_handler``: el framework garantiza en runtime que cada
# manejador solo se invoca con instancias de la clase registrada, y los
# mensajes de estas excepciones son deterministas y seguros de exponer.


async def manejar_error_estado_incompatible(_solicitud: Request, error: Exception) -> JSONResponse:
    """409 cuando el comando no es válido para el estado global actual."""

    return _respuesta_error(409, "ESTADO_INCOMPATIBLE", str(error))


async def manejar_error_configuracion(_solicitud: Request, error: Exception) -> JSONResponse:
    """503 cuando ``system.toml`` no puede cargarse o validarse.

    Registrado para ``ErrorTomlInvalido`` y ``ErrorValidacionConfiguracion``.
    Se usa 503 (y no 422) porque el cliente no envía el archivo: la
    configuración inválida es una indisponibilidad técnica del backend para
    preparar, no un error del pedido (documento 04, sección 6).
    """

    return _respuesta_error(503, "CONFIGURACION_INVALIDA", str(error))


async def manejar_error_padron(_solicitud: Request, error: Exception) -> JSONResponse:
    """503 cuando ``concejales.csv`` no cumple el contrato canónico."""

    return _respuesta_error(503, "PADRON_INVALIDO", str(error))


async def manejar_error_auditoria(_solicitud: Request, error: Exception) -> JSONResponse:
    """503 cuando no puede garantizarse la auditoría obligatoria.

    Registrado para ``ErrorAuditoria``: cubre creación del conjunto,
    persistencia de eventos y cierre, incluidas las subclases como
    ``ErrorEscritorNoDisponible`` (escritor cerrado o en fallo cerrado).
    """

    return _respuesta_error(503, "AUDITORIA_NO_DISPONIBLE", str(error))


def registrar_manejadores_errores(aplicacion: FastAPI) -> None:
    """Asocia cada excepción conocida con su traducción HTTP estable.

    FastAPI busca el manejador por la clase concreta de la excepción recorriendo
    su jerarquía, así que cada tipo se registra explícitamente. Los fallos no
    clasificados siguen llegando al manejador genérico ``ERROR_INTERNO`` que
    registra ``aplicacion.py``.
    """

    aplicacion.add_exception_handler(ErrorEstadoIncompatible, manejar_error_estado_incompatible)
    aplicacion.add_exception_handler(ErrorTomlInvalido, manejar_error_configuracion)
    aplicacion.add_exception_handler(ErrorValidacionConfiguracion, manejar_error_configuracion)
    aplicacion.add_exception_handler(ErrorPadronInvalido, manejar_error_padron)
    aplicacion.add_exception_handler(ErrorAuditoria, manejar_error_auditoria)
