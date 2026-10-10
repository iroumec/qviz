"""Read a circuit written in OpenQASM 2 or 3 into a Qiskit ``QuantumCircuit``.

This module is outside the pipeline: ``compile`` receives the circuit it
returns, like any other ``QuantumCircuit``. It only reads; it never runs
anything. OpenQASM 2 uses ``qiskit.qasm2``; OpenQASM 3 uses ``qiskit.qasm3``,
which needs the package ``qiskit-qasm3-import``.
"""

from __future__ import annotations

import re

from qiskit import QuantumCircuit, qasm2
from qiskit.circuit import ControlFlowOp

from backend.core import config
from backend.core.errors import CircuitParseError, UnsupportedOperationError

_COMMENTS = re.compile(r"//[^\n]*|/\*.*?\*/", re.S)
_CONTROL_FLOW = re.compile(r"\b(if|for|while|switch)\b")
_OPAQUE = re.compile(r"\bopaque\b")
_UNDEFINED = re.compile(r"(?:gate )?'(\w+)' is not defined")
_NODE = re.compile(r"node of type (\w+) is not supported")
_CONSTRUCTS = {
    "SubroutineDefinition": "subroutines (def)",
    "CalibrationGrammarDeclaration": "pulse-level calibration (defcalgrammar)",
    "CalibrationDefinition": "pulse-level calibration (defcal)",
    "CalibrationStatement": "pulse-level calibration (cal)",
    "ExternDeclaration": "external functions (extern)",
}
_HEADER = re.compile(r"\s*OPENQASM\s+(\d+)(?:\.\d+)?\s*;")


def _version(code: str) -> int:
    """Return the major version declared in the header (2 or 3).

    ``code`` is the text without comments.
    """
    header = _HEADER.match(code)
    if header is None:
        raise CircuitParseError(
            "the circuit must start with the line OPENQASM 2.0; or OPENQASM 3.0;"
        )
    version = int(header.group(1))
    if version not in (2, 3):
        raise CircuitParseError(f"OpenQASM {version} is not supported (use 2 or 3)")
    return version


def _parse(text: str, version: int) -> QuantumCircuit:
    if version == 2:
        return qasm2.loads(text)
    try:
        from qiskit import qasm3

        return qasm3.loads(text)
    except ImportError as exc:
        raise CircuitParseError(
            "OpenQASM 3 needs the package qiskit-qasm3-import; "
            "use OpenQASM 2 or install it"
        ) from exc


def _explain(error: Exception) -> str:
    """Return a message a person can act on for an error of the parsers."""
    message = " ".join(str(error).split()).strip("\"'")
    construct = _NODE.search(message)
    if construct:
        name = construct.group(1)
        return (
            f"{message.split(':')[0]}: {_CONSTRUCTS.get(name, name)} is not "
            "supported by QViz; write the gates one after another"
        )
    undefined = _UNDEFINED.search(message)
    if undefined:
        return (
            f"{message.rstrip('.')}. Only the gates of stdgates.inc (OpenQASM 3) or "
            "qelib1.inc (OpenQASM 2) exist; define another with "
            "`gate name qubits { ... }` using them, so it can be translated to "
            "the native gates of IonQ"
        )
    if "out of range" in message:
        return (
            f"{message}: a qubit or bit index is outside its register; "
            "check the sizes in the declarations"
        )
    return message or "syntax error; check that every statement ends with ';'"


def load_circuit(text: str) -> QuantumCircuit:
    """Return the circuit written in ``text`` (OpenQASM 2 or 3).

    The version is read from the ``OPENQASM`` header. Raises
    :class:`CircuitParseError` when the text is empty, too long or invalid, and
    :class:`UnsupportedOperationError` for control flow (``if``, ``for``,
    ``while``, ``switch``), which a step-by-step view cannot show. The limits
    that depend on the machine (qubits, mid-circuit measurements) are checked
    later by ``compile``.
    """
    source = (text or "").strip()
    if not source:
        raise CircuitParseError("the circuit is empty")
    if len(source) > config.MAX_QASM_CHARS:
        raise CircuitParseError(
            f"the circuit has {len(source)} characters, maximum is "
            f"{config.MAX_QASM_CHARS}"
        )
    code = _COMMENTS.sub(" ", source)
    version = _version(code)
    found = _CONTROL_FLOW.search(code)
    if found:
        raise UnsupportedOperationError(
            f"control flow ({found.group(1)}) is not supported; "
            "write the gates one after another"
        )
    if _OPAQUE.search(code):
        raise UnsupportedOperationError(
            "opaque gates have no definition, so they cannot be translated to the "
            "native gates of IonQ; define the gate with `gate name qubits { ... }`"
        )
    try:
        circuit = _parse(source, version)
    except CircuitParseError:
        raise
    except Exception as exc:  # noqa: BLE001 - parsers raise their own types
        raise CircuitParseError(f"invalid OpenQASM {version}: {_explain(exc)}") from exc
    for instruction in circuit.data:
        if isinstance(instruction.operation, ControlFlowOp):
            raise UnsupportedOperationError(
                f"control flow ({instruction.operation.name}) is not supported; "
                "write the gates one after another"
            )
    return circuit
