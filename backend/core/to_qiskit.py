"""Rebuild a Qiskit circuit from a :class:`NativeCircuit`.

Used as the oracle in tests, by the tomography strategy and by the sampler.
qiskit-ionq native gates take their phases in turns, so phases are divided by
``2*pi`` here.
"""

from __future__ import annotations

from collections.abc import Sequence

from qiskit import QuantumCircuit
from qiskit.circuit.library import RZGate
from qiskit_ionq import GPI2Gate, GPIGate, MSGate, ZZGate

from backend.core.constants import TWO_PI
from backend.core.model import NativeCircuit, NativeOp


def to_qiskit(native: NativeCircuit, upto: int | None = None) -> QuantumCircuit:
    """Build the Qiskit circuit for the first ``upto`` native ops.

    ``upto=None`` uses the whole circuit. ``upto=0`` gives the empty circuit.
    """
    ops = native.ops if upto is None else native.ops[:upto]
    return circuit_from_ops(ops, native.num_qubits)


def circuit_from_ops(ops: Sequence[NativeOp], num_qubits: int) -> QuantumCircuit:
    """Build the Qiskit circuit that applies ``ops`` in order on ``num_qubits``."""
    qc = QuantumCircuit(num_qubits)
    for op in ops:
        targets = list(op.targets)
        if op.name == "gpi":
            qc.append(GPIGate(op.phases[0] / TWO_PI), targets)
        elif op.name == "gpi2":
            qc.append(GPI2Gate(op.phases[0] / TWO_PI), targets)
        elif op.name == "ms":
            qc.append(
                MSGate(
                    op.phases[0] / TWO_PI,
                    op.phases[1] / TWO_PI,
                    op.angle,
                ),
                targets,
            )
        elif op.name == "zz":
            qc.append(ZZGate(op.angle), targets)
        elif op.name == "virtual_z":
            qc.append(RZGate(op.z_rotation), targets)
        else:  # pragma: no cover - guarded by the OpName type
            raise ValueError(f"unknown native operation {op.name!r}")

    return qc
