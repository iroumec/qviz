"""Tunable configuration parameters of the backend.

These values describe a policy, not a law. They may be adjusted without breaking
the mathematics of the library. The values that must never change are kept in
``constants.py``.
"""

from __future__ import annotations

MAX_QASM_CHARS: int = 200_000
"""Longest OpenQASM text that ``importer.load_circuit`` reads.

A 16-qubit circuit of thousands of gates fits; anything longer is more likely a
wrong file than a circuit a person can follow step by step.
"""

MAX_QUBITS: int = 16
"""Hard cap on the circuit width.

The statevector needs ``2**n`` complex numbers and every step touches all of
them, so memory and time grow exponentially with ``n`` (a 28-qubit state alone
takes 4 GiB). Beyond ~16 qubits the Bloch spheres are also too many to read in
a visualizer, so the cap is a usability limit as much as a resource one.

The limit is also read from the backend when the backend exposes its own number
of qubits; the effective limit is the smaller of the two. See
``transpiler._effective_max_qubits``.
"""

MAX_STEPS_WARNING: int = 500
"""If a circuit produces more native steps than this, a warning is logged."""

VIBRATION_THRESHOLD: float = 0.01
"""Minimum per-qubit error before it is reported as vibration."""

JSON_DECIMALS: int = 6
"""Number of decimals used when serializing floating point values."""

MAX_SAMPLE_SHOTS: int = 100_000
"""Largest number of shots that ``sampler.sample`` accepts in one call."""

REMOTE_JOB_TIMEOUT_S: float = 60.0
"""Seconds to wait for the IonQ dry-run job before falling back to a local transpile."""
