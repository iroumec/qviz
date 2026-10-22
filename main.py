"""Qollab entry point (Python project).

Qollab injects the selected backend as the global ``backend`` and calls
``main`` when its signature is strict. Never ``import backend`` here: that
would shadow the injected global. Local execution is not supported.

Parameters with strict annotations make Qollab render a form in the QPU
dialog (``documentation/internal/qollab_context.md`` §5). The functions are in
``qollab_api.py``, which a JS project can call too.
"""

from __future__ import annotations

import time

from backend import compile, export, sample
from qollab_api import build_circuit, parse_entangler

_MAX_STEPS_PRINTED = 30
_TOP_OUTCOMES = 8


# Qollab needs the whole signature on one line (E501 is ignored for this file).
def main(circuit: str = "bell", shots: int = 1024, entangler: str = "auto", step: int = 0) -> None:
    """Compile an example circuit, then measure one step of it.

    ``circuit`` is bell, ghz3, ghz16 or layered16. ``entangler`` is auto, ms or
    zz. ``step`` is the step to measure; 0 means the last one.
    """
    started = time.perf_counter()
    data = compile(
        backend,  # noqa: F821 - injected by Qollab
        build_circuit(circuit),
        entangler=parse_entangler(entangler),
        shots=shots,
    )
    compiled = time.perf_counter()

    steps = len(data["steps"])
    print(f"backend : {data['backend']}")
    print(f"circuit : {circuit} ({data['total_qubits']} qubits, {steps} steps)")
    print(f"compile : {compiled - started:.2f} s")
    if steps <= _MAX_STEPS_PRINTED:
        print(export(data))
    else:
        print(f"json    : {len(export(data)) / 1000:.0f} kB (not printed)")

    chosen = step if step else steps
    counts = sample(data, chosen, shots)
    measured = time.perf_counter()
    print(f"sample  : step {chosen}, {shots} shots, {measured - compiled:.2f} s")
    for bits, count in list(counts.items())[:_TOP_OUTCOMES]:
        print(f"  {bits}  {count:6d}  {100 * count / shots:5.1f} %")
