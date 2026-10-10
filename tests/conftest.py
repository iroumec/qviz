"""Shared pytest fixtures."""

from __future__ import annotations

from typing import get_args

import pytest
from qiskit.providers.basic_provider import BasicSimulator
from qiskit.providers.fake_provider import GenericBackendV2

from backend.core import config
from backend.core.model import Provider


@pytest.fixture
def all_providers(monkeypatch: pytest.MonkeyPatch) -> None:
    """Switch every provider on, as a user who edits ``config`` would."""
    monkeypatch.setattr(config, "ENABLED_PROVIDERS", frozenset(get_args(Provider)))


@pytest.fixture
def basic_backend() -> BasicSimulator:
    return BasicSimulator()


@pytest.fixture
def heron_backend() -> GenericBackendV2:
    return GenericBackendV2(num_qubits=20, basis_gates=["cz", "rz", "sx", "x"])


@pytest.fixture
def eagle_backend() -> GenericBackendV2:
    return GenericBackendV2(num_qubits=20, basis_gates=["ecr", "rz", "sx", "x"])
