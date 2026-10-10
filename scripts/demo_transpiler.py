"""Demo M1: detect the provider and transpile a Bell circuit.

Run with: python scripts/demo_transpiler.py
"""

from __future__ import annotations

from qiskit.providers.basic_provider import BasicSimulator
from qiskit.providers.fake_provider import GenericBackendV2

from _common import bell
from backend.core.provider import provider
from backend.core.transpiler import transpiler


class UnknownBackend:
    """Fake backend used to exercise the generic fallback path."""

    __module__ = "some_pkg"
    name = "mystery_qpu"


def main() -> None:
    """Print provider info and the transpiled circuit for each local backend."""
    backends = {
        "BasicSimulator": BasicSimulator(),
        "GenericBackendV2 (Heron)": GenericBackendV2(
            num_qubits=20, basis_gates=["cz", "rz", "sx", "x"]
        ),
        "GenericBackendV2 (Eagle)": GenericBackendV2(
            num_qubits=20, basis_gates=["ecr", "rz", "sx", "x"]
        ),
        "UnknownBackend": UnknownBackend(),
    }

    for label, backend in backends.items():
        info = provider.detect(backend)
        transpiled = transpiler.transpile(info, backend, bell())
        names = [instr.operation.name for instr in (transpiled.circuit or [])]
        print(f"=== {label} ===")
        print(f"  provider   : {info.provider}")
        print(f"  name       : {info.name}")
        print(f"  display    : {info.display_name}")
        print(f"  entangler  : {info.entangler}")
        print(f"  hardware   : {info.is_hardware}")
        print(f"  source     : {transpiled.source}")
        print(f"  num_qubits : {transpiled.num_qubits}")
        print(f"  layout     : {transpiled.layout}")
        print(f"  ops        : {names}")
        print()


if __name__ == "__main__":
    main()
