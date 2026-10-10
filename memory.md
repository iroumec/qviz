# memory.md — Estado del proyecto para retomar entre sesiones

> Lo leen los agentes al empezar (`CLAUDE.md` lo importa y `AGENTS.md` lo exige) y **lo actualizan al terminar cada cambio** (regla en `AGENTS.md`, sección "Memoria"). Es el traspaso entre sesiones: el diseño y el contrato mandan en `spec.md`; acá solo el estado, lo decidido, lo pendiente y cómo seguir. Mantenelo corto (máx. ~150 líneas): al agregar algo nuevo, borrá lo que ya no vale.

Última actualización: 2026-10-10 (mensaje de proveedor no soportado). Rama `development`; el último commit y los cambios sin subir los muestra `make resume`.

## Cómo retomar

```bash
make resume            # rama, commits, cambios sin subir y los pendientes de este archivo
make test && make lint # tiene que estar todo verde (algunos tests se saltan según el entorno)
make qollab            # arma qollab/ (el visor real) para subir a Qollab; make qollab-probe = diagnóstico
```

1. Hacé `git fetch` y `git pull --rebase origin development` y mirá qué trajo el equipo antes de tocar nada.
2. Leé este archivo, `spec.md` (fuente de verdad) y, si el cambio toca Qollab, `documentation/docs/frontend/qollab.qmd` y `documentation/prompts/qollab_pruebas.md`.
3. Commit y push **solo cuando el usuario lo pide** (mensajes en inglés).

## Qué hay hecho (todo con tests; M0–M9 "Listo para validar" en `spec.md` §8)

- Pipeline `provider → transpiler → translator → simulator → vectorizer → metrics → formatter → exporter`, orquestado por `compiler.compile`. Tomografía (`strategy="tomography"`) y `sampler.sample` (medición simulada) aparte.
- Contrato JSON en `spec.md` §6 y `documentation/schema/` (`total_qubits` ≤ 16).
- Qollab: `main.py` (proyecto Python), `qollab_api.py` (lo que llaman las páginas JS), `scripts/package_qollab.py` (`make qollab`).
- Documentación: `spec.md` (español), Quarto en `documentation/docs/` (inglés), guías en `documentation/prompts/`.

## Decisiones tomadas (detalle en `spec.md`)

- `MAX_QUBITS = 16`. Sin campos nuevos en el contrato JSON para medir: el `sampler` reconstruye el circuito desde el propio JSON (§M9).
- `config.ENABLED_PROVIDERS = {"ionq", "local"}`: IBM, AWS y `unknown` quedan desactivados (`ProviderDisabledError`) por el problema de la transpilación (§11, punto 6; `documentation/prompts/decision_transpilacion_no_ionq.md`). `detect` nunca falla.
- `entangler` automático por defecto en `main.py`/`qollab_api.py` (`"auto"`); texto inválido es un error.
- Ruido de la medición: la fidelidad por qubit es un error de lectura `(1−f)/2`, más el SPAM (`1 − initial_fidelity`).
- Compatibilidad: `qiskit-ionq >= 1.0.0` (Qollab trae la 1.0.2); `requirements.txt` igual a `pyproject.toml` (lo comprueba un test).
- **El aspecto y las funciones del visor (`frontend/index.html`) no se cambian sin aprobación.** Lo de Qollab entra como hooks opcionales (`window.QVIZ_HOST`) y como código generado. El usuario aprobó (2026-10-10) ocultar la nota de "qubits entrelazados" cuando mide el backend.
- Los módulos del pipeline no se importan entre sí; `compiler` solo orquesta.

## Qollab (medido el 2026-10-10)

Pyodide v314.0.7, qiskit 2.5.2, qiskit-ionq 1.0.2, numpy 2.4.6. Verificado en Built-in con la página de diagnóstico: un clic llama a Python con `callPromising` después de la primera corrida; `import * as api from "qollab_api"` funciona; `ALL CHECKS PASS`. Límites: 100 archivos por proyecto (el repo tiene más: por eso `make qollab`), solo `main.css`, los `<script>` del HTML no corren, el JS no lee archivos, un job por corrida en IonQ, Python devuelve texto.

## Pendientes (en orden)

0. **IBM se queda cargando en Qollab** (AWS local ya da el error). Correr `make qollab-probe` con IBM Boston y pegar la consola para ver dónde se cuelga.
1. **Subir `make qollab` (visor real) y completar la tabla de `documentation/prompts/qollab_pruebas.md` §6**: la escena 3D con three.js 0.186.1 (el visor es de r128), el tamaño dentro del iframe, Medir en el paso 4 y 7 del Bell, los simuladores de IonQ (solo la primera compilación; medir no gasta job) y los tiempos con 16 qubits.
2. Commit y push de los cambios locales (hooks del visor, paquete de Qollab, documentación, `memory.md`) cuando el usuario lo pida.
3. Decisión sobre la transpilación de IBM/AWS/`unknown` (opciones A, E, B en el documento de decisión; hay una pregunta preparada para el profesor). Hasta entonces siguen desactivados. Al decidir: reescribir `spec.md` §M2b, `translator.qmd`, `transpiler.qmd`.
4. Tomografía: reformular "el statevector queda como referencia para comparar" (`tomography.qmd`, `spec.md` §M8) o implementar la comparación. Con qiskit-ionq < 1.0.3 la tomografía sobre un backend que no es IonQ da un `TranspilationError` (las compuertas nativas no traen definición).
5. S5 (pausado): cambiar la jerarquía `Translator` por una función `translate(info, transpiled)`; toca `compiler`, demos, tests, spec y `activity.puml` (el SVG se regenera con `make render-puml`).
6. Dudas del usuario: el AWS Braket local queda desactivado (¿se reactiva?); `README.md` no describe el proyecto y lista FastAPI; `errors.md` y `documentation.md` son notas sueltas que conviene llevar a `spec.md` §10 o `documentation/prompts/`.
7. Validar los módulos con el equipo (todos están en "Listo para validar") y correr M7 y M8 en Qollab (IonQ Aria y Forte).

## Ideas a futuro (sin aprobar)

- Mostrar visualmente que dos qubits están entrelazados en el visor (hoy solo se ve que la esfera se acorta, `r < 1`, y desaparece con `r = 0`). Habría que decidir qué se dibuja (un enlace entre las esferas, color o intensidad) y qué dato lo sostiene: el JSON actual no dice con quién está entrelazado cada qubit, así que haría falta un cálculo nuevo en el backend (por ejemplo la concurrencia o la información mutua entre pares, desde el statevector) y, probablemente, un campo nuevo del contrato JSON, que requiere acuerdo del equipo. Cualquier cambio visual del visor necesita aprobación.

## Equipo y convenciones

El usuario trabaja el backend y la documentación con este agente; un compañero toca el visor y partes de Quarto y empuja a la misma rama `development`. Código y commits en inglés; `spec.md` y las guías en español; Quarto en inglés. Explicar con opciones, ventajas y una recomendación; esperar el visto bueno ante cambios del contrato o visibles.

## Historial (lo último arriba; borrá lo viejo)

- 2026-10-10 · Probado en Qollab por el usuario: Built-in, IonQ Aria y Forte funcionan bien. Mensaje de máquina no soportada ahora formal (`PROVIDER_LABELS`) y sin traceback en el visor (prelude `readable`). Abierto: con IBM el visor queda en "loading" (no se sabe por qué; `detect` tarda ~0,1 ms en local, hace falta correr el diagnóstico con IBM Boston).
- 2026-10-10 · Se anotó la idea de mostrar el entrelazamiento entre pares de qubits.
- 2026-10-10 · El botón Medir del visor usa el backend vía `HOST.sample`; `make qollab` arma el visor real (44 archivos) y `make qollab-probe` el diagnóstico; página `documentation/docs/frontend/qollab.qmd`; `memory.md` (importado por `CLAUDE.md`, con la regla de actualizarlo en `AGENTS.md`) y `make resume`. Subido en el commit de esta sesión.
- 2026-10-10 · Rangos de versiones (`f0f2785`), fix del import de `native_2q_gate` (`334b5fc`), proyecto JS único de Qollab y checks automáticos (`e3e769d`).
- 2026-10-10 · `sampler` y `qollab_api` (`5587c32`); `ENABLED_PROVIDERS` (`702e1db`).
