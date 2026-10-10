"""Demo M5: fidelities, inactivity, vibration and cost per step.

Run with: python scripts/demo_metrics.py
"""

from __future__ import annotations

from _common import bell, make_info
from backend.core.metrics import metrics
from backend.core.model import TranspiledCircuit
from backend.core.simulator import simulator
from backend.core.translator import translator
from backend.core.vectorizer import vectorizer


def main() -> None:
    """Print the metrics table per step for a Bell circuit."""
    qc = bell()
    info = make_info("ms")
    transpiled = TranspiledCircuit(
        source="qiskit", num_qubits=qc.num_qubits, circuit=qc
    )
    native = translator.create(info).translate(transpiled)
    vectorized = vectorizer.vectorize(simulator.simulate(native))
    measured = metrics.measure(vectorized, info, shots=1024)

    print(f"initial_fidelity = {100 * (1 - info.profile.spam_error):.3f} %")
    for step in measured.steps:
        print(
            f"step {step.index:2d} {step.op.name:8s}"
            f" acum_fid={step.acumulative_fidelity:8.4f}"
            f" fid={[round(v, 3) for v in step.fidelities]}"
            f" inact={list(step.inactivity)}"
            f" vib={[round(v, 4) for v in step.vibration]}"
            f" cost={step.acumulative_cost:.6f} USD"
        )


if __name__ == "__main__":
    main()
