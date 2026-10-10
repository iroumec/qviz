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


def build_circuit() -> QuantumCircuit:
    """Build the example two-qubit Bell-state circuit."""
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    return qc


def main(shots: int = 1024, entangler: str = "ms") -> None:
    """Compile the example circuit and print the visualization JSON."""
    forced = entangler if entangler in ("ms", "zz") else None
    selected = backend  # noqa: F821 - global injected by Qollab
    data = compile(selected, build_circuit(), entangler=forced, shots=shots)
    print(export(data))
