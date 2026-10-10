"""Translation of a transpiled circuit into the native trapped-ion gate set.

The translation rules are the same for every backend (``rules.py``); the only
input that changes them is the target entangler of ``BackendInfo``.
"""

from __future__ import annotations

from backend.core.errors import QVizError
from backend.core.model import BackendInfo, NativeCircuit, TranspiledCircuit
from backend.core.translator import rules


def translate(info: BackendInfo, transpiled: TranspiledCircuit) -> NativeCircuit:
    """Normalize a transpiled circuit into the native gate set of ``info``.

    ``info.entangler`` (``"ms"`` or ``"zz"``) is the two-qubit gate to emit.
    """
    entangler = info.entangler
    if transpiled.native_ops is not None:
        num_qubits = transpiled.num_qubits
        ops = rules.translate_native_ops(
            transpiled.native_ops, num_qubits, entangler
        )
    else:
        if transpiled.circuit is None:  # pragma: no cover - model invariant
            raise QVizError("transpiled circuit has neither circuit nor native ops")
        ops, num_qubits = rules.translate_circuit(
            transpiled.circuit, transpiled.layout, entangler
        )
    return NativeCircuit(backend=info, num_qubits=num_qubits, ops=tuple(ops))
