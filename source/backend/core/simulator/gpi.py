"""GPi(phi): rotation of pi around a phase-dependent axis.

``GPi(phi) = [[0, e^{-i phi}], [e^{i phi}, 0]]`` with ``phi`` in radians
(``documentation/references/ionq_native_gates.md`` §2.1).
"""

from __future__ import annotations

import cmath

import numpy as np


def matrix(phase: float) -> np.ndarray:
    """Return the 2x2 unitary of ``GPi(phase)`` with ``phase`` in radians."""
    return np.array(
        [
            [0.0, cmath.exp(-1j * phase)],
            [cmath.exp(1j * phase), 0.0],
        ],
        dtype=complex,
    )
