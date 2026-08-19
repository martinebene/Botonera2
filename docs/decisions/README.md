# Decisiones posteriores (DEC)

Este directorio se utiliza únicamente para decisiones nuevas que aparezcan durante la implementación y que modifiquen o precisen arquitectura, contratos globales, operación, calidad o criterios transversales.

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

## Decisiones vigentes

- `DEC-001-estilo-codigo-y-referencia-produccion.md`: código propio en español, documentación pedagógica, explicación para principiantes en PR y fallback funcional/UX/visual a producción.
- `DEC-002-lanzador-work-packages.md`: lanzador local para validar autorización y preparar rama + worktree + CLI de agente para WPs posteriores a WP-001.
- `DEC-003-herramientas-mcp-agentes.md`: Context7, Nuxt MCP, Playwright MCP y GitHub MCP/integración equivalente; reglas de uso, disponibilidad, aviso, fallback seguro y secretos.
- `DEC-004-orquestacion-revision-secuencial-y-sincronizacion.md`: ChatGPT Web como orquestador preferido, revisión independiente secuencial en el worktree del WP, excepción administrativa original para `PLAN.md` y sincronización GitHub/local obligatoria.
- `DEC-005-planificacion-y-autoridad-documental-del-orquestador.md`: ChatGPT Web concentra también la planificación documental y, con aprobación humana explícita, puede mantener directamente en `main` la documentación canónica acordada; código y cambios ejecutables conservan rama + PR.
