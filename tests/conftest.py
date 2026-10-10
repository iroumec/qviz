"""Shared pytest fixtures."""

from __future__ import annotations

import pytest
from qiskit.providers.basic_provider import BasicSimulator
from qiskit.providers.fake_provider import GenericBackendV2


@pytest.fixture
def basic_backend() -> BasicSimulator:
    return BasicSimulator()


@pytest.fixture
def heron_backend() -> GenericBackendV2:
    return GenericBackendV2(num_qubits=20, basis_gates=["cz", "rz", "sx", "x"])


@pytest.fixture
def eagle_backend() -> GenericBackendV2:
    return GenericBackendV2(num_qubits=20, basis_gates=["ecr", "rz", "sx", "x"])
