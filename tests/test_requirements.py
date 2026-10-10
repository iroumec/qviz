"""Tests that the dependencies of Qollab and of the package stay the same."""

from __future__ import annotations

import tomllib
from pathlib import Path

_ROOT = Path(__file__).parent.parent


def _requirements() -> set[str]:
    lines = (_ROOT / "requirements.txt").read_text().splitlines()
    return {
        line.replace(" ", "")
        for line in lines
        if line.strip() and not line.lstrip().startswith("#")
    }


def _project_dependencies() -> set[str]:
    project = tomllib.loads((_ROOT / "pyproject.toml").read_text())["project"]
    return {dependency.replace(" ", "") for dependency in project["dependencies"]}


def test_requirements_match_pyproject():
    assert _requirements() == _project_dependencies()


def test_requirements_use_only_what_qollab_accepts():
    for line in _requirements():
        assert not line.startswith("-"), "pip options are rejected"
        assert ";" not in line, "environment markers are rejected"
        assert "://" not in line and "@" not in line, "URL requirements are rejected"


def test_qiskit_line_is_the_one_qollab_adds_by_itself():
    assert "qiskit>=2.5.2,<3.0.0" in _requirements()
