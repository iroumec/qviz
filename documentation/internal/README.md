# Notas internas de trabajo

Esta carpeta guarda el material que no forma parte del libro publicado con
Quarto: la especificación, las notas de diseño, los prompts que se usaron con
los agentes, las listas de prueba para Qollab y las guías de estilo que se
siguieron durante el hackathon.

**Es pública a propósito.** El equipo decidió (2026-10-22) que no se saca nada
del repositorio público: esconder los prompts de IA o las instrucciones de los
agentes hacía al proyecto menos honesto, no más profesional. Tenerlas acá las
separa de `documentation/docs/`, que es el libro que leen los lectores.

- `spec.md`: la fuente de verdad de la arquitectura, el contrato JSON y el plan
  por módulos.
- `qollab_context.md`, `qollab_pruebas.md`: qué permite Qollab y cómo probar el
  paquete ahí.
- `DESIGN.md`, `feature_*.md`, `decision_*.md`: notas de diseño y de features.
- `python-slop/`, `javascript-slop/`, `python_validator.md`: las guías de
  revisión que se usaron para quitar complejidad accidental.

`AGENTS.md` y `CLAUDE.md` quedan en la raíz porque los agentes los leen de ahí.
`memory.md` también vive acá: es el traspaso entre sesiones.
