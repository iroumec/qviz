"""Exact statevector simulation of a :class:`NativeCircuit`.

The state is a NumPy tensor of shape ``(2,) * n`` in Qiskit little-endian
order: qubit ``q`` lives on axis ``n - 1 - q`` (``spec.md`` §M3).
"""

from __future__ import annotations

import logging
import math

import numpy as np

from backend.core import config, constants
from backend.core.model import (
    NativeCircuit,
    NativeOp,
    QubitAngles,
    SimulatedCircuit,
    SimulatedStep,
)
from backend.core.simulator import gpi, gpi2, ms, virtualz, zz

logger = logging.getLogger(__name__)

_R_SMALL = 1e-12


def _matrix(op: NativeOp) -> np.ndarray:
    if op.name == "gpi":
        return gpi.matrix(op.phases[0])
    if op.name == "gpi2":
        return gpi2.matrix(op.phases[0])
    if op.name == "ms":
        return ms.matrix(op.phases[0], op.phases[1], op.angle)
    if op.name == "zz":
        return zz.matrix(op.angle)
    if op.name == "virtual_z":
        return virtualz.matrix(op.z_rotation)
    raise ValueError(f"unknown native operation {op.name!r}")


def _apply(
    state: np.ndarray, matrix: np.ndarray, targets: tuple[int, ...]
) -> np.ndarray:
    """Apply a k-qubit ``matrix`` to ``targets`` (in order) of ``state``."""
    n = state.ndim
    target_axes = [n - 1 - q for q in targets]
    other_axes = [axis for axis in range(n) if axis not in target_axes]
    permutation = target_axes + other_axes

    transposed = np.transpose(state, permutation)
    k = len(targets)
    dim = 2**k
    contracted = matrix @ transposed.reshape(dim, -1)
    reshaped = contracted.reshape([2] * k + [2] * len(other_axes))
    return np.transpose(reshaped, np.argsort(permutation))


def _angles(state: np.ndarray, qubit: int, n: int) -> QubitAngles:
    """Reduced Bloch state of one qubit as ``(r, theta, phi)``."""
    axis = n - 1 - qubit
    reduced = np.moveaxis(state, axis, 0).reshape(2, -1)
    rho = reduced @ reduced.conj().T

    x = 2.0 * float(rho[0, 1].real)
    y = -2.0 * float(rho[0, 1].imag)
    z = float(rho[0, 0].real - rho[1, 1].real)

    r = math.sqrt(x * x + y * y + z * z)
    if r <= _R_SMALL:
        return QubitAngles(0.0, 0.0, 0.0)

    cos_theta = max(-1.0, min(1.0, z / r))
    theta = math.acos(cos_theta)
    phi = math.atan2(y, x)
    if phi < 0.0:
        phi += constants.TWO_PI
    if phi >= constants.TWO_PI:
        phi = 0.0
    if math.isclose(math.sin(theta), 0.0, abs_tol=1e-12):
        phi = 0.0
    return QubitAngles(r, theta, phi)


def simulate(native: NativeCircuit, strategy: str = "statevector") -> SimulatedCircuit:
    """Simulate every native op, storing the reduced state after each step."""
    if strategy != "statevector":
        raise NotImplementedError(f"strategy {strategy!r} is not implemented yet")

    n = native.num_qubits
    state = np.zeros((2,) * n, dtype=complex)
    state[(0,) * n] = 1.0

    virtual_z = [0.0] * n
    qubits = (QubitAngles(1.0, 0.0, 0.0),) * n  # every qubit starts in |0>
    steps: list[SimulatedStep] = []

    for index, op in enumerate(native.ops, start=1):
        state = _apply(state, _matrix(op), op.targets)

        if op.name == "virtual_z":
            qubit = op.targets[0]
            virtual_z[qubit] = (virtual_z[qubit] + op.z_rotation) % constants.TWO_PI

        # A unitary acting on ``targets`` cannot change the reduced state of
        # the other qubits, so only the targets are recomputed.
        qubits = tuple(
            _angles(state, q, n) if q in op.targets else qubits[q] for q in range(n)
        )
        steps.append(
            SimulatedStep(
                index=index,
                op=op,
                qubits=qubits,
                virtual_z=tuple(virtual_z),
            )
        )

    if len(steps) > config.MAX_STEPS_WARNING:
        logger.warning(
            "simulation produced %d steps (more than %d)",
            len(steps),
            config.MAX_STEPS_WARNING,
        )

    return SimulatedCircuit(native=native, steps=tuple(steps))
