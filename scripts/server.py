"""Serve the viewer locally, with the Python services that Qollab gives it.

Without Qollab there is no Python in the page, so the viewer could neither compile
the circuit that a person loads nor measure it. This server serves the repository
(the viewer, the shaders, the model and ``out/``) and gives the viewer the same two
services, with the same code that Qollab runs (``qollab_api``) on the built-in
simulator. It is a tool for development, not for Qollab.

- ``POST /api/compile``: the body is the OpenQASM text; the optional query
  ``shots`` and ``entangler`` (``auto``, ``ms`` or ``zz``) are the ones of
  ``run_qasm``. The reply is the JSON of the visualization.
- ``POST /api/sample``: the body is that JSON; the query has ``step`` and
  ``shots``. The reply is the list of ``[bitstring, count]`` pairs of
  ``sample_step``, drawn from the statevector, so the entanglement is kept.

An error is ``{"error": "..."}`` with the status 400 (the request is not valid) or
500 (something unexpected).

Run with: python scripts/server.py [--port 8000] [--host 127.0.0.1]   (or: make server)
"""

from __future__ import annotations

import argparse
import json
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from qiskit.providers.basic_provider import BasicSimulator  # noqa: E402

import qollab_api  # noqa: E402
from backend.core import config  # noqa: E402
from backend.core.errors import QVizError  # noqa: E402

COMPILE_PATH = "/api/compile"
SAMPLE_PATH = "/api/sample"
MAX_SAMPLE_BYTES = 64_000_000
VIEWER_PATH = "/frontend/index.html"


class Handler(SimpleHTTPRequestHandler):
    """Static files of the repository, plus the compiler of circuits."""

    backend: Any = None

    def end_headers(self) -> None:
        """Ask the browser not to cache, so that every edit is seen on reload."""
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802 - name fixed by http.server
        """Send the viewer for ``/`` and the file for any other path."""
        if urlparse(self.path).path == "/":
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", VIEWER_PATH)
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - name fixed by http.server
        """Run the service named by the path on the body of the request."""
        url = urlparse(self.path)
        if url.path not in (COMPILE_PATH, SAMPLE_PATH):
            self._reply(HTTPStatus.NOT_FOUND, {"error": f"no such service: {url.path}"})
            return
        compiling = url.path == COMPILE_PATH
        length = int(self.headers.get("Content-Length") or 0)
        if length > (2 * config.MAX_QASM_CHARS if compiling else MAX_SAMPLE_BYTES):
            self._reply(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "body too big"})
            return
        text = self.rfile.read(length).decode("utf-8", errors="replace")
        query = parse_qs(url.query)
        shots = query.get("shots", ["1024"])[0]
        try:
            if compiling:
                body = qollab_api.run_qasm(
                    self.backend, text, int(shots), query.get("entangler", ["auto"])[0]
                )
            else:
                body = qollab_api.sample_step(
                    text, int(query.get("step", ["0"])[0]), int(shots)
                )
        except (QVizError, ValueError) as error:
            self._reply(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:  # noqa: BLE001 - a bug must not stop the server
            self._reply(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": f"{type(error).__name__}: {error}"},
            )
        else:
            self._reply(HTTPStatus.OK, body)

    def _reply(self, status: HTTPStatus, body: dict | str) -> None:
        payload = (body if isinstance(body, str) else json.dumps(body)).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def make_server(host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    """Return the server, not started. ``port=0`` picks a free port."""
    handler = type("QVizHandler", (Handler,), {"backend": BasicSimulator()})

    def build(*args: Any, **kwargs: Any) -> Handler:
        return handler(*args, directory=str(ROOT), **kwargs)

    return ThreadingHTTPServer((host, port), build)


def main() -> None:
    """Parse the arguments and serve until Ctrl+C."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    server = make_server(args.host, args.port)
    print(f"QViz viewer: http://{args.host}:{server.server_port}{VIEWER_PATH}")
    print("Circuits (OpenQASM) are compiled on the built-in simulator. Ctrl+C stops.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
