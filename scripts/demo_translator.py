"""Demo M2: translate Bell and GHZ circuits to native ops for MS and ZZ.

Run with: python scripts/demo_translator.py
"""

from __future__ import annotations

from collections import Counter

from qiskit import QuantumCircuit

from _common import bell, ghz3, make_info
from backend.core.model import TranspiledCircuit
from backend.core.translator import translator


def translate(qc: QuantumCircuit, entangler: str):
    """Translate ``qc`` for the requested entangler."""
    info = make_info(entangler)  # type: ignore[arg-type]
    transpiled = TranspiledCircuit(
        source="qiskit", num_qubits=qc.num_qubits, circuit=qc
    )
    return translator.create(info).translate(transpiled)


def main() -> None:
    """Print the native ops of Bell and GHZ for both entanglers."""
    for label, factory in (("bell", bell), ("ghz3", ghz3)):
        for entangler in ("ms", "zz"):
            native = translate(factory(), entangler)
            counts = Counter(op.name for op in native.ops)
            print(f"=== {label} / {entangler} ===")
            for index, op in enumerate(native.ops, start=1):
                detail = f" targets={list(op.targets)}"
                if op.phases:
                    detail += f" phases={[round(p, 4) for p in op.phases]}"
                if op.angle is not None:
                    detail += f" angle={op.angle}"
                if op.z_rotation is not None:
                    detail += f" rz={round(op.z_rotation, 4)}"
                print(f"  {index:2d}. {op.name}{detail}")
            print(f"  counts: {dict(counts)}")
            print()


if __name__ == "__main__":
    main()
