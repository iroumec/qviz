"""M8: estimate Bloch vectors by measuring circuit prefixes on a backend.

Instead of computing the state, this strategy measures the three Pauli
expectations of every qubit after each prefix, in a single ``backend.run``
call (``spec.md`` §M8).
"""

from __future__ import annotations

import logging
import math
from typing import Any

from qiskit import QuantumCircuit
from qiskit import transpile as qiskit_transpile

from backend.core import config
from backend.core.errors import QVizError
from backend.core.model import (
    BackendInfo,
    NativeCircuit,
    QubitAngles,
    SimulatedCircuit,
    SimulatedStep,
)

logger = logging.getLogger(__name__)

_BASES = ("z", "x", "y")


def _basis_circuit(
    prefix: QuantumCircuit, axis: str, num_qubits: int
) -> QuantumCircuit:
    qc = QuantumCircuit(num_qubits, num_qubits)
    qc.compose(prefix, inplace=True)
    if axis == "x":
        qc.h(range(num_qubits))
    elif axis == "y":
        qc.sdg(range(num_qubits))
        qc.h(range(num_qubits))
    qc.measure(range(num_qubits), range(num_qubits))
    return qc


def _expectation(counts: dict, qubit: int, shots: int) -> float:
    n0 = n1 = 0
    for key, value in counts.items():
        bit = (int(key.replace(" ", ""), 2) >> qubit) & 1
        if bit == 0:
            n0 += value
        else:
            n1 += value
    return (n0 - n1) / shots


def _angles(x: float, y: float, z: float) -> QubitAngles:
    r = math.sqrt(x * x + y * y + z * z)
    if r > 1.0:
        x, y, z = x / r, y / r, z / r
        r = 1.0
    if r <= 1e-12:
        return QubitAngles(0.0, 0.0, 0.0)
    theta = math.acos(max(-1.0, min(1.0, z / r)))
    phi = math.atan2(y, x)
    if phi < 0:
        phi += config.TWO_PI
    if math.isclose(math.sin(theta), 0.0, abs_tol=1e-12):
        phi = 0.0
    return QubitAngles(r, theta, phi)


def _cumulative_virtual_z(ops, upto: int, num_qubits: int) -> tuple[float, ...]:
    accumulator = [0.0] * num_qubits
    for op in ops[:upto]:
        if op.name == "virtualz":
            qubit = op.targets[0]
            accumulator[qubit] = (accumulator[qubit] + op.z_rotation) % config.TWO_PI
    return tuple(accumulator)


def measure(
    native: NativeCircuit,
    backend: Any,
    info: BackendInfo,
    *,
    shots: int = 1024,
    allow_paid: bool = False,
) -> SimulatedCircuit:
    """Measure every prefix of ``native`` and return the estimated Bloch states."""
    # Imported lazily to avoid an import cycle; the spec assigns to_qiskit to
    # the translator but allows tomography to use it.
    from backend.core.translator.to_qiskit import to_qiskit

    if info.is_hardware and not allow_paid:
        raise QVizError(
            "tomography on hardware spends credits; pass allow_paid=True to proceed"
        )

    n = native.num_qubits
    num_ops = len(native.ops)
    circuits: list[QuantumCircuit] = []
    keys: list[tuple[int, str]] = []

    for k in range(1, num_ops + 1):
        prefix = to_qiskit(native, upto=k)
        for axis in _BASES:
            circuits.append(_basis_circuit(prefix, axis, n))
            keys.append((k, axis))

    if info.provider != "ionq":
        circuits = list(
            qiskit_transpile(circuits, backend=backend, optimization_level=1)
        )

    logger.warning(
        "tomography runs %d circuits with %d shots each", len(circuits), shots
    )
    job = backend.run(circuits, shots=shots)
    counts_list = job.result().get_counts()

    by_key = dict(zip(keys, counts_list))
    steps: list[SimulatedStep] = []

    for k in range(1, num_ops + 1):
        virtual_z = _cumulative_virtual_z(native.ops, k, n)
        qubits = []
        for qubit in range(n):
            x = _expectation(by_key[(k, "x")], qubit, shots)
            y = _expectation(by_key[(k, "y")], qubit, shots)
            z = _expectation(by_key[(k, "z")], qubit, shots)
            qubits.append(_angles(x, y, z))
        steps.append(
            SimulatedStep(
                index=k,
                op=native.ops[k - 1],
                qubits=tuple(qubits),
                virtual_z=virtual_z,
            )
        )

    return SimulatedCircuit(native=native, steps=tuple(steps))
