---
name: anti-ai-slop-python
description: Audita y limpia "AI slop" en proyectos Python (código y estructura de archivos) sin alterar el comportamiento ni romper la arquitectura, cruzando todo con spec.md. Primero detecta y reporta, y solo después de la aprobación del usuario aplica cambios. Usala siempre que el usuario mencione AI slop, limpiar código generado por IA, deslop, revisar o refactorizar código Python que escribió una IA, comentarios de más, try/except defensivos, sobreingeniería, utils.py cajón de sastre, archivos duplicados o desordenados, o pida "dejar el código como si lo hubiera escrito una persona", aunque no diga "slop".
---

# Anti-AI-Slop para Python

El "slop" es código que parece correcto y completo pero agrega ruido, riesgo o complejidad sin aportar valor: comentarios que narran, defensas contra estados imposibles, abstracciones de un solo uso, archivos duplicados, imports inventados. Los LLM tienden a priorizar que algo funcione en el camino feliz y a sobreaplicar "buenas prácticas" sin mirar el contexto del proyecto.

Dos ideas guían todo lo demás:

1. **El slop es un síntoma, no una prueba de autoría.** No importa quién escribió el código; importa si el patrón aporta o no. No hagas juicios sobre "esto lo escribió una IA".
2. **Limpiar no es reescribir.** El comportamiento observable, la API pública y la arquitectura del proyecto son intocables salvo aprobación explícita. Ante la duda entre "más limpio" y "más seguro", gana lo seguro.

## Flujo obligatorio

El orden importa. **Nunca modifiques archivos antes de que el usuario apruebe el reporte** (fase 4).

### Fase 0: Contexto del proyecto (solo lectura)

Antes de juzgar nada, entendé las reglas de la casa. Lo que es slop en un proyecto puede ser convención en otro.

- Buscá `spec.md` (también `SPEC.md`, `docs/spec.md`, `specs/`), `CLAUDE.md`, `AGENTS.md`, `README`, `CONTRIBUTING`, `docs/adr/`. Leelos completos.
- Leé `pyproject.toml` / `setup.cfg` / `requirements*.txt`: versión de Python, dependencias reales, config de ruff/black/mypy/pytest.
- Mapeá el árbol: layout (`src/` o plano), capas (por ej. domain / application / infra / api), dónde viven tests, scripts, config, migraciones.
- Inferí las convenciones dominantes mirando varios archivos: estilo de docstrings, manejo de errores, logging, nombres, tipado. **El estándar es el del proyecto, no uno genérico.**
- Definí el alcance: si el usuario indicó rutas, ese es el alcance. Si no, preguntá o usá el diff contra la rama principal (`git diff main...`). No audites todo el repo sin que lo pidan.
- Establecé la línea base: corré tests, linter y type checker que el proyecto ya use, y anotá el resultado. Si no hay tests, decilo en el reporte: significa que cada cambio tiene más riesgo.

### Fase 1: Detección (solo lectura)

Recorré el alcance con el catálogo de `references/catalogo-patrones.md`, que cubre código y estructura de archivos. Para cada hallazgo registrá: archivo y línea, patrón, evidencia (1-3 líneas), por qué es slop **en este proyecto**, y la propuesta.

Verificá con herramientas cuando se pueda, no a ojo: `ruff`, `vulture` o equivalentes si ya están en el proyecto, y para imports dudosos comprobá contra las dependencias declaradas y el entorno antes de calificarlos de inventados. No instales herramientas nuevas en el proyecto sin preguntar.

### Fase 2: Cruce con spec.md

Para cada hallazgo, chequeá si lo que se propone cambiar contradice o toca algo del spec (requisitos, nombres, contratos, estructura, decisiones de diseño, manejo de errores esperado).

- **Contradice el spec:** no lo propongas como cambio. Marcalo como **CONFLICTO** y preguntá.
- **El spec no dice nada pero el cambio es de diseño** (mover módulos, quitar una capa, cambiar el contrato de errores): marcalo como **AMBIGUO** y preguntá.
- **El spec respalda el cambio:** citá la sección.
- **No hay spec.md:** avisalo en el reporte y tratá `CLAUDE.md`/README/ADRs como fuente. Si tampoco hay nada, sé más conservador.

Cuando haya conflicto o ambigüedad, preguntá siempre. No decidas por el usuario ni "interpretes a favor". Si tenés `AskUserQuestion`, usalo; si no, preguntá en texto.

### Fase 3: Reporte

Armá el reporte con la plantilla de `references/plantilla-reporte.md` y entregáselo al usuario **antes de tocar nada**. Cada hallazgo va en una de estas clases:

| Clase | Qué es | Ejemplo |
|---|---|---|
| **A. Seguro** | Mecánico, no cambia comportamiento | Borrar comentario que repite el código, import sin usar, `pass` redundante |
| **B. Con riesgo** | Podría cambiar comportamiento en algún caso | Quitar un try/except, cambiar `except Exception` por una excepción concreta, quitar un fallback |
| **C. Estructural** | Toca archivos o arquitectura | Mover/renombrar módulos, partir `utils.py`, eliminar archivos duplicados |
| **D. Conflicto/ambiguo** | Choca o no está cubierto por el spec | Eliminar una capa que el spec menciona |

Las clases B, C y D **siempre** requieren aprobación individual. La clase A también necesita aprobación del reporte, pero podés pedirla en bloque.

### Fase 4: Aprobación

Esperá la respuesta. El usuario puede aprobar todo, elegir por clase o ítem, o descartar. Lo no aprobado no se toca. Si la respuesta es ambigua, preguntá.

### Fase 5: Aplicar cambios

- Aplicá de a un grupo coherente por vez, de lo más seguro a lo más riesgoso.
- Después de cada grupo, corré de nuevo la línea base (tests, linter, tipos). Si algo que pasaba antes falla, **revertí ese grupo** y reportalo; no "arregles" encima.
- Usá el formateador del proyecto, no uno propio. No mezcles cambios de formato masivos con los de slop (ensucian el diff).
- Mover o renombrar archivos: usá `git mv` si hay git, actualizá imports y referencias en todo el repo, y verificá que no queden rutas rotas (config, CI, Docker, docs).
- No agregues dependencias, features ni tests nuevos "de paso". Si falta cobertura para un cambio riesgoso, proponelo en el reporte en vez de improvisarlo.

### Fase 6: Cierre

Entregá un resumen corto: qué se cambió, qué no se aprobó, resultado de tests/linter antes y después, y pendientes. No repitas el reporte entero.

## Reglas que no se negocian

- **Comportamiento intacto.** Mismas entradas, mismas salidas, mismos efectos y mismos errores observables. Si no podés asegurarlo, es clase B y se pregunta.
- **API pública intacta.** Nombres exportados, firmas, rutas HTTP, esquemas, comandos CLI y formatos de archivo no se tocan sin aprobación.
- **Arquitectura intacta.** Respetá las capas, el sentido de las dependencias y los patrones ya establecidos, aunque no sean tu preferencia. Un `Repository` o un `Service` que el proyecto usa en todos lados no es slop; uno aislado y de un solo uso, quizás sí.
- **Consistencia por encima de pureza.** Si el 90 % del repo hace algo de cierta manera, el 10 % restante se alinea, no al revés.
- **Los defensivos de frontera se quedan.** Validación de entrada externa (HTTP, CLI, archivos, red, DB) y manejo de errores de I/O son legítimos. El slop es defender estados imposibles dentro de código confiable.
- **Una duda, una pregunta.** Mejor preguntar de más que borrar algo que estaba ahí por una razón que no ves.

## Cuándo no usar esta skill

Para escribir features nuevas, hacer refactors de diseño pedidos explícitamente, o corregir bugs. Si en el camino aparece un bug real, reportalo aparte; no lo mezcles con la limpieza.
