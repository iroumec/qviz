"""Serialize a :class:`MeasuredCircuit` into the JSON contract of ``spec.md`` §6."""

from __future__ import annotations

from backend.core import config
from backend.core.model import MeasuredCircuit, MeasuredStep

_PHASED = ("gpi", "gpi2", "ms")
_ANGLED = ("ms", "zz")


def _round(value: float) -> float:
    rounded = round(float(value), config.JSON_DECIMALS)
    return 0.0 if rounded == 0 else rounded


def _round_list(values) -> list[float]:
    return [_round(value) for value in values]


def _round_points(points) -> list[list[float]]:
    return [[_round(component) for component in point] for point in points]


def _step_entry(step: MeasuredStep) -> dict:
    op = step.op
    entry: dict = {
        "step": step.index,
        "operation": op.name,
        "targets": list(op.targets),
    }
    if op.name in _PHASED:
        entry["phases"] = _round_list(op.phases)
    if op.name in _ANGLED:
        entry["angle"] = _round(op.angle)

    entry["cumulative_fidelity"] = _round(step.cumulative_fidelity)
    entry["states"] = _round_points(step.states)
    entry["vibration"] = _round_list(step.vibration)
    entry["cumulative_cost"] = _round(step.cumulative_cost)
    entry["probabilities"] = _round_points(step.probabilities)
    entry["virtual_z"] = _round_list(step.virtual_z)
    entry["inactivity"] = list(step.inactivity)
    entry["fidelities"] = _round_list(step.fidelities)
    return entry


def format(measured: MeasuredCircuit) -> dict:  # noqa: A001 - module verb
    """Build the JSON-ready dictionary for a measured circuit."""
    info = measured.native.backend
    initial_fidelity = 100.0 * (1.0 - info.profile.spam_error)
    return {
        "backend": info.display_name,
        "total_qubits": measured.native.num_qubits,
        "initial_fidelity": _round(initial_fidelity),
        "steps": [_step_entry(step) for step in measured.steps],
    }
