"""Modulo de parseo y validacion sintactica para el simulador de dispositivos (WP-007).

Este modulo es responsable de:
1. Parsear la sintaxis compacta manual de entrada (`<numero-dispositivo>-<tecla>`).
2. Validar y estructurar archivos de escenarios declarativos en JSON.
3. Evaluar expectativas opcionales (`status_http`, `aceptada`, `motivo`) sobre las respuestas.
4. Generar resúmenes interpretados legibles para humanos sin alterar la respuesta literal.

Pedagogia y convenciones:
- Nombres de identificadores en espanol sin tildes ni eñes (DEC-001).
- El simulador no juzga la semantica del negocio: no restringe los dispositivos al padron
  ni las teclas a las actualmente habilitadas. Esa evaluacion corresponde exclusivamente al backend.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import cast

from modelos import (
    DiscrepanciaExpectativa,
    EscenarioDeclarativo,
    ExpectativaRespuesta,
    PasoConcurrente,
    PasoPausa,
    PasoPulsacion,
    PulsacionLogica,
    RespuestaServidor,
    TipoPaso,
)


class ErrorSintaxisEntrada(Exception):
    """Se produce cuando una entrada manual no cumple con la sintaxis `<numero>-<tecla>`."""


class ErrorFormatoEscenario(Exception):
    """Se produce cuando la estructura de un archivo de escenario JSON es invalida."""


def normalizar_identificador_dispositivo(numero_str: str) -> str:
    """Convierte un numero entero no negativo en la representacion logica canonica `devNN`.

    Ejemplos:
        '5' -> 'dev05'
        '0' -> 'dev00'
        '12' -> 'dev12'
        '99' -> 'dev99'
        '100' -> 'dev100'

    Args:
        numero_str: Cadena de texto que debe contener exclusivamente digitos decimales.

    Returns:
        Identificador logico normalizado con prefijo 'dev' y al menos 2 digitos.

    Raises:
        ErrorSintaxisEntrada: Si el valor no es un entero no negativo valido.
    """
    cadena_limpia = numero_str.strip()
    if not cadena_limpia.isdigit():
        raise ErrorSintaxisEntrada(
            f"El identificador de dispositivo '{numero_str}' debe ser un numero entero "
            "no negativo (sin letras ni prefijos)."
        )

    numero = int(cadena_limpia)
    return f"dev{numero:02d}"


def parsear_sintaxis_manual(entrada: str) -> PulsacionLogica:
    """Parsea una pulsacion ingresada en la sintaxis compacta `<numero-dispositivo>-<tecla>`.

    Reglas canónicas de WP-007:
    - El separador es exclusivamente el primer guion `-` encontrado.
    - La parte izquierda debe ser un numero entero no negativo (sin prefijo `dev`).
    - El simulador lo convierte a `devNN` con al menos dos digitos (ej. 5 -> dev05).
    - La parte derecha debe ser texto no vacio y representa la tecla literal.
    - Por usar solo el primer guion, `5--` se parsea como dispositivo `dev05` y tecla `-`.
    - No se valida si el dispositivo pertenece al padron (permite probar DISPOSITIVO_NO_ASIGNADO).
    - No se valida si la tecla tiene semantica actual (permite probar teclas no asignadas).

    Ejemplos validos:
        '5-9' -> PulsacionLogica(dispositivo='dev05', tecla='9')
        '12-8' -> PulsacionLogica(dispositivo='dev12', tecla='8')
        '5--' -> PulsacionLogica(dispositivo='dev05', tecla='-')
        '3-+' -> PulsacionLogica(dispositivo='dev03', tecla='+')
        '4-enter' -> PulsacionLogica(dispositivo='dev04', tecla='enter')

    Args:
        entrada: Cadena ingresada por el usuario o leida desde un argumento shell.

    Returns:
        Instancia de PulsacionLogica lista para ser enviada.

    Raises:
        ErrorSintaxisEntrada: Si la cadena no contiene guion, el dispositivo no es numerico
            o la tecla esta vacia.
    """
    cadena = entrada.strip()
    if not cadena:
        raise ErrorSintaxisEntrada("La entrada no puede estar vacia.")

    if "-" not in cadena:
        raise ErrorSintaxisEntrada(
            f"Entrada '{entrada}' invalida: falta el separador '-'. "
            "El formato esperado es <numero>-<tecla> (ejemplo: '5-9' o '12-8')."
        )

    # Dividir unicamente por el primer guion
    parte_dispositivo, parte_tecla = cadena.split("-", 1)

    if not parte_dispositivo:
        raise ErrorSintaxisEntrada(
            f"Entrada '{entrada}' invalida: falta el numero de dispositivo antes del guion."
        )

    if not parte_tecla:
        raise ErrorSintaxisEntrada(
            f"Entrada '{entrada}' invalida: falta la tecla despues del guion (ejemplo: '5-9')."
        )

    dispositivo_normalizado = normalizar_identificador_dispositivo(parte_dispositivo)
    return PulsacionLogica(dispositivo=dispositivo_normalizado, tecla=parte_tecla)


def parsear_expectativa(datos: Mapping[str, object]) -> ExpectativaRespuesta:
    """Parsea el bloque opcional `esperado` de una pulsacion en un escenario.

    Campos soportados:
    - `status_http`: entero (ejemplo: 200, 422, 503).
    - `aceptada`: booleano (True o False).
    - `motivo`: cadena de texto con el codigo de motivo (ejemplo: 'PRESENCIA_ACTUALIZADA').

    Args:
        datos: Diccionario con los campos de expectativa.

    Returns:
        Instancia de ExpectativaRespuesta.

    Raises:
        ErrorFormatoEscenario: Si alguno de los campos tiene un tipo invalido.
    """
    status_http: int | None = None
    aceptada: bool | None = None
    motivo: str | None = None

    if "status_http" in datos:
        valor_status = datos["status_http"]
        if not isinstance(valor_status, int) or isinstance(valor_status, bool):
            raise ErrorFormatoEscenario(
                f"El campo 'status_http' debe ser un entero, recibido: {valor_status!r}"
            )
        status_http = valor_status

    if "aceptada" in datos:
        valor_aceptada = datos["aceptada"]
        if not isinstance(valor_aceptada, bool):
            raise ErrorFormatoEscenario(
                f"El campo 'aceptada' en 'esperado' debe ser un booleano (true/false), "
                f"recibido: {valor_aceptada!r}"
            )
        aceptada = valor_aceptada

    if "motivo" in datos:
        valor_motivo = datos["motivo"]
        if not isinstance(valor_motivo, str):
            raise ErrorFormatoEscenario(
                f"El campo 'motivo' en 'esperado' debe ser un texto, recibido: {valor_motivo!r}"
            )
        motivo = valor_motivo

    return ExpectativaRespuesta(
        status_http=status_http,
        aceptada=aceptada,
        motivo=motivo,
    )


def _parsear_paso_pulsacion(datos: dict[str, object]) -> PasoPulsacion:
    """Parsea un diccionario que representa una pulsacion individual en un escenario."""
    esperado: ExpectativaRespuesta | None = None
    if "esperado" in datos:
        esperado_raw = datos["esperado"]
        if not isinstance(esperado_raw, dict):
            raise ErrorFormatoEscenario("El campo 'esperado' en un paso debe ser un objeto JSON.")
        esperado_dict = cast(dict[str, object], esperado_raw)
        esperado = parsear_expectativa(esperado_dict)

    # Puede especificarse mediante 'entrada': '5-9' o mediante 'dispositivo' y 'tecla'
    if "entrada" in datos:
        entrada_raw = datos["entrada"]
        if not isinstance(entrada_raw, str):
            raise ErrorFormatoEscenario(
                f"El campo 'entrada' debe ser una cadena de texto, recibido: {entrada_raw!r}"
            )
        try:
            pulsacion = parsear_sintaxis_manual(entrada_raw)
        except ErrorSintaxisEntrada as err:
            raise ErrorFormatoEscenario(
                f"Error al parsear 'entrada' en paso de escenario: {err}"
            ) from err
        return PasoPulsacion(pulsacion=pulsacion, esperado=esperado)

    if "dispositivo" in datos and "tecla" in datos:
        dispositivo_raw = datos["dispositivo"]
        tecla_raw = datos["tecla"]
        if not isinstance(dispositivo_raw, str) or not isinstance(tecla_raw, str):
            raise ErrorFormatoEscenario(
                "Los campos 'dispositivo' y 'tecla' deben ser cadenas de texto."
            )
        if not dispositivo_raw.strip() or not tecla_raw.strip():
            raise ErrorFormatoEscenario(
                "Los campos 'dispositivo' y 'tecla' no pueden estar vacios."
            )
        return PasoPulsacion(
            pulsacion=PulsacionLogica(dispositivo=dispositivo_raw.strip(), tecla=tecla_raw),
            esperado=esperado,
        )

    raise ErrorFormatoEscenario(
        "Un paso de pulsacion debe contener el campo 'entrada' (ejemplo: '1-9') "
        "o ambos campos 'dispositivo' y 'tecla'."
    )


def parsear_escenario_json(
    contenido_o_datos: str | Mapping[str, object],
) -> EscenarioDeclarativo:
    """Parsea y valida la estructura de un archivo de escenario JSON.

    Estructura soportada:
    ```json
    {
      "nombre": "nombre-del-escenario",
      "precondicion": "estado previo requerido",
      "pasos": [
        {"entrada": "1-9", "esperado": {"status_http": 200, "aceptada": true}},
        {"pausa_ms": 100},
        {
          "concurrentes": [
            {"entrada": "2-9"},
            {"entrada": "3-4", "esperado": {"status_http": 200}}
          ]
        }
      ]
    }
    ```

    Args:
        contenido_o_datos: Cadena de texto JSON o diccionario ya cargado.

    Returns:
        Instancia de EscenarioDeclarativo validada.

    Raises:
        ErrorFormatoEscenario: Si el JSON es invalido o no cumple la estructura requerida.
    """
    if isinstance(contenido_o_datos, str):
        try:
            datos_cargados: object = json.loads(contenido_o_datos)
        except json.JSONDecodeError as err:
            raise ErrorFormatoEscenario(
                f"El contenido del escenario no es un JSON valido: {err}"
            ) from err
    else:
        datos_cargados = contenido_o_datos

    if not isinstance(datos_cargados, dict):
        raise ErrorFormatoEscenario(
            "El escenario JSON debe tener un objeto raíz con campos "
            "'nombre', 'precondicion' y 'pasos'."
        )

    datos = cast(dict[str, object], datos_cargados)

    nombre = str(datos.get("nombre", "escenario-sin-nombre"))
    precondicion = str(datos.get("precondicion", ""))

    pasos_raw = datos.get("pasos")
    if not isinstance(pasos_raw, list):
        raise ErrorFormatoEscenario(
            "El escenario debe contener una lista 'pasos' con al menos un elemento."
        )

    lista_pasos_crudos = cast(list[object], pasos_raw)
    if len(lista_pasos_crudos) == 0:
        raise ErrorFormatoEscenario("La lista 'pasos' del escenario no puede estar vacia.")

    pasos_parseados: list[TipoPaso] = []

    for indice, paso_crudo in enumerate(lista_pasos_crudos, start=1):
        if not isinstance(paso_crudo, dict):
            raise ErrorFormatoEscenario(
                f"El paso #{indice} debe ser un objeto JSON, recibido: {paso_crudo!r}"
            )

        paso_dict = cast(dict[str, object], paso_crudo)

        # Caso 1: Pausa en milisegundos o segundos
        if "pausa_ms" in paso_dict:
            pausa_ms = paso_dict["pausa_ms"]
            if not isinstance(pausa_ms, int) or isinstance(pausa_ms, bool) or pausa_ms < 0:
                raise ErrorFormatoEscenario(
                    f"El paso #{indice} especifica 'pausa_ms' invalido: debe ser un entero >= 0."
                )
            pasos_parseados.append(PasoPausa(milisegundos=pausa_ms))
            continue

        if "pausa_segundos" in paso_dict:
            pausa_seg = paso_dict["pausa_segundos"]
            if (
                not isinstance(pausa_seg, (int, float))
                or isinstance(pausa_seg, bool)
                or pausa_seg < 0
            ):
                raise ErrorFormatoEscenario(
                    f"El paso #{indice} especifica 'pausa_segundos' invalido: "
                    "debe ser un numero >= 0."
                )
            pasos_parseados.append(PasoPausa(milisegundos=int(pausa_seg * 1000)))
            continue

        # Caso 2: Grupo concurrente
        if "concurrentes" in paso_dict:
            concurrentes_raw = paso_dict["concurrentes"]
            if (
                not isinstance(concurrentes_raw, list)
                or len(cast(list[object], concurrentes_raw)) == 0
            ):
                raise ErrorFormatoEscenario(
                    f"El paso #{indice} especifica 'concurrentes' que debe ser una lista no vacia."
                )
            lista_concurrentes = cast(list[object], concurrentes_raw)
            pulsaciones_concurrentes: list[PasoPulsacion] = []
            for sub_indice, sub_paso in enumerate(lista_concurrentes, start=1):
                if not isinstance(sub_paso, dict):
                    raise ErrorFormatoEscenario(
                        f"En paso #{indice}, elemento concurrente #{sub_indice} debe ser un objeto."
                    )
                sub_paso_dict = cast(dict[str, object], sub_paso)
                pulsaciones_concurrentes.append(_parsear_paso_pulsacion(sub_paso_dict))
            pasos_parseados.append(PasoConcurrente(pulsaciones=pulsaciones_concurrentes))
            continue

        # Caso 3: Pulsacion individual
        pasos_parseados.append(_parsear_paso_pulsacion(paso_dict))

    return EscenarioDeclarativo(
        nombre=nombre,
        precondicion=precondicion,
        pasos=pasos_parseados,
    )


def evaluar_expectativas(
    respuesta: RespuestaServidor | None,
    esperado: ExpectativaRespuesta | None,
) -> list[DiscrepanciaExpectativa]:
    """Evalua si una respuesta del servidor cumple con las expectativas declaradas.

    Reglas de WP-007:
    - Las expectativas son opcionales. Si esperado es None o no tiene campos, no hay discrepancias.
    - Se evalua `status_http`.
    - Si se especifica `aceptada` o `motivo`, se intenta parsear el cuerpo como JSON.
    - Si el cuerpo no es JSON valido o no tiene la estructura requerida, se genera una
      discrepancia explicativa clara sin ocultar la respuesta literal recibida.

    Args:
        respuesta: Respuesta recibida del servidor (o None si hubo error de red).
        esperado: Expectativas a contrastar.

    Returns:
        Lista de discrepancias encontradas (vacia si se cumplieron todas).
    """
    if esperado is None or not esperado.tiene_expectativas:
        return []

    discrepancias: list[DiscrepanciaExpectativa] = []

    if respuesta is None:
        discrepancias.append(
            DiscrepanciaExpectativa(
                campo="comunicacion",
                esperado="Respuesta HTTP del servidor",
                obtenido="Fallo de red / sin respuesta",
                detalle="No se pudo obtener respuesta HTTP del servidor para evaluar expectativas.",
            )
        )
        return discrepancias

    # 1. Validar status HTTP
    if esperado.status_http is not None and respuesta.status_http != esperado.status_http:
        discrepancias.append(
            DiscrepanciaExpectativa(
                campo="status_http",
                esperado=esperado.status_http,
                obtenido=respuesta.status_http,
                detalle=(
                    f"Status HTTP esperado {esperado.status_http}, "
                    f"pero se recibio {respuesta.status_http}."
                ),
            )
        )

    # 2. Validar campos dentro del JSON si se declararon
    necesita_json = esperado.aceptada is not None or esperado.motivo is not None
    if necesita_json:
        try:
            datos_crudos: object = json.loads(respuesta.cuerpo_literal)
        except Exception as err:
            discrepancias.append(
                DiscrepanciaExpectativa(
                    campo="json_invalido",
                    esperado="Cuerpo JSON interpretable",
                    obtenido=respuesta.cuerpo_literal,
                    detalle=(
                        "No se pudo parsear el cuerpo recibido como JSON para verificar "
                        f"expectativas ('aceptada'/'motivo'): {err}"
                    ),
                )
            )
            return discrepancias

        if not isinstance(datos_crudos, dict):
            discrepancias.append(
                DiscrepanciaExpectativa(
                    campo="formato_json",
                    esperado="Objeto JSON con campos DTO",
                    obtenido=type(datos_crudos).__name__,
                    detalle="El JSON devuelto no es un objeto/diccionario.",
                )
            )
            return discrepancias

        datos_json = cast(dict[str, object], datos_crudos)

        if esperado.aceptada is not None:
            valor_aceptada = datos_json.get("aceptada")
            if valor_aceptada != esperado.aceptada:
                discrepancias.append(
                    DiscrepanciaExpectativa(
                        campo="aceptada",
                        esperado=esperado.aceptada,
                        obtenido=valor_aceptada,
                        detalle=(
                            f"Campo 'aceptada' esperado: {esperado.aceptada!r}, "
                            f"recibido: {valor_aceptada!r}."
                        ),
                    )
                )

        if esperado.motivo is not None:
            valor_motivo = datos_json.get("motivo")
            if valor_motivo != esperado.motivo:
                discrepancias.append(
                    DiscrepanciaExpectativa(
                        campo="motivo",
                        esperado=esperado.motivo,
                        obtenido=valor_motivo,
                        detalle=(
                            f"Campo 'motivo' esperado: {esperado.motivo!r}, "
                            f"recibido: {valor_motivo!r}."
                        ),
                    )
                )

    return discrepancias


def formatear_resumen_respuesta(cuerpo_literal: str) -> str | None:
    """Genera una linea resumen breve cuando el cuerpo de la respuesta es un DTO conocido.

    Esta linea es puramente complementaria para comodidad humana y NUNCA reemplaza
    a la salida literal obligatoria.

    Args:
        cuerpo_literal: Texto exacto recibido en la respuesta HTTP.

    Returns:
        Cadena con el resumen (ejemplo: '[resumen] aceptada=True motivo=PRESENCIA_ACTUALIZADA')
        o None si el cuerpo no es un DTO JSON con esos campos.
    """
    if not cuerpo_literal or not cuerpo_literal.strip():
        return None

    try:
        datos_crudos: object = json.loads(cuerpo_literal)
    except Exception:
        return None

    if not isinstance(datos_crudos, dict):
        return None

    datos = cast(dict[str, object], datos_crudos)

    if "aceptada" in datos and "motivo" in datos:
        aceptada = datos["aceptada"]
        motivo = datos["motivo"]
        resumen = f"[resumen] aceptada={aceptada} motivo={motivo}"

        # Si incluye concejal o resultado breve, podemos sumar contexto util
        concejal_obj = datos.get("concejal")
        if isinstance(concejal_obj, dict):
            concejal_dict = cast(dict[str, object], concejal_obj)
            nombre = str(concejal_dict.get("nombre", ""))
            apellido = str(concejal_dict.get("apellido", ""))
            banca = str(concejal_dict.get("banca", ""))
            if nombre or apellido:
                resumen += f" concejal='{nombre} {apellido}' banca={banca}"

        resultado_obj = datos.get("resultado")
        if isinstance(resultado_obj, dict):
            res_dict = cast(dict[str, object], resultado_obj)
            tipo_resultado = str(res_dict.get("tipo", ""))
            if tipo_resultado == "PRESENCIA":
                presente = res_dict.get("presente")
                presentes = res_dict.get("presentes")
                quorum = res_dict.get("quorum_alcanzado")
                resumen += f" (presente={presente}, total={presentes}, quorum={quorum})"
            elif tipo_resultado == "TEST":
                activo = res_dict.get("activo")
                duracion = res_dict.get("duracion_segundos")
                resumen += f" (test_activo={activo}, duracion={duracion}s)"

        return resumen

    return None
