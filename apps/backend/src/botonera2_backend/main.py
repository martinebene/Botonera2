"""Aplicación importable por un servidor ASGI en ejecución productiva."""

from botonera2_backend.aplicacion import crear_aplicacion

# Los servidores ASGI buscan habitualmente una variable de módulo llamada
# ``app``. El nombre está impuesto por esa integración externa; toda la creación
# propia permanece concentrada y testeable en ``crear_aplicacion``.
app = crear_aplicacion()
