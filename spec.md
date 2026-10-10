# QViz — Especificación del backend

> Visualizador educativo de iones atrapados. Este documento cubre **solo el backend** (Python). El frontend (three.js) vive en `frontend/` y aquí solo aparece como consumidor del contrato JSON (§6).
>
> Fuentes: requerimientos del equipo, `documentation/diagrams/activity.puml`, `backend/core/compiler/compiler.py`, `documentation/prompts/qollab_context.md` (restricciones de la plataforma) y `documentation/references/ionq_native_gates.md` (definición de las compuertas nativas, identidades verificadas y errores de la doc de IonQ).
>
> Convención de este documento: **[a verificar]** = supuesto que hay que comprobar en Qollab antes de apostar el diseño. **[decisión]** = elección tomada acá que el equipo puede revertir.

---

## 1. Propósito y alcance

QViz toma un circuito de Qiskit y el `backend` elegido en Qollab, y produce un **JSON con la secuencia de compuertas nativas de iones atrapados** (GPI, GPI2, MS o ZZ, y VirtualZ) junto con el estado de cada ion después de cada paso. El frontend usa ese JSON para animar una cadena de iones representados como esferas de Bloch.

El objetivo es **pedagógico y de debugging**: que alguien con física básica vea qué le hace cada compuerta nativa a cada qubit. No se busca simular el proceso físico real (láseres, modos de vibración, etc.).

**Dentro del alcance (backend):** detección de proveedor, transpilación, normalización a compuertas de iones, cálculo de estados, vectorización, métricas (fidelidad, inactividad, costo, vibración), formateo y exportación del JSON, punto de entrada para Qollab.

**Fuera del alcance (por ahora):** todo el frontend (3D, láseres, botones RF1–RF4, paleta, accesibilidad, sonidos), la publicación en PyPI y la integración continua.

---

## 2. Restricciones que condicionan el diseño

Resumen de `documentation/prompts/qollab_context.md`, que tiene el detalle:

1. **Sin servidor.** Qollab corre o un proyecto Python (`main.py`, salida en consola) o un proyecto JS (`index.html` + `main.js`) que importa módulos Python con `.callPromising(...)`. "Backend" significa _módulo Python corriendo en el navegador (Pyodide)_. Nada de endpoints, POST ni persistencia.
2. **El `backend` lo inyecta Qollab** como variable global de `main.py` (lo elige el usuario en _Select QPU_). Nunca se crea ni se fija en el código; se recibe como argumento.
3. **Un solo job por corrida en backends IonQ.** Una segunda llamada a `backend.run` corta la corrida. Cada `compile()` sobre IonQ puede hacer **como máximo una** llamada a `backend.run` en total.
4. **Python 3.14, Qiskit 2.x, NumPy 2.x.** Las dependencias tienen que ser Python puro o venir compiladas para Pyodide.
5. **Sin secretos en el código:** el código publicado es público.
6. **Rutas de archivos como string literal** si Python lee archivos del proyecto.
7. **Un solo hilo:** la simulación tiene que ser liviana (ver límite de qubits en §5.4).

### Licencias

El requerimiento dice "todas las bibliotecas bajo MIT", pero **Qiskit y qiskit-ionq son Apache-2.0 y NumPy es BSD-3**, así que con MIT estricto el proyecto no puede existir. **[decisión]** Se permiten licencias permisivas: **MIT, BSD-2/3, Apache-2.0, ISC**. No se permiten las copyleft (GPL, LGPL, AGPL, MPL). Antes de sumar una dependencia nueva, verificá su licencia y anotala en §9. **Confirmado por los organizadores (2026-10-10):** el requisito de MIT se aplica al código propio; usar Qiskit y OpenQASM como dependencias (importadas y listadas en `requirements.txt`) no cambia la licencia del proyecto, porque Apache-2.0 es permisiva. Condiciones: el texto MIT en un archivo `LICENSE` en el repositorio y en el proyecto de Qollab (**hecho**: `LICENSE` en la raíz, copiado por `make qollab`; titular "Qubit Overflow", 2026), y, si se copia código Apache-2.0 al repositorio, conservar su encabezado de licencia (hoy no se copia ninguno).

---

## 3. Arquitectura

### 3.1 Pipeline

Basado en `activity.puml`, con dos agregados marcados con ★:

```
QuantumCircuit + backend
        │
        ▼
[provider] ★ detect(backend) ──► BackendInfo (proveedor, nombre, entrelazador, perfil de ruido)
        │
        ▼
[transpiler]  transpile(backend_info, backend, qc) ──► TranspiledCircuit (compuertas del proveedor)
        │
        ▼
[translator]  translator.translate(info, transpiled) ──► NativeCircuit (GPI, GPI2, MS|ZZ, VirtualZ)
        │
        ▼
[simulator]   simulate(native) ──► SimulatedCircuit (r, θ, φ por qubit y por paso)
        │
        ▼
[vectorizer]  vectorize(simulated) ──► VectorizedCircuit (x, y, z + probabilidades)
        │
        ▼
[metrics] ★   measure(vectorized, backend_info) ──► MeasuredCircuit (fidelidades, inactividad, costo, vibración)
        │
        ▼
[formatter]   format(measured) ──► dict con el contrato JSON (§6)
        │
        ▼
[exporter]    export(data, path=None) ──► str JSON (y archivo opcional)
```

- **provider** queda separado porque el transpiler (para elegir estrategia) y el translator (para elegir MS o ZZ) necesitan conocer el proveedor. El requerimiento pone la detección dentro del "normalizador"; acá vive en un módulo propio que el normalizador usa.
- **translator** es una función: `translator.translate(info, transpiled)`. La regla de traducción es la misma para todo backend (`rules.py`); lo único que cambia es el entrelazador objetivo de `info`. Hubo una base abstracta `Translator` con una subclase por proveedor (`IonQTranslator`, `IBMTranslator`, `AWSTranslator`, `LocalTranslator`, `GenericTranslator`); se quitó porque todas hacían lo mismo y IBM, AWS y `unknown` ya no se aceptan (§5.5).
- **metrics** queda separado porque fidelidad, costo e inactividad no son estado cuántico ni formato, y mezclarlos en vectorizer o formatter rompería la responsabilidad única.
- `exporter` ya aparece importado en `backend/__init__.py`.

### 3.2 Estructura de carpetas (objetivo)

Sigue el patrón actual: un paquete por módulo, `backend/core/<modulo>/<modulo>.py`, con una función pública cuyo verbo nombra al módulo. `compiler.py` solo orquesta.

```
main.py                         # Entrada en Qollab (proyecto Python). M7
qollab_api.py                   # Funciones que llaman las páginas JS de Qollab (devuelven texto). M7, M9
requirements.txt                # Dependencias para Qollab, iguales a las de pyproject.toml (un test lo comprueba). M7
pyproject.toml                  # Desarrollo local (y PyPI a futuro). M0
backend/
  __init__.py                   # API pública: compile, export, sample, __version__
  core/
    __init__.py
    model.py                    # Dataclasses inmutables de la representación intermedia (§5)
    errors.py                   # Jerarquía de excepciones
    constants.py                # Constantes matemáticas fijas (TWO_PI)
    config.py                   # Parámetros configurables: MAX_QUBITS, umbrales, decimales
    provider/   provider.py, profiles.py
    compiler/   compiler.py
    transpiler/ transpiler.py
    translator/ translator.py, rules.py, normalize.py
    to_qiskit.py                # Puente NativeCircuit -> QuantumCircuit (lo usan la tomografía, el sampler y los tests)
    simulator/  simulator.py, gpi.py, gpi2.py, ms.py, zz.py, virtualz.py, tomography.py (M8)
    vectorizer/ vectorizer.py
    metrics/    metrics.py
    formatter/  formatter.py
    exporter/   exporter.py
    sampler/    sampler.py                  # Medición simulada de un paso (M9); no es una etapa del pipeline
    importer/   importer.py                 # Lectura de circuitos OpenQASM 2/3 (M10); no es una etapa del pipeline
tests/
  conftest.py
  circuits.py                   # Circuitos de prueba compartidos (Bell, GHZ, rotaciones, ...)
  test_<modulo>.py
examples/                       # Circuitos de ejemplo (por ejemplo el sumador QFT)
  qft.py
scripts/
  demo_<modulo>.py              # Salida legible para validar cada módulo a mano
  package_qollab.py             # `make qollab`: arma `qollab/`, el proyecto JS que se sube a Qollab (el visor real) (M9)
documentation/
  schema/visualization.schema.json   # JSON Schema del contrato. M6
```

### 3.3 Reglas de dependencias entre módulos

- Cada módulo importa solo `core.model`, `core.errors`, `core.config` y, si lo necesita, `core.provider` y `core.to_qiskit` (2f). El `sampler` (M9) no es una etapa del pipeline y usa solo `core.model`, `core.errors`, `core.config` y `core.to_qiskit`. **Ningún módulo del pipeline importa a otro del pipeline.** Solo `compiler` los conoce a todos.
- Imports absolutos desde la raíz del paquete: `from backend.core.transpiler import transpiler`. El estilo actual (`from core...`) no funciona en Qollab, donde la raíz del proyecto es la que está en `sys.path`.
- Las funciones públicas son puras: reciben objetos de `model.py` y devuelven objetos nuevos. Sin estado global y sin `print` (se usa `logging`).
- **Excepción a la pureza:** `transpiler` (y `tomography` en M8) pueden llamar a `backend.run`, siempre respetando la regla de un job (§2.3).

---

## 4. API pública

```python
from backend import compile, export, load_circuit, sample

qc = load_circuit(qasm_text)   # OpenQASM 2 o 3 → QuantumCircuit (M10)
data: dict = compile(
    backend,                 # el backend inyectado por Qollab (o uno local en tests)
    qc,                      # qiskit.QuantumCircuit
    *,
    entangler=None,          # None = automático según backend; "ms" | "zz" para forzar
    strategy="statevector",  # "statevector" (M3) | "tomography" (M8)
    shots=1024,              # se usa en costo (M5) y tomografía (M8); debe ser > 0
    allow_paid=False,        # guarda de costo de la tomografía en hardware (M8)
    allow_remote=True,       # False: nunca manda el job de IonQ; transpila en local (M10)
)
text: str = export(data, path=None)   # JSON string; si hay path, además lo escribe
counts: dict[str, int] = sample(data, step, shots=1024, seed=None)  # medición simulada (M9)
```

- `compile` devuelve el `dict` del contrato (§6), no un string. Así es más fácil de testear, y `export` lo serializa.
- Desde JS, se llama a la función que devuelve **string JSON** y se hace `JSON.parse`. Así se evita el problema de `dict` → `Map` de Pyodide (qollab_context §8.1).

### 4.1 Errores

`core/errors.py`: `QVizError` (base) y, debajo, `UnsupportedOperationError`, `CircuitTooLargeError`, `CircuitParseError` (texto OpenQASM ilegible, M10), `UnsupportedProviderError` y `TranspilationError`. **`provider.detect` nunca falla**: un backend que no es IonQ ni el simulador integrado se clasifica como `unsupported` (§7, M1). Quien lo rechaza es `compile` (§5.5): lanza `UnsupportedProviderError` antes de transpilar. Solo se aborta con un mensaje claro ante operaciones que no tienen sentido en el visualizador: medición a mitad de circuito, `reset`, control clásico, parámetros sin ligar (`UnsupportedOperationError`) o más qubits que el límite efectivo (`CircuitTooLargeError`). También se lanza `QVizError` directamente ante un argumento inválido (`strategy` desconocida, `shots <= 0`) o una tomografía en hardware sin `allow_paid`; `compile` valida `strategy` y `shots` antes de tocar el backend, para no gastar el único job de IonQ por un error de tipeo.

---

## 5. Representación intermedia (`core/model.py`)

Son dataclasses `frozen=True`. Los nombres son orientativos; lo que importa son los campos y las unidades.

### 5.1 Unidades y convenciones (obligatorias)

Las matrices de cada compuerta nativa están en `documentation/references/ionq_native_gates.md` §2.

| Magnitud                  | Unidad                                    | Notas                                                                                           |
| ------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Fases φ de GPI, GPI2 y MS | **radianes**                              | En qiskit-ionq están en _turnos_: φ_rad = 2π·φ_turnos                                           |
| `angle` θ de MS y ZZ      | **turnos**, rango [0, 0.25]               | Como pide el contrato. 0.25 = entrelazamiento máximo                                            |
| Rotación de VirtualZ      | radianes                                  | Solo en la representación intermedia. El JSON no la incluye por paso (se deduce de `virtual_z`) |
| Vector de Bloch           | (x, y, z) = (⟨X⟩, ⟨Y⟩, ⟨Z⟩)               | \|0⟩ → (0, 0, 1), \|1⟩ → (0, 0, −1). Convención física estándar                                 |
| θ, φ del ion              | θ ∈ [0, π] desde +z; φ ∈ [0, 2π) desde +x | Si r ≈ 0, θ = φ = 0. Si θ ≈ 0 o π, φ = 0                                                        |
| Orden de qubits           | little-endian de Qiskit                   | En el bitstring de counts, el bit de la derecha es el qubit 0                                   |
| Fidelidades               | **porcentaje** [0, 100]                   | Porque `initial_fidelity = 100 − SPAM`                                                          |

> Que el polo sur se dibuje "hacia arriba" es **responsabilidad del frontend**. El backend siempre emite la convención estándar.

### 5.2 Tipos

```python
Provider  = Literal["ionq", "local", "unsupported"]
Entangler = Literal["ms", "zz"]
OpName    = Literal["gpi", "gpi2", "ms", "zz", "virtual_z"]
Strategy  = Literal["statevector", "tomography"]

BackendInfo(provider, name, display_name, entangler, is_hardware: bool, profile: NoiseProfile)
NoiseProfile(spam_error, fidelity_1q, fidelity_2q, idle_error_per_step, price_1q, price_2q)  # §7 M5

TranspiledCircuit(circuit: QuantumCircuit | None, native_ops: tuple[dict, ...] | None,
                  source: Literal["ionq-native", "qiskit"], num_qubits: int, layout: tuple[int, ...] | None)

NativeOp(name: OpName, targets: tuple[int, ...],
         phases: tuple[float, ...] = (),      # rad: gpi/gpi2 → (φ,), ms → (φ0, φ1)
         angle: float | None = None,          # turnos: ms/zz
         z_rotation: float | None = None,     # rad: solo virtual_z
         source_index: int | None = None)     # índice de la instrucción de origen (trazabilidad / M8)
NativeCircuit(backend: BackendInfo, num_qubits: int, ops: tuple[NativeOp, ...])

QubitAngles(r, theta, phi)
SimulatedStep(index: int, op: NativeOp, qubits: tuple[QubitAngles, ...], virtual_z: tuple[float, ...])
SimulatedCircuit(native: NativeCircuit, steps: tuple[SimulatedStep, ...])

VectorizedStep(..., states: tuple[tuple[float, float, float], ...], probabilities: tuple[tuple[float, float], ...])
MeasuredStep(..., fidelities, cumulative_fidelity, inactivity, vibration, cumulative_cost)
```

### 5.3 Paso 0

El estado inicial (todos en |0⟩, `virtual_z` en 0, fidelidad `initial_fidelity`) **no se emite como paso**. Los pasos se numeran desde 1. El frontend conoce el estado inicial por definición (RF4).

### 5.4 Límites

- `MAX_QUBITS = 16` en `config.py`. Es el tope duro del ancho del circuito. Se eligió 16 por dos motivos: (1) el simulador guarda el statevector completo (`2^n` complejos, 16 bytes cada uno, y cada paso lo recorre y copia varias veces), de modo que memoria y tiempo crecen exponencialmente (con 28 qubits solo el estado ocupa 4 GiB, y en Pyodide la memoria es limitada); (2) al ser un visualizador, con más de ~16 esferas de Bloch el resultado pierde sentido a la vista. Además, si el backend expone su propio número de qubits (`backend.num_qubits`), el límite efectivo es `min(MAX_QUBITS, backend.num_qubits)`, para no mandar un circuito a un backend demasiado chico. Por encima del límite efectivo se lanza `CircuitTooLargeError`.
- Sin límite duro de pasos. Si hay más de 500, se loguea un warning.

### 5.5 Proveedores aceptados

`compile` acepta solo dos clases de backend: las máquinas **IonQ** (`ionq`) y el simulador integrado (`local`). **[decisión]** Todo lo demás (IBM, AWS Braket y cualquier backend no reconocido) se clasifica `unsupported` y se rechaza con `UnsupportedProviderError`. El motivo: sus circuitos se transpilan con el mapa de conexiones de un chip que no es de iones, y el enrutamiento puede permutar las etiquetas de los qubits y agregar SWAPs que los iones no necesitan (§11, punto 6; `documentation/prompts/decision_transpilacion_no_ionq.md`). Los simuladores locales (Built-in) y las máquinas IonQ tienen conectividad total, así que no sufren ese problema. No hay interruptor de configuración: soportar otro proveedor es un cambio de diseño. El mensaje del error es formal y legible, en inglés: `This machine is not currently supported (detected: default (BraketLocalBackend)). Currently supported: IonQ (Aria and Forte), the built-in simulator.` (el nombre y la clase del backend rechazado); el paquete de Qollab le quita el traceback antes de mostrarlo. Se evalúa en `compile`, justo después de `detect` y antes del transpiler, por lo que un backend rechazado no gasta el job de IonQ.

---

## 6. Contrato JSON (backend → frontend)

Es el único punto de acoplamiento con el frontend. **No se cambia sin acuerdo del equipo**, y si cambia se actualizan a la vez este documento y `documentation/schema/visualization.schema.json`.

```jsonc
{
  "backend": "IonQ Aria 1", // nombre legible; si no es IonQ: "ibm_kingston → iones (referencia Aria)"
  "total_qubits": 2,
  "initial_fidelity": 99.5, // 100 − SPAM (%)
  "steps": [
    {
      "step": 1,
      "operation": "virtual_z", // "gpi" | "gpi2" | "ms" | "zz" | "virtual_z"
      "targets": [0], // 1 qubit: gpi, gpi2, virtual_z · 2 qubits: ms, zz
      // "phases": ausente en virtual_z y zz · [φ] en gpi/gpi2 · [φ0, φ1] en ms (radianes)
      // "angle":  solo en ms y zz, turnos en [0, 0.25]
      "cumulative_fidelity": 99.5,
      "states": [
        [0.0, 0.0, 1.0],
        [0.0, 0.0, 1.0],
      ],
      "vibration": [0.0, 0.0],
      "cumulative_cost": 0.0,
      "probabilities": [
        [1.0, 0.0],
        [1.0, 0.0],
      ], // [p(|0⟩), p(|1⟩)] por qubit
      "virtual_z": [3.141593, 0.0], // acumulado por qubit, rad, normalizado a [0, 2π)
      "inactivity": [0, 0],
      "fidelities": [100.0, 100.0],
    },
    {
      "step": 2,
      "operation": "gpi2",
      "targets": [0],
      "phases": [1.570796],
      "cumulative_fidelity": 99.48,
      "states": [
        [1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0],
      ],
      "vibration": [0.0, 0.0],
      "cumulative_cost": 0.0003,
      "probabilities": [
        [0.5, 0.5],
        [1.0, 0.0],
      ],
      "virtual_z": [3.141593, 0.0],
      "inactivity": [0, 1],
      "fidelities": [99.98, 99.99],
    },
  ],
}
```

(Los primeros dos pasos de `h(0)` traducido: VirtualZ(π) seguido de GPI2(π/2). Los estados son exactos; las fidelidades y el costo son ilustrativos.)

### 6.1 Semántica de cada campo

| Campo                  | Definición                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend`              | `BackendInfo.display_name`                                                                                                                                                                                                                                                                        |
| `total_qubits`         | Qubits del circuito del usuario más ancillas reales, si las hubo (ver compactación, M2). Entre 1 y `MAX_QUBITS` (16); el schema tiene el mismo tope, y un test comprueba que coincidan                                                                                                          |
| `initial_fidelity`     | `100 · (1 − spam_error)` del perfil de ruido                                                                                                                                                                                                                                                      |
| `step`                 | Índice desde 1, consecutivo. La lista se ordena por `step`                                                                                                                                                                                                                                        |
| `operation`            | En minúsculas. **[decisión]** `virtual_z`, no `virtualZ`, para no mezclar mayúsculas en un enum                                                                                                                                                                                                    |
| `phases`               | **Fases lógicas** (las del circuito con VirtualZ explícitos), no la fase física del láser. La fase del láser sería φ − `virtual_z[q]` y se puede mostrar como dato educativo. El signo **−** está verificado contra las matrices; el ejemplo de la doc de IonQ usa **+** (ver `ionq_native_gates.md` §2.3) |
| `targets`              | Índices de qubit compactados (0 … total_qubits−1)                                                                                                                                                                                                                                                 |
| `angle`                | θ en turnos, normalizado a [0, 0.25] (ver M2)                                                                                                                                                                                                                                                     |
| `cumulative_fidelity` | Fidelidad global después del paso (§7 M5)                                                                                                                                                                                                                                                         |
| `states`               | Vector de Bloch reducido por qubit, con \|v\| ≤ 1 (\|v\| < 1 si hay entrelazamiento)                                                                                                                                                                                                              |
| `vibration`            | Amplitud de oscilación normalizada [0, 1] por qubit. Vale 0 si el error está por debajo de `VIBRATION_THRESHOLD`. El frontend la mapea a ángulo                                                                                                                                                   |
| `cumulative_cost`     | Costo estimado acumulado en **USD** para `shots` shots en el hardware de referencia (§7 M5). **[decisión]** USD y no créditos de Qollab                                                                                                                                                           |
| `probabilities`        | `[(1+z)/2, (1−z)/2]` por qubit                                                                                                                                                                                                                                                                    |
| `virtual_z`            | Suma de rotaciones VirtualZ por qubit, normalizada a [0, 2π)                                                                                                                                                                                                                                      |
| `inactivity`           | **[decisión]** Total acumulado (monotónico) de pasos en los que el qubit no fue target. Los pasos `virtual_z` no suman inactividad a los demás (duran 0)                                                                                                                                           |
| `fidelities`           | Fidelidad por qubit en %, empieza en 100                                                                                                                                                                                                                                                          |

Los campos que no aplican **se omiten** (no van como `null`). Los floats se redondean a `JSON_DECIMALS = 6` y `-0.0` se escribe como `0.0`.

> El requerimiento escribía `acumulative_*`. **[resuelto]** El contrato usa el prefijo `cumulative_*` (por ejemplo `cumulative_fidelity`, `cumulative_cost`) y la operación `virtual_z` en snake_case.

---

## 7. Plan de implementación por módulos

**Regla de trabajo:** se implementa **un módulo por vez**. Al terminar cada uno: tests en verde, demo corrida y estado actualizado en la tabla de §8. Después se **frena hasta que el equipo lo valide**. Cada módulo vive en su rama `feature/<modulo>` (`make feature NAME=<modulo>`).

Circuitos de prueba compartidos (`tests/circuits.py`): `single_x`, `single_h`, `rotations` (rx, ry, rz con ángulos arbitrarios), `bell`, `ghz3`, `swap_test` (con swap y ccx, para forzar descomposiciones) y `idle_qubit` (un qubit que nunca se usa).

---

### M0 — Fundaciones

**Objetivo:** dejar un proyecto que se instala y testea, con la estructura de §3.2 vacía y bien cableada.

- `pyproject.toml`: `requires-python = ">=3.12"`, dependencias `qiskit>=2.5.2,<3.0.0` (la línea que Qollab agrega solo), `qiskit-ionq>=1.0.0,<2.0.0` y `numpy>=2.0,<3.0`, y extras `dev` = `pytest`, `jsonschema`, `flake8`, `pydocstyle` (`make lint`).
- `__init__.py` en cada paquete. Imports absolutos `backend.core...` (§3.3). Arreglar `backend/__init__.py`: hoy importa `from core.compiler import compile` y `from exporter import export`, que no resuelven, y tiene un `__main__` que no se ejecuta nunca. `show` se saca de `__all__` hasta que exista el frontend.
- `core/model.py` (todos los dataclasses de §5.2), `core/errors.py` y `core/config.py`.
- `tests/circuits.py` y `tests/conftest.py`.
- Makefile: `make venv`, `make install`, `make test`, `make demo M=<modulo>`.
- Rehacer `documentation/diagrams/modules.puml`, que hoy tiene contenido de otro proyecto (Simulation, RunoffModel, MainWindow…), según §3.1. Agregar a `activity.puml` los pasos provider, metrics y exporter.

**Validación:** `make install && make test` pasa (con un smoke test que importa `backend` y construye un `NativeOp`).

---

### M1 — Provider + Transpiler

**Objetivo:** dado cualquier `backend`, saber de qué proveedor viene (sin fallar nunca por un proveedor inesperado) y obtener el circuito transpilado. Qué backends se aceptan lo decide `compile` (§5.5): solo IonQ y el simulador integrado.

**1a. Sonda en Qollab (primera tarea, manual).** Un `main.py` mínimo que imprima `type(backend).__module__`, `type(backend).__name__`, `backend.name`, `backend.options` y, si existe, `backend.target.operation_names`, para cada grupo de backends: Built-in, AWS local, un IBM con ruido, IonQ Aria 1 y IonQ Forte 1 (simulador). El agente no puede correrlo: se lo pide al equipo y anota los resultados en §10. **[a verificar]** todo lo que sigue depende de esto.

**1b. `provider.detect(backend) -> BackendInfo`**

| Señal (en orden)                                                                      | Proveedor                   |
| ------------------------------------------------------------------------------------- | --------------------------- |
| `type(backend).__module__` empieza con `qiskit_ionq` o `backend.name` contiene `ionq` | `ionq`                      |
| `BasicSimulator` / `basic_simulator` / `aer_simulator`                                | `local`                     |
| fallback estructural: los `operation_names` del backend                               | `ionq`/`unsupported`        |
| cualquier otra cosa (IBM, AWS Braket, backends no reconocidos)                        | `unsupported` (`detect` nunca lanza excepción) |

El fallback estructural mira `target.operation_names` (o `operation_names`, o `configuration().basis_gates`): `gpi`/`gpi2`/`ms` → `ionq` (`zz` y `rxx` no cuentan: también existen como compuertas comunes de Qiskit y darían falsos positivos); si no, `unsupported`. Así un backend con nombre raro pero gates claros queda bien clasificado.

- Entrelazador automático **[actualizado]**: primero se mira la compuerta nativa de 2 qubits que anuncia el backend (si anuncia solo `zz`, o solo `ms`); si no, se usa `provider.native_2q_gate` (propio, `aria` → `ms` y `forte` → `zz`; copia de la función de `qiskit-ionq` ≥ 1.0.3, que el qiskit-ionq de Qollab no tiene); si no, el nombre: `forte` o `ideal` → `zz`, `aria` → `ms`; por defecto `ms`. El parámetro `entangler` de `compile` lo puede forzar.
- `is_hardware`: true solo para QPUs de IonQ (las que gastan créditos). Se prefieren los atributos booleanos `_simulator`/`_is_simulator`/`is_simulator`/`simulator` que pone el SDK; buscar la palabra `simulator` en el nombre queda como último recurso, porque un nombre es una señal débil.
- `profiles.py`: tabla de `NoiseProfile` por máquina de referencia (`aria`, `forte`, `ideal`). Con IonQ se usa el perfil de esa máquina. Con cualquier otro proveedor se usa el perfil de referencia del entrelazador (MS → Aria, ZZ → Forte) **[decisión]**, porque el visualizador muestra el circuito _como si_ corriera en iones. Los valores numéricos se completan en M5, con fuente y fecha.

**1c. `transpiler.transpile(info, backend, qc) -> TranspiledCircuit`**

- Primero quita las mediciones finales (`remove_final_measurements`) y valida el ancho contra el límite efectivo (`min(MAX_QUBITS, backend.num_qubits)`, §5.4), que el circuito no esté vacío y que no tenga parámetros sin ligar (`UnsupportedOperationError`). Las tres validaciones ocurren antes de cualquier job.
- **IonQ, estrategia `native-local`** (candidata, la más deseable): con qiskit-ionq ≥ 1.0.0, `transpile(qc, backend=<backend con gateset="native">)` transpila a GPI/GPI2/MS|ZZ **en local, sin mandar ningún job** (`ionq_native_gates.md` §4.2). Esto evita la duda sobre `dry_run` y no gasta el único job de la corrida. **[a verificar]** si en Qollab se puede obtener la variante nativa del `backend` inyectado (qollab_context §8.4). Ojo: es el transpilador de qiskit-ionq, no el compilador propietario de IonQ, así que el resultado puede diferir del que IonQ ejecutaría.
- **IonQ, estrategia `remote`** (la del código actual): `backend.run(qc, dry_run=True, job_settings=...)` + `job.compiled_circuit(lang="native")`. La espera del job tiene un tope (`config.REMOTE_JOB_TIMEOUT_S`, 60 s): si se agota, se pasa a `local`. **[a verificar]** que la versión de qiskit-ionq en Qollab soporte `dry_run` y `compiled_circuit`, qué devuelve (¿`QuantumCircuit` con `GPIGate`? ¿dict JSON de IonQ?) y si el dry-run cuenta como el único job de la corrida.
- **IonQ, estrategia `local` (fallback)**: si `remote` lanza una excepción, se usa `qiskit.transpile(qc, backend=backend, optimization_level=1)` (el backend precreado usa el gateset estándar) y se deja un warning en el log. El translator lo trata igual.
- **Simulador local (`local`)**: `qiskit.transpile(qc, backend=backend, optimization_level=1)`. Si falla (por ejemplo, un backend sin `target`), se reintenta con `transpile(qc, basis_gates=["rz", "sx", "x", "cz", "cx"], optimization_level=1)`, sin mapa de acoplamiento.
- Se guarda el layout inicial (`circuit.layout.initial_index_layout(filter_ancillas=True)`) si existe, para la compactación en M2.
- Orden de intento con IonQ: `native-local` → `remote` → `local`. La sonda (1a) decide cuáles son viables; las que no lo sean se descartan del código.
- En **ningún** caso se transpila hacia IonQ un circuito que vino de otro proveedor (requerimiento: traducción estática).

**Tests (sin red):** `BasicSimulator`; un `GenericBackendV2` con base `["cz", "rz", "sx", "x"]` (un chip con mapa de conexiones, para probar el layout); un objeto falso sin `target` (clasificado `unsupported`); un mock de backend IonQ cuyo `run` devuelve un job falso con un circuito nativo fijo, para probar la estrategia `remote`; y un mock que lanza una excepción, para el fallback. Además, `detect` sobre cada uno.

**Demo:** `scripts/demo_transpiler.py` imprime el `BackendInfo` y el circuito transpilado de `bell` para cada backend local.

---

### M2 — Translator (normalizador)

**Objetivo:** convertir cualquier `TranspiledCircuit` en un `NativeCircuit` equivalente formado solo por `gpi`, `gpi2`, `virtual_z` y un único entrelazador (`ms` **o** `zz`, nunca los dos).

**2a. Función `translate` (`translator.py`).** `translate(info, transpiled) -> NativeCircuit` recibe el `BackendInfo` y el `TranspiledCircuit` que devuelve `transpiler.transpile()`. La regla de traducción es la misma para todo backend (2c); lo único que cambia es el entrelazador objetivo (`ms`/`zz` de `BackendInfo.entangler`). Delega en los helpers `rules.py` y `normalize.py`. No hay clases por proveedor: `compile` solo acepta IonQ y el simulador integrado (§5.5), y las subclases eran idénticas.

**2b. Compactación de qubits.** Los qubits de salida son los del circuito del usuario, en su orden (vía layout inicial). Los qubits físicos que no se tocan se descartan: un backend de decenas de qubits queda en 2 si el circuito es un Bell. Si el routing usó ancillas físicas, se agregan al final. Un qubit del usuario que nunca se usa se conserva (es un ion quieto en |0⟩). Limitación aceptada: las permutaciones finales por routing no se deshacen.

**2c. Tabla de reglas (`rules.py`).** Todas son iguales **salvo fase global**, que no afecta a los vectores de Bloch. El orden es temporal (primero se aplica lo de la izquierda).

| Compuerta de origen                                                | Traducción                                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `x`                                                                | `gpi(0)`                                                                            |
| `y`                                                                | `gpi(π/2)`                                                                          |
| `sx` / `sxdg`                                                      | `gpi2(0)` / `gpi2(π)`                                                               |
| `rz(λ)`, `p(λ)`, `u1(λ)`                                           | `virtual_z(λ)`                                                                       |
| `z`, `s`, `sdg`, `t`, `tdg`                                        | `virtual_z(π)`, `virtual_z(π/2)`, `virtual_z(−π/2)`, `virtual_z(π/4)`, `virtual_z(−π/4)` |
| `h`                                                                | `virtual_z(π)`, `gpi2(π/2)`                                                          |
| `cz(a,b)`                                                          | `ZZ⁺(a,b)`, `virtual_z(a,−π/2)`, `virtual_z(b,−π/2)`                                  |
| `cx(c,t)`, entrelazador `ms`                                       | `gpi2(c,π/2)`, `ms(c,t; [0,0]; 0.25)`, `gpi2(c,π)`, `gpi2(t,π)`, `gpi2(c,−π/2)` (Maslov, 5 ops; `ionq_native_gates.md` §3) |
| `cx(c,t)`, entrelazador `zz`                                       | `h(t)`, `cz(c,t)`, `h(t)` (expandido con las reglas de arriba)                      |
| `rzz(θ)`                                                           | `zz(θ / 2π)` normalizado (2d)                                                       |
| GPI/GPI2/MS/ZZ de IonQ                                             | Directo, convirtiendo fases de turnos a radianes. Se acepta como entrada un `QuantumCircuit` con compuertas de `qiskit_ionq` **o** la lista JSON de la API nativa (`gate`, `phase`/`phases`, `angle`, `target`/`targets`; `ionq_native_gates.md` §4.1) |
| `id`, `barrier`, `delay`, `measure` final                          | Se ignoran                                                                          |
| Otra compuerta de **1 qubit**                                      | `OneQubitEulerDecomposer(basis="ZSX")` → reglas de arriba                           |
| Otra compuerta de **2 qubits** (`ecr`, `swap`, `iswap`, `rzx`, …)  | `TwoQubitBasisDecomposer(CZGate(), euler_basis="ZSX")` → reglas de arriba           |
| Compuerta de 3+ qubits                                             | Se expande con `operation.definition` recursivamente hasta llegar a la tabla        |
| `measure` a mitad de circuito, `reset`, `if_else`, control clásico | `UnsupportedOperationError` con el nombre y la posición                             |

Donde `ZZ⁺(a,b)` es el entrelazador máximo según el backend:

- entrelazador `zz`: `zz(a,b; 0.25)`
- entrelazador `ms`: `gpi2(a,π/2)`, `gpi2(b,π/2)`, `ms(a,b; [0,0]; 0.25)`, `gpi2(a,−π/2)`, `gpi2(b,−π/2)`

Identidades de base, verificadas numéricamente contra las matrices oficiales el 2026-10-09 (detalle en `documentation/references/ionq_native_gates.md` §3; igual tienen que quedar cubiertas por los tests):

- GPI(φ) = σ_φ = cos φ·X + sin φ·Y. GPI2(φ) = exp(−iπ/4·σ_φ). GPI2(π/2) = RY(π/2).
- MS(φ0, φ1, t) = exp(−iπt·σ_φ0⊗σ_φ1). ZZ(t) = exp(−iπt·Z⊗Z), con t en turnos.
- CZ = RZ(−π/2)⊗RZ(−π/2) · ZZ(0.25), salvo fase global.
- XX ↔ ZZ: conjugando con RY(±π/2) en ambos qubits. MS(φ0, φ1, t) = rotar con `virtual_z(−φ0)`, `virtual_z(−φ1)`, aplicar MS(0, 0, t) y deshacer con `virtual_z(φ0)`, `virtual_z(φ1)`.

**2d. Normalización del ángulo (`normalize.py`)** a t ∈ [0, 0.25] turnos, para ZZ(t) = exp(−iπt·ZZ):

1. t ← t mod 1, llevado a [−0.5, 0.5) (±1 turno es fase global).
2. Si |t| > 0.25: t ← t − 0.5·sign(t), y se agrega Z⊗Z = `virtual_z(π)` en ambos qubits (para MS se agrega X⊗X = `gpi(φ0)`, `gpi(φ1)`).
3. Si t < 0: se conjuga el primer qubit con X para ZZ (`gpi(0)` antes y después) o con Z para MS (`virtual_z(π)` antes y después), y t ← −t.
4. Si t = 0 no se emite nada.

**2e. Conmutación MS ↔ ZZ.** Si el circuito de IonQ trae el entrelazador que no corresponde (o el usuario forzó el otro con `entangler`), se reescribe con las identidades de 2c. Esto también cubre el extra "Conmutador de compuertas".

**2f. `to_qiskit(native, upto=None) -> QuantumCircuit`** (`core/to_qiskit.py`, fuera del paquete `translator` porque va en el sentido inverso a la traducción y lo usan también la tomografía y los tests, sin que ningún módulo del pipeline importe a otro). Reconstruye el circuito con `GPIGate`, `GPI2Gate`, `MSGate`, `ZZGate` (de qiskit-ionq, fases en turnos) y `RZGate` para virtual_z. Se usa como oráculo en los tests y para la tomografía en M8.

**Sin optimización** en el MVP: no se fusionan compuertas consecutivas. Un pase de fusión es opcional para después.

**Tests (la fuente de verdad son los tests, no la tabla):**

- Por cada regla: `Operator(to_qiskit(regla)).equiv(Operator(compuerta_origen))`, para ambos entrelazadores y para ángulos aleatorios con semilla fija (incluidos negativos y mayores a 0.25).
- Por cada circuito de prueba y backend local: equivalencia del circuito completo, transpilado contra traducido.
- Invariantes: solo aparecen los ops permitidos, nunca `ms` y `zz` juntos, cada `angle` está en [0, 0.25] y los targets están en rango.
- Si una fórmula de 2c no pasa su test, se corrige la fórmula **y** este documento.

**Demo:** `scripts/demo_translator.py` imprime la lista de ops de `bell` y `ghz3` para MS y para ZZ, con la cantidad de compuertas por tipo.

---

### M3 — Simulator (statevector exacto)

**Objetivo:** calcular, después de cada op, el estado reducido de cada qubit como (r, θ, φ), y el VirtualZ acumulado.

- Un archivo por compuerta (ya existen `gpi.py` y `gpi2.py`), cada uno con `matrix(...) -> np.ndarray` en convención de radianes y turnos (§5.1), según las matrices de `ionq_native_gates.md` §2. La doc escribe las matrices de 2 qubits en big-endian; acá se trabaja en little-endian, así que hay que cuidar el orden de los targets: `gpi.py`, `gpi2.py`, `ms.py`, `zz.py`, `virtualz.py` (= RZ(λ)).
- `simulate(native) -> SimulatedCircuit`: statevector de NumPy con forma `(2,)*n`, inicializado en |0…0⟩. Cada op se aplica contrayendo su matriz con los ejes de sus targets (se transpone el estado para ponerlos primero y se multiplica). Con el orden little-endian, el qubit q corresponde al eje `n−1−q`.
- Después de cada op, para cada qubit **target** (los demás conservan su descripción anterior: una unitaria sobre unos qubits no cambia el estado reducido del resto, y así cada paso cuesta el trabajo de uno o dos qubits): la matriz densidad reducida ρ_q (traza parcial) da x = 2·Re ρ01, y = −2·Im ρ01, z = ρ00 − ρ11, y de ahí se calculan r, θ y φ. El vectorizer convierte de vuelta a cartesianas. Se pasa por ángulos porque así lo pide el diagrama de actividad y porque la UI muestra θ y φ.
- VirtualZ se aplica como RZ real sobre el estado, así el vector gira en Z (es el "click" del VirtualZ). `virtual_z[q]` acumula λ módulo 2π.
- `simulate` solo calcula el statevector exacto; la tomografía (M8) se elige en `compiler`, antes de llamarla.

**Tests:**

- Casos a mano: `gpi(0)` sobre |0⟩ da z = −1. `gpi2(0)` sobre |0⟩ da (0, −1, 0). `gpi2(π/2)` sobre |0⟩ da (1, 0, 0). Después de un Bell, r = 0 en ambos qubits.
- Oráculo: el estado final de cada circuito de prueba se compara contra `qiskit.quantum_info.Statevector(qc_original)` con `partial_trace` por qubit (atol 1e-9).
- Las matrices de cada archivo se comparan contra `Operator(GPIGate(φ/2π))` etc. de qiskit-ionq, salvo fase global.

**Demo:** `scripts/demo_simulator.py` imprime una tabla de paso × qubit con (r, θ, φ) para `bell`.

---

### M4 — Vectorizer

**Objetivo:** convertir (r, θ, φ) en (x, y, z) y calcular las probabilidades.

- x = r·sinθ·cosφ, y = r·sinθ·sinφ, z = r·cosθ. `probabilities = [(1+z)/2, (1−z)/2]`.
- Recorta r a ≤ 1 si hay error numérico.

**Tests:** ida y vuelta (cartesianas → esféricas → cartesianas) sobre puntos aleatorios, polos, origen y ecuador. Las probabilidades suman 1 y están en [0, 1].

**Demo:** la misma tabla de M3 con (x, y, z) y p(|1⟩).

---

### M5 — Metrics

**Objetivo:** calcular `initial_fidelity`, `fidelities`, `cumulative_fidelity`, `inactivity`, `vibration` y `cumulative_cost`. Es un modelo **didáctico y simple**, documentado acá, no una simulación de ruido.

- **Perfil de ruido** (`provider/profiles.py`): `spam_error`, `fidelity_1q`, `fidelity_2q`, `idle_error_per_step`, `price_1q`, `price_2q` (USD por compuerta-shot). Los valores se cargan para `aria` y `forte` **con la fuente y la fecha en un comentario** (doc de IonQ, Qollab o precios públicos de AWS Braket / Azure). **[a verificar]** si `backend.calibration()` de qiskit-ionq funciona en Qollab; si funciona, tiene prioridad sobre la tabla. Perfil `ideal`: todo en 1 y precio 0.
- `initial_fidelity = 100·(1 − spam_error)`.
- Por paso, con `f` = 1 para `virtual_z`, `fidelity_1q` para gpi/gpi2 y `fidelity_2q` para ms/zz:
  - `fidelities[q] *= f` si q es target. Si no lo es y el paso no es `virtual_z`, `fidelities[q] *= (1 − idle_error_per_step)` y `inactivity[q] += 1`.
  - `cumulative_fidelity = cumulative_fidelity_prev · f · Π_{q inactivo}(1 − idle_error_per_step)`.
  - `cumulative_cost += shots · price(op)`, con price = 0 para virtual_z.
  - `vibration[q] = e_q` si `e_q = 1 − fidelities[q]/100 ≥ VIBRATION_THRESHOLD` (config, por defecto 0.01); si no, 0.

**Tests:** valores calculados a mano para un circuito de 3 ops; monotonía (la fidelidad nunca sube, costo e inactividad nunca bajan); `virtual_z` no cambia ni la fidelidad ni la inactividad; el umbral se respeta en ambos sentidos; el perfil `ideal` da todo 100 y costo 0.

---

### M6 — Formatter + Exporter + API pública

**Objetivo:** cerrar el pipeline: `compile(backend, qc)` devuelve el dict del contrato §6 y `export` lo serializa.

- `formatter.format(measured) -> dict`: arma exactamente las claves de §6, omite los campos que no aplican y redondea a `JSON_DECIMALS`.
- `exporter.export(data, path=None) -> str`: un JSON con sangría de 2 espacios en el que las listas simples (números, textos o listas de ellos, como `states` o `targets`) van en una sola línea, con `ensure_ascii=False` y `allow_nan=False` (un `NaN` o infinito no es JSON válido y lanza `ValueError`), y si hay `path` lo escribe (en Qollab el archivo dura solo lo que dura la corrida).
- `compiler.compile(...)`: descomenta y completa el pipeline de §3.1.
- `documentation/schema/visualization.schema.json` (JSON Schema draft 2020-12) con los tipos, rangos, campos condicionales por `operation` y largos de listas iguales a `total_qubits`.

**Tests:** el resultado de `compile` para cada circuito de prueba valida contra el schema (`jsonschema`); snapshot (golden file) de `bell` en BasicSimulator, en `tests/golden/bell_basic.json`; y `export` → `json.loads` da el mismo dict.

**Demo:** `scripts/demo_compile.py` escribe `out/bell.json` y `out/ghz3.json` (`out/` va en `.gitignore`).

---

### M7 — Integración en Qollab

**Objetivo:** que funcione de verdad en la plataforma, con todos los grupos de backends.

- `main.py` en la raíz (proyecto Python, porque todavía no hay frontend): arma un circuito de ejemplo, llama a `compile(backend, qc)` y hace `print(export(data))`. **Nunca `import backend`**: pisaría la variable `backend` que inyecta Qollab. Se usa `from backend import compile, export`.
- `requirements.txt` con las mismas dependencias que `pyproject.toml` (sin opciones de pip, marcadores de entorno ni URLs; con comentarios, que Qollab admite). Qollab siempre instala Qiskit y, si el archivo no lo nombra, agrega `qiskit>=2.5.2,<3.0.0`; si lo nombra, usa la línea tal cual. El `qiskit-ionq` lo trae la plataforma con sus backends IonQ (su versión no está documentada, es anterior a 1.0.3), así que el rango pide una versión que ese paquete ya cumple y no fuerza una instalación distinta. NumPy viene con Pyodide.
- Si `main()` lleva parámetros con anotaciones estrictas (`shots: int`, `entangler: str`), Qollab genera un formulario (qollab_context §5). `main.py` compila un circuito de ejemplo (`circuit`: `bell`, `ghz3`, `ghz16` o `layered16`), imprime el JSON (o solo su tamaño si tiene más de 30 pasos) y mide un paso con `sample` (`step`, 0 = el último); la lógica compartida con las páginas JS está en `qollab_api.py`. El campo `entangler` es texto libre (el formulario no tiene desplegables) y vale `"auto"` por defecto: `parse_entangler` lo convierte en `None` (el backend decide: Forte → ZZ, el resto → MS), o en `"ms"`/`"zz"` para forzarlo, sin distinguir mayúsculas. Cualquier otro texto lanza `QVizError`; antes caía en silencio al modo automático y el valor por defecto `"ms"` forzaba MS también en Forte. **[a verificar]** en Qollab si el formulario precarga el valor por defecto y cómo llega un campo vacío (`""` o `None`; ambos se tratan como `"auto"`).

**Validación (manual, la hace el equipo):** correr en Built-in, IonQ Aria 1 (simulador) e IonQ Forte 1 (simulador). Ninguno puede fallar, el JSON tiene que validar contra el schema y no puede aparecer "only one job is allowed". En AWS local y en un IBM con ruido tiene que aparecer `UnsupportedProviderError` con un mensaje claro (no están soportados, §5.5). Los resultados se anotan en §10.

---

### M8 — Tomografía por prefijos (`strategy="tomography"`)

**Objetivo:** el requerimiento "Toma de mediciones": obtener los vectores **midiendo** en el backend en vez de calcularlos, para ver el efecto del ruido real. El statevector de M3 queda como referencia ideal para comparar.

- Para k = 1 … N (la cantidad de ops), el prefijo es `to_qiskit(native, upto=k)`. El requerimiento dice k ∈ [0, N): eso deja afuera el estado posterior al último gate, así que se usa 1 … N. k = 0 es |0…0⟩ y solo se mide opcionalmente, como calibración de SPAM.
- Por cada prefijo, 3 circuitos: base Z (`measure_all`), base X (`h` en todos y luego medir) y base Y (`sdg` + `h` en todos y luego medir). En total son **3N circuitos**.
- **Una sola llamada** `backend.run(lista_de_circuitos, shots=shots)` (§2.3). Para backends no IonQ, antes se hace `transpile(lista, backend)`.
- ⟨σ_B⟩\_q = (n0 − n1)/shots, marginalizando el bit q (el de la derecha es el qubit 0). El vector se recorta a la bola unitaria.
- **Conflictos conocidos:**
  - Con IonQ, la estrategia `remote` del transpiler ya consume el único job. En modo tomografía, el transpiler tiene que usar la estrategia `local`.
  - **[a verificar]** que qiskit-ionq acepte una lista de circuitos en un solo job.
  - **[a verificar]** si se pueden mandar compuertas nativas desde el `backend` precreado (qollab_context §8.4). Es lo ideal: con `gateset="native"` IonQ no recompila ni mitiga, así que lo medido corresponde exactamente a los ops visualizados (`ionq_native_gates.md` §5). Si no se puede, los prefijos se mandan en gateset estándar y IonQ los recompila (el estado ideal es el mismo, pero el ruido corresponde al circuito recompilado).
- **Guarda de costo:** si `info.is_hardware`, se lanza error salvo que se pase `allow_paid=True`. La guarda es conservadora: no siempre se puede saber desde el código si el backend es pago, así que se pide confirmación explícita antes de mandar 3N circuitos × shots.
- Advertencia en el log: con los simuladores con ruido, el tiempo escala con circuitos × shots.

**Tests:** con `BasicSimulator` y 20 000 shots, cada componente difiere del statevector en menos de 5/√shots; se cuenta exactamente una llamada a `run` (backend mockeado); y la guarda de hardware funciona.

---

### M9 — Sampler (medición simulada de un paso)

**Objetivo:** el botón "Medir" del visor: dado un paso del JSON, devolver los conteos de cada bitstring como si se midieran todos los qubits. Tiene que reproducir las correlaciones del entrelazamiento (un Bell solo da `00` y `11`).

**Problema que resuelve.** `states` y `probabilities` son marginales por qubit. De las marginales no se puede recuperar la distribución conjunta: en un Bell ambas valen 0.5, y muestrear cada qubit por separado da 25 % para `00`, `01`, `10` y `11`. La distribución conjunta es la diagonal del statevector, `|⟨z|ψ⟩|²`.

**[decisión] No se agrega ningún campo al contrato JSON.** Los pasos exportados ya traen cada operación nativa con sus parámetros, así que el circuito se puede reconstruir y simular a partir del propio JSON. Se comprobó en seis circuitos (Bell, GHZ de 16 qubits, un sumador y circuitos aleatorios de hasta 16 qubits) con una diferencia máxima de 1e-6 (el redondeo del JSON). Un campo con la distribución conjunta por paso se descartó por tamaño: guardar solo las probabilidades ≥ 1e-6 daría ~16 MB para un circuito aleatorio de 12 qubits y ~115 MB para uno de 16, y el tamaño depende de la estructura del estado, no de la cantidad de qubits.

- `sampler.sample(data, step, shots=1024, *, seed=None) -> dict[str, int]` (`backend.sample`). `data` es el dict de `compile` o el resultado de `json.loads(export(...))`. `step=0` es el estado inicial. El bitstring es little-endian (qubit 0 a la derecha) y el resultado va de más a menos frecuente.
- Reconstruye las operaciones desde los pasos (la rotación de un `virtual_z` es la diferencia con su acumulado anterior), arma el circuito con `to_qiskit.circuit_from_ops` y calcula `|ψ|²` con `Statevector`. Los resultados ideales se muestrean de esa distribución y después se les aplica ruido.
- **Ruido [decisión]:** la fidelidad `f` de cada qubit en ese paso (`fidelities`, en %) es un error de lectura de `(1 − f)/2`, que equivale a acercar la probabilidad a 0.5 con el factor `f`. Además se suma, como un segundo cambio de bit independiente, el error de preparación y medición `1 − initial_fidelity` (SPAM); por eso un Bell recién preparado tampoco se mide sin errores. Dos cambios independientes con probabilidades `a` y `b` dan `a + b − 2ab`.
- `config.MAX_SAMPLE_SHOTS = 100_000`. Datos mal formados, `step` o `shots` inválidos lanzan `QVizError`.
- `sampler.probabilities(data, step)` devuelve la distribución ideal (`2**n` entradas, índice = valor del bitstring).
- No envía ningún job: respeta la regla de un job por corrida en IonQ.
- **Puente para Qollab:** `qollab_api.py` expone `run(backend, circuit, shots, entangler) -> str` y `sample_step(visualization, step, shots) -> str`. Devuelven texto (el `dict` → `Map` de Pyodide no se puede imprimir) y `sample_step` responde una **lista de pares** `[bitstring, cuenta]`, no un objeto, porque JavaScript reordena las claves enteras de un objeto (`"10"`, `"11"`) y se perdería el orden.
- **Limitación:** requiere poder llamar a Python desde un clic en la página. **Verificado en Qollab el 2026-10-10** (Built-in): la llamada con `callPromising` funciona después de la primera corrida, las 8 mediciones de la prueba salieron bien, `import * as api from "qollab_api"` funciona con un archivo de la raíz y compilar un Bell y cada medición tardan unos milisegundos. Entonces no hace falta la alternativa de simular en JavaScript.
- **Conexión con el visor.** El botón Medir de `frontend/index.html` usa `sample` cuando el visor corre en Qollab. **[decisión]** El aspecto y las funciones del visor no se cambian sin aprobación del equipo: lo que Qollab necesita entra como hooks opcionales (`window.QVIZ_HOST` con `shaders`, `laser`, `circuits`, `load` y `sample`; sin ellos el visor se comporta como siempre) y como código generado por `scripts/package_qollab.py`, que copia el HTML y el CSS del visor y arma un único `main.js` con un preludio (los shaders y el modelo del láser embebidos y el host) seguido de los módulos de `frontend/js` empaquetados sin reescribirlos, cada uno en su ámbito (Qollab no sirve los demás archivos del proyecto, así que un `import("./js/...")` falla ahí). Lo único visible que cambia: con la medición del backend no se muestra la nota de "qubits entrelazados" (el muestreo ya conserva las correlaciones). Guía completa, reglas para cambios futuros y qué falta verificar en `documentation/docs/frontend/qollab.qmd`.

**Tests:** la distribución conjunta coincide con las marginales de cada paso del JSON y con `Statevector` del circuito original; un Bell sin ruido solo da `00` y `11`; con fidelidad 0 la distribución es uniforme; el orden de bits; la semilla; el rechazo de pasos, shots y datos inválidos; y las funciones de `qollab_api.py` (incluido el orden de la lista de pares).

---

### M10 — Importer (circuitos en OpenQASM)

**Objetivo:** que el visor cargue circuitos propios (archivos `.qasm`), que pasan por la plataforma entera hasta llegar al contrato JSON. **[decisión del usuario, 2026-10-10]** El botón y el arrastrar de JSON se quitaron del visor: lo único que el usuario carga son circuitos en OpenQASM. Los organizadores confirmaron (2026-10-10) que OpenQASM es el estándar para cargar circuitos, que OpenQASM 2 funciona con `qiskit.qasm2.loads`, que OpenQASM 3 necesita `qiskit.qasm3.loads` más `qiskit-qasm3-import` en `requirements.txt`, y que usar Qiskit y OpenQASM como dependencias no cambia la licencia del proyecto.

- `importer.load_circuit(text) -> QuantumCircuit` (`backend.load_circuit`). Lee la versión del encabezado `OPENQASM 2.0;` / `OPENQASM 3.0;` (los comentarios antes del encabezado se ignoran) y usa `qasm2` o `qasm3`. `qasm3` se importa recién al leer un circuito en OpenQASM 3: si el paquete falta, OpenQASM 2 sigue andando y el error dice qué instalar.
- `CircuitParseError` (nueva, hereda de `QVizError`): texto vacío, más largo que `config.MAX_QASM_CHARS` (200 000), sin encabezado, versión distinta de 2 y 3, o error del parser (el mensaje conserva línea y columna). **[decisión]** Todo error del parser se convierte en `CircuitParseError`; ninguna excepción cruda llega al visor.
- **Control de flujo (`if`, `for`, `while`, `switch`)** → `UnsupportedOperationError` desde el importer (un `for` del importador de Qiskit falla con un `TypeError` ilegible si se lo deja llegar al pipeline).
- **Compuertas que no se pueden traducir a IonQ → error descriptivo [decisión del usuario].** Toda compuerta que Qiskit sabe descomponer (la librería estándar, las definidas con `gate`, `ctrl @`, `inv @`, `pow @`) termina en GPI, GPI2, MS/ZZ y Z virtual. Lo que no se puede traducir se rechaza antes de gastar ningún job, con el nombre y el motivo: `opaque` (importer, y `transpiler` para cualquier `Gate` sin definición, también dentro de otras definiciones), una compuerta que no existe (`rzz`, `rxx`: se dice qué compuertas hay y cómo definirla con `gate`), `reset`, medición a mitad de circuito, control clásico, subrutinas `def` y calibración de pulsos, y los índices fuera de registro.
- Los límites que dependen de la máquina siguen en `compile`: más de 16 qubits, `reset`, medición a mitad de circuito y parámetros sin valor (`input`). Las mediciones finales se aceptan y se quitan.
- **[decisión] Sin job de IonQ para los circuitos cargados.** `compile` recibe `allow_remote=True` (por omisión, sin cambios); `qollab_api.run_qasm` pasa `False`, así que se transpila en local y se pueden cargar todos los archivos que se quiera en una corrida. El modelo de error (`metrics`) no usa ningún job: sale del perfil fijo de la máquina; el único job de la transpilación es el que pide a IonQ su propia compilación. Costo: el circuito no pasa por el compilador de IonQ, así que su cantidad de pasos puede diferir de la del ejemplo compilado en remoto.
- **Puente para Qollab:** `qollab_api.run_qasm(backend, qasm, shots, entangler) -> str`; el preludio del paquete lo expone como `HOST.compileQasm`. El visor, con ese hook, muestra "Cargar circuito" (acepta `.qasm`, `.qasm3` y `.txt`, también arrastrando) y agrega el circuito al selector; sin el hook el visor llama a `POST /api/compile` del servidor local (`make server`, `scripts/server.py`: sirve el repo y compila con `qollab_api.run_qasm` sobre el simulador integrado, siempre en `127.0.0.1`); con un `http.server` común avisa que ese servidor no compila. **[decisión del usuario, 2026-10-10]** El botón Medir funciona igual en Qollab y en local: sin `HOST.sample` llama a `POST /api/sample` del mismo servidor (`qollab_api.sample_step`). Se eliminó del visor el muestreo independiente por marginales, porque no modela el entrelazamiento; sin Python el visor muestra un error. **[decisión del usuario, 2026-10-10]** Solo archivos y arrastrar; pegar texto queda fuera.
- Ejemplos en `examples/qasm/` (`bell`, `ghz4`, `qft3` y `bell_qasm2`); los tests los compilan todos.
- **Licencia:** las dependencias nuevas son Apache-2.0/BSD-3 (§9). El `LICENSE` MIT está en el repositorio y en el paquete de Qollab (§2, Licencias).

**Tests:** `tests/test_server.py` (el servidor local: compila, errores 400/404/413, redirección y archivos), `tests/test_importer.py` (versiones 2 y 3, encabezado, comentarios, errores con posición, control de flujo, tope de texto, ejemplos que compilan, límites de `compile`) y las pruebas de `run_qasm` en `tests/test_qollab_api.py` (JSON de salida, sin job de IonQ, error como `QVizError`).

---

### Extras (solo la parte de backend, después del MVP)

| Extra                                    | Qué falta en el backend                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Salud del circuito                       | Nada: sale de `cumulative_fidelity`                                                    |
| Costo en nube                            | Completar la tabla de precios de M5                                                     |
| Oscilación del vector                    | Nada: sale de `vibration` con el umbral                                                 |
| Mapa de calor de decoherencia            | Nada: sale de `inactivity` y `fidelities`                                               |
| Conmutador MS ↔ ZZ                       | Exponer `entangler` (ya está en M2) y, opcionalmente, emitir los dos JSON para comparar |
| PyPI                                     | Renombrar el paquete a `qviz` (§11), metadatos en `pyproject.toml`, `python -m build`   |
| Láseres en onda, sonidos, formato visual | Frontend                                                                                |

---

## 8. Estado

| Módulo                        | Estado            | Rama        | Validado por |
| ----------------------------- | ----------------- | ----------- | ------------ |
| M0 Fundaciones                | Listo para validar | development |              |
| M1 Provider + Transpiler      | Listo para validar | development |              |
| M2 Translator                 | Listo para validar | development |              |
| M3 Simulator                  | Listo para validar | development |              |
| M4 Vectorizer                 | Listo para validar | development |              |
| M5 Metrics                    | Listo para validar | development |              |
| M6 Formatter + Exporter + API | Listo para validar | development |              |
| M7 Integración Qollab         | Listo para validar | development |              |
| M8 Tomografía                 | Listo para validar | development |              |
| M9 Sampler (medición)         | Listo para validar | development |              |
| M10 Importer (OpenQASM)       | Listo para validar | development |              |

Estados posibles: Pendiente → En curso → Listo para validar → Validado.

---

## 9. Dependencias

| Paquete          | Licencia     | Uso                                                 |
| ---------------- | ------------ | --------------------------------------------------- |
| qiskit `>=2.5.2,<3.0.0`      | Apache-2.0   | Circuitos, transpilación, `Operator`, decomposers   |
| qiskit-ionq `>=1.0.0,<2.0.0` | Apache-2.0   | Backend IonQ, compuertas nativas (oráculo de tests) |
| numpy `>=2.0,<3.0`           | BSD-3-Clause | Statevector                                         |
| qiskit-qasm3-import `>=0.6,<1.0` | Apache-2.0 | Lee OpenQASM 3 (`qiskit.qasm3.loads`); trae `openqasm3` (Apache-2.0) y `antlr4-python3-runtime` (BSD-3-Clause), Python puro |
| pytest (dev)     | MIT          | Tests                                               |
| jsonschema (dev) | MIT          | Validación del contrato                             |
| flake8 (dev)     | MIT          | Estilo PEP 8                                        |
| pydocstyle (dev) | MIT          | Docstrings PEP 257                                  |

---

## 10. Hallazgos en Qollab

_Resultados de la sonda (M1a) y de las pruebas de M7 y M8. Completar a medida que se prueba._

| Fecha | Backend | `type(backend)` | `backend.name` | Observaciones |
| ----- | ------- | --------------- | -------------- | ------------- |
| 2026-10-10 | Built-in | — | `basic_simulator` | `options.noise_model` lanza excepción. Detectado como `local`. |
| 2026-10-10 | AWS Braket local | — | `default` | `options.noise_model` lanza excepción. Detectado como `aws` por el módulo. |
| 2026-10-10 | IBM Boston (ruido) | — | `fake_boston` | Basis gates `cz,id,rx,rz,rzz,sx,x`; `options.noise_model` es un `NoiseModel` (no string). Detectado como `ibm`. |
| 2026-10-10 | IBM Berlin (ruido) | — | `fake_berlin` | Igual que Boston. |
| 2026-10-10 | IonQ Aria 2 (sim) | — | `ionq_simulator` | `options.noise_model = "aria-2"` → entrelazador **MS**. |
| 2026-10-10 | IonQ Forte 1 (sim) | — | `ionq_simulator` | `options.noise_model` de familia `forte-1` → entrelazador **ZZ**. |
| 2026-10-10 | Built-in, página de diagnóstico (retirada el 2026-10-10) | — | `basic_simulator` | Versiones de Qollab: qiskit 2.5.2, **qiskit-ionq 1.0.2**, numpy 2.4.6 (Pyodide v314.0.7). `Object.keys(api)` devuelve vacío pero `api.run`, `api.sample_step` y `api.versions` se llaman bien con `callPromising`. Compile de un Bell: 78 ms; cada paso de los checks: 4–9 ms. `ALL CHECKS PASS` (correlaciones: 1.9 % de resultados que no son 00 ni 11, esperado 1.6 %). 8 mediciones seguidas sin error. |
| 2026-10-10 | _qiskit-ionq de Qollab_ | — | — | **No tiene `helpers.native_2q_gate`** (existe desde 1.0.3): `import backend` fallaba con `ImportError` al cargar `provider.py`. Se reemplazó por una función propia. El código se probó con qiskit-ionq 1.0.0, 1.0.1, 1.0.2, 1.0.3, 1.1.0 y 1.1.1 (y NumPy 2.0.2). Limitación conocida: con las versiones anteriores a 1.0.3 la tomografía sobre un backend que no es IonQ no se puede transpilar (`HighLevelSynthesis is unable to synthesize "gpi2"`), porque las compuertas nativas no traen definición; `tomography.measure` lo convierte en un `TranspilationError` que lo explica. |
| 2026-10-10 | IonQ Forte Enterprise 1 (sim) | — | `ionq_simulator` | `options.noise_model` de familia `forte-enterprise-1` → **ZZ**. |

> **Hallazgo clave:** todos los IonQ comparten el nombre `ionq_simulator`. El nombre no dice si la máquina es Aria o Forte. La familia se lee de `backend.options.noise_model` (`aria-2`, `forte-1`, …), y `provider.native_2q_gate` la convierte en `ms`/`zz`. `provider._machine_hints` implementa esto.

Pendientes de verificar en Qollab (el agente no puede ejecutarlos):

2. **M1c:** si con el `backend` inyectado se puede transpilar a nativas en local (`gateset="native"`). Si no, ¿funciona el dry-run remoto y cuenta como el único job? El código intenta `native-local → remote → local`.
3. **M5:** si `backend.calibration()` de qiskit-ionq está disponible; de tener prioridad sobre `profiles.py`. Los valores actuales de `spam_error`, `fidelity_*` y precios son estimaciones ilustrativas.
4. **M8:** si qiskit-ionq acepta una lista de circuitos en un solo `backend.run` y si el backend precreado acepta compuertas nativas.
5. **M1b:** el nombre del QPU de IonQ de hardware (no simulado) no apareció en la sonda. `is_hardware` usa los atributos `_simulator`/`_is_simulator` y, como último recurso, la palabra `simulator` en el nombre; falta confirmar el nombre del hardware real.
6. **`allow_paid`:** no todo backend clasificado como hardware es necesariamente pago. La guarda de M8 es conservadora; se puede relajar cuando se confirme qué máquinas gastan créditos.
7. **M9:** ~~si una página JS puede llamar a Python con `callPromising` desde un clic; si `import * as api from "qollab_api"` funciona; si `backend` (el global) y el paquete `backend` conviven~~ **verificado el 2026-10-10 en Built-in** (ver §10). Falta: los simuladores de IonQ (el único job lo gasta la compilación; medir no), los tiempos con 16 qubits (`layered16`, 676 pasos), y que el visor 3D (con el láser) se vea igual con el three.js de Qollab (0.186.1; el visor usa la 0.160) y que `three/addons/` se resuelva ahí, y su tamaño dentro del iframe. Prueba en `documentation/prompts/qollab_pruebas.md`.


---

## 11. Decisiones abiertas

1. **Nombre del paquete.** `backend` choca con la variable `backend` que inyecta Qollab (cualquier `import backend` la pisa) y no sirve para PyPI. Propuesta: renombrar a `qviz` en M0. Mientras no se decida, rige la regla "nunca `import backend`".
2. **Licencias:** confirmar con el hackathon si alcanza con "permisivas" (§2).
3. **`cumulative_*` y `virtualz`: [resuelto].** El contrato usa `cumulative_*` y el op `virtual_z`. Actualizado en backend, schema y documentación.
4. **Perfil de ruido para backends no IonQ:** ¿referencia de iones (actual) o `ideal` para los simuladores locales ideales?
5. **Unidad de costo:** USD estimados (actual) o créditos de Qollab.
6. **Transpilación de los backends que no son IonQ [resuelta: no se soportan]:** con el mapa de conexiones de un chip de IBM, el enrutamiento puede cambiar las etiquetas de los qubits y la secuencia de pasos varía entre corridas. **[decisión del usuario, 2026-10-10]** `compile` solo acepta `ionq` y `local`, que tienen conectividad total; IBM, AWS y cualquier otro backend se rechazan con `UnsupportedProviderError` (§5.5) y se eliminaron el interruptor `ENABLED_PROVIDERS`, las clasificaciones `ibm`/`aws`/`unknown` y las subclases del translator. Explicación, evidencia y opciones que se descartaron en `documentation/prompts/decision_transpilacion_no_ionq.md`.
