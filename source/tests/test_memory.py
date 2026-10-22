"""Tests that the session hand-over stays usable."""

from __future__ import annotations

from pathlib import Path

_ROOT = Path(__file__).parent.parent.parent
_MEMORY = _ROOT / "documentation" / "internal" / "memory.md"
_MAX_LINES = 150
_SECTIONS = (
    "## Cómo retomar",
    "## Decisiones tomadas",
    "## Pendientes",
    "## Historial",
)


def _memory() -> str:
    return _MEMORY.read_text(encoding="utf-8")


def test_memory_has_the_sections_that_a_new_session_needs():
    text = _memory()
    for section in _SECTIONS:
        assert section in text, f"the memory lost the section {section!r}"


def test_memory_stays_short():
    assert len(_memory().splitlines()) <= _MAX_LINES


def test_claude_and_agents_point_to_the_memory():
    assert "@documentation/internal/memory.md" in (
        _ROOT / "CLAUDE.md"
    ).read_text(encoding="utf-8")
    agents = (_ROOT / "AGENTS.md").read_text(encoding="utf-8")
    assert "documentation/internal/memory.md" in agents
    assert "Memoria del proyecto" in agents
