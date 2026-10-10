"""ZZ(theta): fixed entangler of Forte.

``ZZ(theta) = exp(-i pi theta Z x Z) = diag(e^{-i pi theta}, e^{i pi theta},
e^{i pi theta}, e^{-i pi theta})`` with ``theta`` in turns.
"""

from __future__ import annotations

import cmath
import math

import numpy as np


def matrix(angle: float) -> np.ndarray:
    """Return the 4x4 unitary of ``ZZ(angle)`` with ``angle`` in turns."""
    arg = math.pi * angle
    diag = [
        cmath.exp(-1j * arg),
        cmath.exp(1j * arg),
        cmath.exp(1j * arg),
        cmath.exp(-1j * arg),
    ]
    return np.diag(np.array(diag, dtype=complex))
