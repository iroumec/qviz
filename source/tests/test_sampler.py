"""Tests for the sampler: exact joint distributions and noisy sampling."""

from __future__ import annotations

import copy

import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

from backend import compile, sample
from backend.core import config
from backend.core.errors import QVizError
from backend.core.sampler import sampler
from examples import ghz, layered, qft_adder
from tests.circuits import ALL_CIRCUITS, bell, ghz3

_SEED = 20261010


def _noiseless(data: dict) -> dict:
    """Return a copy of ``data`` in which every fidelity is 100 %."""
    clean = copy.deepcopy(data)
    clean["initial_fidelity"] = 100.0
    for step in clean["steps"]:
        step["fidelities"] = [100.0] * clean["total_qubits"]
    return clean


def _marginal_p1(joint: np.ndarray, qubit: int) -> float:
    indices = np.arange(len(joint))
    return float(joint[(indices >> qubit) & 1 == 1].sum())


@pytest.fixture
def bell_data(basic_backend):
    return compile(basic_backend, bell())


@pytest.mark.parametrize("name", list(ALL_CIRCUITS))
def test_joint_matches_the_marginals_of_every_step(name, basic_backend):
    data = compile(basic_backend, ALL_CIRCUITS[name]())
    for number, step in enumerate(data["steps"], start=1):
        joint = sampler.probabilities(data, number)
        assert joint.sum() == pytest.approx(1.0, abs=1e-9)
        for qubit, (_, p1) in enumerate(step["probabilities"]):
            assert _marginal_p1(joint, qubit) == pytest.approx(p1, abs=1e-5)


@pytest.mark.parametrize(
    "circuit",
    [bell(), ghz3(), ghz(5), layered(4, depth=3), qft_adder(2)],
    ids=["bell", "ghz3", "ghz5", "layered4", "adder2"],
)
def test_final_joint_matches_the_statevector_of_the_circuit(circuit, basic_backend):
    data = compile(basic_backend, circuit)
    expected = np.abs(Statevector(circuit).data) ** 2
    joint = sampler.probabilities(data, len(data["steps"]))
    assert np.allclose(joint, expected, atol=1e-5)


def test_initial_step_is_all_zeros(bell_data):
    assert sampler.probabilities(bell_data, 0)[0] == 1.0
    assert sample(_noiseless(bell_data), 0, 50, seed=_SEED) == {"00": 50}


def test_bell_only_gives_00_and_11_without_noise(bell_data):
    counts = sample(_noiseless(bell_data), len(bell_data["steps"]), 4000, seed=_SEED)
    assert set(counts) == {"00", "11"}
    assert abs(counts["00"] - 2000) < 5 * np.sqrt(4000) / 2


def test_noise_leaks_a_few_wrong_outcomes(bell_data):
    counts = sample(bell_data, len(bell_data["steps"]), 20000, seed=_SEED)
    wrong = counts.get("01", 0) + counts.get("10", 0)
    assert 0 < wrong < 0.1 * 20000


def test_zero_fidelity_gives_a_uniform_distribution(bell_data):
    data = _noiseless(bell_data)
    data["steps"][-1]["fidelities"] = [0.0, 0.0]
    counts = sample(data, len(data["steps"]), 8000, seed=_SEED)
    assert set(counts) == {"00", "01", "10", "11"}
    tolerance = 5 * np.sqrt(8000 * 0.25 * 0.75)
    assert all(abs(value - 2000) < tolerance for value in counts.values())


def test_qubit_zero_is_the_rightmost_bit(basic_backend):
    qc = QuantumCircuit(3)
    qc.x(0)
    data = _noiseless(compile(basic_backend, qc))
    assert sample(data, len(data["steps"]), 20, seed=_SEED) == {"001": 20}


def test_wide_ghz_only_gives_the_two_extremes(basic_backend):
    data = _noiseless(compile(basic_backend, ghz(16)))
    counts = sample(data, len(data["steps"]), 500, seed=_SEED)
    assert set(counts) == {"0" * 16, "1" * 16}


def test_counts_are_sorted_and_add_up(bell_data):
    counts = sample(bell_data, len(bell_data["steps"]), 1000, seed=_SEED)
    assert sum(counts.values()) == 1000
    assert list(counts.values()) == sorted(counts.values(), reverse=True)


def test_same_seed_same_counts_and_the_input_is_untouched(bell_data):
    snapshot = copy.deepcopy(bell_data)
    last = len(bell_data["steps"])
    first = sample(bell_data, last, 1000, seed=7)
    assert sample(bell_data, last, 1000, seed=7) == first
    assert sample(bell_data, last, 1000, seed=8) != first
    assert bell_data == snapshot


@pytest.mark.parametrize("step", [-1, 99, 1.5, "2", True, None])
def test_invalid_step_raises(bell_data, step):
    with pytest.raises(QVizError, match="step"):
        sample(bell_data, step, 10)


@pytest.mark.parametrize("shots", [0, -1, config.MAX_SAMPLE_SHOTS + 1, 2.5, "10"])
def test_invalid_shots_raise(bell_data, shots):
    with pytest.raises(QVizError, match="shots"):
        sample(bell_data, 1, shots)


def _broken(change):
    def build(data):
        data = copy.deepcopy(data)
        change(data)
        return data

    return build


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d["steps"][1].update(operation="swap"),
        lambda d: d["steps"][1].update(targets=[5]),
        lambda d: d["steps"][1].update(targets=[0, 0]),
        lambda d: d["steps"][1].update(targets=[0, 1]),
        lambda d: d["steps"][1].pop("phases"),
        lambda d: d["steps"][1].update(phases=["x"]),
        lambda d: d["steps"][1].update(virtual_z=[0.0]),
        lambda d: d["steps"][1].update(virtual_z=[float("nan"), 0.0]),
        lambda d: d["steps"].__setitem__(1, "not a step"),
        lambda d: d.update(steps="nope"),
        lambda d: d.update(total_qubits=0),
        lambda d: d["steps"][-1].pop("fidelities"),
    ],
)
def test_malformed_data_raises(bell_data, mutate):
    data = _broken(mutate)(bell_data)
    with pytest.raises(QVizError, match="malformed"):
        sample(data, len(data["steps"]), 10)


def test_data_must_be_a_dictionary():
    with pytest.raises(QVizError, match="malformed"):
        sample([1, 2, 3], 0, 10)


def test_too_wide_data_is_rejected(bell_data):
    data = copy.deepcopy(bell_data)
    data["total_qubits"] = config.MAX_QUBITS + 1
    with pytest.raises(QVizError, match="qubits"):
        sample(data, 0, 10)


def test_sample_accepts_a_precomputed_distribution(bell_data):
    step = len(bell_data["steps"])
    ideal = sampler.probabilities(bell_data, step)
    assert sample(bell_data, step, 500, seed=_SEED) == sample(
        bell_data, step, 500, seed=_SEED, ideal=ideal
    )
