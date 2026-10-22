# Decisión pendiente: cómo se transpilan los circuitos que no son de IonQ

> Estado: **resuelta el 2026-10-10: IBM, AWS y los demás backends no se soportan.** Escrito el 2026-10-10. Lo que sigue queda como registro del problema y de las opciones que se descartaron.
> **Resolución:** `compile` solo acepta `ionq` y `local`, y rechaza IBM, AWS y cualquier otro backend con `UnsupportedProviderError` antes de transpilar (`spec.md` §5.5). Los simuladores locales (Built-in) y las máquinas IonQ tienen conectividad total y no sufren el problema. Se eliminaron `ENABLED_PROVIDERS`, las clasificaciones `ibm`/`aws`/`unknown` y las subclases del translator. Este documento queda como registro del problema y de las opciones que se descartaron.
> Alcance: `source/backend/core/transpiler/transpiler.py` y `source/backend/core/translator/rules.py` (`_compaction`).
> Lo marcado **[a verificar]** hay que comprobarlo en Qollab, porque los objetos `backend` de Qollab no son idénticos a los que se pueden crear en una máquina local.

## 1. Resumen

Con los backends de IBM (los simuladores con ruido de Qollab: Boston, Kingston, Pittsburgh, Fez, Marrakesh, Aachen, Miami, Berlin), **QViz puede mostrar los qubits con las etiquetas cambiadas**, y la secuencia de pasos puede ser **distinta en cada corrida**. Pasa cuando el circuito del usuario necesita que dos qubits no vecinos interactúen. Los resultados de Bell y GHZ de tres qubits no lo muestran, por eso no se había visto.

La causa es que, para los backends que no son IonQ, el transpiler usa el **mapa de conexiones del chip de IBM**, que no tiene sentido para un visualizador de iones (los iones se conectan todos con todos). Proponemos dejar de usarlo (opción A, §5).

Necesitamos que el equipo (1) elija una opción y (2) corra la sonda de la §6 en Qollab, porque todo lo medido hasta ahora es una reproducción local.

## 2. Dónde está el problema y por qué ocurre

### 2.1 Qué hace Qiskit cuando transpila para un chip

Un chip de IBM no puede hacer una compuerta de dos qubits entre cualquier par: solo entre vecinos físicos. Cuando se llama a `transpile(circuito, backend=chip)`, Qiskit hace tres cosas:

1. **Layout inicial.** Decide qué qubit físico del chip usa cada qubit del circuito. Ejemplo medido con `FakeBoston` (156 qubits): los qubits 0, 1, 2 y 3 del usuario van a los físicos 56, 62, 43 y 63. Se lee con `circuito.layout.initial_index_layout()`.
2. **Enrutamiento (routing).** Si dos qubits que deben interactuar no son vecinos, inserta compuertas **SWAP**, que intercambian el estado de dos qubits físicos.
3. **Layout final.** Después de los SWAP, el estado del qubit 0 del usuario ya no está en el físico donde empezó. Qiskit **no deshace** los SWAP al final (costarían más compuertas); en su lugar informa la permutación con `circuito.layout.final_index_layout()`. Cuando después se miden los qubits, Qiskit usa esa información para devolver los bits en el orden correcto. Por eso los *conteos* se ven bien en cualquier chip.

### 2.2 Qué hace QViz con eso

QViz **no mide**: simula el estado de cada qubit en cada paso y lo muestra. Para eso necesita saber qué qubit del circuito es cada uno. Hoy:

- `transpiler._layout_of` guarda **solo el layout inicial**.
- `rules._compaction` renombra los qubits físicos a índices 0, 1, 2, … usando **ese layout inicial**.

Pero después de los SWAP, el estado del qubit 0 del usuario está en la posición que dice el layout **final**. QViz nunca lo mira, así que muestra bajo la etiqueta "q0" el estado de otro qubit.

Caso medido (circuito de 4 qubits en `FakeBoston`):

| | q0 | q1 | q2 | q3 |
| --- | --- | --- | --- | --- |
| Layout inicial (el que usa QViz) | 56 | 62 | 43 | 63 |
| Layout final (donde está realmente el estado) | 43 | 63 | 56 | 62 |

La etiqueta "q0" de QViz muestra lo que en realidad es el qubit 2 del usuario, y así con los demás (permutación `(2, 3, 0, 1)`; se comprobó que coincide exactamente con el layout final).

### 2.3 Dos efectos más del mismo origen

- **Pasos que el usuario no escribió.** Cada SWAP se traduce a compuertas reales (`cz` y rotaciones), y QViz las muestra como pasos. En esos pasos el estado "salta" de una esfera a otra. Esto pasa aunque se corrigiera el etiquetado final.
- **Resultados distintos entre corridas.** El algoritmo de enrutamiento de Qiskit (SABRE) es heurístico y usa números aleatorios. El mismo circuito en `FakeBoston`, transpilado 8 veces, dio 2 resultados distintos (45 y 36 compuertas, con layouts distintos). El visualizador mostraría una animación diferente cada vez.

### 2.4 Por qué no se había visto

- Los tests usan Bell (2 qubits vecinos) y circuitos pequeños con layout trivial `(0, 1)`.
- Built-in y AWS Braket local no devuelven layout, e IonQ tiene conectividad total: no hay SWAP.
- Es el único camino donde pasa el combo "chip con conectividad parcial" + "circuito con interacciones no vecinas".

## 3. Evidencia medida (reproducción local)

Se instalaron los mismos paquetes que usa Qollab (`qiskit-ibm-runtime`, `qiskit-braket-provider`, `qiskit-ionq`) y se compararon los vectores de Bloch finales de QViz contra `Statevector` de Qiskit (error máximo por componente; con el redondeo a 6 decimales del JSON, lo normal es ~5e-7):

| Backend | Circuito | Error contra el estado exacto |
| --- | --- | --- |
| Built-in, Braket local, IonQ (estándar y nativo) | los 5 circuitos de prueba | ≤ 1e-14 (correcto) |
| `FakeBerlin` | bell, ghz3, mixed3, wide4 | ≤ 1e-14 (correcto) |
| `FakeBoston` | wide4 (4 qubits, varias interacciones) | **1,6** |
| `FakeBerlin` | sumador QFT de 2 bits (`resources/examples/`) | **2,0** |
| `FakeBoston` | transpilación repetida 8 veces | **2 resultados distintos** |
| Cadena lineal de 5 qubits (sin IBM, ver §4) | todos los pares interactúan | **error 2,0 en 10 de 10 corridas** |

Sin mapa de conexiones, las 8 transpilaciones del mismo circuito dieron exactamente el mismo resultado (28 compuertas, sin layout).

### 3.1 El cálculo es exacto; lo que falla es la interpretación

Se midió sobre una cadena lineal de 5 qubits, con un circuito de 4 qubits en el que interactúan todos los pares (6 compuertas de dos qubits), 6 corridas:

- El circuito nativo que produce QViz es **equivalente** (`Operator.equiv`) al circuito transpilado del que sale, en las 6 corridas. El translator y el simulador no se equivocan.
- El circuito transpilado equivale al original solo **salvo una permutación de cables** (layout inicial y final). QViz usa solo el inicial. Aplicando también el final, el error contra el estado exacto baja de 2.0 a 1e-14 en las 6 corridas.
- Aun así, no es solo un parámetro que falta: con el mapa del chip hay **15** compuertas de dos qubits en lugar de 6 y 125–128 pasos en lugar de 47. Los 9 extras son SWAPs que los iones no necesitan.

| Cómo se transpila | Compuertas de 2 qubits | Pasos | Error de etiquetas |
|---|---|---|---|
| Con el mapa del chip (hoy) | 15 | 125–128, varía | 2.0 |
| Con el mapa + layout final (B) | 15 | 125–128 | 1e-14 |
| Sin mapa (A) | 6 | 47 | 5e-15 |

## 4. Cómo reproducirlo sin Qollab y sin IBM

Solo hace falta Qiskit y este repositorio (desde la carpeta raíz del proyecto):

```python
import logging
import warnings
warnings.filterwarnings("ignore"); logging.disable(logging.CRITICAL)
import numpy as np
from qiskit import QuantumCircuit
from qiskit.providers.fake_provider import GenericBackendV2
from qiskit.quantum_info import Statevector, partial_trace
from backend import compile

def bloch(sv, n, q):
    r = partial_trace(sv, [i for i in range(n) if i != q]).data
    return np.array([2 * r[0, 1].real, -2 * r[0, 1].imag, (r[0, 0] - r[1, 1]).real])

# A chip where each qubit only talks to its neighbours: 0-1-2-3-4 in a line.
line = [(i, i + 1) for i in range(4)] + [(i + 1, i) for i in range(4)]
chip = GenericBackendV2(num_qubits=5, basis_gates=["cz", "rz", "sx", "x"], coupling_map=line, seed=1)

# Every pair of the 4 qubits interacts, which a line cannot do without SWAPs.
qc = QuantumCircuit(4)
qc.x(0)                      # q0 = |1>, the rest stay in |0>
for a in range(4):
    for b in range(a + 1, 4):
        qc.cz(a, b)
qc.ry(0.3, 1)
sv = Statevector(qc)
expected = [bloch(sv, 4, q) for q in range(4)]
bad = 0
for run in range(10):
    last = compile(chip, qc)["steps"][-1]["states"]
    err = max(np.abs(np.array(last[q]) - expected[q]).max() for q in range(4))
    bad += err > 1e-6
    if run < 3:
        print(f"run {run}: max error vs exact statevector = {err:.2f}")
print(f"wrong labelling in {bad}/10 runs")
```

Salida esperada hoy: `max error ... = 2.00` y `wrong labelling in 10/10 runs`. Con una corrección correcta debe dar error ~5e-7 y `0/10`. Este script es la base del test de regresión que hay que agregar cuando se decida.

## 5. Opciones

### A. Transpilar sin el mapa de conexiones del chip (recomendada)

Para todo proveedor que no sea IonQ se llama a `transpile(circuito, basis_gates=[...], optimization_level=1)` sin `backend` y sin `coupling_map`. Hoy ya existe ese camino (`_transpile_generic` lo usa como respaldo, con `_FALLBACK_BASIS`); pasaría a ser el camino normal. El backend solo se usaría para validar el ancho del circuito (`num_qubits`).

- **A favor:**
  - Elimina de raíz el etiquetado cambiado, los SWAP inventados y la variación entre corridas, porque no hay enrutamiento.
  - Es coherente con el principio del spec (`spec.md` §M1b): el visualizador muestra el circuito **como si corriera en iones**, que son todos-con-todos. La conectividad de un chip de IBM no aporta nada.
  - Es el cambio más chico: el código del camino de respaldo ya existe y está cubierto por tests.
  - Se podría simplificar luego la lógica de compactación de qubits (`_compaction`), que existe solo para amortiguar este problema.
- **En contra:**
  - El circuito deja de ser el que el chip seleccionado ejecutaría de verdad (sus compuertas nativas y su conectividad). Para un visualizador de iones es irrelevante, pero hay que decirlo explícitamente.
  - El backend seleccionado ya no influye en la transpilación de los no IonQ (sí en el nombre mostrado, el perfil de ruido y el límite de qubits).

### B. Mantener la transpilación del chip y re-etiquetar con el layout final

Usar `final_index_layout()` para permutar los qubits al final.

- **A favor:** conserva el circuito "realista" del chip.
- **En contra:** arregla solo las etiquetas del **último** paso. Los pasos intermedios siguen mostrando SWAP y estados que saltan de esfera; no se puede etiquetar consistentemente un qubit cuya identidad cambia a mitad del circuito. La variación entre corridas sigue. Agrega complejidad en el punto más delicado del pipeline.

### C. Fijar la semilla de la transpilación (`seed_transpiler`)

- **A favor:** vuelve reproducible el resultado, y es una línea.
- **En contra:** no corrige el etiquetado. Sirve **como complemento** de B, no como solución.

### D. No cambiar nada y documentar la limitación

- **En contra:** un visualizador educativo que rotula mal los qubits de forma silenciosa es peor que uno que falla. No lo recomendamos.

### E. No transpilar y traducir cada compuerta del usuario directamente

`rules.py` ya sabe descomponer cualquier compuerta de 1, 2 o 3 qubits, así que para los proveedores que no son IonQ no haría falta transpilar.

- **A favor:**
  - No depende del chip ni de la semilla; es determinista.
  - Cada paso nativo puede enlazarse con la compuerta del usuario que lo originó (`source_index` apuntaría al circuito del usuario y no al transpilado; hoy ese campo no sale en el JSON).
  - La `h` queda en 2 pasos y no en 3 (el Bell da 7 pasos, con A da 8).
  - Es coherente con la regla de `AGENTS.md` de no optimizar ni fusionar compuertas en el MVP.
  - Permitiría simplificar `_compaction`, porque no habría layout.
- **En contra:**
  - No fusiona rotaciones consecutivas: tres rotaciones dan 10 pasos en lugar de 5 y el sumador QFT de 2 bits da 185 en lugar de 118.
- Se verificó que es equivalente al circuito original en los 9 circuitos de prueba.

### Recomendación

**A** o **E**; se descarta B (sigue mostrando compuertas que los iones no necesitan). Sea cual sea la elegida, además del cambio hay que agregar un test de regresión basado en §4 (un chip de conectividad lineal y un circuito con interacciones no vecinas, comparado contra `Statevector`) y la verificación en Qollab de la §6.

## 6. Qué hay que verificar en Qollab

El código local no puede reemplazar a Qollab: por ejemplo, según las notas de `spec.md` §10, el IBM Boston de Qollab tiene `rx` y `rzz` en su base y un `NoiseModel` en `options`, y el `FakeBoston` que se usó aquí no. Además, en `spec.md` §10 la columna `type(backend)` quedó en "—". Hay que ver el objeto real: puede que no tenga mapa de conexiones, y entonces el problema no aparecería (o aparecería distinto).

### 6.1 Cómo correr la sonda

1. Crear un proyecto de Qollab (tipo Python) con la carpeta `source/backend/` del repositorio y `requirements.txt`.
2. Pegar el script de abajo como `main.py` (reemplaza al de ejemplo).
3. Para cada backend (Built-in, AWS Braket local, **IBM Boston, Kingston, Fez, Berlin** como mínimo, IonQ Aria 2 y Forte 1 simuladores): elegirlo en *Select QPU*, apretar *Run* y copiar la consola completa en la tabla de §6.3.
4. Para **QPUs de IonQ de pago**, poner `RUN_END_TO_END = False` antes de correr: el script no manda ningún job y solo describe el backend. No sabemos **[a verificar]** si el diálogo de Qollab pide confirmar costo igual; si es así, cancelar.

```python
"""QViz probe for Qollab. Use it as main.py of a project that also has source/backend/."""

import importlib.metadata as metadata
import logging

import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import Statevector, partial_trace

from backend import compile

# Set it to False on a paid IonQ QPU: end_to_end() sends a dry-run job per compile.
RUN_END_TO_END = True
RUNS = 4

logging.basicConfig(level=logging.WARNING, format="  [log %(levelname)s] %(message)s")


def show(label, getter):
    try:
        print(f"{label}: {str(getter())[:300]}")
    except Exception as exc:  # the probe must never stop on a missing attribute
        print(f"{label}: <raises {type(exc).__name__}: {str(exc)[:80]}>")


def describe_backend():
    print("=== VERSIONS")
    for package in ("qiskit", "qiskit-ionq", "qiskit-ibm-runtime", "qiskit-braket-provider", "numpy"):
        try:
            print(f"{package}: {metadata.version(package)}")
        except Exception:
            print(f"{package}: not installed")
    print("=== BACKEND")
    cls = type(backend)
    print("module:", cls.__module__)
    print("type:", cls.__name__, "| mro:", [c.__name__ for c in cls.__mro__])
    show("name", lambda: backend.name)
    show("num_qubits", lambda: backend.num_qubits)
    show("operation_names", lambda: sorted(backend.target.operation_names))
    show("coupling_map edges", lambda: len(backend.coupling_map.get_edges()))
    for attribute in ("_simulator", "_is_simulator", "is_simulator", "simulator"):
        show(f"attr {attribute}", lambda a=attribute: repr(getattr(backend, a)))
    show("options fields", lambda: sorted(vars(backend.options)))
    show("options.noise_model", lambda: type(backend.options.noise_model).__name__
         + " " + (backend.options.noise_model if isinstance(backend.options.noise_model, str) else ""))
    show("options.gateset", lambda: backend.options.gateset)


def all_pairs(count):
    """Every pair of qubits interacts, so a sparse chip needs SWAPs."""
    qc = QuantumCircuit(count)
    qc.x(0)
    for first in range(count):
        for second in range(first + 1, count):
            qc.cz(first, second)
    qc.ry(0.3, 1)
    return qc


def bell():
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    return qc


def routing_check():
    print("=== ROUTING (does Qiskit permute the qubits?)")
    try:
        transpiled = transpile(all_pairs(4), backend=backend, optimization_level=1)
    except Exception as exc:
        print("transpile failed:", type(exc).__name__, str(exc)[:120])
        return
    layout = transpiled.layout
    if layout is None:
        print("no layout: no routing was applied")
        return
    initial = layout.initial_index_layout(filter_ancillas=True)
    final = layout.final_index_layout(filter_ancillas=True) if layout.final_layout is not None else initial
    print("initial layout:", initial)
    print("final layout  :", final)
    print("PERMUTED" if initial != final else "not permuted")


def bloch(statevector, count, qubit):
    rho = partial_trace(statevector, [i for i in range(count) if i != qubit]).data
    return np.array([2 * rho[0, 1].real, -2 * rho[0, 1].imag, (rho[0, 0] - rho[1, 1]).real])


def end_to_end(runs=RUNS):
    print("=== END TO END (QViz vs exact statevector)")
    for name, qc in (("bell", bell()), ("all_pairs4", all_pairs(4)), ("all_pairs6", all_pairs(6))):
        count = qc.num_qubits
        exact = Statevector(qc)
        errors, step_counts = [], set()
        for _ in range(runs):
            try:
                data = compile(backend, qc)
            except Exception as exc:
                print(f"{name}: compile raised {type(exc).__name__}: {str(exc)[:150]}")
                break
            states = data["steps"][-1]["states"]
            errors.append(max(np.abs(np.array(states[q]) - bloch(exact, count, q)).max() for q in range(count)))
            step_counts.add(len(data["steps"]))
        if errors:
            print(f"{name}: backend={data['backend']!r} total_qubits={data['total_qubits']} "
                  f"max_error={max(errors):.2e} runs={len(errors)} distinct_step_counts={sorted(step_counts)}")


describe_backend()
routing_check()
if RUN_END_TO_END:
    end_to_end()
```

### 6.2 Cómo leer el resultado

| Línea de la consola | Qué significa |
| --- | --- |
| `module` / `type` / `mro` | La clase real del backend. Es el dato que falta en `spec.md` §10. |
| `coupling_map edges: <raises ...>` o ausente | El backend no tiene mapa de conexiones: el problema probablemente no aparece. |
| `PERMUTED` (bajo `=== ROUTING`) | Qiskit reordena los qubits al transpilar para ese backend: el problema **existe en Qollab**. |
| `no layout` / `not permuted` (bajo `=== ROUTING`) | No hay enrutamiento para ese backend con este circuito. |
| `max_error` | Error de QViz contra el statevector exacto. **Esperado: menor que 1e-5** (el redondeo del JSON da ~5e-7). Un valor cercano a 1 o 2 confirma etiquetas cambiadas. |
| `distinct_step_counts` con más de un valor | La transpilación no es reproducible entre corridas. |
| `[log WARNING] IonQ remote native transpile failed (...)` | La ruta remota de IonQ (`dry_run`) falló; el mensaje dice por qué. Sirve para resolver los pendientes 2 y 4 de `spec.md` §10. |

Nota: el bloque `ROUTING` usa `transpile(..., backend=backend)` directamente, para diagnosticar a Qiskit. Seguirá mostrando `PERMUTED` aunque se adopte la opción A. Lo que valida la solución es `END TO END`.

### 6.3 Tabla de resultados (completar)

| Backend | `module` / `type` | `num_qubits` | `coupling_map` | ROUTING | `max_error` (bell / all_pairs4 / all_pairs6) | `distinct_step_counts` | Notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Built-in | | | | | | | |
| AWS Braket local | | | | | | | |
| IBM Boston | | | | | | | |
| IBM Kingston | | | | | | | |
| IBM Fez | | | | | | | |
| IBM Berlin | | | | | | | |
| IonQ Aria 2 (sim) | | | | | | | |
| IonQ Forte 1 (sim) | | | | | | | |
| IonQ Forte 1 (QPU, solo descripción) | | | | | | | |

### 6.4 Criterio de aceptación (después de aplicar la opción elegida)

Volver a correr la misma sonda en **todos** los backends de la tabla. La decisión está bien implementada si, en cada uno:

- `max_error` es menor que 1e-5 para los tres circuitos;
- `distinct_step_counts` tiene un solo valor;
- ningún `compile` lanza una excepción.

## 7. Qué NO cambia según el proveedor (relación con la revisión del `Translator`)

La investigación también midió qué diferencias reales hay por proveedor en cada etapa:

| Etapa | ¿Depende del proveedor? |
| --- | --- |
| `provider.detect` | **Sí.** Módulo, nombre, `noise_model`, `_simulator`, `num_qubits`. |
| `transpiler` | **Sí.** Estrategia (IonQ: nativo local, remoto, local; resto: Qiskit) y compuertas producidas. Aquí está el problema de este documento. |
| `translator` | **No.** Todos los proveedores terminan en `gpi`, `gpi2`, `virtual_z` y `ms`\|`zz`, y la regla solo depende de `info.entangler`. Las cinco subclases de `Translator` tienen el mismo cuerpo. |
| Tomografía | **Sí**, pero está en `tomography.py` (los no IonQ se transpilan antes del `run`). |

Esto respalda simplificar `translator.py` a una función (pendiente S5 de la revisión), pero esa decisión se toma por separado.

## 8. Decisión del equipo

- [ ] Opción A: transpilar sin mapa de conexiones (recomendada)
- [ ] Opción B: re-etiquetar con el layout final
- [ ] Opción C: solo fijar la semilla
- [ ] Opción D: no cambiar
- Resultados de la sonda cargados en §6.3: [ ]
- Responsable / fecha: ______
