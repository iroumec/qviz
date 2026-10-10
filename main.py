"""Qollab entry point (Python project).

Qollab injects the selected backend as the global ``backend`` and calls
``main`` when its signature is strict. Never ``import backend`` here: that
would shadow the injected global. Local execution is not supported.

Parameters with strict annotations make Qollab render a form in the QPU
dialog (``documentation/prompts/qollab_context.md`` §5).
"""

from __future__ import annotations

from qiskit import QuantumCircuit

from backend import compile, export
from backend.core.errors import QVizError
from backend.core.model import Entangler


def build_circuit() -> QuantumCircuit:
    """Build the example two-qubit Bell-state circuit."""
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    return qc


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


def main(shots: int = 1024, entangler: str = "auto") -> None:
    """Compile the example circuit and print the visualization JSON."""
    forced = parse_entangler(entangler)
    circuit = build_circuit()
    data = compile(backend, circuit, entangler=forced, shots=shots)  # noqa: F821
    print(export(data))
