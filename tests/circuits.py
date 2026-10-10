"""Shared test circuits and helpers."""

from __future__ import annotations

from qiskit import QuantumCircuit

from backend.core.model import BackendInfo, Entangler
from backend.core.provider import profiles


def single_x() -> QuantumCircuit:
    qc = QuantumCircuit(1)
    qc.x(0)
    return qc


def single_h() -> QuantumCircuit:
    qc = QuantumCircuit(1)
    qc.h(0)
    return qc


def rotations() -> QuantumCircuit:
    qc = QuantumCircuit(1)
    qc.rx(0.7, 0)
    qc.ry(1.1, 0)
    qc.rz(-0.4, 0)
    return qc


def bell() -> QuantumCircuit:
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    return qc


def bell_measured() -> QuantumCircuit:
    qc = bell()
    qc.measure_all()
    return qc


def ghz3() -> QuantumCircuit:
    qc = QuantumCircuit(3)
    qc.h(0)
    qc.cx(0, 1)
    qc.cx(1, 2)
    return qc


def swap_test() -> QuantumCircuit:
    qc = QuantumCircuit(3)
    qc.h(0)
    qc.cx(0, 1)
    qc.swap(1, 2)
    qc.ccx(0, 1, 2)
    return qc


def idle_qubit() -> QuantumCircuit:
    qc = QuantumCircuit(3)
    qc.h(0)
    qc.cx(0, 1)
    return qc


ALL_CIRCUITS = {
    "single_x": single_x,
    "single_h": single_h,
    "rotations": rotations,
    "bell": bell,
    "ghz3": ghz3,
    "swap_test": swap_test,
    "idle_qubit": idle_qubit,
}


def make_info(entangler: Entangler = "ms") -> BackendInfo:
    """Build a synthetic BackendInfo for translator/simulator tests."""
    profile = profiles.ARIA if entangler == "ms" else profiles.FORTE
    return BackendInfo(
        provider="local",
        name="test",
        display_name="test",
        entangler=entangler,
        is_hardware=False,
        profile=profile,
    )
