"""Shared pytest fixtures."""

from __future__ import annotations

import pytest
from qiskit.providers.basic_provider import BasicSimulator
from qiskit.providers.fake_provider import GenericBackendV2


@pytest.fixture
def basic_backend() -> BasicSimulator:
    return BasicSimulator()


@pytest.fixture
def chip_backend() -> GenericBackendV2:
    """A backend with a coupling map and more qubits than a small circuit uses."""
    return GenericBackendV2(num_qubits=20, basis_gates=["cz", "rz", "sx", "x"])
