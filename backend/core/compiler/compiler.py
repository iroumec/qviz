"""Pipeline orchestration.

This module is the only place that knows every pipeline stage. It never
imports the ``backend`` injected by Qollab; the caller passes it in.
"""

from __future__ import annotations

from typing import Any

from qiskit import QuantumCircuit

from backend.core.errors import QVizError
from backend.core.formatter import formatter
from backend.core.metrics import metrics
from backend.core.model import Entangler
from backend.core.provider import provider
from backend.core.simulator import simulator, tomography
from backend.core.translator import translator
from backend.core.transpiler import transpiler
from backend.core.vectorizer import vectorizer


def compile(  # noqa: A001 - public API name
    backend: Any,
    qc: QuantumCircuit,
    *,
    entangler: Entangler | None = None,
    strategy: str = "statevector",
    shots: int = 1024,
    allow_paid: bool = False,
) -> dict:
    """Run the whole pipeline and return the JSON-ready visualization dict."""
    info = provider.detect(backend, entangler=entangler)
    transpiled = transpiler.transpile(
        info, backend, qc, allow_remote=strategy != "tomography"
    )
    native = translator.create(info).translate(transpiled)

    if strategy == "statevector":
        simulated = simulator.simulate(native)
    elif strategy == "tomography":
        simulated = tomography.measure(
            native, backend, info, shots=shots, allow_paid=allow_paid
        )
    else:
        raise QVizError(f"unknown strategy {strategy!r}")

    vectorized = vectorizer.vectorize(simulated)
    measured = metrics.measure(vectorized, info, shots=shots)
    return formatter.format(measured)
