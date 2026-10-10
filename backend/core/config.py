"""Tunable configuration parameters of the backend.

These values describe a policy, not a law. They may be adjusted without breaking
the mathematics of the library. The values that must never change are kept in
``constants.py``.
"""

from __future__ import annotations

from backend.core.model import Provider

ENABLED_PROVIDERS: frozenset[Provider] = frozenset({"ionq", "local"})
"""Providers that ``compile`` accepts; any other backend is rejected up front.

Only IonQ (the target machines) and the local simulators are inside the MVP.
IBM, AWS and unknown backends are switched off because their circuits go through
a chip-specific transpilation (coupling map, routing) that does not make sense
for trapped ions and can permute the qubit labels (``spec.md`` §11, item 6). To
try one of them, add its name here (``"ibm"``, ``"aws"`` or ``"unknown"``). The
provider detection itself never fails: only ``compile`` applies this list.
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

REMOTE_JOB_TIMEOUT_S: float = 60.0
"""Seconds to wait for the IonQ dry-run job before falling back to a local transpile."""
