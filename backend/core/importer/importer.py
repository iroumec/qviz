"""Read a circuit written in OpenQASM 2 or 3 into a Qiskit ``QuantumCircuit``.

This module is outside the pipeline: ``compile`` receives the circuit it
returns, like any other ``QuantumCircuit``. It only reads; it never runs
anything. OpenQASM 2 uses ``qiskit.qasm2``; OpenQASM 3 uses ``qiskit.qasm3``,
which needs the package ``qiskit-qasm3-import``.
"""

from __future__ import annotations

import re

from qiskit import QuantumCircuit
from qiskit.circuit import ControlFlowOp

from backend.core import config
from backend.core.errors import CircuitParseError, UnsupportedOperationError

_COMMENTS = re.compile(r"//[^\n]*|/\*.*?\*/", re.S)
_CONTROL_FLOW = re.compile(r"\b(if|for|while|switch)\b")
_HEADER = re.compile(r"\s*OPENQASM\s+(\d+)(?:\.\d+)?\s*;")


def _version(text: str) -> int:
    """Return the major version declared in the header (2 or 3)."""
    header = _HEADER.match(_COMMENTS.sub(" ", text))
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
        from qiskit import qasm2

        return qasm2.loads(text)
    try:
        from qiskit import qasm3

        return qasm3.loads(text)
    except ImportError as exc:
        raise CircuitParseError(
            "OpenQASM 3 needs the package qiskit-qasm3-import; "
            "use OpenQASM 2 or install it"
        ) from exc


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
    version = _version(source)
    found = _CONTROL_FLOW.search(_COMMENTS.sub(" ", source))
    if found:
        raise UnsupportedOperationError(
            f"control flow ({found.group(1)}) is not supported; "
            "write the gates one after another"
        )
    try:
        circuit = _parse(source, version)
    except CircuitParseError:
        raise
    except Exception as exc:  # noqa: BLE001 - parsers raise their own types
        message = str(exc).strip().splitlines()[0] if str(exc).strip() else "invalid"
        raise CircuitParseError(f"invalid OpenQASM {version}: {message}") from exc
    for instruction in circuit.data:
        if isinstance(instruction.operation, ControlFlowOp):
            raise UnsupportedOperationError(
                f"control flow ({instruction.operation.name}) is not supported; "
                "write the gates one after another"
            )
    return circuit
