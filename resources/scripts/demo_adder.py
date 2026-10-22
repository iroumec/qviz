"""Demo: the QFT adder.

The Fourier transform is printed for two qubits, and the adder is compiled by
the backend for two input pairs. The result is written to ``out/adder_*.json``.

Run with: python resources/scripts/demo_adder.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from qiskit import QuantumCircuit
from qiskit.providers.basic_provider import BasicSimulator
from qiskit.quantum_info import Operator

from backend import compile, export
from examples import qft, qft_adder

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "out"


def _adder_input(count: int, a: int, b: int) -> QuantumCircuit:
    """Prepare ``a`` in the first register and ``b`` in the second, then add."""
    circuit = QuantumCircuit(2 * count)
    for index in range(count):
        if (a >> index) & 1:
            circuit.x(index)
        if (b >> index) & 1:
            circuit.x(count + index)
    circuit.compose(qft_adder(count), inplace=True)
    return circuit


def _final_probabilities(data: dict) -> list[list[float]]:
    last = data["steps"][-1]["probabilities"]
    return [[round(p, 3) for p in qubit] for qubit in last]


def main() -> None:
    OUT.mkdir(exist_ok=True)

    print("=== QFT on 2 qubits (unitary, rounded) ===")
    print(np.round(Operator(qft(2)).data, 3))

    backend = BasicSimulator()
    for count, a, b in ((1, 1, 1), (2, 1, 1), (2, 3, 2)):
        circuit = _adder_input(count, a, b)
        data = compile(backend, circuit)
        total = (a + b) % (2**count)
        path = OUT / f"adder_n{count}_{a}_{b}.json"
        export(data, str(path))
        print(f"=== adder n={count}: {a} + {b} = {total} (mod {2 ** count}) ===")
        print(f"  native steps: {len(data['steps'])}")
        print(f"  final p(|1>): {_final_probabilities(data)}")
        print(f"  wrote {path}")


if __name__ == "__main__":
    main()
