"""Tests for the transpiler."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from qiskit import QuantumCircuit
from qiskit.circuit import Parameter
from qiskit_ionq import GPIGate, MSGate

from backend.core import config
from backend.core.errors import CircuitTooLargeError, UnsupportedOperationError
from backend.core.model import BackendInfo
from backend.core.provider import profiles
from backend.core.transpiler import transpiler
from tests.circuits import bell


def _ionq_info() -> BackendInfo:
    return BackendInfo(
        provider="ionq",
        name="Aria 1",
        display_name="IonQ Aria 1",
        entangler="ms",
        is_hardware=False,
        profile=profiles.ARIA,
    )


class _NoTarget:
    __module__ = "some_pkg.some_module"

    def __init__(self) -> None:
        self.name = "weird_backend"


def test_basic_simulator_keeps_two_qubits(basic_backend):
    transpiled = transpiler.transpile(
        _info_for(basic_backend), basic_backend, bell()
    )
    assert transpiled.num_qubits == 2
    assert transpiled.circuit is not None
    assert transpiled.layout is None


def test_ibm_heron_layout_is_compacted(heron_backend):
    from backend.core.provider import provider

    info = provider.detect(heron_backend)
    transpiled = transpiler.transpile(info, heron_backend, bell())
    assert transpiled.layout == (0, 1)
    assert {"cz", "rz", "sx", "x"} & {
        instr.operation.name for instr in transpiled.circuit.data
    }


def test_unknown_backend_uses_fallback_basis():
    from backend.core.provider import provider

    info = provider.detect(_NoTarget())
    transpiled = transpiler.transpile(info, _NoTarget(), bell())
    assert transpiled.source == "qiskit"
    names = {instr.operation.name for instr in transpiled.circuit.data}
    assert names <= {"rz", "sx", "x", "cz", "cx"}


def test_ionq_remote_returns_native_circuit():
    native = QuantumCircuit(2)
    native.append(GPIGate(0.0), [0])
    native.append(MSGate(0.0, 0.0), [0, 1])

    job = MagicMock()
    job.compiled_circuit.return_value = native
    backend = MagicMock()
    backend.run.return_value = job

    transpiled = transpiler.transpile(_ionq_info(), backend, bell())
    assert transpiled.source == "ionq-native"
    assert transpiled.circuit is native
    backend.run.assert_called_once()


def test_ionq_remote_returns_native_list():
    payload = [
        {"gate": "ms", "targets": [0, 1], "phases": [0, 0], "angle": 0.25},
        {"gate": "gpi", "target": "0", "phase": 0.0},
    ]
    job = MagicMock()
    job.compiled_circuit.return_value = payload
    backend = MagicMock()
    backend.run.return_value = job

    transpiled = transpiler.transpile(_ionq_info(), backend, bell())
    assert transpiled.source == "ionq-native"
    assert transpiled.native_ops is not None
    assert len(transpiled.native_ops) == 2


def test_ionq_remote_wait_uses_a_timeout():
    job = MagicMock()
    job.compiled_circuit.return_value = QuantumCircuit(2)
    backend = MagicMock()
    backend.run.return_value = job

    transpiler.transpile(_ionq_info(), backend, bell())
    job.wait_for_final_state.assert_called_once_with(
        timeout=config.REMOTE_JOB_TIMEOUT_S
    )


def test_ionq_falls_back_when_remote_times_out():
    job = MagicMock()
    job.wait_for_final_state.side_effect = TimeoutError("job did not finish")
    backend = MagicMock()
    backend.run.return_value = job

    transpiled = transpiler.transpile(_ionq_info(), backend, bell())
    assert transpiled.source == "qiskit"


def test_ionq_falls_back_when_remote_fails():
    backend = MagicMock()
    backend.run.side_effect = RuntimeError("network is restricted")

    transpiled = transpiler.transpile(_ionq_info(), backend, bell())
    assert transpiled.source == "qiskit"
    assert transpiled.circuit is not None


def test_circuit_too_large_raises():
    qc = QuantumCircuit(config.MAX_QUBITS + 1)
    qc.x(0)
    with pytest.raises(CircuitTooLargeError):
        transpiler.transpile(_ionq_info(), MagicMock(), qc)


def test_circuit_at_the_cap_is_accepted(basic_backend):
    qc = QuantumCircuit(config.MAX_QUBITS)
    qc.x(0)
    transpiled = transpiler.transpile(_info_for(basic_backend), basic_backend, qc)
    assert transpiled.num_qubits == config.MAX_QUBITS


def test_backend_width_lowers_the_limit(heron_backend):
    qc = QuantumCircuit(heron_backend.num_qubits + 1)
    qc.x(0)
    with pytest.raises(CircuitTooLargeError):
        transpiler.transpile(_info_for(heron_backend), heron_backend, qc)


def _info_for(backend):
    from backend.core.provider import provider

    return provider.detect(backend)


def test_unbound_parameters_raise_before_any_job_is_spent():
    qc = QuantumCircuit(1)
    qc.rz(Parameter("theta"), 0)
    backend = MagicMock()
    with pytest.raises(UnsupportedOperationError, match="theta"):
        transpiler.transpile(_ionq_info(), backend, qc)
    backend.run.assert_not_called()
