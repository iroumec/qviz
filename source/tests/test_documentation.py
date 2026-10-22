"""Tests that the public documentation keeps its local links working."""

from __future__ import annotations

import re
from pathlib import Path

_ROOT = Path(__file__).parent.parent.parent
_DOCS = _ROOT / "documentation"
_LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
_IGNORED = (".venv", "_book", ".quarto", ".git")


def _text_files() -> list[Path]:
    files = [
        _ROOT / "README.md",
        _ROOT / "AGENTS.md",
        _ROOT / "documentation" / "internal" / "memory.md",
    ]
    files += list(_DOCS.rglob("*.qmd"))
    files += list(_DOCS.rglob("*.md"))
    return [
        path
        for path in files
        if path.is_file() and not any(part in _IGNORED for part in path.parts)
    ]


def _local_targets(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    targets = []
    for match in _LINK.finditer(text):
        target = match.group(1).split("#", 1)[0].strip()
        if not target or target.startswith(("#", "/", "mailto:")):
            continue
        if "://" in target:
            continue
        targets.append(target)
    return targets


def test_every_local_link_of_the_documentation_exists():
    missing = []
    for path in _text_files():
        for target in _local_targets(path):
            resolved = (path.parent / target).resolve()
            if not resolved.exists():
                missing.append(f"{path.relative_to(_ROOT)} -> {target}")
    assert not missing, "\n".join(sorted(missing))


def test_the_internal_notes_are_public_and_not_inside_the_book():
    internal = _DOCS / "internal"
    assert (internal / "spec.md").is_file()
    assert (internal / "README.md").is_file()
    # The published book only lists documentation/docs in _quarto.yml.
    config = (_DOCS / "_quarto.yml").read_text(encoding="utf-8")
    assert "internal/" not in config


def test_every_chapter_listed_in_the_quarto_config_exists():
    config = (_DOCS / "_quarto.yml").read_text(encoding="utf-8")
    chapters = [
        line.strip()[2:].strip()
        for line in config.splitlines()
        if line.strip().startswith("- ") and line.strip().endswith(".qmd")
    ]
    assert chapters
    missing = [name for name in chapters if not (_DOCS / name).is_file()]
    assert not missing, missing
