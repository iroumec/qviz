# AGENTS.md — Guía para agentes de código en QViz

QViz es un visualizador educativo de iones atrapados para un hackathon que corre en **Qollab**. A partir de un circuito de Qiskit y el `backend` elegido, el backend Python genera un JSON con la secuencia de compuertas nativas de iones (GPI, GPI2, MS|ZZ, VirtualZ) y el estado de Bloch de cada qubit en cada paso.

**Antes de tocar código leé:**

- `memory.md`: el estado actual del proyecto, lo decidido y los pendientes. Es el traspaso entre sesiones (`CLAUDE.md` lo importa). Si algo contradice a `spec.md`, manda `spec.md` y se corrige `memory.md`.
- `spec.md`: arquitectura, contrato JSON, plan por módulos y estado. Es la fuente de verdad.
- `documentation/prompts/qollab_context.md`: qué se puede y qué no se puede hacer en Qollab.
- `documentation/references/ionq_native_gates.md`: matrices de GPI/GPI2/MS/ZZ/VirtualZ, identidades verificadas y errores de la doc oficial de IonQ. Es obligatorio para M1, M2, M3 y M8. Cuando la doc de IonQ y sus propias matrices se contradicen, mandan las matrices y los tests.

**Alcance actual: solo backend (Python).** No escribas nada de frontend (Astro, JS, HTML, CSS) hasta que el equipo lo pida.

---

## 1. Cómo trabajamos: un módulo por vez

El plan está en `spec.md` §7 (M0 … M8). Para cada módulo:

1. Confirmá cuál es el módulo actual en la tabla de estado (`spec.md` §8). **No empieces uno si el anterior no está "Validado"**, salvo que el equipo lo diga.
2. Leé la sección completa del módulo en `spec.md`: objetivo, reglas, tests y demo.
3. Implementá solo ese módulo, junto con sus tests y su `scripts/demo_<modulo>.py`.
4. Corré `make test` y la demo. Todo en verde.
5. Pasá el estado a "Listo para validar" en `spec.md` §8.
6. **Frená** y reportá al equipo:
   - qué hiciste (archivos),
   - cómo validarlo (comandos exactos y salida esperada),
   - qué quedó **[a verificar]** en Qollab,
   - cualquier desvío del spec y por qué.
7. Esperá el OK antes del siguiente módulo.

Si descubrís que el spec está mal (por ejemplo, una fórmula de traducción que no pasa su test de equivalencia), corregí el código **y** `spec.md`, y avisalo en el reporte. Si el cambio afecta al **contrato JSON** (`spec.md` §6), no lo cambies: preguntá primero.

No podés ejecutar nada en Qollab. Todo lo marcado **[a verificar]** lo prueba el equipo. Prepará el script de prueba, pedí que lo corran y anotá los resultados en `spec.md` §10.

---

## 2. Arquitectura y reglas de código

Pipeline (detalle en `spec.md` §3):

```
provider → transpiler → translator → simulator → vectorizer → metrics → formatter → exporter
```

- **Un paquete por módulo:** `backend/core/<modulo>/<modulo>.py`, con una función pública cuyo verbo nombra al módulo (`transpile`, `translate`, `simulate`, `vectorize`, `measure`, `format`, `export`). Los helpers van en archivos hermanos dentro del mismo paquete.
- **`compiler.py` solo orquesta.** Los módulos del pipeline **no se importan entre sí**; solo usan `core.model`, `core.errors`, `core.config`, `core.provider` y `core.to_qiskit` (puente neutral de `NativeCircuit` a `QuantumCircuit`, que usan la tomografía y los tests).
- **Imports absolutos desde el paquete:** `from backend.core.translator import translator`. El estilo `from core...` no funciona en Qollab.
- **Datos:** dataclasses `frozen=True` definidos en `core/model.py`. Las funciones son puras: devuelven objetos nuevos y no mutan la entrada.
- **Sin estado global y sin `print` en `backend/core`.** Se usa `logging.getLogger(__name__)`. Los `print` van solo en `scripts/` y `main.py`.
- **Errores:** solo las excepciones de `core/errors.py`. `provider.detect` **nunca** falla: un proveedor desconocido cae en la clasificación `unknown`. Quien decide si se acepta es `compile`, con `config.ENABLED_PROVIDERS` (por defecto solo `ionq` y `local`; el resto lanza `ProviderDisabledError`).
- **Unidades (`spec.md` §5.1):** fases en radianes; `angle` de MS/ZZ en turnos [0, 0.25]; fidelidades en %; orden de qubits little-endian de Qiskit; Bloch estándar (|0⟩ = +z). Las compuertas de `qiskit_ionq` usan turnos: convertí en el borde.
- **Matemática:** NumPy. Nada de dependencias pesadas para lo que NumPy resuelve.

### Convenciones

- Código, identificadores, comentarios, docstrings y mensajes de commit en **inglés**. La documentación (`spec.md`, `documentation/`) en **español**.
- Type hints en todas las firmas públicas. Docstrings cortos: qué hace, unidades de entrada y salida.
- Copiá el estilo del código que ya está alrededor. No sumes abstracciones (clases base, registros, plugins) que el spec no pida.

---

## 3. Restricciones de Qollab (no negociables)

- **No hay servidor.** Ni Flask, ni FastAPI, ni sockets, ni POST. El "backend" es un módulo Python que corre en el navegador (Pyodide).
- **`backend` lo inyecta Qollab** como global de `main.py`. Nunca lo crees ni lo fijes en el código de la librería: se recibe como argumento.
- **Nunca `import backend` en `main.py`**, porque pisa la variable inyectada. Usá `from backend import compile, export`.
- **Lo que llama una página JS devuelve texto** (`qollab_api.py`): un `dict` llega a JS como `Map` y `JSON.stringify` da `{}`. Las listas de pares conservan el orden; un objeto JS reordena las claves enteras (`"10"`, `"11"`).
- **Un solo `backend.run` por corrida en IonQ.** Cada llamada a `compile()` hace como máximo una. Si necesitás varios circuitos, van en **una** sola llamada con una lista.
- **Sin secretos:** ni API keys ni tokens. El código publicado es público.
- **Dependencias:** Python puro o compiladas para Pyodide. Licencia permisiva (MIT, BSD, Apache-2.0, ISC). Nada copyleft. Antes de agregar una, verificá la licencia, anotala en `spec.md` §9 y sumala a `pyproject.toml` (y a `requirements.txt` desde M7).
- **Archivos leídos desde Python:** la ruta tiene que ser un string literal en el código.
- **Nada de mandar a hardware de IonQ** (gasta créditos) sin una guarda explícita (`allow_paid=True`).

---

### El visor y Qollab

El visor (`frontend/index.html`) es del equipo. Guía completa: `documentation/docs/frontend/qollab.qmd`.

- **No cambies su aspecto ni sus funciones sin aprobación explícita.** Tiene que seguir funcionando solo, servido con `python -m http.server`.
- Lo que Qollab necesita entra como **hooks opcionales** (`window.QVIZ_HOST`: `shaders`, `laser`, `circuits`, `load`, `sample`, `compileQasm`), que el visor lee con un respaldo si faltan, o se genera al construir el paquete (`scripts/package_qollab.py`). Nunca se reescribe el visor para Qollab.
- `make qollab` arma `qollab/` (proyecto JS de 63 archivos; el repo entero supera el límite de 100). Se sube el **contenido**. No edites `qollab/`.
- Qollab no ejecuta los `<script>` del HTML, solo carga `main.css` y el JS no lee archivos del proyecto: por eso el paquete embebe los shaders y el modelo del láser, y toma los circuitos de Python.
- Versiones de Qollab (medidas el 2026-10-10): Pyodide v314.0.7, qiskit 2.5.2, qiskit-ionq 1.0.2, numpy 2.4.6. El código tiene que funcionar con qiskit-ionq ≥ 1.0.0.
- Después de cambiar el visor, `qollab_api.py` o el paquete: `make test`, `make qollab`, subir y, si algo falla, la página de diagnóstico.

## 4. Tests

- `pytest` en `tests/`, un `test_<modulo>.py` por módulo. Los circuitos de prueba compartidos van en `tests/circuits.py`.
- **Sin red ni credenciales:** IonQ siempre mockeado. Backends locales: `BasicSimulator` y `qiskit.providers.fake_provider.GenericBackendV2`.
- **Oráculos:**
  - Traducción: `qiskit.quantum_info.Operator(...).equiv(...)` entre el circuito de origen y `to_qiskit(native)`.
  - Simulación: `Statevector` + `partial_trace` de Qiskit.
  - JSON: el schema en `documentation/schema/visualization.schema.json`.
- Aleatoriedad con semilla fija. Tolerancia numérica `atol=1e-9`, salvo tomografía (estadística).
- Si un test falla, arreglá la causa. No relajes la tolerancia ni borres el test para que pase.

---

## 5. Comandos

```bash
make venv          # crea .venv
make install       # instala el paquete + extras de dev
make test          # corre pytest
make demo M=translator   # corre scripts/demo_translator.py
make qollab        # arma qollab/, el proyecto JS que se sube a Qollab (el visor real)
make resume        # rama, commits, cambios sin subir y los pendientes de memory.md
make server        # el visor en http://localhost:8000 con compilar y medir en Python, sin Qollab (PORT=9000)
```

(Se crean en M0. Hasta entonces, `python -m pytest`.)

Entorno local: Python 3.14 (igual que Qollab) y Qiskit `>=2.5.2,<3`.

---

## 6. Git

- Flujo de `make/Makefile.git`: `main` (estable), `development` (integración) y `feature/<modulo>` por módulo (`make feature NAME=translator`).
- **No hagas commit, push ni merge si el equipo no lo pide.** Nunca `--no-verify` ni force-push.
- Mensajes de commit en inglés: un resumen corto en la primera línea y, si hace falta, un cuerpo con viñetas, como en el historial.

---

## 6b. Memoria del proyecto (`memory.md`)

El chat se vacía entre sesiones; el repositorio no. Por eso:

- **Al empezar:** hacé `git pull`, leé `memory.md` y corré `make resume`.
- **Al terminar cada cambio** (código, documentación o decisión), **actualizá `memory.md` antes de cerrar**, aunque el usuario no lo pida:
  - la línea "Última actualización" y el último commit subido;
  - "Qué hay hecho" y "Decisiones tomadas", si cambiaron;
  - "Pendientes": tachá lo resuelto, agregá lo nuevo, mantené el orden por prioridad;
  - una línea en "Historial" con la fecha, qué se hizo y si quedó **sin commitear**.
- **Mantenelo corto** (máx. ~150 líneas, un test lo comprueba): resumí y borrá lo viejo. El diseño va en `spec.md` y las guías en `documentation/`; en `memory.md` solo lo que alguien necesita para retomar.
- Sin secretos ni datos personales. Si el usuario dice algo que importa para el futuro (una preferencia, una aprobación, una decisión), anotalo ahí.
- Si usás una memoria propia fuera del repo, no reemplaza a este archivo: es la que ven todos los agentes y el equipo.
- **Cierre de sesión:** `make test` y `make lint` en verde, `memory.md` al día y, si el usuario lo pidió, commit y push (pull antes).

## 7. Fuera de alcance (no lo hagas)

- Frontend de cualquier tipo.
- Transpilar _hacia IonQ_ un circuito que viene de otro proveedor. La normalización es una **traducción estática** (`spec.md` M2).
- Cambiar el contrato JSON sin acuerdo.
- Optimizar o fusionar compuertas en el MVP.
- Publicar en PyPI o configurar CI (son extras, para después del MVP).

## Documentation

- Quarto documentaation must be updated after each prompt. It can be found in documentation/docs/.
