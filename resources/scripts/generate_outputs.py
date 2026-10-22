"""Generate the JSON files that the viewer loads, and a manifest.

The manifest (``out/manifest.json``) lists every file with a readable label, so
that the viewer can offer a selector. The 16-qubit circuits are used to test the
performance of the renderer.

Run with: python resources/scripts/generate_outputs.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from qiskit import QuantumCircuit
from qiskit.providers.basic_provider import BasicSimulator

from backend import compile, export
from examples import qft_adder
from examples.catalog import CIRCUITS, LABELS

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "out"
_MANIFEST = OUT / "manifest.json"


def _adder_input(count: int, a: int, b: int) -> QuantumCircuit:
    circuit = QuantumCircuit(2 * count)
    for index in range(count):
        if (a >> index) & 1:
            circuit.x(index)
        if (b >> index) & 1:
            circuit.x(count + index)
    circuit.compose(qft_adder(count), inplace=True)
    return circuit


def _outputs() -> dict[str, tuple[str, QuantumCircuit]]:
    outputs = {
        f"{name}.json": (LABELS[name], factory())
        for name, factory in CIRCUITS.items()
    }
    outputs["adder_n2_1_1.json"] = (
        "QFT adder 1 + 1 (4 qubits)",
        _adder_input(2, 1, 1),
    )
    return outputs


def main() -> None:
    OUT.mkdir(exist_ok=True)
    backend = BasicSimulator()
    manifest: dict = {"default": "bell.json", "files": []}

    for filename, (label, circuit) in _outputs().items():
        start = time.perf_counter()
        data = compile(backend, circuit)
        elapsed = time.perf_counter() - start
        export(data, str(OUT / filename))
        manifest["files"].append(
            {
                "file": filename,
                "label": label,
                "qubits": data["total_qubits"],
                "steps": len(data["steps"]),
            }
        )
        print(
            f"{filename:22s} {data['total_qubits']:2d} qubits  "
            f"{len(data['steps']):5d} steps  {elapsed:6.2f} s"
        )

    _MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote {_MANIFEST}")


if __name__ == "__main__":
    main()
