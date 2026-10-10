# Plantilla del reporte (fase 3)

Entregá el reporte en el chat, con esta estructura. Sé concreto y corto: el usuario tiene que poder decidir rápido. Escribí en el idioma del usuario.

---

## Reporte Anti-AI-Slop (Python)

### 1. Contexto
- **Alcance:** rutas o diff auditado, cantidad de archivos.
- **Fuentes de reglas:** spec.md (ruta), CLAUDE.md, README, ADRs encontrados. Si no hay spec.md, decirlo.
- **Arquitectura detectada:** layout y capas en 2-3 líneas.
- **Convenciones dominantes:** docstrings, errores, tipado, estilo.
- **Línea base:** tests / linter / tipos, con resultado. Si no hay tests, advertirlo.

### 2. Resumen
Tabla con conteo por categoría y clase.

| Categoría | A. Seguro | B. Con riesgo | C. Estructural | D. Conflicto |
|---|---|---|---|---|
| Comentarios | | | | |
| Manejo de errores | | | | |
| Sobreingeniería | | | | |
| Código muerto | | | | |
| Imports | | | | |
| Tipado y estilo | | | | |
| Tests | | | | |
| Estructura de archivos | | | | |

### 3. Preguntas bloqueantes (spec / ambigüedad)
Lo que hay que resolver antes de tocar nada. Para cada una: qué dice el spec (cita), qué se quería cambiar, y las opciones. Si no hay, escribir "Ninguna".

### 4. Hallazgos
Un bloque por hallazgo, ordenados por clase y luego por impacto:

**#N · [Clase] · Categoría · `ruta/archivo.py:línea`**
- *Evidencia:* 1-3 líneas.
- *Por qué es slop acá:* una frase, referida al proyecto.
- *Propuesta:* qué se haría.
- *Riesgo / verificación:* cómo se comprobará que el comportamiento no cambia.
- *Spec:* respalda / no dice nada / en conflicto (cita).

### 5. Cambios de estructura propuestos
Árbol "antes → después" y lista de referencias que habría que actualizar. Si no hay, omitir.

### 6. Posibles bugs encontrados (fuera del alcance de la limpieza)
Lista aparte. No se corrigen sin aprobación explícita.

### 7. Qué necesito de vos
Opciones claras, por ejemplo:
- Aprobar todo lo clase A.
- Elegir ítems de B y C por número.
- Responder las preguntas de la sección 3.
- Descartar categorías enteras.

Aclaración final: no se modifica ningún archivo hasta recibir la respuesta.
