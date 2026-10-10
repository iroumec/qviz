"""Tests for the script that gathers the files to upload to Qollab."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).parent.parent / "scripts" / "package_qollab.py"


@pytest.fixture(scope="module")
def packaged(tmp_path_factory):
    spec = importlib.util.spec_from_file_location("package_qollab", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    out = tmp_path_factory.mktemp("qollab")
    return module, out, {str(path) for path in module.package(out)}


def test_the_project_fits_in_the_qollab_limit(packaged):
    module, out, files = packaged
    assert len(files) <= module.MAX_FILES
    assert all((out / name).is_file() for name in files)


def test_it_is_a_js_project_without_main_py(packaged):
    _, _, files = packaged
    assert {"index.html", "main.js", "qollab_api.py", "requirements.txt"} <= files
    assert "main.py" not in files


def test_the_libraries_are_complete(packaged):
    _, _, files = packaged
    assert "backend/__init__.py" in files
    assert "backend/core/sampler/sampler.py" in files
    assert "examples/__init__.py" in files
    assert not any("__pycache__" in name for name in files)
