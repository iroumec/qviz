"""Demo M3: (r, theta, phi) per qubit after every native op of a Bell circuit.

Run with: python scripts/demo_simulator.py
"""

from __future__ import annotations

import math

from _common import bell, make_info
from backend.core.model import TranspiledCircuit
from backend.core.simulator import simulator
from backend.core.translator import translator


def main() -> None:
    """Print the (r, theta, phi) table per step and qubit for a Bell circuit."""
    qc = bell()
    info = make_info("ms")
    transpiled = TranspiledCircuit(
        source="qiskit", num_qubits=qc.num_qubits, circuit=qc
    )
    native = translator.create(info).translate(transpiled)
    simulated = simulator.simulate(native)

    for step in simulated.steps:
        print(f"step {step.index}: {step.op.name}{list(step.op.targets)}")
        for qubit, angles in enumerate(step.qubits):
            theta_deg = math.degrees(angles.theta)
            phi_deg = math.degrees(angles.phi)
            print(
                f"  q{qubit}: r={angles.r:7.4f}  theta={theta_deg:8.3f} deg"
                f"  phi={phi_deg:8.3f} deg"
            )
        print(f"  virtual_z: {[round(v, 4) for v in step.virtual_z]}")


if __name__ == "__main__":
    main()
