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

    # Fidelities are percentages (0-100) as in the JSON; the profiles hold
    # fractions (0-1), hence the ``100.0 *`` and ``/ 100.0`` conversions.
    initial_fidelity = 100.0 * (1.0 - profile.spam_error)
    idle_factor = 1.0 - profile.idle_error_per_step
    fidelities = [100.0] * n
    inactivity = [0] * n
    cumulative_fidelity = initial_fidelity
    cumulative_cost = 0.0

    steps: list[MeasuredStep] = []

    for step in vectorized.steps:
        op = step.op
        fidelity, price = _fidelity_and_price(op.name, info)
        targets = set(op.targets)
        idle_count = 0

        for qubit in range(n):
            if qubit in targets:
                fidelities[qubit] *= fidelity
            elif op.name != "virtual_z":
                fidelities[qubit] *= idle_factor
                inactivity[qubit] += 1
                idle_count += 1

        cumulative_fidelity *= fidelity * idle_factor**idle_count
        cumulative_cost += shots * price

        errors = (1.0 - qubit_fidelity / 100.0 for qubit_fidelity in fidelities)
        vibration = tuple(
            error if error >= config.VIBRATION_THRESHOLD else 0.0 for error in errors
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
