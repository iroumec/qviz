"""Helpers shared by the demo scripts (not part of the library)."""

from __future__ import annotations

from qiskit import QuantumCircuit

from backend.core.model import BackendInfo, Entangler
from backend.core.provider import profiles


def make_info(entangler: Entangler = "ms") -> BackendInfo:
    """Return a synthetic IonQ BackendInfo for the requested entangler."""
    profile = profiles.ARIA if entangler == "ms" else profiles.FORTE
    return BackendInfo(
        provider="ionq",
        name="Aria 1" if entangler == "ms" else "Forte 1",
        display_name="IonQ Aria 1" if entangler == "ms" else "IonQ Forte 1",
        entangler=entangler,
        is_hardware=False,
        profile=profile,
    )


def bell() -> QuantumCircuit:
    """Build a two-qubit Bell-state circuit."""
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    return qc


def ghz3() -> QuantumCircuit:
    """Build a three-qubit GHZ-state circuit."""
    qc = QuantumCircuit(3)
    qc.h(0)
    qc.cx(0, 1)
    qc.cx(1, 2)
    return qc
