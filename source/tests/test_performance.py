"""Tests for the wide circuits used to check the performance."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator, Statevector

from backend import compile
from examples import ghz, layered

_SCHEMA = json.loads(
    (
        Path(__file__).parent.parent.parent
        / "documentation"
        / "schema"
        / "visualization.schema.json"
    ).read_text()
)


@pytest.mark.parametrize("count", [2, 3, 5])
def test_ghz_state_is_correct(count):
    circuit = ghz(count)
    state = Statevector(circuit).data
    probabilities = np.abs(state) ** 2
    # Only |00...0> and |11...1> carry weight.
    expected = np.zeros(2**count)
    expected[0] = 0.5
    expected[-1] = 0.5
    assert np.allclose(probabilities, expected)


def test_ghz_16_compiles_and_validates(basic_backend):
    data = compile(basic_backend, ghz(16))
    jsonschema.validate(data, _SCHEMA)
    assert data["total_qubits"] == 16
    assert len(data["steps"]) > 16


def test_ghz_16_becomes_fully_entangled(basic_backend):
    data = compile(basic_backend, ghz(16))
    last_states = data["steps"][-1]["states"]
    for x, y, z in last_states:
        assert abs(x) + abs(y) + abs(z) < 1e-9


def test_layered_is_reproducible():
    first = Operator(layered(4, depth=2, seed=7))
    second = Operator(layered(4, depth=2, seed=7))
    assert first.equiv(second)


def test_layered_changes_with_the_seed():
    first = Operator(layered(4, depth=2, seed=1))
    second = Operator(layered(4, depth=2, seed=2))
    assert not first.equiv(second)


def test_layered_16_compiles(basic_backend):
    data = compile(basic_backend, layered(16, depth=3))
    jsonschema.validate(data, _SCHEMA)
    assert data["total_qubits"] == 16


@pytest.mark.parametrize(
    "call",
    [
        lambda: ghz(1),
        lambda: layered(1),
        lambda: layered(4, depth=0),
    ],
)
def test_validation_errors(call):
    with pytest.raises(ValueError):
        call()


def test_ghz_is_a_circuit():
    assert isinstance(ghz(16), QuantumCircuit)
