"""Demo M6: compile Bell and GHZ circuits and write the JSON contract.

Run with: python resources/scripts/demo_compile.py
"""

from __future__ import annotations

from pathlib import Path

from qiskit.providers.basic_provider import BasicSimulator

from _common import ghz3
from examples import bell
from backend import compile, export

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "out"


def main() -> None:
    """Compile Bell and GHZ and write their JSON to the out/ directory."""
    OUT.mkdir(exist_ok=True)
    backend = BasicSimulator()
    for name, factory in (("bell", bell), ("ghz3", ghz3)):
        data = compile(backend, factory())
        path = OUT / f"{name}.json"
        export(data, str(path))
        print(
            f"wrote {path} ({len(data['steps'])} steps, "
            f"{data['total_qubits']} qubits)"
        )


if __name__ == "__main__":
    main()
