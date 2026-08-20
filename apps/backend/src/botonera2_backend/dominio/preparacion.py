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

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from botonera2_backend.auditoria import EscritorAuditoriaCsv, NivelAuditoria
from botonera2_backend.configuracion.modelos import ConfiguracionSistema, Padron


def _crear_expiraciones_test() -> dict[str, float]:
    """Crea el mapa mutable independiente de cada preparación."""

    return {}


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
        expiraciones_test: mapa ``dni -> instante monotónico`` del test visual
            más recientemente activado. Es estado operativo temporal, no un
            nuevo estado de negocio ni una fuente alternativa de presencia.
        escritor_auditoria: conjunto L1/L2/L3 activo de esta preparación. Es
            la referencia que los WPs posteriores usarán para persistir sus
            eventos sin crear un segundo mecanismo de auditoría.
    """

    fecha_hora_inicio: datetime
    configuracion: ConfiguracionSistema
    padron: Padron
    presencias: dict[str, bool]
    escritor_auditoria: EscritorAuditoriaCsv
    expiraciones_test: dict[str, float] = field(default_factory=_crear_expiraciones_test)

    def cantidad_presentes(self) -> int:
        """Cuenta las presencias actuales sin guardar un contador paralelo.

        El diccionario ``presencias`` es la única fuente de verdad. Recalcular
        el total al responder una pulsación evita que un contador cacheado pueda
        quedar desfasado después de una futura extensión del ciclo operativo.
        """

        return sum(1 for presente in self.presencias.values() if presente)

    def quorum_alcanzado(self) -> bool:
        """Indica si la cantidad derivada de presentes alcanza el quórum.

        El umbral pertenece a ``configuracion``, que fue congelada al preparar.
        Por eso este método no carga archivos ni conserva un segundo valor de
        quórum en la preparación.
        """

        return self.cantidad_presentes() >= self.configuracion.quorum

    def activar_test_dispositivo(self, dni: str, ahora: float) -> None:
        """Activa o renueva el indicador visual de un concejal.

        ``ahora`` proviene de un reloj monotónico: no cambia si el reloj civil se
        ajusta. La expiración nueva se compara con la anterior y se conserva la
        más lejana, de modo que repetir una tecla ``8`` nunca acorta un test que
        todavía tenía una ventana posterior.
        """

        expiracion_nueva = ahora + self.configuracion.device_test_seconds
        expiracion_anterior = self.expiraciones_test.get(dni)
        if expiracion_anterior is None or expiracion_nueva > expiracion_anterior:
            self.expiraciones_test[dni] = expiracion_nueva

    def test_dispositivo_activo(self, dni: str, ahora: float) -> bool:
        """Consulta el test sin crear una tarea de fondo para apagarlo.

        La expiración se evalúa al consultar, por lo que el estado queda
        inactivo automáticamente cuando ``ahora`` alcanza el instante guardado.
        No hace falta modificar el diccionario ni ejecutar timers en segundo
        plano, una propiedad importante para mantener el estado volátil simple.
        """

        expiracion = self.expiraciones_test.get(dni)
        return expiracion is not None and ahora < expiracion

    def rutas_auditoria(self) -> tuple[Path, ...]:
        """Devuelve las rutas de los tres CSV activos, en orden L1, L2, L3.

        Es una vista de conveniencia para exponer en ``EstadoOperativo`` las
        rutas del conjunto vigente sin duplicar su administración: la
        autoridad sobre los archivos sigue siendo el escritor de WP-004. Se
        itera sobre ``NivelAuditoria`` (y no sobre el orden interno del
        escritor) para que el orden del resultado sea explícito y estable.
        """

        return tuple(self.escritor_auditoria.rutas[nivel] for nivel in NivelAuditoria)
