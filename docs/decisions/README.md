# Decisiones posteriores (DEC)

Este directorio se utilizará únicamente para decisiones nuevas que aparezcan durante la implementación y que modifiquen o precisen arquitectura, contratos globales, operación, calidad o criterios transversales.

## Regla

No crear un `DEC-XXX` para detalles locales y reversibles de implementación que un agente pueda resolver dentro de un WP sin alterar decisiones canónicas.

Crear un `DEC-XXX` cuando una decisión:

- afecte a más de un WP o componente;
- cambie una decisión técnica ya aprobada;
- establezca un contrato o restricción global nueva;
- tenga alternativas relevantes con consecuencias futuras;
- requiera aprobación humana antes de continuar.

## Convención

`DEC-NNN-descripcion-corta.md`

Cada decisión debe registrar como mínimo:

- contexto;
- decisión;
- alternativas consideradas cuando aporten valor;
- consecuencias;
- documentos/WPs afectados;
- estado: `PROPUESTA`, `APROBADA`, `REEMPLAZADA` o `RECHAZADA`.

Las decisiones ya cerradas DT-001 a DT-XXX permanecen en sus documentos canónicos actuales; no deben duplicarse retroactivamente aquí.
