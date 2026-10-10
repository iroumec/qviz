"""Tests for the vectorizer."""

from __future__ import annotations

import math

import numpy as np
import pytest

from backend.core.model import (
    NativeCircuit,
    NativeOp,
    QubitAngles,
    SimulatedCircuit,
    SimulatedStep,
)
from backend.core.vectorizer import vectorizer
from tests.circuits import make_info

_RNG = np.random.default_rng(7)


def _to_spherical(x: float, y: float, z: float) -> QubitAngles:
    r = math.sqrt(x * x + y * y + z * z)
    if r < 1e-12:
        return QubitAngles(0.0, 0.0, 0.0)
    theta = math.acos(max(-1.0, min(1.0, z / r)))
    phi = math.atan2(y, x)
    if phi < 0:
        phi += 2 * math.pi
    if math.isclose(math.sin(theta), 0.0, abs_tol=1e-12):
        phi = 0.0
    return QubitAngles(r, theta, phi)


def _run(angles: QubitAngles):
    op = NativeOp("gpi", (0,), phases=(0.0,))
    native = NativeCircuit(backend=make_info(), num_qubits=1, ops=(op,))
    step = SimulatedStep(index=1, op=op, qubits=(angles,), virtual_z=(0.0,))
    vectorized = vectorizer.vectorize(SimulatedCircuit(native=native, steps=(step,)))
    return vectorized.steps[0]


@pytest.mark.parametrize(
    "point",
    [(0.0, 0.0, 0.0), (0.0, 0.0, 1.0), (0.0, 0.0, -1.0), (1.0, 0.0, 0.0)],
)
def test_round_trip_special_points(point):
    step = _run(_to_spherical(*point))
    assert step.states[0] == pytest.approx(point, abs=1e-9)


def test_round_trip_random_points():
    for _ in range(50):
        vector = _RNG.normal(size=3)
        vector /= np.linalg.norm(vector)
        radius = float(_RNG.uniform(0.0, 1.0))
        point = tuple(radius * vector)
        step = _run(_to_spherical(*point))
        assert step.states[0] == pytest.approx(point, abs=1e-9)


def test_probabilities_sum_to_one():
    for _ in range(20):
        vector = _RNG.normal(size=3)
        vector /= np.linalg.norm(vector)
        step = _run(_to_spherical(*vector))
        p0, p1 = step.probabilities[0]
        assert p0 + p1 == pytest.approx(1.0)
        assert 0.0 <= p0 <= 1.0 and 0.0 <= p1 <= 1.0


def test_radius_is_clipped():
    step = _run(QubitAngles(1.0 + 1e-6, math.pi / 2, 0.0))
    x, y, z = step.states[0]
    assert math.sqrt(x * x + y * y + z * z) <= 1.0 + 1e-12
