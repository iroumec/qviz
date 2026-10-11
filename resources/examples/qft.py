"""Quantum Fourier transform, and the Draper adder built from it.

Two ideas are shown here.

1. The **quantum Fourier transform** (QFT). It is built by hand, from Hadamard
   gates and controlled phase rotations, followed by a set of swaps that
   reverses the qubit order.

2. The **Draper adder**. Two numbers are added in the Fourier basis. A phase is
   added for every pair of qubits, and the inverse transform is applied at the
   end.

Qubit order. The little-endian convention of Qiskit is used. Qubit 0 is the
least significant bit. In the adder, the first ``n`` qubits hold ``a`` and the
last ``n`` qubits hold ``b``. After the circuit, the first register holds
``(a + b) mod 2**n``, and the second register is unchanged.
"""

from __future__ import annotations

import math

from qiskit import QuantumCircuit
from qiskit.circuit import Qubit

__all__ = ["apply_qft", "apply_inverse_qft", "qft", "inverse_qft", "qft_adder"]


def apply_qft(circuit: QuantumCircuit, qubits: list[Qubit]) -> None:
    """Apply the QFT in place to ``qubits``, least significant first.

    The transform is written explicitly so that the gate sequence can be read.
    Each qubit receives a Hadamard gate, and a controlled phase is added for
    every pair of qubits. A set of swaps reverses the order at the end.
    """
    count = len(qubits)
    for high in reversed(range(count)):
        circuit.h(qubits[high])
        for low in reversed(range(high)):
            angle = math.pi / 2 ** (high - low)
            circuit.cp(angle, qubits[high], qubits[low])
    for index in range(count // 2):
        circuit.swap(qubits[index], qubits[count - 1 - index])


def apply_inverse_qft(circuit: QuantumCircuit, qubits: list[Qubit]) -> None:
    """Apply the inverse QFT in place to ``qubits``.

    This is the exact inverse of :func:`apply_qft`: the swaps come first, then
    the phase rotations are undone with the opposite sign, and the Hadamard
    gates are applied last.
    """
    count = len(qubits)
    for index in range(count // 2):
        circuit.swap(qubits[index], qubits[count - 1 - index])
    for high in range(count):
        for low in range(high):
            angle = -math.pi / 2 ** (high - low)
            circuit.cp(angle, qubits[high], qubits[low])
        circuit.h(qubits[high])


def qft(count: int) -> QuantumCircuit:
    """Return the QFT on ``count`` qubits as a standalone circuit."""
    circuit = QuantumCircuit(count)
    apply_qft(circuit, list(circuit.qubits))
    return circuit


def inverse_qft(count: int) -> QuantumCircuit:
    """Return the inverse QFT on ``count`` qubits as a standalone circuit."""
    circuit = QuantumCircuit(count)
    apply_inverse_qft(circuit, list(circuit.qubits))
    return circuit


def qft_adder(count: int) -> QuantumCircuit:
    """Return the Draper adder on ``2 * count`` qubits.

    The first ``count`` qubits hold ``a`` and the last ``count`` qubits hold
    ``b``. The circuit maps ``|a>|b>`` to ``|a + b mod 2**count>|b>``.

    The adder works in the Fourier basis. The transform is applied to ``a``
    first. A controlled phase is then added for every pair ``(a_j, b_k)``, with
    the angle ``2*pi / 2**(count - k - j)``. This angle is exactly the phase
    that the addition of the bit ``b_k`` gives to the Fourier component of
    ``a_j``. The inverse transform is applied at the end.

    ``count = 1`` gives the smallest adder: two qubits, one number each, and the
    sum is taken modulo 2.
    """
    if count < 1:
        raise ValueError("count must be at least 1")

    circuit = QuantumCircuit(2 * count)
    register_a = list(range(count))
    register_b = list(range(count, 2 * count))

    apply_qft(circuit, [circuit.qubits[i] for i in register_a])
    for index_b in range(count):
        for index_a in range(count):
            angle = 2 * math.pi / 2 ** (count - index_b - index_a)
            circuit.cp(angle, register_b[index_b], register_a[index_a])
    apply_inverse_qft(circuit, [circuit.qubits[i] for i in register_a])

    return circuit
