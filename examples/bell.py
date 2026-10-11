"""Bell-pair examples: the smallest entangled circuits."""

from __future__ import annotations

from qiskit import QuantumCircuit

__all__ = ["bell", "distant_bell"]


def bell() -> QuantumCircuit:
    """Return a Bell pair on two neighbouring qubits (q0 and q1)."""
    return _pair(2, 1)


def distant_bell() -> QuantumCircuit:
    """Return a Bell pair on two ions that are not neighbours (q0 and q2).

    The entangler acts on q0 and q2 directly, so the two-qubit gate skips the
    ion in between: it is the long-range coupling of the phonon bus.
    """
    return _pair(3, 2)


def _pair(count: int, target: int) -> QuantumCircuit:
    circuit = QuantumCircuit(count)
    circuit.h(0)
    circuit.cx(0, target)
    return circuit
