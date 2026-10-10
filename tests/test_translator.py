"""Tests for the translator: per-rule equivalence and invariants."""

from __future__ import annotations

import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator
from qiskit_ionq import GPI2Gate, GPIGate, MSGate, ZZGate

from backend.core.errors import UnsupportedOperationError
from backend.core.model import TranspiledCircuit
from backend.core.translator import translator
from backend.core.translator.to_qiskit import to_qiskit
from tests.circuits import ALL_CIRCUITS, make_info

_RNG = np.random.default_rng(20261010)
ENTANGLERS = ("ms", "zz")


def _translate(qc: QuantumCircuit, entangler: str):
    info = make_info(entangler)  # type: ignore[arg-type]
    transpiled = TranspiledCircuit(
        source="qiskit", num_qubits=qc.num_qubits, circuit=qc
    )
    return translator.create(info).translate(transpiled)


def _assert_equivalent(qc: QuantumCircuit, entangler: str) -> None:
    native = _translate(qc, entangler)
    rebuilt = to_qiskit(native)
    assert Operator(rebuilt).equiv(Operator(qc))


@pytest.mark.parametrize("entangler", ENTANGLERS)
@pytest.mark.parametrize(
    "gate,params",
    [
        ("x", 0),
        ("y", 0),
        ("sx", 0),
        ("sxdg", 0),
        ("z", 0),
        ("s", 0),
        ("sdg", 0),
        ("t", 0),
        ("tdg", 0),
        ("h", 0),
    ],
)
def test_one_qubit_named_rules(gate, params, entangler):
    qc = QuantumCircuit(1)
    getattr(qc, gate)(0)
    _assert_equivalent(qc, entangler)


@pytest.mark.parametrize("entangler", ENTANGLERS)
def test_rotation_rules_random_angles(entangler):
    for _ in range(8):
        angle = float(_RNG.uniform(-2 * np.pi, 2 * np.pi))
        qc = QuantumCircuit(1)
        qc.rz(angle, 0)
        _assert_equivalent(qc, entangler)


@pytest.mark.parametrize("entangler", ENTANGLERS)
def test_two_qubit_rules(entangler):
    for _ in range(6):
        angle = float(_RNG.uniform(-2 * np.pi, 2 * np.pi))
        qc = QuantumCircuit(2)
        qc.h(0)
        qc.cx(0, 1)
        qc.cz(0, 1)
        qc.rzz(angle, 0, 1)
        qc.swap(0, 1)
        _assert_equivalent(qc, entangler)


@pytest.mark.parametrize("entangler", ENTANGLERS)
def test_arbitrary_one_qubit_unitary(entangler):
    qc = QuantumCircuit(1)
    qc.u(0.3, -1.2, 2.1, 0)
    _assert_equivalent(qc, entangler)


@pytest.mark.parametrize("entangler", ENTANGLERS)
def test_arbitrary_two_qubit_unitary(entangler):
    qc = QuantumCircuit(2)
    qc.iswap(0, 1)
    _assert_equivalent(qc, entangler)


@pytest.mark.parametrize("entangler", ENTANGLERS)
def test_three_qubit_expansion(entangler):
    qc = QuantumCircuit(3)
    qc.h(0)
    qc.ccx(0, 1, 2)
    _assert_equivalent(qc, entangler)


@pytest.mark.parametrize("entangler", ENTANGLERS)
@pytest.mark.parametrize("factory", list(ALL_CIRCUITS.values()), ids=list(ALL_CIRCUITS))
def test_full_circuit_equivalence(factory, entangler):
    _assert_equivalent(factory(), entangler)


@pytest.mark.parametrize("entangler", ENTANGLERS)
@pytest.mark.parametrize("factory", list(ALL_CIRCUITS.values()), ids=list(ALL_CIRCUITS))
def test_invariants(factory, entangler):
    native = _translate(factory(), entangler)
    names = {op.name for op in native.ops}
    assert names <= {"gpi", "gpi2", "ms", "zz", "virtual_z"}
    assert not ({"ms", "zz"} <= names)
    for op in native.ops:
        assert all(0 <= q < native.num_qubits for q in op.targets)
        if op.name in ("ms", "zz"):
            assert op.angle is not None
            assert 0.0 <= op.angle <= 0.25


def test_native_ops_input_is_parsed():
    transpiled = TranspiledCircuit(
        source="ionq-native",
        num_qubits=2,
        native_ops=(
            {"gate": "ms", "targets": [0, 1], "phases": [0.0, 0.0], "angle": 0.25},
            {"gate": "gpi", "target": 0, "phase": 0.25},
        ),
    )
    native = translator.create(make_info("ms")).translate(transpiled)
    assert {op.name for op in native.ops} == {"ms", "gpi"}


def test_mid_circuit_measurement_raises():
    qc = QuantumCircuit(1, 1)
    qc.measure(0, 0)
    qc.x(0)
    with pytest.raises(UnsupportedOperationError):
        _translate(qc, "ms")


def test_reset_raises():
    qc = QuantumCircuit(1)
    qc.reset(0)
    with pytest.raises(UnsupportedOperationError):
        _translate(qc, "ms")


def _native_payload_translation(payload: list, entangler: str = "ms"):
    transpiled = TranspiledCircuit(
        source="ionq-native", num_qubits=2, native_ops=tuple(payload)
    )
    info = make_info(entangler)  # type: ignore[arg-type]
    return translator.create(info).translate(transpiled)


@pytest.mark.parametrize("entangler", ENTANGLERS)
def test_native_ops_input_is_equivalent_to_ionq_gates(entangler):
    payload = [
        {"gate": "gpi2", "target": 0, "phase": 0.1},
        {"gate": "ms", "targets": [0, 1], "phases": [0.05, 0.2], "angle": 0.2},
        {"gate": "zz", "targets": [0, 1], "angle": 0.4},
        {"gate": "gpi", "target": 1, "phase": 0.3},
    ]
    expected = QuantumCircuit(2)
    expected.append(GPI2Gate(0.1), [0])
    expected.append(MSGate(0.05, 0.2, 0.2), [0, 1])
    expected.append(ZZGate(0.4), [0, 1])
    expected.append(GPIGate(0.3), [1])

    native = _native_payload_translation(payload, entangler)
    assert Operator(to_qiskit(native)).equiv(Operator(expected))


@pytest.mark.parametrize(
    "payload",
    [
        [{"gate": "gpi", "phase": 0.1}],  # no target
        [{"gate": "gpi", "target": None, "phase": 0.1}],
        [{"gate": "gpi", "target": "x", "phase": 0.1}],
        [{"gate": "gpi", "target": 5, "phase": 0.1}],  # outside the circuit
        [{"gate": "gpi", "target": -1, "phase": 0.1}],
        [{"gate": "gpi", "target": 0}],  # no phase
        [{"gate": "gpi", "target": 0, "phase": None}],
        [{"gate": "gpi", "targets": [0, 1], "phase": 0.1}],  # wrong arity
        [{"gate": "ms", "targets": [0, 0], "angle": 0.25}],  # repeated qubit
        [{"gate": "ms", "targets": [0], "angle": 0.25}],
        [{"gate": "ms", "targets": [0, 1], "phases": [0.1]}],  # one phase
        [{"gate": "ms", "targets": [0, 1], "angle": None}],
        [{"gate": "zz", "targets": [0, 1], "angle": "wide"}],
        [{"gate": "swap", "targets": [0, 1]}],  # unknown gate
        [["gpi", 0, 0.1]],  # not a dictionary
    ],
)
def test_malformed_native_ops_raise_unsupported(payload):
    with pytest.raises(UnsupportedOperationError):
        _native_payload_translation(payload)
