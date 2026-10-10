"""Tests for the statevector simulator."""

from __future__ import annotations

import numpy as np
import pytest
from qiskit.quantum_info import Operator, Statevector, partial_trace
from qiskit_ionq import GPI2Gate, GPIGate, MSGate, ZZGate

from backend.core.model import NativeCircuit, NativeOp
from backend.core.simulator import gpi, gpi2, ms, simulator, virtualz, zz
from backend.core.translator import rules
from backend.core.translator.to_qiskit import to_qiskit
from tests.circuits import make_info

_PERM = np.array(
    [
        [1, 0, 0, 0],
        [0, 0, 1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
    ],
    dtype=complex,
)


def _bloch_from_angles(angles):
    x = angles.r * np.sin(angles.theta) * np.cos(angles.phi)
    y = angles.r * np.sin(angles.theta) * np.sin(angles.phi)
    z = angles.r * np.cos(angles.theta)
    return np.array([x, y, z])


def _simulate_ops(ops, num_qubits):
    info = make_info("ms")
    native = NativeCircuit(backend=info, num_qubits=num_qubits, ops=tuple(ops))
    return simulator.simulate(native)


def test_gpi_zero_on_zero():
    step = _simulate_ops([NativeOp("gpi", (0,), phases=(0.0,))], 1).steps[0]
    assert step.qubits[0].r == pytest.approx(1.0)
    assert step.qubits[0].theta == pytest.approx(np.pi)
    assert step.qubits[0].phi == pytest.approx(0.0)


def test_gpi2_zero_on_zero():
    step = _simulate_ops([NativeOp("gpi2", (0,), phases=(0.0,))], 1).steps[0]
    x, y, z = _bloch_from_angles(step.qubits[0])
    assert (x, y, z) == pytest.approx((0.0, -1.0, 0.0), abs=1e-12)


def test_gpi2_half_pi_on_zero():
    step = _simulate_ops([NativeOp("gpi2", (0,), phases=(np.pi / 2,))], 1).steps[0]
    x, y, z = _bloch_from_angles(step.qubits[0])
    assert (x, y, z) == pytest.approx((1.0, 0.0, 0.0), abs=1e-12)


def test_bell_is_maximally_entangled():
    from qiskit import QuantumCircuit

    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    ops, n = rules.translate_circuit(qc, None, "ms")
    step = _simulate_ops(ops, n).steps[-1]
    assert step.qubits[0].r == pytest.approx(0.0, abs=1e-12)
    assert step.qubits[1].r == pytest.approx(0.0, abs=1e-12)


@pytest.mark.parametrize("entangler", ["ms", "zz"])
@pytest.mark.parametrize(
    "circuit_name",
    ["single_h", "rotations", "bell", "ghz3", "swap_test", "idle_qubit"],
)
def test_matches_qiskit_statevector(circuit_name, entangler):
    from tests import circuits

    qc = circuits.ALL_CIRCUITS[circuit_name]()
    ops, n = rules.translate_circuit(qc, None, entangler)  # type: ignore[arg-type]
    step = _simulate_ops(ops, n).steps[-1]

    statevector = Statevector(qc)
    for qubit in range(n):
        reduced = partial_trace(statevector, [q for q in range(n) if q != qubit]).data
        x = 2 * reduced[0, 1].real
        y = -2 * reduced[0, 1].imag
        z = reduced[0, 0].real - reduced[1, 1].real
        assert _bloch_from_angles(step.qubits[qubit]) == pytest.approx(
            (x, y, z), abs=1e-9
        )


@pytest.mark.parametrize("entangler", ["ms", "zz"])
@pytest.mark.parametrize("circuit_name", ["bell", "ghz3", "swap_test"])
def test_every_step_matches_qiskit_statevector(circuit_name, entangler):
    """Untouched qubits are reused between steps, so check all of them."""
    from tests import circuits

    qc = circuits.ALL_CIRCUITS[circuit_name]()
    ops, n = rules.translate_circuit(qc, None, entangler)  # type: ignore[arg-type]
    info = make_info(entangler)  # type: ignore[arg-type]
    native = NativeCircuit(backend=info, num_qubits=n, ops=tuple(ops))
    simulated = simulator.simulate(native)

    for step in simulated.steps:
        statevector = Statevector(to_qiskit(native, upto=step.index))
        for qubit in range(n):
            others = [q for q in range(n) if q != qubit]
            reduced = partial_trace(statevector, others).data
            expected = (
                2 * reduced[0, 1].real,
                -2 * reduced[0, 1].imag,
                reduced[0, 0].real - reduced[1, 1].real,
            )
            assert _bloch_from_angles(step.qubits[qubit]) == pytest.approx(
                expected, abs=1e-9
            )


def test_gpi_matrix_matches_qiskit_ionq():
    phi = 0.37
    expected = Operator(GPIGate(phi)).data
    assert gpi.matrix(2 * np.pi * phi) == pytest.approx(expected, abs=1e-12)


def test_gpi2_matrix_matches_qiskit_ionq():
    phi = 0.21
    expected = Operator(GPI2Gate(phi)).data
    assert gpi2.matrix(2 * np.pi * phi) == pytest.approx(expected, abs=1e-12)


def test_ms_matrix_matches_qiskit_ionq():
    from qiskit import QuantumCircuit

    p0, p1, theta = 0.13, 0.37, 0.25
    circuit = QuantumCircuit(2)
    circuit.append(MSGate(p0, p1, theta), [0, 1])
    expected = Operator(circuit).data
    ours = _PERM @ ms.matrix(2 * np.pi * p0, 2 * np.pi * p1, theta) @ _PERM
    assert ours == pytest.approx(expected, abs=1e-12)


def test_zz_matrix_matches_qiskit_ionq():
    from qiskit import QuantumCircuit

    theta = 0.25
    circuit = QuantumCircuit(2)
    circuit.append(ZZGate(theta), [0, 1])
    expected = Operator(circuit).data
    ours = _PERM @ zz.matrix(theta) @ _PERM
    assert ours == pytest.approx(expected, abs=1e-12)


def test_virtualz_matrix_matches_rz():
    from qiskit.circuit.library import RZGate

    rotation = 1.234
    assert virtualz.matrix(rotation) == pytest.approx(
        Operator(RZGate(rotation)).data, abs=1e-12
    )
