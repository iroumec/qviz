"""Convert spherical Bloch coordinates to Cartesian vectors and probabilities."""

from __future__ import annotations

import math

from backend.core.model import (
    QubitAngles,
    SimulatedCircuit,
    VectorizedCircuit,
    VectorizedStep,
)


def _cartesian(angles: QubitAngles) -> tuple[float, float, float]:
    # ``r`` equals 1 only for a pure single-qubit state; it is smaller when the
    # qubit is entangled. The clip is a guard against rounding making it > 1.
    r = min(angles.r, 1.0)
    sin_theta = math.sin(angles.theta)
    x = r * sin_theta * math.cos(angles.phi)
    y = r * sin_theta * math.sin(angles.phi)
    z = r * math.cos(angles.theta)
    return x, y, z


def _probabilities(z: float) -> tuple[float, float]:
    p0 = (1.0 + z) / 2.0
    return p0, 1.0 - p0


def vectorize(simulated: SimulatedCircuit) -> VectorizedCircuit:
    """Return ``(x, y, z)`` and ``[p0, p1]`` for every qubit after every step."""
    steps: list[VectorizedStep] = []

    for step in simulated.steps:
        states = tuple(_cartesian(angles) for angles in step.qubits)
        probabilities = tuple(_probabilities(z) for _, _, z in states)
        steps.append(
            VectorizedStep(
                index=step.index,
                op=step.op,
                states=states,
                probabilities=probabilities,
                virtual_z=step.virtual_z,
            )
        )

    return VectorizedCircuit(native=simulated.native, steps=tuple(steps))
