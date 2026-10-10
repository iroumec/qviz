"""Didactic metrics: fidelities, inactivity, vibration and estimated cost.

This is a simple documented model, not a noise simulation (``spec.md`` §M5).
"""

from __future__ import annotations

from backend.core import config
from backend.core.model import (
    BackendInfo,
    MeasuredCircuit,
    MeasuredStep,
    VectorizedCircuit,
)

_ONE_QUBIT = ("gpi", "gpi2")


def _fidelity_and_price(op_name: str, info: BackendInfo) -> tuple[float, float]:
    profile = info.profile
    if op_name == "virtual_z":
        return 1.0, 0.0
    if op_name in _ONE_QUBIT:
        return profile.fidelity_1q, profile.price_1q
    return profile.fidelity_2q, profile.price_2q


def measure(
    vectorized: VectorizedCircuit, info: BackendInfo, shots: int = 1024
) -> MeasuredCircuit:
    """Decorate every vectorized step with the didactic metrics."""
    profile = info.profile
    n = vectorized.native.num_qubits

    initial_fidelity = 100.0 * (1.0 - profile.spam_error)
    fidelities = [100.0] * n
    inactivity = [0] * n
    cumulative_fidelity = initial_fidelity
    cumulative_cost = 0.0

    steps: list[MeasuredStep] = []

    for step in vectorized.steps:
        op = step.op
        fidelity, price = _fidelity_and_price(op.name, info)
        targets = set(op.targets)
        inactive_qubits = []

        for qubit in range(n):
            if qubit in targets:
                fidelities[qubit] *= fidelity
            elif op.name != "virtual_z":
                fidelities[qubit] *= 1.0 - profile.idle_error_per_step
                inactivity[qubit] += 1
                inactive_qubits.append(qubit)

        cumulative_fidelity *= fidelity
        for _ in inactive_qubits:
            cumulative_fidelity *= 1.0 - profile.idle_error_per_step
        cumulative_cost += shots * price

        vibration = tuple(
            error if error >= config.VIBRATION_THRESHOLD else 0.0
            for error in (1.0 - fidelities[q] / 100.0 for q in range(n))
        )

        steps.append(
            MeasuredStep(
                index=step.index,
                op=op,
                states=step.states,
                probabilities=step.probabilities,
                virtual_z=step.virtual_z,
                fidelities=tuple(fidelities),
                cumulative_fidelity=cumulative_fidelity,
                inactivity=tuple(inactivity),
                vibration=vibration,
                cumulative_cost=cumulative_cost,
            )
        )

    return MeasuredCircuit(native=vectorized.native, steps=tuple(steps))
