"""Tests for the reader of OpenQASM 2 and 3 circuits."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest
from qiskit import QuantumCircuit
from qiskit.circuit import Gate
from qiskit.quantum_info import Operator

from backend import compile, load_circuit
from backend.core import config
from backend.core.errors import (
    CircuitParseError,
    CircuitTooLargeError,
    QVizError,
    UnsupportedOperationError,
)
from tests.circuits import bell

_QASM = Path(__file__).parent.parent / "examples" / "qasm"
_HEAD3 = 'OPENQASM 3.0;\ninclude "stdgates.inc";\n'


def test_openqasm3_is_read():
    qc = load_circuit(_HEAD3 + "qubit[2] q; h q[0]; cx q[0], q[1];")
    assert Operator(qc).equiv(Operator(bell()))


def test_openqasm2_is_read():
    text = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2]; h q[0]; cx q[0],q[1];'
    assert Operator(load_circuit(text)).equiv(Operator(bell()))


def test_comments_before_the_header_are_ignored():
    qc = load_circuit("// my circuit\n/* two\nlines */\n" + _HEAD3 + "qubit q; x q;")
    assert qc.num_qubits == 1


@pytest.mark.parametrize("path", sorted(_QASM.glob("*.qasm")), ids=lambda p: p.name)
def test_every_example_file_compiles(path, basic_backend):
    data = compile(basic_backend, load_circuit(path.read_text()), allow_remote=False)
    assert data["steps"]


def test_the_examples_directory_has_both_versions():
    versions = {p.read_text().split("OPENQASM")[1][:2].strip() for p in _QASM.glob("*")}
    assert versions == {"2", "3"}


@pytest.mark.parametrize("text", ["", "   \n", None])
def test_empty_text_is_rejected(text):
    with pytest.raises(CircuitParseError, match="empty"):
        load_circuit(text)


def test_a_missing_header_is_rejected():
    with pytest.raises(CircuitParseError, match="OPENQASM"):
        load_circuit("qubit q; x q;")


def test_an_unknown_version_is_rejected():
    with pytest.raises(CircuitParseError, match="not supported"):
        load_circuit("OPENQASM 4.0;")


@pytest.mark.parametrize(
    "text",
    [_HEAD3 + "qubit q; foo q;", "OPENQASM 2.0;\nqreg q[1]; foo q[0];"],
)
def test_invalid_code_is_a_parse_error_with_the_position(text):
    with pytest.raises(CircuitParseError, match="foo"):
        load_circuit(text)


def test_a_huge_text_is_rejected(monkeypatch):
    monkeypatch.setattr(config, "MAX_QASM_CHARS", 50)
    with pytest.raises(CircuitParseError, match="maximum"):
        load_circuit(_HEAD3 + "qubit[2] q; h q[0]; cx q[0], q[1];")


@pytest.mark.parametrize(
    "body",
    [
        "qubit q; bit c; h q; c = measure q; if (c) { x q; }",
        "qubit[3] q; for int i in [0:2] { h q[i]; }",
        "qubit q; int n = 0; while (n < 2) { h q; n += 1; }",
    ],
)
def test_control_flow_is_unsupported(body):
    with pytest.raises(UnsupportedOperationError, match="control flow"):
        load_circuit(_HEAD3 + body)


def test_an_if_in_a_comment_is_not_control_flow():
    assert load_circuit(_HEAD3 + "// if only\nqubit q; x q;").num_qubits == 1


def test_all_errors_are_qviz_errors():
    assert issubclass(CircuitParseError, QVizError)


def test_reset_and_mid_circuit_measurements_fail_in_compile(basic_backend):
    with pytest.raises(UnsupportedOperationError):
        compile(basic_backend, load_circuit(_HEAD3 + "qubit q; h q; reset q;"))
    mid = _HEAD3 + "qubit q; bit c; h q; c = measure q; x q;"
    with pytest.raises(UnsupportedOperationError, match="mid-circuit"):
        compile(basic_backend, load_circuit(mid))


def test_too_many_qubits_fail_in_compile(basic_backend):
    qc = load_circuit(_HEAD3 + "qubit[17] q; h q[0];")
    with pytest.raises(CircuitTooLargeError):
        compile(basic_backend, qc)


def test_unbound_inputs_fail_in_compile(basic_backend):
    qc = load_circuit(_HEAD3 + "input float theta; qubit q; rx(theta) q;")
    with pytest.raises(UnsupportedOperationError, match="unbound"):
        compile(basic_backend, qc)


@pytest.mark.parametrize(
    "body, expected",
    [
        ("qubit q; opaque mygate a; mygate q;", "opaque gates have no definition"),
        ("qubit q; rzz(0.3) q;", "stdgates.inc"),
        ("qubit[2] q; h q[3];", "outside its register"),
        ("qubit q; def f(qubit a) { h a; } f(q);", "subroutines"),
        ("qubit q; h q", "syntax error"),
    ],
)
def test_errors_say_what_to_do(body, expected):
    with pytest.raises(QVizError, match=expected):
        load_circuit(_HEAD3 + body)


def test_an_opaque_gate_of_openqasm2_is_rejected_by_name():
    text = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[1];\nopaque mygate a;\n'
    with pytest.raises(UnsupportedOperationError, match="opaque"):
        load_circuit(text + "mygate q[0];")


def test_a_gate_defined_from_standard_gates_is_translated(basic_backend):
    text = _HEAD3 + "gate bell a, b { h a; cx a, b; } qubit[2] q; bell q[0], q[1];"
    data = compile(basic_backend, load_circuit(text))
    assert data["steps"]


def test_most_standard_gates_translate(basic_backend):
    gates = (
        "p(0.3) q[0]; y q[0]; sdg q[0]; tdg q[0]; sx q[0]; u3(0.1,0.2,0.3) q[0]; "
        "cy q[0],q[1]; cp(0.4) q[0],q[1]; crx(0.2) q[0],q[1]; ch q[0],q[1]; "
        "swap q[0],q[1]; cswap q[0],q[1],q[2]; cu(0.1,0.2,0.3,0.4) q[0],q[1]; "
        "ccx q[0],q[1],q[2]; ctrl @ x q[0], q[1]; inv @ s q[0];"
    )
    data = compile(basic_backend, load_circuit(_HEAD3 + "qubit[3] q; " + gates))
    assert data["steps"]


def test_a_gate_without_definition_is_named_before_any_job(basic_backend):
    qc = QuantumCircuit(2)
    qc.append(Gate("mygate", 2, []), [0, 1])
    with pytest.raises(UnsupportedOperationError, match="'mygate' has no definition"):
        compile(basic_backend, qc)


def test_a_gate_without_definition_inside_a_definition_is_found(basic_backend):
    inner = QuantumCircuit(1, name="outer")
    inner.append(Gate("hidden", 1, []), [0])
    qc = QuantumCircuit(1)
    qc.append(inner.to_gate(), [0])
    with pytest.raises(UnsupportedOperationError, match="'hidden'"):
        compile(basic_backend, qc)


def test_the_ionq_job_is_not_sent_for_an_untranslatable_gate():
    backend = MagicMock()
    backend.name = "ionq_simulator"
    qc = QuantumCircuit(1)
    qc.append(Gate("mygate", 1, []), [0])
    with pytest.raises(UnsupportedOperationError):
        compile(backend, qc)
    backend.run.assert_not_called()


def test_reset_and_mid_circuit_errors_explain_why(basic_backend):
    with pytest.raises(UnsupportedOperationError, match="not a unitary gate"):
        compile(basic_backend, load_circuit(_HEAD3 + "qubit q; h q; reset q;"))
