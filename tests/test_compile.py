"""End-to-end tests: compile -> schema, golden file and export."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import jsonschema
import pytest

from backend import compile, export
from backend.core import config
from backend.core.errors import ProviderDisabledError, QVizError
from tests.circuits import ALL_CIRCUITS, bell

_SCHEMA_PATH = (
    Path(__file__).parent.parent
    / "documentation"
    / "schema"
    / "visualization.schema.json"
)
_SCHEMA = json.loads(_SCHEMA_PATH.read_text())
_GOLDEN = Path(__file__).parent / "golden" / "bell_basic.json"


def _assert_lengths(data: dict) -> None:
    num_qubits = data["total_qubits"]
    for step in data["steps"]:
        assert len(step["states"]) == num_qubits
        assert len(step["probabilities"]) == num_qubits
        assert len(step["vibration"]) == num_qubits
        assert len(step["virtual_z"]) == num_qubits
        assert len(step["inactivity"]) == num_qubits
        assert len(step["fidelities"]) == num_qubits


def _assert_no_null(value) -> None:
    if isinstance(value, dict):
        for item in value.values():
            _assert_no_null(item)
    elif isinstance(value, list):
        for item in value:
            _assert_no_null(item)
    else:
        assert value is not None


@pytest.mark.parametrize("factory", list(ALL_CIRCUITS.values()), ids=list(ALL_CIRCUITS))
def test_compile_validates_against_schema(factory, basic_backend):
    data = compile(basic_backend, factory())
    jsonschema.validate(data, _SCHEMA)
    _assert_lengths(data)
    _assert_no_null(data)


def test_schema_width_matches_the_qubit_cap():
    assert _SCHEMA["properties"]["total_qubits"]["maximum"] == config.MAX_QUBITS


def test_bell_golden(basic_backend):
    data = compile(basic_backend, bell())
    assert data == json.loads(_GOLDEN.read_text())


def test_export_roundtrip(basic_backend):
    data = compile(basic_backend, bell())
    assert json.loads(export(data)) == data


def test_export_has_no_negative_zero(basic_backend):
    data = compile(basic_backend, bell())
    assert "-0.0" not in export(data)


def test_export_inlines_simple_arrays(basic_backend):
    text = export(compile(basic_backend, bell()))
    # A simple array is written on one line.
    assert '"states": [[0.0, 0.0, 1.0], [0.0, 0.0, 1.0]]' in text
    assert '"targets": [0]' in text
    assert '"probabilities": [[1.0, 0.0], [1.0, 0.0]]' in text
    # Objects stay indented.
    assert '{\n      "step": 1,' in text


def test_shots_scale_cost(basic_backend):
    cheap = compile(basic_backend, bell(), shots=100)
    pricey = compile(basic_backend, bell(), shots=1000)
    assert (
        pricey["steps"][-1]["cumulative_cost"]
        > cheap["steps"][-1]["cumulative_cost"]
    )


def test_entangler_forced_zz(basic_backend):
    data = compile(basic_backend, bell(), entangler="zz")
    operations = {step["operation"] for step in data["steps"]}
    assert "zz" in operations
    assert "ms" not in operations


def test_entangler_forced_ms(basic_backend):
    data = compile(basic_backend, bell(), entangler="ms")
    operations = {step["operation"] for step in data["steps"]}
    assert "ms" in operations
    assert "zz" not in operations


def test_ibm_backend_is_compacted(all_providers, heron_backend):
    data = compile(heron_backend, bell())
    assert data["total_qubits"] == 2
    assert "referencia Aria" in data["backend"]


def test_only_ionq_and_local_are_enabled_by_default():
    assert config.ENABLED_PROVIDERS == {"ionq", "local"}


class _UnknownBackend:
    name = "mystery_qpu"


@pytest.mark.parametrize("strategy", ["statevector", "tomography"])
def test_disabled_provider_is_rejected_before_any_work(heron_backend, strategy):
    heron_backend.run = MagicMock()
    with pytest.raises(ProviderDisabledError, match="'ibm'.*ENABLED_PROVIDERS"):
        compile(heron_backend, bell(), strategy=strategy)
    heron_backend.run.assert_not_called()


def test_unknown_provider_is_disabled_by_default():
    with pytest.raises(ProviderDisabledError, match="'unknown'"):
        compile(_UnknownBackend(), bell())


def test_a_disabled_provider_can_be_switched_on(all_providers):
    data = compile(_UnknownBackend(), bell())
    assert data["total_qubits"] == 2


def test_local_and_ionq_backends_stay_enabled(basic_backend):
    assert compile(basic_backend, bell())["total_qubits"] == 2


def test_invalid_strategy_raises_before_touching_the_backend():
    backend = MagicMock()
    backend.name = "ionq_simulator"
    with pytest.raises(QVizError, match="unknown strategy"):
        compile(backend, bell(), strategy="bogus")  # type: ignore[arg-type]
    backend.run.assert_not_called()


@pytest.mark.parametrize("shots", [0, -5])
@pytest.mark.parametrize("strategy", ["statevector", "tomography"])
def test_non_positive_shots_raise(basic_backend, strategy, shots):
    with pytest.raises(QVizError, match="shots"):
        compile(basic_backend, bell(), strategy=strategy, shots=shots)
