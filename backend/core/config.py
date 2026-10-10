"""Tunable configuration parameters of the backend.

These values describe a policy, not a law. They may be adjusted without breaking
the mathematics of the library. The values that must never change are kept in
``constants.py``.
"""

from __future__ import annotations

MAX_QUBITS: int = 28
"""Hard cap on the circuit width.

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
