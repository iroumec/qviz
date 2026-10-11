"""Tests for the didactic metrics."""

from __future__ import annotations

import pytest

from backend.core.model import (
    BackendInfo,
    NativeCircuit,
    NativeOp,
    NoiseProfile,
    VectorizedCircuit,
    VectorizedStep,
)
from backend.core.metrics import metrics
from backend.core.provider import profiles


def _info(profile: NoiseProfile) -> BackendInfo:
    return BackendInfo(
        provider="local",
        name="test",
        display_name="test",
        entangler="ms",
        is_hardware=False,
        profile=profile,
    )


def _vectorized(ops, num_qubits, info: BackendInfo) -> VectorizedCircuit:
    steps = tuple(
        VectorizedStep(
            index=index + 1,
            op=op,
            states=((0.0, 0.0, 0.0),) * num_qubits,
            probabilities=((0.5, 0.5),) * num_qubits,
            virtual_z=(0.0,) * num_qubits,
        )
        for index, op in enumerate(ops)
    )
    native = NativeCircuit(backend=info, num_qubits=num_qubits, ops=tuple(ops))
    return VectorizedCircuit(native=native, steps=steps)


_HAND_PROFILE = NoiseProfile(
    spam_error=0.01,
    fidelity_1q=0.9,
    fidelity_2q=0.8,
    idle_error_per_step=0.1,
    price_1q=0.001,
    price_2q=0.002,
)


def test_hand_computed_values():
    info = _info(_HAND_PROFILE)
    ops = [
        NativeOp("virtual_z", (0,), z_rotation=1.0),
        NativeOp("gpi", (0,), phases=(0.0,)),
        NativeOp("ms", (0, 1), phases=(0.0, 0.0), angle=0.25),
    ]
    measured = metrics.measure(_vectorized(ops, 2, info), info, shots=1000)

    first, second, third = measured.steps
    assert first.fidelities == pytest.approx((100.0, 100.0))
    assert first.inactivity == (0, 0)
    assert first.cumulative_fidelity == pytest.approx(99.0)
    assert first.cumulative_cost == pytest.approx(0.0)

    assert second.fidelities == pytest.approx((90.0, 90.0))
    assert second.inactivity == (0, 1)
    assert second.cumulative_fidelity == pytest.approx(99.0 * 0.9 * 0.9)
    assert second.cumulative_cost == pytest.approx(1000 * 0.001)
    assert second.vibration == pytest.approx((0.1, 0.1))

    assert third.fidelities == pytest.approx((72.0, 72.0))
    assert third.inactivity == (0, 1)
    assert third.cumulative_fidelity == pytest.approx(99.0 * 0.9 * 0.9 * 0.8)
    assert third.cumulative_cost == pytest.approx(1000 * 0.003)


def test_virtualz_does_not_change_fidelity_or_inactivity():
    info = _info(_HAND_PROFILE)
    ops = [
        NativeOp("virtual_z", (0,), z_rotation=1.0),
        NativeOp("virtual_z", (1,), z_rotation=2.0),
    ]
    measured = metrics.measure(_vectorized(ops, 2, info), info, shots=1000)
    for step in measured.steps:
        assert step.fidelities == pytest.approx((100.0, 100.0))
        assert step.inactivity == (0, 0)
        assert step.cumulative_fidelity == pytest.approx(99.0)
        assert step.cumulative_cost == pytest.approx(0.0)


def test_metrics_are_monotonic():
    info = _info(_HAND_PROFILE)
    ops = [
        NativeOp("gpi", (0,), phases=(0.0,)),
        NativeOp("ms", (0, 1), phases=(0.0, 0.0), angle=0.25),
        NativeOp("gpi2", (1,), phases=(0.0,)),
    ]
    measured = metrics.measure(_vectorized(ops, 2, info), info, shots=1000)
    previous_fidelity = float("inf")
    previous_cost = -1.0
    previous_inactivity = (0, 0)
    for step in measured.steps:
        assert step.cumulative_fidelity <= previous_fidelity
        assert step.cumulative_cost >= previous_cost
        assert min(step.inactivity) >= min(previous_inactivity)
        previous_fidelity = step.cumulative_fidelity
        previous_cost = step.cumulative_cost
        previous_inactivity = step.inactivity


def test_vibration_threshold_both_ways():
    strict = _info(
        NoiseProfile(0.0, 0.999, 0.999, 0.0, 0.0, 0.0)
    )
    ops = [NativeOp("gpi", (0,), phases=(0.0,))]
    measured = metrics.measure(_vectorized(ops, 1, strict), strict, shots=1)
    assert measured.steps[0].vibration == (0.0,)

    loose = _info(NoiseProfile(0.0, 0.9, 0.9, 0.0, 0.0, 0.0))
    measured = metrics.measure(_vectorized(ops, 1, loose), loose, shots=1)
    assert measured.steps[0].vibration == pytest.approx((0.1,))


def test_ideal_profile():
    info = _info(profiles.IDEAL)
    ops = [
        NativeOp("gpi", (0,), phases=(0.0,)),
        NativeOp("ms", (0, 1), phases=(0.0, 0.0), angle=0.25),
    ]
    measured = metrics.measure(_vectorized(ops, 2, info), info, shots=1000)
    for step in measured.steps:
        assert step.fidelities == pytest.approx((100.0, 100.0))
        assert step.cumulative_fidelity == pytest.approx(100.0)
        assert step.cumulative_cost == pytest.approx(0.0)
        assert step.vibration == (0.0, 0.0)
