"""Tests for the Qollab entry point and the functions its pages call."""

from __future__ import annotations

import json

import pytest

import main
import qollab_api
from backend.core.errors import QVizError
from qollab_api import (
    CIRCUITS,
    build_circuit,
    parse_entangler,
    run,
    sample_step,
)


@pytest.mark.parametrize("text", ["auto", "AUTO", " auto ", "", None])
def test_auto_lets_the_backend_choose(text):
    assert parse_entangler(text) is None


@pytest.mark.parametrize(
    ("text", "expected"),
    [("ms", "ms"), ("MS", "ms"), (" zz ", "zz"), ("ZZ", "zz")],
)
def test_ms_and_zz_force_the_entangler(text, expected):
    assert parse_entangler(text) == expected


@pytest.mark.parametrize("text", ["forte", "mz", "1", "none"])
def test_unknown_entangler_values_are_rejected(text):
    with pytest.raises(QVizError, match="entangler"):
        parse_entangler(text)


@pytest.mark.parametrize("name", list(CIRCUITS))
def test_every_example_circuit_builds(name):
    assert build_circuit(name).num_qubits >= 2


def test_unknown_circuit_is_rejected():
    with pytest.raises(QVizError, match="circuit"):
        build_circuit("nope")


def test_versions_lists_the_main_libraries():
    found = json.loads(qollab_api.versions())
    assert set(found) == {"qiskit", "qiskit-ionq", "numpy"}
    assert all(isinstance(value, str) and value for value in found.values())


def test_run_returns_json_text(basic_backend):
    text = run(basic_backend, "bell", 256)
    assert isinstance(text, str)
    assert json.loads(text)["total_qubits"] == 2


def test_sample_step_returns_json_counts(basic_backend):
    text = run(basic_backend, "bell", 256)
    reply = sample_step(text, 0, 300)
    assert isinstance(reply, str)
    counts = dict(json.loads(reply))
    assert sum(counts.values()) == 300
    assert counts["00"] > 280  # only the state-preparation error flips a bit
    counts = dict(json.loads(sample_step(text, 7, 2000)))
    assert sum(counts.values()) == 2000
    assert counts["00"] + counts["11"] > 1900


def test_sample_step_keeps_the_order_in_a_list_of_pairs(basic_backend):
    text = run(basic_backend, "bell", 256)
    pairs = json.loads(sample_step(text, 7, 1000))
    assert all(isinstance(pair, list) and len(pair) == 2 for pair in pairs)
    counts = [count for _, count in pairs]
    assert counts == sorted(counts, reverse=True)


def test_javascript_numbers_are_accepted(basic_backend):
    text = run(basic_backend, "bell", 256.0)
    assert sum(count for _, count in json.loads(sample_step(text, 7.0, 10.0))) == 10


def test_main_prints_the_counts(basic_backend, monkeypatch, capsys):
    monkeypatch.setattr(main, "backend", basic_backend, raising=False)
    main.main("bell", 500, "auto", 0)
    output = capsys.readouterr().out
    assert "circuit : bell (2 qubits, 7 steps)" in output
    assert "sample  : step 7, 500 shots" in output
    assert "  00 " in output and "  11 " in output


def test_main_does_not_print_a_huge_json(basic_backend, monkeypatch, capsys):
    monkeypatch.setattr(main, "backend", basic_backend, raising=False)
    main.main("ghz16", 100, "auto", 3)
    output = capsys.readouterr().out
    assert "not printed" in output
    assert "step 3" in output


def test_the_api_module_never_imports_the_injected_backend():
    source = open(qollab_api.__file__, encoding="utf-8").read()
    assert "\nimport backend" not in source
