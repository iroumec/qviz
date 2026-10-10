"""Tests for the reader of OpenQASM 2 and 3 circuits."""

from __future__ import annotations

from pathlib import Path

import pytest
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
