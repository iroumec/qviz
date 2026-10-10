"""Demo M4: Cartesian Bloch vectors and p(|1>) per qubit.

Run with: python scripts/demo_vectorizer.py
"""

from __future__ import annotations

from _common import bell, make_info
from backend.core.model import TranspiledCircuit
from backend.core.simulator import simulator
from backend.core.translator import translator
from backend.core.vectorizer import vectorizer


def main() -> None:
    """Print the Cartesian table per step and qubit for a Bell circuit."""
    qc = bell()
    info = make_info("ms")
    transpiled = TranspiledCircuit(
        source="qiskit", num_qubits=qc.num_qubits, circuit=qc
    )
    native = translator.create(info).translate(transpiled)
    vectorized = vectorizer.vectorize(simulator.simulate(native))

    for step in vectorized.steps:
        print(f"step {step.index}: {step.op.name}{list(step.op.targets)}")
        for qubit, (state, probability) in enumerate(
            zip(step.states, step.probabilities)
        ):
            x, y, z = state
            print(
                f"  q{qubit}: x={x:7.4f} y={y:7.4f} z={z:7.4f}"
                f"  p(|1>)={probability[1]:7.4f}"
            )


if __name__ == "__main__":
    main()
