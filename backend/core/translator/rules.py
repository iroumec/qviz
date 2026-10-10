"""Translation table: Qiskit operations -> native trapped-ion operations.

The temporal order is the list order (leftmost is applied first). All
identities are exact up to a global phase, which does not change Bloch vectors
(``spec.md`` §M2c and ``documentation/references/ionq_native_gates.md`` §3).
"""

from __future__ import annotations

import math
from dataclasses import replace

from qiskit import QuantumCircuit
from qiskit.circuit.library import CZGate
from qiskit.quantum_info import Operator
from qiskit.synthesis import OneQubitEulerDecomposer, TwoQubitBasisDecomposer
from qiskit_ionq import GPI2Gate, GPIGate
from qiskit_ionq import MSGate as IonQMSGate
from qiskit_ionq import ZZGate as IonQZZGate

from backend.core import constants
from backend.core.errors import UnsupportedOperationError
from backend.core.model import Entangler, NativeOp
from backend.core.translator import normalize

_PI = math.pi
_IGNORED = ("id", "barrier", "delay", "global_phase")
_ONE_QUBIT = OneQubitEulerDecomposer(basis="ZSX")
_TWO_QUBIT = TwoQubitBasisDecomposer(CZGate(), euler_basis="ZSX")


def _add(ops: list[NativeOp], op: NativeOp, source_index: int | None) -> None:
    ops.append(op if source_index is None else replace(op, source_index=source_index))


def _gpi(q: int, phase: float = 0.0) -> NativeOp:
    return NativeOp("gpi", (q,), phases=(phase,))


def _gpi2(q: int, phase: float = 0.0) -> NativeOp:
    return NativeOp("gpi2", (q,), phases=(phase,))


def _vz(q: int, rotation: float) -> NativeOp:
    return NativeOp("virtual_z", (q,), z_rotation=rotation)


def _h(q: int) -> list[NativeOp]:
    return [_vz(q, _PI), _gpi2(q, _PI / 2)]


def _zz_to_ms(ops: list[NativeOp], op: NativeOp, source_index: int | None) -> None:
    """ZZ(t) = GPi2(pi/2) both, MS(0,0,t), GPi2(-pi/2) both."""
    a, b = op.targets
    t = op.angle
    _add(ops, _gpi2(a, _PI / 2), source_index)
    _add(ops, _gpi2(b, _PI / 2), source_index)
    _add(ops, NativeOp("ms", (a, b), phases=(0.0, 0.0), angle=t), source_index)
    _add(ops, _gpi2(a, -_PI / 2), source_index)
    _add(ops, _gpi2(b, -_PI / 2), source_index)


def _ms_to_zz(ops: list[NativeOp], op: NativeOp, source_index: int | None) -> None:
    """Convert an MS op to the ZZ entangler.

    MS(p0,p1,t) = VZ(-p0), VZ(-p1), GPi2(-pi/2) both, ZZ(t),
    GPi2(pi/2) both, VZ(p0), VZ(p1).
    """
    a, b = op.targets
    p0, p1 = op.phases
    t = op.angle
    _add(ops, _vz(a, -p0), source_index)
    _add(ops, _vz(b, -p1), source_index)
    _add(ops, _gpi2(a, -_PI / 2), source_index)
    _add(ops, _gpi2(b, -_PI / 2), source_index)
    _add(ops, NativeOp("zz", (a, b), angle=t), source_index)
    _add(ops, _gpi2(a, _PI / 2), source_index)
    _add(ops, _gpi2(b, _PI / 2), source_index)
    _add(ops, _vz(a, p0), source_index)
    _add(ops, _vz(b, p1), source_index)


def emit_zz(
    ops: list[NativeOp],
    targets: tuple[int, ...],
    angle: float,
    entangler: Entangler,
    source_index: int | None = None,
) -> None:
    """Emit ``ZZ(angle)`` normalized and converted to the target entangler."""
    for op in normalize.normalize_zz(targets, angle):
        if op.name == "zz" and entangler == "ms":
            _zz_to_ms(ops, op, source_index)
        else:
            _add(ops, op, source_index)


def emit_ms(
    ops: list[NativeOp],
    targets: tuple[int, ...],
    phases: tuple[float, float],
    angle: float,
    entangler: Entangler,
    source_index: int | None = None,
) -> None:
    """Emit ``MS(phases, angle)`` normalized and converted to the target entangler."""
    for op in normalize.normalize_ms(targets, phases, angle):
        if op.name == "ms" and entangler == "zz":
            _ms_to_zz(ops, op, source_index)
        else:
            _add(ops, op, source_index)


def _cz(
    ops: list[NativeOp],
    targets: tuple[int, ...],
    entangler: Entangler,
    si: int | None,
) -> None:
    a, b = targets
    if entangler == "zz":
        _add(ops, NativeOp("zz", (a, b), angle=0.25), si)
    else:
        _add(ops, _gpi2(a, _PI / 2), si)
        _add(ops, _gpi2(b, _PI / 2), si)
        _add(ops, NativeOp("ms", (a, b), phases=(0.0, 0.0), angle=0.25), si)
        _add(ops, _gpi2(a, -_PI / 2), si)
        _add(ops, _gpi2(b, -_PI / 2), si)
    _add(ops, _vz(a, -_PI / 2), si)
    _add(ops, _vz(b, -_PI / 2), si)


def _cx(
    ops: list[NativeOp],
    targets: tuple[int, ...],
    entangler: Entangler,
    si: int | None,
) -> None:
    c, t = targets
    if entangler == "ms":
        _add(ops, _gpi2(c, _PI / 2), si)
        _add(ops, NativeOp("ms", (c, t), phases=(0.0, 0.0), angle=0.25), si)
        _add(ops, _gpi2(c, _PI), si)
        _add(ops, _gpi2(t, _PI), si)
        _add(ops, _gpi2(c, -_PI / 2), si)
    else:
        for op in _h(t):  # noqa: E501 - H on target
            _add(ops, op, si)
        _cz(ops, (c, t), "zz", si)
        for op in _h(t):
            _add(ops, op, si)


def _matrix_of(op, qubits: tuple[int, ...]):  # type: ignore[no-untyped-def]
    tmp = QuantumCircuit(len(qubits))
    tmp.append(op, range(len(qubits)))
    return Operator(tmp).data


def _decompose_one(ops, op, qubit, entangler, si):  # type: ignore[no-untyped-def]
    circuit = _ONE_QUBIT(_matrix_of(op, (qubit,)))
    for instr in circuit.data:
        emit(ops, instr.operation, (qubit,), entangler, si)


def _decompose_two(ops, op, qubits, entangler, si):  # type: ignore[no-untyped-def]
    circuit = _TWO_QUBIT(_matrix_of(op, qubits))
    for instr in circuit.data:
        indices = tuple(circuit.find_bit(q).index for q in instr.qubits)
        emit(ops, instr.operation, tuple(qubits[i] for i in indices), entangler, si)


def _expand_definition(ops, op, qubits, entangler, si):  # type: ignore[no-untyped-def]
    definition = getattr(op, "definition", None)
    if definition is None:
        raise UnsupportedOperationError(
            f"operation {op.name!r} has no definition to expand"
        )
    mapping = {definition.qubits[i]: qubits[i] for i in range(len(qubits))}
    for instr in definition.data:
        mapped = tuple(mapping[q] for q in instr.qubits)
        emit(ops, instr.operation, mapped, entangler, si)


def emit(ops, op, qubits, entangler, source_index=None):  # type: ignore[no-untyped-def]
    """Append the native ops equivalent to a single Qiskit operation."""
    name = op.name
    if name in _IGNORED:
        return
    if name == "measure":
        return  # final measures are removed upstream; mid-circuit checked separately
    if name == "reset":
        raise UnsupportedOperationError(
            f"reset at source index {source_index} is not supported"
        )
    if name == "if_else" or getattr(op, "condition", None) is not None:
        raise UnsupportedOperationError(
            f"classical control flow at source index {source_index} is not supported"
        )

    if isinstance(op, GPIGate):
        _add(ops, _gpi(qubits[0], constants.TWO_PI * float(op.params[0])), source_index)
    elif isinstance(op, GPI2Gate):
        _add(
            ops,
            _gpi2(qubits[0], constants.TWO_PI * float(op.params[0])),
            source_index,
        )
    elif isinstance(op, IonQMSGate):
        phases = (
            constants.TWO_PI * float(op.params[0]),
            constants.TWO_PI * float(op.params[1]),
        )
        emit_ms(
            ops, tuple(qubits), phases, float(op.params[2]), entangler, source_index
        )
    elif isinstance(op, IonQZZGate):
        emit_zz(ops, tuple(qubits), float(op.params[0]), entangler, source_index)
    elif name == "x":
        _add(ops, _gpi(qubits[0], 0.0), source_index)
    elif name == "y":
        _add(ops, _gpi(qubits[0], _PI / 2), source_index)
    elif name == "sx":
        _add(ops, _gpi2(qubits[0], 0.0), source_index)
    elif name == "sxdg":
        _add(ops, _gpi2(qubits[0], _PI), source_index)
    elif name in ("rz", "p", "u1"):
        _add(ops, _vz(qubits[0], float(op.params[0])), source_index)
    elif name == "z":
        _add(ops, _vz(qubits[0], _PI), source_index)
    elif name == "s":
        _add(ops, _vz(qubits[0], _PI / 2), source_index)
    elif name == "sdg":
        _add(ops, _vz(qubits[0], -_PI / 2), source_index)
    elif name == "t":
        _add(ops, _vz(qubits[0], _PI / 4), source_index)
    elif name == "tdg":
        _add(ops, _vz(qubits[0], -_PI / 4), source_index)
    elif name == "h":
        for nop in _h(qubits[0]):
            _add(ops, nop, source_index)
    elif name == "cz":
        _cz(ops, tuple(qubits), entangler, source_index)
    elif name in ("cx", "cnot"):
        _cx(ops, tuple(qubits), entangler, source_index)
    elif name == "rzz":
        emit_zz(
            ops,
            tuple(qubits),
            float(op.params[0]) / constants.TWO_PI,
            entangler,
            source_index,
        )
    elif len(qubits) == 1:
        _decompose_one(ops, op, qubits[0], entangler, source_index)
    elif len(qubits) == 2:
        _decompose_two(ops, op, tuple(qubits), entangler, source_index)
    else:
        _expand_definition(ops, op, tuple(qubits), entangler, source_index)


def _check_measure_position(circuit: QuantumCircuit) -> None:
    seen_measure = False
    for index, instr in enumerate(circuit.data):
        name = instr.operation.name
        if name == "measure":
            seen_measure = True
            continue
        if name in _IGNORED:
            continue
        if seen_measure:
            raise UnsupportedOperationError(
                f"measurement at source index {index} is mid-circuit and not supported"
            )


def _compaction(circuit: QuantumCircuit, layout: tuple[int, ...] | None):
    used: set[int] = set()
    for instr in circuit.data:
        for qubit in instr.qubits:
            used.add(circuit.find_bit(qubit).index)

    if layout is None:
        return {i: i for i in range(circuit.num_qubits)}, circuit.num_qubits

    mapping = {physical: new for new, physical in enumerate(layout)}
    next_index = len(layout)
    for physical in sorted(used):
        if physical not in mapping:
            mapping[physical] = next_index
            next_index += 1
    return mapping, next_index


def translate_circuit(
    circuit: QuantumCircuit,
    layout: tuple[int, ...] | None,
    entangler: Entangler,
):
    """Translate a Qiskit circuit and compact its qubits.

    Returns ``(ops, num_qubits)`` with targets already compacted.
    """
    _check_measure_position(circuit)
    mapping, num_qubits = _compaction(circuit, layout)

    ops: list[NativeOp] = []
    for source_index, instr in enumerate(circuit.data):
        qubits = tuple(circuit.find_bit(q).index for q in instr.qubits)
        emit(ops, instr.operation, qubits, entangler, source_index)

    remapped = [
        replace(op, targets=tuple(mapping[q] for q in op.targets)) for op in ops
    ]
    return remapped, num_qubits


def _native_targets(raw: dict) -> tuple[int, ...]:
    targets = raw.get("targets")
    if targets is None:
        target = raw.get("target")
        targets = [target]
    return tuple(int(q) for q in targets)


def translate_native_ops(native_ops, num_qubits: int, entangler: Entangler):
    """Translate an IonQ native API gate list (``spec.md`` §M2c).

    Returns ``(ops, num_qubits)``.
    """
    ops: list[NativeOp] = []
    for source_index, raw in enumerate(native_ops):
        gate = str(raw.get("gate") or raw.get("name") or "").lower()
        targets = _native_targets(raw)
        if gate == "gpi":
            _add(
                ops,
                _gpi(targets[0], constants.TWO_PI * float(raw["phase"])),
                source_index,
            )
        elif gate == "gpi2":
            _add(
                ops,
                _gpi2(targets[0], constants.TWO_PI * float(raw["phase"])),
                source_index,
            )
        elif gate == "ms":
            raw_phases = raw.get("phases", raw.get("phase", [0.0, 0.0]))
            if not isinstance(raw_phases, (list, tuple)):
                raw_phases = [raw_phases, raw_phases]
            phases = (
                constants.TWO_PI * float(raw_phases[0]),
                constants.TWO_PI * float(raw_phases[1]),
            )
            angle = float(raw.get("angle", 0.25))
            emit_ms(ops, targets, phases, angle, entangler, source_index)
        elif gate == "zz":
            angle = float(raw.get("angle", 0.25))
            emit_zz(ops, targets, angle, entangler, source_index)
        else:
            raise UnsupportedOperationError(
                f"unknown native gate {gate!r} in input list"
            )
    return ops, num_qubits
