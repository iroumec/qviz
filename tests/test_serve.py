"""Tests for the local server of the viewer."""

from __future__ import annotations

import importlib.util
import json
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).parent.parent / "scripts" / "serve.py"
_BELL = (
    'OPENQASM 3.0;\ninclude "stdgates.inc";\n'
    "qubit[2] q; h q[0]; cx q[0], q[1];"
)


@pytest.fixture(scope="module")
def base():
    spec = importlib.util.spec_from_file_location("serve", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    server = module.make_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()


def _post(url: str, body: str):
    request = urllib.request.Request(url, data=body.encode(), method="POST")
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())


def test_it_compiles_an_openqasm_circuit(base):
    status, data = _post(base + "/api/compile?shots=256", _BELL)
    assert status == 200
    assert data["total_qubits"] == 2 and data["steps"]


def test_it_passes_the_entangler_through(base):
    status, data = _post(base + "/api/compile?entangler=zz", _BELL)
    assert status == 200
    assert any(step["operation"] == "zz" for step in data["steps"])


@pytest.mark.parametrize(
    "body, text",
    [
        ("not a circuit", "OPENQASM"),
        (_BELL.replace("h q[0];", "opaque g a; g q[0];"), "opaque"),
        ('OPENQASM 3.0;\nqubit q; reset q;', "reset"),
    ],
)
def test_a_bad_circuit_is_a_400_with_the_reason(base, body, text):
    status, data = _post(base + "/api/compile", body)
    assert status == 400
    assert text in data["error"]


def test_a_bad_parameter_is_a_400(base):
    status, data = _post(base + "/api/compile?shots=abc", _BELL)
    assert status == 400
    status, data = _post(base + "/api/compile?entangler=xx", _BELL)
    assert status == 400 and "entangler" in data["error"]


def test_a_huge_file_is_rejected(base):
    status, data = _post(base + "/api/compile", " " * 500_000)
    assert status == 413


def test_other_services_do_not_exist(base):
    status, data = _post(base + "/api/other", _BELL)
    assert status == 404


def test_the_root_goes_to_the_viewer_and_the_files_are_served(base):
    with urllib.request.urlopen(base + "/") as response:
        assert response.url.endswith("/frontend/index.html")
        assert b"Cargar circuito" in response.read()
    with urllib.request.urlopen(base + "/shaders/bloch.frag") as response:
        assert response.status == 200
        assert response.headers["Cache-Control"] == "no-store"
