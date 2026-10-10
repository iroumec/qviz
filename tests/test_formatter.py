"""Tests for the formatter (JSON contract of spec.md section 6)."""

from __future__ import annotations

import pytest

from backend.core.formatter import formatter
from backend.core.model import (
    MeasuredCircuit,
    MeasuredStep,
    NativeCircuit,
    NativeOp,
)
from backend.core.provider import profiles
from tests.circuits import make_info


def _measured(op: NativeOp, num_qubits: int = 2, **overrides) -> MeasuredCircuit:
    fields = dict(
        index=1,
        op=op,
        states=((0.0, 0.0, 1.0),) * num_qubits,
        probabilities=((1.0, 0.0),) * num_qubits,
        virtual_z=(0.0,) * num_qubits,
        fidelities=(100.0,) * num_qubits,
        cumulative_fidelity=99.5,
        inactivity=(0,) * num_qubits,
        vibration=(0.0,) * num_qubits,
        cumulative_cost=0.0003,
    )
    fields.update(overrides)
    native = NativeCircuit(make_info(), num_qubits, (op,))
    return MeasuredCircuit(native=native, steps=(MeasuredStep(**fields),))


def _step(op: NativeOp, **overrides) -> dict:
    return formatter.format(_measured(op, **overrides))["steps"][0]


def test_header_fields():
    data = formatter.format(_measured(NativeOp("gpi", (0,), phases=(0.0,))))
    assert data["total_qubits"] == 2
    assert data["backend"] == "test"
    expected = 100.0 * (1.0 - profiles.ARIA.spam_error)
    assert data["initial_fidelity"] == pytest.approx(expected)


def test_one_qubit_gate_has_phases_but_no_angle():
    step = _step(NativeOp("gpi", (0,), phases=(0.5,)))
    assert step["phases"] == [0.5]
    assert "angle" not in step


def test_ms_has_phases_and_angle():
    step = _step(NativeOp("ms", (0, 1), phases=(0.0, 1.0), angle=0.25))
    assert step["phases"] == [0.0, 1.0]
    assert step["angle"] == 0.25


def test_zz_has_angle_but_no_phases():
    step = _step(NativeOp("zz", (0, 1), angle=0.25))
    assert step["angle"] == 0.25
    assert "phases" not in step


def test_virtual_z_has_neither_phases_nor_angle():
    step = _step(NativeOp("virtual_z", (0,), z_rotation=1.0))
    assert "phases" not in step
    assert "angle" not in step


def test_floats_are_rounded_to_the_configured_decimals():
    step = _step(
        NativeOp("gpi", (0,), phases=(0.123456789,)),
        cumulative_fidelity=99.123456789,
    )
    assert step["phases"] == [0.123457]
    assert step["cumulative_fidelity"] == 99.123457


def test_negative_zero_is_written_as_zero():
    step = _step(
        NativeOp("gpi", (0,), phases=(-0.0,)),
        states=((-0.0, -1e-12, 1.0),) * 2,
    )
    assert str(step["phases"][0]) == "0.0"
    assert all(str(component) == "0.0" for component in step["states"][0][:2])


def test_integers_stay_integers():
    step = _step(NativeOp("gpi", (0,), phases=(0.0,)), inactivity=(0, 3))
    assert step["inactivity"] == [0, 3]
    assert all(isinstance(value, int) for value in step["inactivity"])
    assert step["targets"] == [0]
    assert step["step"] == 1
