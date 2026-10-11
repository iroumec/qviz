"""Tests for the worked examples, in particular the QFT adder."""

from __future__ import annotations

import json
import math
from pathlib import Path

import jsonschema
import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator, Statevector

from backend import compile
from examples import inverse_qft, qft, qft_adder

_SCHEMA = json.loads(
    (
        Path(__file__).parent.parent.parent
        / "documentation"
        / "schema"
        / "visualization.schema.json"
    ).read_text()
)


def _expected_qft(count: int) -> np.ndarray:
    size = 2**count
    return np.array(
        [
            [np.exp(2j * math.pi * a * b / size) for b in range(size)]
            for a in range(size)
        ]
    ) / math.sqrt(size)


@pytest.mark.parametrize("count", [1, 2, 3])
def test_qft_matches_the_fourier_matrix(count):
    assert Operator(qft(count)).equiv(Operator(_expected_qft(count)))


@pytest.mark.parametrize("count", [1, 2, 3])
def test_inverse_qft_undoes_qft(count):
    circuit = QuantumCircuit(count)
    circuit.compose(qft(count), inplace=True)
    circuit.compose(inverse_qft(count), inplace=True)
    assert Operator(circuit).equiv(Operator(np.eye(2**count, dtype=complex)))


@pytest.mark.parametrize("count", [1, 2, 3])
def test_adder_computes_the_sum(count):
    for a in range(2**count):
        for b in range(2**count):
            circuit = QuantumCircuit(2 * count)
            for index in range(count):
                if (a >> index) & 1:
                    circuit.x(index)
                if (b >> index) & 1:
                    circuit.x(count + index)
            circuit.compose(qft_adder(count), inplace=True)

            state = Statevector(circuit).data
            index = int(np.argmax(np.abs(state) ** 2))
            result_a = index & (2**count - 1)
            result_b = (index >> count) & (2**count - 1)
            assert result_a == (a + b) % 2**count
            assert result_b == b


def test_adder_rejects_zero_count():
    with pytest.raises(ValueError):
        qft_adder(0)


def test_compiled_adder_validates_against_schema(basic_backend):
    circuit = QuantumCircuit(2)
    circuit.x(0)
    circuit.x(1)
    circuit.compose(qft_adder(1), inplace=True)

    data = compile(basic_backend, circuit)
    jsonschema.validate(data, _SCHEMA)
    assert data["total_qubits"] == 2
