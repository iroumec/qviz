"""Sample measurement outcomes from the JSON that ``compile`` produces.

The exported steps hold every native operation with its parameters, so the exact
joint distribution of any step can be rebuilt from the data alone. That is what
the per-qubit ``states`` cannot give: for a Bell pair both marginals are 0.5, yet
only ``00`` and ``11`` can be measured. The ideal distribution is the diagonal of
the statevector, ``|<z|psi>|**2``; noise is then added as independent bit flips.

This module is not a pipeline stage: it works on the output of ``compile`` and
imports nothing but ``core.model``, ``core.errors``, ``core.config`` and
``core.to_qiskit``.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any, get_args

import numpy as np
from qiskit.quantum_info import Statevector

from backend.core import config, constants
from backend.core.errors import QVizError
from backend.core.model import NativeOp, OpName
from backend.core.to_qiskit import circuit_from_ops

_ARITY = {"gpi": 1, "gpi2": 1, "ms": 2, "zz": 2, "virtual_z": 1}


def _malformed(index: int | None, reason: str) -> QVizError:
    where = "visualization data" if index is None else f"step at index {index}"
    return QVizError(f"malformed {where}: {reason}")


def _number(value: Any, what: str, index: int | None) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise _malformed(index, f"{what} is not a number ({value!r})") from exc
    if not math.isfinite(number):
        raise _malformed(index, f"{what} is not finite ({value!r})")
    return number


def _steps_of(data: Any) -> tuple[int, list[Mapping]]:
    if not isinstance(data, Mapping):
        raise _malformed(None, "expected a dictionary")
    steps = data.get("steps")
    total = data.get("total_qubits")
    if not isinstance(steps, Sequence) or isinstance(steps, (str, bytes)):
        raise _malformed(None, "'steps' must be a list")
    if not isinstance(total, int) or isinstance(total, bool) or total < 1:
        raise _malformed(None, "'total_qubits' must be a positive integer")
    return total, list(steps)


def _op_of(raw: Any, previous_z: list[float], num_qubits: int, index: int) -> NativeOp:
    """Rebuild one native operation, updating the running ``virtual_z``."""
    if not isinstance(raw, Mapping):
        raise _malformed(index, "not a dictionary")
    name = raw.get("operation")
    if name not in get_args(OpName):
        raise _malformed(index, f"unknown operation {name!r}")
    targets = raw.get("targets")
    if (
        not isinstance(targets, Sequence)
        or len(targets) != _ARITY[name]
        or not all(isinstance(q, int) and 0 <= q < num_qubits for q in targets)
        or len(set(targets)) != len(targets)
    ):
        raise _malformed(index, f"invalid targets {targets!r} for {name!r}")
    targets = tuple(targets)

    accumulated = raw.get("virtual_z")
    if not isinstance(accumulated, Sequence) or len(accumulated) != num_qubits:
        raise _malformed(index, "'virtual_z' must have one value per qubit")
    accumulated = [_number(v, "virtual_z", index) for v in accumulated]

    op: NativeOp
    if name == "virtual_z":
        q = targets[0]
        rotation = (accumulated[q] - previous_z[q]) % constants.TWO_PI
        op = NativeOp(name, targets, z_rotation=rotation)
    else:
        phases: tuple[float, ...] = ()
        if name in ("gpi", "gpi2", "ms"):
            values = raw.get("phases")
            if not isinstance(values, Sequence) or len(values) != _ARITY[name]:
                raise _malformed(index, f"'phases' needs {_ARITY[name]} value(s)")
            phases = tuple(_number(v, "phase", index) for v in values)
        angle = None
        if name in ("ms", "zz"):
            angle = _number(raw.get("angle"), "angle", index)
        op = NativeOp(name, targets, phases=phases, angle=angle)
    previous_z[:] = accumulated
    return op


def _noise_flip_probabilities(
    data: Mapping, step: int, num_qubits: int
) -> np.ndarray:
    """Return the chance that each qubit is read wrongly at ``step``.

    The per-qubit fidelity ``f`` (in percent) is a read-out error of
    ``(1 - f) / 2``, which equals pulling ``p`` towards 0.5 by the factor ``f``.
    The state-preparation-and-measurement error, ``1 - initial_fidelity``, is
    added as a second independent flip.
    """
    initial = _number(data.get("initial_fidelity", 100.0), "initial_fidelity", None)
    spam = 1.0 - initial / 100.0
    if step == 0:
        gate_fidelity = [100.0] * num_qubits
    else:
        gate_fidelity = data["steps"][step - 1].get("fidelities")
        if not isinstance(gate_fidelity, Sequence) or len(gate_fidelity) != num_qubits:
            raise _malformed(step - 1, "'fidelities' must have one value per qubit")
    gate = np.array([_number(f, "fidelity", step - 1) for f in gate_fidelity])
    gate_flip = (1.0 - np.clip(gate, 0.0, 100.0) / 100.0) / 2.0
    spam = min(max(spam, 0.0), 1.0)
    return gate_flip + spam - 2.0 * gate_flip * spam


def probabilities(data: Mapping, step: int) -> np.ndarray:
    """Return the ideal joint distribution after ``step`` operations.

    The result has ``2**n`` entries and the index is the bitstring value, with
    qubit 0 as the least significant bit (the Qiskit order). ``step=0`` is the
    initial state, ``|0...0>``.
    """
    num_qubits, steps = _steps_of(data)
    if isinstance(step, bool) or not isinstance(step, int):
        raise QVizError(f"step must be an integer, got {step!r}")
    if not 0 <= step <= len(steps):
        raise QVizError(f"step must be between 0 and {len(steps)}, got {step}")
    if num_qubits > config.MAX_QUBITS:
        raise _malformed(None, f"more than {config.MAX_QUBITS} qubits")

    previous_z = [0.0] * num_qubits
    ops = [
        _op_of(raw, previous_z, num_qubits, index)
        for index, raw in enumerate(steps[:step])
    ]
    state = Statevector(circuit_from_ops(ops, num_qubits))
    return np.abs(state.data) ** 2


def sample(
    data: Mapping, step: int, shots: int = 1024, *, seed: int | None = None
) -> dict[str, int]:
    """Measure all qubits ``shots`` times after ``step`` operations.

    ``data`` is the dictionary returned by ``compile`` (or ``json.loads`` of the
    exported text). The ideal outcomes are drawn from the statevector, so the
    correlations of entanglement are kept, and each qubit is then flipped with the
    read-out error of that step (see ``_noise_flip_probabilities``). Returns the
    counts per bitstring, qubit 0 on the right, most frequent first. The same
    ``seed`` gives the same counts.
    """
    if isinstance(shots, bool) or not isinstance(shots, int):
        raise QVizError(f"shots must be an integer, got {shots!r}")
    if not 0 < shots <= config.MAX_SAMPLE_SHOTS:
        raise QVizError(
            f"shots must be between 1 and {config.MAX_SAMPLE_SHOTS}, got {shots}"
        )

    ideal = probabilities(data, step)
    num_qubits = int(round(math.log2(len(ideal))))
    flips = _noise_flip_probabilities(data, step, num_qubits)

    rng = np.random.default_rng(seed)
    outcomes = rng.choice(len(ideal), size=shots, p=ideal / ideal.sum())
    for qubit in range(num_qubits):
        flipped = rng.random(shots) < flips[qubit]
        outcomes = outcomes ^ (flipped.astype(np.int64) << qubit)

    values, counts = np.unique(outcomes, return_counts=True)
    order = np.argsort(-counts, kind="stable")
    return {
        format(int(values[i]), f"0{num_qubits}b"): int(counts[i]) for i in order
    }
