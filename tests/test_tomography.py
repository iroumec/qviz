"""Tests for the tomography strategy (M8)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from qiskit.providers.basic_provider import BasicSimulator
from qiskit_ionq import GPI2Gate

from backend import compile
from backend.core.errors import QVizError, TranspilationError
from backend.core.model import BackendInfo, TranspiledCircuit
from backend.core.provider import profiles
from backend.core.simulator import tomography
from backend.core.translator import translator
from tests.circuits import bell, make_info

# qiskit-ionq before 1.0.3 gives its native gates no definition, so Qiskit cannot
# transpile them for a backend that is not IonQ.
_NATIVE_GATES_TRANSPILE = GPI2Gate(0.1).definition is not None

_SHOTS = 20000
_TOLERANCE = 5 / (_SHOTS ** 0.5)


def _native(entangler: str = "ms"):
    qc = bell()
    info = make_info(entangler)  # type: ignore[arg-type]
    transpiled = TranspiledCircuit(
        source="qiskit", num_qubits=qc.num_qubits, circuit=qc
    )
    return translator.create(info).translate(transpiled), info


@pytest.mark.skipif(
    not _NATIVE_GATES_TRANSPILE, reason="needs qiskit-ionq 1.0.3 or newer"
)
def test_tomography_matches_statevector():
    backend = BasicSimulator()
    backend.set_options(seed_simulator=20261010)
    ideal = compile(backend, bell(), strategy="statevector")
    measured = compile(backend, bell(), strategy="tomography", shots=_SHOTS)

    for ideal_step, measured_step in zip(ideal["steps"], measured["steps"]):
        for ideal_state, measured_state in zip(
            ideal_step["states"], measured_step["states"]
        ):
            for a, b in zip(ideal_state, measured_state):
                assert abs(a - b) <= _TOLERANCE


def test_tomography_uses_a_single_run_call():
    native, info = _native()
    ionq_info = BackendInfo(
        provider="ionq",
        name=info.name,
        display_name=info.display_name,
        entangler=info.entangler,
        is_hardware=False,
        profile=info.profile,
    )

    backend = MagicMock()
    backend.run.return_value.result.return_value.get_counts.return_value = [
        {"00": _SHOTS}
        for _ in range(3 * len(native.ops))
    ]

    tomography.measure(native, backend, ionq_info, shots=_SHOTS)
    backend.run.assert_called_once()


def test_tomography_hardware_guard():
    native, info = _native()
    hardware_info = BackendInfo(
        provider="ionq",
        name="Forte 1",
        display_name="IonQ Forte 1",
        entangler=info.entangler,
        is_hardware=True,
        profile=profiles.FORTE,
    )
    with pytest.raises(QVizError):
        tomography.measure(native, MagicMock(), hardware_info, shots=10)


@pytest.mark.skipif(
    _NATIVE_GATES_TRANSPILE, reason="only an old qiskit-ionq cannot transpile them"
)
def test_old_qiskit_ionq_gives_a_clear_error():
    with pytest.raises(TranspilationError, match="qiskit-ionq 1.0.3"):
        compile(BasicSimulator(), bell(), strategy="tomography", shots=10)
