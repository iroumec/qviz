"""Tests that memory.md, the hand-over between sessions, stays usable."""

from __future__ import annotations

from pathlib import Path

_ROOT = Path(__file__).parent.parent
_MAX_LINES = 150
_SECTIONS = (
    "## Cómo retomar",
    "## Decisiones tomadas",
    "## Pendientes",
    "## Historial",
)


def _memory() -> str:
    return (_ROOT / "memory.md").read_text(encoding="utf-8")


def test_memory_has_the_sections_that_a_new_session_needs():
    text = _memory()
    for section in _SECTIONS:
        assert section in text, f"memory.md lost the section {section!r}"


def test_memory_stays_short():
    assert len(_memory().splitlines()) <= _MAX_LINES


def test_claude_and_agents_point_to_the_memory():
    assert "@memory.md" in (_ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    agents = (_ROOT / "AGENTS.md").read_text(encoding="utf-8")
    assert "memory.md" in agents and "Memoria del proyecto" in agents
