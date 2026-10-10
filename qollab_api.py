"""Functions that Qollab pages call, shared with ``main.py``.

A JS project reaches these with ``callPromising`` (see
``documentation/prompts/qollab_pruebas.md``). They take and return plain values
and **JSON strings**, never dictionaries, because Pyodide turns a ``dict`` into
a JS ``Map`` that ``JSON.stringify`` cannot print (``qollab_context.md`` §8.1).

``backend`` is never imported here: Qollab injects it, and the caller passes it
in as an argument.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from importlib import metadata
from typing import Any

from qiskit import QuantumCircuit

from backend import compile, export, load_circuit, sample
from backend.core.errors import QVizError
from backend.core.model import Entangler
from examples import ghz, layered


def _bell() -> QuantumCircuit:
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    return qc


CIRCUITS: dict[str, Callable[[], QuantumCircuit]] = {
    "bell": _bell,
    "ghz3": lambda: ghz(3),
    "ghz16": lambda: ghz(16),
    "layered16": lambda: layered(16),
}


# The text that the selector of the viewer shows for each circuit.
_LABELS = {
    "bell": "Bell (2 qubits)",
    "ghz3": "GHZ (3 qubits)",
    "ghz16": "GHZ (16 qubits, performance)",
    "layered16": "Random layers, depth 4 (16 qubits, performance)",
}


def build_circuit(name: str) -> QuantumCircuit:
    """Build one of the example circuits listed in ``CIRCUITS``."""
    key = (name or "").strip().lower()
    if key not in CIRCUITS:
        raise QVizError(f"circuit must be one of {', '.join(CIRCUITS)}, got {name!r}")
    return CIRCUITS[key]()


def parse_entangler(value: str | None) -> Entangler | None:
    """Turn the text of the form field into the ``entangler`` argument.

    ``"auto"`` (or an empty field) lets the backend choose; ``"ms"`` and ``"zz"``
    force the entangler. Anything else is an error, never a silent fallback.
    """
    text = (value or "").strip().lower()
    if text in ("", "auto"):
        return None
    if text == "ms":
        return "ms"
    if text == "zz":
        return "zz"
    raise QVizError(f"entangler must be 'auto', 'ms' or 'zz', got {value!r}")


def circuits() -> str:
    """Return the example circuits as JSON text: ``[{"file": …, "label": …}]``.

    The viewer lists them in its selector, in the place of the files of ``out/``.
    """
    return json.dumps([{"file": name, "label": _LABELS[name]} for name in CIRCUITS])


def versions() -> str:
    """Return the versions of the main libraries, as JSON text.

    Qollab ships its own versions, which may differ from the ones used for
    development; the test page prints this at the start.
    """
    found = {}
    for name in (
        "qiskit",
        "qiskit-ionq",
        "numpy",
        "qiskit-qasm3-import",
        "openqasm3",
        "antlr4-python3-runtime",
    ):
        try:
            found[name] = metadata.version(name)
        except metadata.PackageNotFoundError:
            found[name] = "not found"
    return json.dumps(found)


def run(
    backend: Any, circuit: str = "bell", shots: int = 1024, entangler: str = "auto"
) -> str:
    """Compile an example circuit on ``backend`` and return the JSON text."""
    data = compile(
        backend,
        build_circuit(circuit),
        entangler=parse_entangler(entangler),
        shots=int(shots),
    )
    return export(data)


def run_qasm(
    backend: Any, qasm: str, shots: int = 1024, entangler: str = "auto"
) -> str:
    """Compile a circuit written in OpenQASM 2 or 3 and return the JSON text.

    The circuit is transpiled locally (``allow_remote=False``): it never sends
    the IonQ job, so any number of files can be loaded in one run.
    """
    data = compile(
        backend,
        load_circuit(qasm),
        entangler=parse_entangler(entangler),
        shots=int(shots),
        allow_remote=False,
    )
    return export(data)


def sample_step(visualization: str, step: int, shots: int = 1024) -> str:
    """Measure ``step`` of an exported visualization and return counts as JSON.

    ``visualization`` is the text returned by :func:`run`. No job is sent: the
    measurement is drawn from the exact statevector. The reply is a list of
    ``[bitstring, count]`` pairs, most frequent first. It is not an object,
    because JavaScript sorts the integer-like keys of an object (``"10"``,
    ``"11"``) and would lose the order.
    """
    counts = sample(json.loads(visualization), int(step), int(shots))
    return json.dumps(list(counts.items()))
