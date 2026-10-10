"""VirtualZ(rotation): phase rotation implemented as ``RZ``.

The intermediate representation stores the rotation in radians, so the matrix
is ``RZ(rotation) = diag(e^{-i rotation/2}, e^{i rotation/2})``.
"""

from __future__ import annotations

import cmath

import numpy as np


def matrix(rotation: float) -> np.ndarray:
    """Return the 2x2 unitary ``RZ(rotation)`` with ``rotation`` in radians."""
    return np.array(
        [
            [cmath.exp(-0.5j * rotation), 0.0],
            [0.0, cmath.exp(0.5j * rotation)],
        ],
        dtype=complex,
    )
