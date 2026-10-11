"""Pipeline orchestration.

This module is the only place that knows every pipeline stage. It never
imports the ``backend`` injected by Qollab; the caller passes it in.
"""

from __future__ import annotations

from typing import Any

from qiskit import QuantumCircuit

from backend.core.errors import QVizError, UnsupportedProviderError
from backend.core.formatter import formatter
from backend.core.metrics import metrics
from backend.core.model import Entangler, Strategy
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
    strategy: Strategy = "statevector",
    shots: int = 1024,
    allow_paid: bool = False,
    allow_remote: bool = True,
) -> dict:
    """Run the whole pipeline and return the JSON-ready visualization dict.

    The arguments are validated before anything else, so that a typo never
    spends the single IonQ job allowed per run. A backend that is neither IonQ
    nor the built-in simulator is rejected before any transpilation.

    ``allow_remote=False`` never sends the IonQ dry-run job (the circuit is
    transpiled locally), so any number of circuits can be compiled in one run.
    """
    if strategy not in ("statevector", "tomography"):
        raise QVizError(f"unknown strategy {strategy!r}")
    if shots <= 0:
        raise QVizError(f"shots must be positive, got {shots}")

    info = provider.detect(backend, entangler=entangler)
    if info.provider == "unsupported":
        detected = type(backend).__name__
        if info.name:
            detected = f"{info.name} ({detected})"
        raise UnsupportedProviderError(
            f"This machine is not currently supported (detected: {detected}). "
            "Currently supported: IonQ (Aria and Forte), the built-in simulator."
        )
    transpiled = transpiler.transpile(
        info, backend, qc, allow_remote=allow_remote and strategy != "tomography"
    )
    native = translator.translate(info, transpiled)

    if strategy == "tomography":
        simulated = tomography.measure(
            native, backend, info, shots=shots, allow_paid=allow_paid
        )
    else:
        simulated = simulator.simulate(native)

    vectorized = vectorizer.vectorize(simulated)
    measured = metrics.measure(vectorized, info, shots=shots)
    return formatter.format(measured)
