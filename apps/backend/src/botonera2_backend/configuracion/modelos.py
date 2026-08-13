"""Modelos tipados e inmutables de configuración y padrón (WP-003).

Este módulo define las estructuras de datos que el backend entrega como
**snapshots congelados**: una vez cargados desde disco, ningún cambio
posterior de los archivos puede alterarlos (criterio CA-059 y RN-CON-07).

Se usan ``dataclasses`` con ``frozen=True`` y ``slots=True``:

- ``frozen`` impide reasignar atributos después de la construcción;
- ``slots`` evita agregar atributos dinámicos por error y ahorra memoria;
- las colecciones se guardan como ``tuple`` (inmutable) en lugar de ``list``,
  de modo que no exista ninguna referencia externa mutable que pueda alterar
  el snapshot por accidente.

Todos los identificadores propios están en español, sin tildes ni ``ñ``,
conforme a DEC-001. Los nombres de las claves del TOML canónico se conservan
en inglés porque forman parte del contrato de archivo aprobado en WP-003.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ConfiguracionSistema:
    """Configuración funcional congelada cargada desde ``config/system.toml``.

    Representa la disposición de bancas, el quórum, los tipos de votación
    asistenciales, los temporizadores de los frontends y el directorio de
    registros CSV. Se construye una única vez por carga y no cambia aunque el
    archivo de disco sea modificado después (congelamiento de configuración).
    """

    quorum: int
    """Cantidad mínima de concejales presentes para sesionar."""

    filas_bancas: tuple[int, ...]
    """Disposición del recinto: cantidad de bancas de cada fila."""

    tipos_votacion: tuple[str, ...]
    """Tipos descriptivos de votación, en el orden configurado."""

    moderacion_revelado_votos_segundos: int | float
    """Retardo antes de revelar votos individuales en Moderación.

    Es un número no negativo (puede ser entero o decimal, p. ej. ``0.5``);
    se conserva el tipo que vino en el archivo: un ``4`` sigue siendo ``int``
    y un ``4.5`` queda como ``float``, sin conversión silenciosa.
    """

    recinto_cuenta_regresiva_inicial_segundos: int | float
    """Cuenta regresiva/efecto visual inicial de votación en el Recinto.

    Número no negativo con la misma semántica de tipo que el retardo de
    Moderación: entero o decimal, sin conversión silenciosa.
    """

    recinto_resultado_publico_segundos: int | float
    """Tiempo de permanencia del resultado en la pantalla pública.

    Número no negativo (entero o decimal), sin conversión silenciosa.
    """

    directorio_registros: str
    """Directorio donde se escribirán los CSV de auditoría en el futuro."""

    @property
    def capacidad_total(self) -> int:
        """Cantidad total de bancas del recinto: ``sum(room.rows)``.

        Es la capacidad contra la cual se valida la cantidad exacta de
        concejales del padrón (RN-CON-04).
        """
        return sum(self.filas_bancas)


@dataclass(frozen=True, slots=True)
class Concejal:
    """Datos base congelados de un concejal del padrón (RN-CON-01 a RN-CON-05).

    El DNI es el identificador primario (se conserva como texto, porque es la
    identidad y no se realizan operaciones aritméticas con él). ``bloque``
    puede quedar vacío; banca y dispositivo de votación son asociaciones
    únicas dentro del padrón. ``ruta_imagen`` es una ruta interna del propio
    sistema: no se hardcodea imagen por número de banca (RN-CON-05).
    """

    dni: str
    nombre: str
    apellido: str
    bloque: str
    banca: int
    dispositivo_votacion: str
    ruta_imagen: str


@dataclass(frozen=True, slots=True)
class Padron:
    """Padrón completo congelado, en el orden de las filas del CSV.

    Contiene la secuencia de concejales que una futura preparación (WP-005)
    utilizará como base. Al igual que la configuración, una vez cargado no
    cambia aunque el archivo de disco sea reemplazado.
    """

    concejales: tuple[Concejal, ...]
    """Concejales cargados, en el orden del archivo de padrón."""
