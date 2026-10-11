"""GPi2(phi): rotation of pi/2 around a phase-dependent axis.

``GPi2(phi) = 1/sqrt(2) [[1, -i e^{-i phi}], [-i e^{i phi}, 1]]`` with ``phi``
in radians (``documentation/references/ionq_native_gates.md`` §2.2).
"""

from __future__ import annotations

import cmath
import math

import numpy as np


def matrix(phase: float) -> np.ndarray:
    """Return the 2x2 unitary of ``GPi2(phase)`` with ``phase`` in radians."""
    scale = 1.0 / math.sqrt(2.0)
    return scale * np.array(
        [
            [1.0, -1j * cmath.exp(-1j * phase)],
            [-1j * cmath.exp(1j * phase), 1.0],
        ],
        dtype=complex,
    )
