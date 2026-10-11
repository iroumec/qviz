"""Tests for the local server of the viewer (scripts/server.py)."""

from __future__ import annotations

import http.client
import importlib.util
import json
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).parent.parent.parent / "resources" / "scripts" / "server.py"
_BELL = (
    'OPENQASM 3.0;\ninclude "stdgates.inc";\n'
    "qubit[2] q; h q[0]; cx q[0], q[1];"
)


@pytest.fixture(scope="module")
def base():
    spec = importlib.util.spec_from_file_location("server", _SCRIPT)
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


@pytest.mark.parametrize("length", ["-1", "abc"])
def test_a_bad_content_length_is_a_400(base, length):
    host, port = base.removeprefix("http://").split(":")
    connection = http.client.HTTPConnection(host, int(port), timeout=10)
    connection.putrequest("POST", "/api/compile")
    connection.putheader("Content-Length", length)
    connection.endheaders()
    response = connection.getresponse()
    assert response.status == 400
    assert "Content-Length" in json.loads(response.read())["error"]
    connection.close()


def test_other_services_do_not_exist(base):
    status, data = _post(base + "/api/other", _BELL)
    assert status == 404


def test_the_root_goes_to_the_viewer_and_the_files_are_served(base):
    with urllib.request.urlopen(base + "/") as response:
        assert response.url.endswith("/source/frontend/index.html")
        assert b"Cargar circuito" in response.read()
    with urllib.request.urlopen(base + "/source/shaders/bloch.frag") as response:
        assert response.status == 200
        assert response.headers["Cache-Control"] == "no-store"


def _counts(base, data, step, shots):
    status, reply = _post(
        f"{base}/api/sample?step={step}&shots={shots}", json.dumps(data)
    )
    assert status == 200
    return dict(reply)


def test_it_measures_with_the_correlations_of_the_entanglement(base):
    _, data = _post(base + "/api/compile", _BELL)
    final = _counts(base, data, len(data["steps"]), 2000)
    assert sum(final.values()) == 2000
    # A Bell pair gives 00 and 11: independent qubits would give 25 % of each.
    assert final.get("00", 0) + final.get("11", 0) > 1900
    assert final.get("01", 0) + final.get("10", 0) < 100


def test_it_measures_the_initial_state(base):
    _, data = _post(base + "/api/compile", _BELL)
    assert _counts(base, data, 0, 500)["00"] > 450


def test_the_measurement_is_the_one_of_qollab(base):
    import qollab_api

    _, data = _post(base + "/api/compile", _BELL)
    expected = dict(json.loads(qollab_api.sample_step(json.dumps(data), 4, 3000)))
    got = _counts(base, data, 4, 3000)
    for bits in ("01", "10"):
        assert abs(got[bits] - expected[bits]) < 300  # about 50 % each, both


def test_a_bad_measurement_is_a_400(base):
    _, data = _post(base + "/api/compile", _BELL)
    for query in ("step=999&shots=10", "step=1&shots=0", "step=x&shots=10"):
        status, reply = _post(f"{base}/api/sample?{query}", json.dumps(data))
        assert status == 400 and reply["error"]
    status, reply = _post(base + "/api/sample?step=1&shots=10", "not json")
    assert status == 400
