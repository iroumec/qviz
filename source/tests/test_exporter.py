"""Tests for the JSON exporter."""

from __future__ import annotations

import json

import pytest

from backend import export


def test_returns_indented_json():
    text = export({"a": [1, 2]})
    assert json.loads(text) == {"a": [1, 2]}
    assert "\n" in text


def test_keeps_non_ascii_characters():
    assert "→" in export({"backend": "x → iones"})


def test_writes_the_file_when_a_path_is_given(tmp_path):
    path = tmp_path / "out.json"
    text = export({"a": 1}, str(path))
    assert path.read_text(encoding="utf-8") == text


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_rejects_values_that_are_not_valid_json(value):
    with pytest.raises(ValueError):
        export({"x": value})
