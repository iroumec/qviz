"""Tests for the Qollab entry point."""

from __future__ import annotations

import pytest

from backend.core.errors import QVizError
from main import parse_entangler


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
def test_unknown_values_are_rejected(text):
    with pytest.raises(QVizError, match="entangler"):
        parse_entangler(text)
