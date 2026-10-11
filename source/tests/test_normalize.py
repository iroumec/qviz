"""Tests for the angle normalization of the entanglers."""

from __future__ import annotations

import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator
from qiskit_ionq import MSGate, ZZGate

from backend.core.model import NativeCircuit
from backend.core.to_qiskit import to_qiskit
from backend.core.translator import normalize
from tests.circuits import make_info

_RNG = np.random.default_rng(20261010)
_ANGLES = [0.0, 0.1, 0.25, 0.3, 0.5, 0.75, 1.0, 1.3, -0.1, -0.3, -0.5, -1.3]
_ANGLES += [float(a) for a in _RNG.uniform(-3, 3, size=8)]


def _operator(ops: list) -> Operator:
    native = NativeCircuit(backend=make_info(), num_qubits=2, ops=tuple(ops))
    return Operator(to_qiskit(native))


@pytest.mark.parametrize("angle", [-0.5, -0.3, 0.0, 0.2, 0.5, 1.5, 7.25])
def test_wrap_stays_in_the_half_open_interval(angle):
    wrapped = normalize._wrap(angle)
    assert -0.5 <= wrapped < 0.5
    assert (angle - wrapped) == pytest.approx(round(angle - wrapped))


@pytest.mark.parametrize("angle", _ANGLES)
def test_zz_is_equivalent_and_angles_are_in_range(angle):
    ops = normalize.normalize_zz((0, 1), angle)
    expected = QuantumCircuit(2)
    expected.append(ZZGate(angle), [0, 1])
    assert _operator(ops).equiv(Operator(expected))
    for op in ops:
        if op.name == "zz":
            assert 0.0 < op.angle <= 0.25


@pytest.mark.parametrize("angle", _ANGLES)
def test_ms_is_equivalent_and_angles_are_in_range(angle):
    phases = (0.13, 0.37)
    ops = normalize.normalize_ms((0, 1), tuple(2 * np.pi * p for p in phases), angle)
    expected = QuantumCircuit(2)
    expected.append(MSGate(*phases, angle), [0, 1])
    assert _operator(ops).equiv(Operator(expected))
    for op in ops:
        if op.name == "ms":
            assert 0.0 < op.angle <= 0.25


@pytest.mark.parametrize("angle", [0.0, 1.0, -2.0])
def test_a_whole_turn_emits_nothing(angle):
    assert normalize.normalize_zz((0, 1), angle) == []
    assert normalize.normalize_ms((0, 1), (0.3, 0.4), angle) == []
