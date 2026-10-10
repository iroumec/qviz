# memory.md — Estado del proyecto para retomar entre sesiones

> Lo leen los agentes al empezar (`CLAUDE.md` lo importa y `AGENTS.md` lo exige) y **lo actualizan al terminar cada cambio** (regla en `AGENTS.md`, sección "Memoria"). Es el traspaso entre sesiones: el diseño y el contrato mandan en `spec.md`; acá solo el estado, lo decidido, lo pendiente y cómo seguir. Mantenelo corto (máx. ~150 líneas): al agregar algo nuevo, borrá lo que ya no vale.

Última actualización: 2026-10-10 (láser volumétrico en el visor y auditoría anti-slop de Python: clases A y B aplicadas, Q1 hecho; faltan los C). Rama `development`; el último commit y los cambios sin subir los muestra `make resume`.

## Cómo retomar

```bash
make resume            # rama, commits, cambios sin subir y los pendientes de este archivo
make test && make lint # tiene que estar todo verde (algunos tests se saltan según el entorno)
make qollab            # arma qollab/ (el visor real) para subir a Qollab
make server            # el visor en local, con compilar y medir en Python (scripts/server.py), sin Qollab
```

1. Hacé `git fetch` y `git pull --rebase origin development` y mirá qué trajo el equipo antes de tocar nada.
2. Leé este archivo, `spec.md` (fuente de verdad) y, si el cambio toca Qollab, `documentation/docs/frontend/qollab.qmd` y `documentation/prompts/qollab_pruebas.md`.
3. Commit y push **solo cuando el usuario lo pide** (mensajes en inglés).

## Qué hay hecho (todo con tests; M0–M9 "Listo para validar" en `spec.md` §8)

- Pipeline `provider → transpiler → translator → simulator → vectorizer → metrics → formatter → exporter`, orquestado por `compiler.compile`. Tomografía (`strategy="tomography"`) y `sampler.sample` (medición simulada) aparte.
- Contrato JSON en `spec.md` §6 y `documentation/schema/` (`total_qubits` ≤ 16).
- M10 `importer.load_circuit` (OpenQASM 2/3) + `qollab_api.run_qasm` + hook `HOST.compileQasm`: el visor carga `.qasm` (botón y arrastrar) sin gastar el job de IonQ (`compile(..., allow_remote=False)`); sin Qollab sigue cargando JSON. Ejemplos en `examples/qasm/`.
- Qollab: `main.py` (proyecto Python), `qollab_api.py` (lo que llaman las páginas JS), `scripts/package_qollab.py` (`make qollab`).
- Visor: esferas de Bloch instanciadas (`shaders/bloch.*`) y **haces láser volumétricos** instanciados (`shaders/laser.*`): un `InstancedMesh` de cajas raymarcheadas, una por ion, con el color según la especie del backend (magenta Yb/Aria/Harmony, verde Ba/Forte, violeta si se desconoce). Los haces están **apagados por defecto**: se disparan solo en los iones target de un paso GPI/GPI2, como un pulso (`LASER_PULSE_MS`), con el atributo `instanceActive` (el usuario lo pidió así). Falta calibrar `LASER_MIN_Y`/`LASER_MAX_Y` y las constantes del `.frag`.
- Documentación: `spec.md` (español), Quarto en `documentation/docs/` (inglés, con tema monocromático claro/oscuro: `documentation/theme-light.scss`, `theme-dark.scss`, `theme-rules.scss`), guías en `documentation/prompts/`.
- CI en GitHub Actions (`.github/workflows/ci.yml`): job de lint (flake8 + pydocstyle, igual que `make lint`) y tests en Python 3.12 y 3.13 (igual que `make test`).

## Decisiones tomadas (detalle en `spec.md`)

- `MAX_QUBITS = 16`. Sin campos nuevos en el contrato JSON para medir: el `sampler` reconstruye el circuito desde el propio JSON (§M9).
- `compile` solo acepta `ionq` y `local`; IBM, AWS y cualquier otro backend se clasifican `unsupported` y lanzan `UnsupportedProviderError` (decisión del usuario, 2026-10-10; §11 punto 6 y `documentation/prompts/decision_transpilacion_no_ionq.md`). No hay interruptor de configuración. `detect` nunca falla. El translator es una función `translate(info, transpiled)`, sin clases por proveedor.
- `entangler` automático por defecto en `main.py`/`qollab_api.py` (`"auto"`); texto inválido es un error.
- Ruido de la medición: la fidelidad por qubit es un error de lectura `(1−f)/2`, más el SPAM (`1 − initial_fidelity`).
- Compatibilidad: `qiskit-ionq >= 1.0.0` (Qollab trae la 1.0.2); `requirements.txt` igual a `pyproject.toml` (lo comprueba un test).
- **El aspecto y las funciones del visor (`frontend/index.html`) no se cambian sin aprobación.** Lo de Qollab entra como hooks opcionales (`window.QVIZ_HOST`) y como código generado. El usuario aprobó (2026-10-10) ocultar la nota de "qubits entrelazados" cuando mide el backend.
- Láser volumétrico (aprobado por el usuario, 2026-10-10): `LASER_MIN_Y`/`LASER_MAX_Y` y `LASER_BOX` en `frontend/js/config.js`; `LASER_RADIUS`/`ENERGY_AMPLITUDE` en `shaders/laser.frag` son los valores a calibrar a mano. `uLaserActive` (maestro) queda en 1.0; cada haz lleva su intensidad en `instanceActive` y se dispara solo en los iones target de GPI/GPI2, durante `LASER_PULSE_MS`.
- Los módulos del pipeline no se importan entre sí; `compiler` solo orquesta.

## Qollab (medido el 2026-10-10)

Qollab **no sirve los demás archivos del proyecto** (un `import("./js/main.js")` falla con `error loading dynamically imported module`): por eso `make qollab` arma un solo `main.js` (preludio + módulos de `frontend/js` empaquetados con `bundle_modules`). Que `qiskit-qasm3-import` se instale en Qollab y que `three/addons/` resuelva ahí **no está verificado**. Detalle y tabla de problemas: `documentation/docs/frontend/qollab.qmd`.

Pyodide v314.0.7, qiskit 2.5.2, qiskit-ionq 1.0.2, numpy 2.4.6. Verificado en Built-in con la página de diagnóstico: un clic llama a Python con `callPromising` después de la primera corrida; `import * as api from "qollab_api"` funciona; `ALL CHECKS PASS`. Límites: 100 archivos por proyecto (el repo tiene más: por eso `make qollab`), solo `main.css`, los `<script>` del HTML no corren, el JS no lee archivos, un job por corrida en IonQ, Python devuelve texto.

## Pendientes (en orden)

-3. **Auditoría anti-slop de Python (`documentation/prompts/python-slop`), lo que falta (clase C, de a uno, con aprobación):** #16 unificar `bell`/`ghz3` repetidos (`qollab_api._bell`, `generate_outputs._bell`, `scripts/_common`) usando `qollab_api.build_circuit` y `examples.ghz`, y las etiquetas de `generate_outputs._outputs()`; los tests quedan con su propio `tests/circuits.py`. #18 compartir `_angles` y el acumulado de `virtual_z` entre `tomography.py` y `simulator.py` (mismo paquete; ojo: el simulador corrige `phi >= 2π` y la tomografía recorta `r > 1`, así que unificar cambia casos borde). Posibles bugs aparte: `scripts/server.py` con `Content-Length` negativo se queda esperando; `tomography.py` hace `zip` sin `strict`. El usuario pidió: tras cada "aplicalo", commit + push antes de explicar el siguiente.
-2. **README y project card** (los pide el usuario): el material ya está en `documentation/docs/frontend/qollab.qmd`, secciones "At a glance" (resumen reutilizable) y "Problems found on Qollab and how they were solved" (qué falló y por qué existe cada pieza del empaquetado). El `README.md` hoy no describe el proyecto.
-1. **Plazo: domingo 2026-10-11, 7 PM ET.** El usuario probó `make qollab` en la web de Qollab (2026-10-10) y dijo que funciona bien. Sin detalle por punto: la tabla de `documentation/prompts/qollab_pruebas.md` §4 sigue sin completar y no se confirmó por separado si `qiskit-qasm3-import` se instala (OpenQASM 3) ni el láser con los addons de three.
0. **IBM se queda cargando en Qollab** (AWS local ya da el error). Subir `make qollab` con IBM Boston y pegar la consola del navegador para ver dónde se cuelga.
1. **Subir `make qollab` (visor real) y completar la tabla de `documentation/prompts/qollab_pruebas.md` §6**: que `three/addons/` resuelva en Qollab y la escena 3D con el láser en three.js 0.186.1 (el visor usa la 0.160), el tamaño dentro del iframe, Medir en el paso 4 y 7 del Bell, los simuladores de IonQ (solo la primera compilación; medir no gasta job) y los tiempos con 16 qubits.
4. Tomografía: reformular "el statevector queda como referencia para comparar" (`tomography.qmd`, `spec.md` §M8) o implementar la comparación. Con qiskit-ionq < 1.0.3 la tomografía sobre un backend que no es IonQ da un `TranspilationError` (las compuertas nativas no traen definición).
5. S5 (pausado): cambiar la jerarquía `Translator` por una función `translate(info, transpiled)`; toca `compiler`, demos, tests, spec y `activity.puml` (el SVG se regenera con `make render-puml`).
6. Dudas del usuario: el AWS Braket local queda desactivado (¿se reactiva?); `README.md` no describe el proyecto; `errors.md` y `documentation.md` son notas sueltas que conviene llevar a `spec.md` §10 o `documentation/prompts/`.
7. Validar los módulos con el equipo (todos están en "Listo para validar") y correr M7 y M8 en Qollab (IonQ Aria y Forte).

## Ideas a futuro (sin aprobar)

- Mostrar visualmente que dos qubits están entrelazados en el visor (hoy solo se ve que la esfera se acorta, `r < 1`, y desaparece con `r = 0`). Habría que decidir qué se dibuja (un enlace entre las esferas, color o intensidad) y qué dato lo sostiene: el JSON actual no dice con quién está entrelazado cada qubit, así que haría falta un cálculo nuevo en el backend (por ejemplo la concurrencia o la información mutua entre pares, desde el statevector) y, probablemente, un campo nuevo del contrato JSON, que requiere acuerdo del equipo. Cualquier cambio visual del visor necesita aprobación.

## Comportamiento normal del visor (no es un bug)

Los vectores de Bloch **se acortan o desaparecen cuando un qubit está entrelazado** (`r < 1`; con `r = 0` no se dibuja la flecha). Pasa también **sin entrelazamiento lógico**: las compuertas de dos qubits se construyen con la compuerta nativa MS, que entrelaza a mitad de la compuerta, y los vectores vuelven cuando termina. Ejemplo medido: `x q[0]; swap q[0], q[1];` termina con los dos vectores en longitud 1, pero en 11 de sus 38 pasos hay un vector menor que 0,5 (en el paso 8, un `ms`, los dos valen 0). El usuario lo revisó (2026-10-10) y lo da por funcionamiento correcto. Se comprobó además que no hay NaN en los datos, que three 0.186.1 dibuja igual que 0.160 y que cargar varios circuitos seguidos redibuja bien. Un vector que **mida 1 en `states` y aun así no se vea** sí sería un error de dibujo; hasta ahora no hay ningún caso.

## Equipo y convenciones

El usuario trabaja el backend y la documentación con este agente; un compañero toca el visor y partes de Quarto y empuja a la misma rama `development`. Código y commits en inglés; `spec.md` y las guías en español; Quarto en inglés. Explicar con opciones, ventajas y una recomendación; esperar el visto bueno ante cambios del contrato o visibles.

## Historial (lo último arriba; borrá lo viejo)

- 2026-10-10 · Láser volumétrico en el visor: `shaders/laser.vert`/`laser.frag` (raymarching instanciado, con `vInstancePos` para centrar cada haz en su ion), `createLaserBeams`/`laserColorFor` en `frontend/js/laser.js`, constantes `LASER_*` y URLs en `config.js`, carga de shaders en `shaders.js`/`state.js`, montaje en `scene.js` (mismo `dummy.matrix` que las esferas), shaders embebidos en `package_qollab.py` (+ test). Luego, a pedido del usuario, los haces pasaron a estar apagados por defecto: se disparan solo en los iones target de GPI/GPI2 (`instanceActive` + pulso `LASER_PULSE_MS` en `data.js`/`scene.js`). Ojo: **`active` es palabra reservada de GLSL**; el `.frag` usa `intensity` (con `active` la compilación fallaba y los haces no se veían). Docs (`viewer.qmd`, `qollab.qmd`) al día; `make test`/`lint`/`qollab` en verde. Sin commitear.
- 2026-10-10 · Auditoría anti-slop de Python (`documentation/prompts/python-slop`): aplicada la clase A (condiciones redundantes y parámetros sin uso en `provider`/`transpiler`, `tuple()` de más en `normalize`, typo de `server.py`, `importer` quita comentarios una sola vez, test de `translator` sin parámetro muerto). `make test` y `make lint` en verde. Clase B aplicada: B1 (`rules.py` ya no mira `condition`, no existe en Qiskit 2) y B2 (`assert_never` en `simulator._matrix` y `to_qiskit`, `QVizError` en `translator`) , B3 (`transpiler` ya no lanza un error para atraparlo en el mismo `try`; test nuevo del payload inesperado), B4 (`importer` importa `qasm2` arriba; test del mensaje cuando falta `qiskit-qasm3-import`) y B5 (`test_smoke.py` comprueba la API pública completa y que `NativeOp` es inmutable). En revisión con el usuario: B restantes (una por una), después C. Q1 hecho: IBM/AWS/`unknown` ya no existen (`Provider` = `ionq`/`local`/`unsupported`, `UnsupportedProviderError`, sin `ENABLED_PROVIDERS`) y `Translator` pasó a la función `translator.translate(info, transpiled)`. Spec, Quarto, AGENTS y las guías al día. Quedan los C (#16 circuitos duplicados en scripts, #18 helpers de tomografía).
- 2026-10-10 · Estética de la documentación: tema monocromático claro/oscuro (`documentation/theme-light.scss`, `theme-dark.scss`, `theme-rules.scss`, cargados tras `cosmo`/`darkly`), `highlight-style: monochrome` en `_quarto.yml` y color de enlaces/cabeceras del PDF Typst. Documentado en `style-and-conventions.qmd`. Subido en el commit de esta sesión.
- 2026-10-10 · El usuario confirmó que el visor funciona bien en la web de Qollab y cerró la sesión.
- 2026-10-10 · Cierre de sesión. Se quitaron las menciones de FastAPI y Astro (README, AGENTS, spec, memory) y se actualizó "Fuera de alcance" de `AGENTS.md`. Se revisó la desaparición de vectores: es el comportamiento normal descrito arriba.
- 2026-10-11 · Arreglo en Qollab: `TypeError: error loading dynamically imported module: …/_nuxt/js/main.js`. Qollab no sirve los archivos de `js/`, así que el `import("./js/main.js")` del preludio fallaba. `package_qollab.py` ahora arma un solo `main.js` (preludio + los módulos de `frontend/js` empaquetados con `bundle_modules`, cada uno en su ámbito); el paquete pasó a 51 archivos. Probado el JS con `node --check` y un arnés con stubs; falta probar en Qollab.
- 2026-10-10 · Licencia MIT: `LICENSE` (titular "Qubit Overflow", 2026; cambiarlo si el equipo prefiere otro), `license` en `pyproject.toml`, sección en el README y copia en el paquete de Qollab (64 archivos). `spec.md` §2 recoge la respuesta de los organizadores.
- 2026-10-10 · Se retiró la página de diagnóstico: `make qollab-probe`, `scripts/qollab_js_probe/`, `qollab_api.versions()` y el argumento `page` de `package_qollab.py`. Las pruebas en Qollab se hacen con el visor real (`documentation/prompts/qollab_pruebas.md`, reescrita). Sigue en el historial de git.
- 2026-10-10 · `make server` (`scripts/server.py`, antes `serve`): servidor local del visor con `POST /api/compile` (`qollab_api.run_qasm`) y `POST /api/sample` (`qollab_api.sample_step`) sobre el simulador integrado. El visor (`frontend/js/host.js`) usa `HOST` si existe y, si no, ese servidor; se eliminó el muestreo independiente por marginales (no modela el entrelazamiento): sin Python, Medir y Cargar circuito dan un error. Tests en `tests/test_server.py`.
- 2026-10-10 · Visor modular: `frontend/index.html` queda solo con HTML y CSS, y el JS se divide en módulos ES en `frontend/js/` (config, state, utils, demo, shaders, three-addons, laser, scene, panels, data, controls, main). Los addons de three y el respaldo pasan a `js/three-addons.js`. `package_qollab.py` ahora copia los módulos y genera `main.js` = preludio + `import("./js/main.js")`; tests y docs actualizados. Verificado con un harness headless (DOM y `three` stubeados) y con `make test`/`make lint` en verde.
- 2026-10-10 · M10: `backend/core/importer` (`load_circuit`, `CircuitParseError`, `config.MAX_QASM_CHARS`), `compile(allow_remote=)`, `qollab_api.run_qasm`, `HOST.compileQasm`, botón "Cargar circuito" en los módulos `frontend/js/` (aprobado; se quitó la carga de JSON), compuertas sin definición/`opaque`/subrutinas con error descriptivo (`transpiler._check_translatable`, `importer._explain`), `qiskit-qasm3-import>=0.6,<1.0` en `pyproject.toml`/`requirements.txt`, ejemplos `.qasm`, docs (`spec.md` M10, `importer.qmd`). Se rebasó sobre el commit "Frontend refactorized". Falta probar en Qollab.
- 2026-10-10 · Pull de `development` (CI, `documentation/`, láser con lentes y three 0.160 con import map en el visor). Eso rompía `make qollab`: `package_qollab.py` ahora acepta `<script type="module">`, quita los `import` del visor y los pone en el preludio (addons con `import()` dinámico y respaldo), embebe los shaders de la lente y el OBJ/MTL (`HOST.shaders.lensVert/lensFrag`, `HOST.laser`) y ya no fuerza el color lineal de r128. Hooks mínimos en `loadLaserModel` del visor (aprobados por el usuario). Sin commitear; falta probar en Qollab.
- 2026-10-10 · Reorganización: los makefiles a `make/` (`Makefile.git`, `Makefile.quarto`) y el proyecto Quarto (`_quarto.yml`, `index.qmd`, `references.bib`) a `documentation/`; sigue `make render/html/pdf-typst/preview/clean` desde la raíz. Docs y `AGENTS.md` actualizados.
- 2026-10-10 · CI con GitHub Actions (`lint` + `tests` en 3.12/3.13) y badge en el README; diagramas PlantUML con SVG embebidos en Quarto; página "Why QViz" y énfasis pedagógico (según `documentation.md`) en README, preface e índice del libro.
- 2026-10-10 · Probado en Qollab por el usuario: Built-in, IonQ Aria y Forte funcionan bien. Mensaje de máquina no soportada ahora formal (`PROVIDER_LABELS`) y sin traceback en el visor (prelude `readable`). Abierto: con IBM el visor queda en "loading" (no se sabe por qué; `detect` tarda ~0,1 ms en local, hace falta correr el diagnóstico con IBM Boston).
- 2026-10-10 · Se anotó la idea de mostrar el entrelazamiento entre pares de qubits.
- 2026-10-10 · El botón Medir del visor usa el backend vía `HOST.sample`; `make qollab` arma el visor real (51 archivos); página `documentation/docs/frontend/qollab.qmd`; `memory.md` (importado por `CLAUDE.md`, con la regla de actualizarlo en `AGENTS.md`) y `make resume`. Subido en el commit de esta sesión.
- 2026-10-10 · Rangos de versiones (`f0f2785`), fix del import de `native_2q_gate` (`334b5fc`), proyecto JS único de Qollab y checks automáticos (`e3e769d`).
- 2026-10-10 · `sampler` y `qollab_api` (`5587c32`); `ENABLED_PROVIDERS` (`702e1db`).
