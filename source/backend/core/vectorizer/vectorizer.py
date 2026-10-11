"""Convert spherical Bloch coordinates to Cartesian vectors and probabilities."""

from __future__ import annotations

import math

from backend.core.model import (
    SimulatedCircuit,
    VectorizedCircuit,
    VectorizedStep,
)


def vectorize(simulated: SimulatedCircuit) -> VectorizedCircuit:
    """Return ``(x, y, z)`` and ``[p0, p1]`` for every qubit after every step.

    The spherical-to-Cartesian conversion and the probabilities are computed in
    the same loop, so no per-qubit helper call is needed. The length ``r`` equals
    1 only for a pure single-qubit state; it is smaller when the qubit is
    entangled, and the clip is a guard against rounding making it larger.
    """
    steps: list[VectorizedStep] = []

    for step in simulated.steps:
        states: list[tuple[float, float, float]] = []
        probabilities: list[tuple[float, float]] = []
        for angles in step.qubits:
            r = min(angles.r, 1.0)
            sin_theta = math.sin(angles.theta)
            x = r * sin_theta * math.cos(angles.phi)
            y = r * sin_theta * math.sin(angles.phi)
            z = r * math.cos(angles.theta)
            states.append((x, y, z))
            p0 = (1.0 + z) / 2.0
            probabilities.append((p0, 1.0 - p0))

        steps.append(
            VectorizedStep(
                index=step.index,
                op=step.op,
                states=tuple(states),
                probabilities=tuple(probabilities),
                virtual_z=step.virtual_z,
            )
        )

    return VectorizedCircuit(native=simulated.native, steps=tuple(steps))
