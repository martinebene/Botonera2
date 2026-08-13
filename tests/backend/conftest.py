"""Configuración compartida de las pruebas asíncronas del backend."""

import pytest


@pytest.fixture
def anyio_backend() -> str:
    """Ejecuta AnyIO sobre asyncio, el loop usado por el runtime de este WP.

    ``anyio_backend`` conserva el nombre requerido por el plugin externo de
    pytest; el contenido propio de la fixture permanece documentado en español.
    """

    return "asyncio"
