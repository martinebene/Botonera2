"""Contexto operativo activo de una preparación de sala (WP-005).

La preparación es la entidad que existe mientras el sistema está en
``PREPARANDO`` y que, en Work Packages posteriores, se extenderá para
convertirse en el contexto operativo de la sesión abierta (modelo de dominio,
sección 2). Reúne en un solo lugar todo lo que la operación ``Preparar sala``
deja congelado o inicializado:

- la fecha/hora local real de inicio;
- los snapshots inmutables de configuración y padrón (WP-003);
- las presencias dinámicas, que comienzan todas en ausente (RN-PRE-01);
- el escritor de auditoría CSV que persiste los eventos institucionales
  de esta preparación (WP-004).

El dataclass no es ``frozen`` a propósito: WPs posteriores mutarán las
presencias (tecla ``9``) y agregarán número de sesión, autoridades y demás
datos operativos. Los snapshots de configuración y padrón sí son objetos
inmutables, por lo que su congelamiento no depende de esta clase.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from botonera2_backend.auditoria import EscritorAuditoriaCsv, NivelAuditoria
from botonera2_backend.configuracion.modelos import ConfiguracionSistema, Padron


@dataclass(slots=True)
class Preparacion:
    """Estado operativo de la única preparación que puede existir por vez.

    Atributos:
        fecha_hora_inicio: hora local real en que comenzó la preparación. Los
            nombres de los CSV pueden diferir en segundos por la regla de
            colisión nominal, pero este valor conserva siempre la hora real.
        configuracion: snapshot congelado de ``system.toml`` (RN-CFG-01).
        padron: snapshot congelado de ``concejales.csv`` (RN-CON-07).
        presencias: mapa ``dni -> presente``. Toda preparación comienza con
            todos los concejales ausentes (RN-CON-06, RN-PRE-01). Lo mutarán
            los WPs de entradas físicas; nunca proviene del archivo de padrón.
        escritor_auditoria: conjunto L1/L2/L3 activo de esta preparación. Es
            la referencia que los WPs posteriores usarán para persistir sus
            eventos sin crear un segundo mecanismo de auditoría.
    """

    fecha_hora_inicio: datetime
    configuracion: ConfiguracionSistema
    padron: Padron
    presencias: dict[str, bool]
    escritor_auditoria: EscritorAuditoriaCsv

    def rutas_auditoria(self) -> tuple[Path, ...]:
        """Devuelve las rutas de los tres CSV activos, en orden L1, L2, L3.

        Es una vista de conveniencia para exponer en ``EstadoOperativo`` las
        rutas del conjunto vigente sin duplicar su administración: la
        autoridad sobre los archivos sigue siendo el escritor de WP-004. Se
        itera sobre ``NivelAuditoria`` (y no sobre el orden interno del
        escritor) para que el orden del resultado sea explícito y estable.
        """

        return tuple(self.escritor_auditoria.rutas[nivel] for nivel in NivelAuditoria)
