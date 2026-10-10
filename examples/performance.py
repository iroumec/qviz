"""Circuits used to test the performance of the visualiser.

The circuits here are deliberately wider and deeper than the small teaching
examples. They are used to check that many Bloch spheres can be drawn at the
same time, and that a long JSON file is handled without a problem.
"""

from __future__ import annotations

import math

import numpy as np
from qiskit import QuantumCircuit

__all__ = ["ghz", "layered"]


def ghz(count: int) -> QuantumCircuit:
    """Return a GHZ state on ``count`` qubits.

    The circuit is shallow: one Hadamard gate, and a chain of CNOT gates. Every
    qubit is fully entangled with the others, so every Bloch vector has length
    zero. It is a good first test for the number of spheres.
    """
    if count < 2:
        raise ValueError("count must be at least 2")
    circuit = QuantumCircuit(count)
    circuit.h(0)
    for index in range(count - 1):
        circuit.cx(index, index + 1)
    return circuit


def layered(count: int, depth: int = 4, seed: int = 1234) -> QuantumCircuit:
    """Return a random layered circuit on ``count`` qubits.

    Each layer is a rotation on every qubit followed by a brickwork of CZ gates.
    The rotations give non-trivial Bloch vectors, and the depth controls the
    number of native steps. A seed is used, so the circuit is reproducible.
    """
    if count < 2:
        raise ValueError("count must be at least 2")
    if depth < 1:
        raise ValueError("depth must be at least 1")

    rng = np.random.default_rng(seed)
    circuit = QuantumCircuit(count)
    for _ in range(depth):
        for qubit in range(count):
            circuit.ry(float(rng.uniform(0.0, math.pi)), qubit)
        for qubit in range(0, count - 1, 2):
            circuit.cz(qubit, qubit + 1)
        for qubit in range(1, count - 1, 2):
            circuit.cz(qubit, qubit + 1)
    return circuit
