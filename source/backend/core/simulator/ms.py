"""MS(phi0, phi1, theta): Molmer-Sorensen entangler (Aria).

``MS(phi0, phi1, theta) = exp(-i pi theta sigma_phi0 x sigma_phi1)`` with
phases in radians and ``theta`` in turns. The 4x4 matrix is written in the
big-endian basis of the reference (first qubit is the most significant); the
simulator applies it to the target axes in order.
"""

from __future__ import annotations

import cmath
import math

import numpy as np


def matrix(phase0: float, phase1: float, angle: float) -> np.ndarray:
    """Return the 4x4 unitary of ``MS(phase0, phase1, angle)``."""
    theta = math.pi * angle
    c = math.cos(theta)
    s = math.sin(theta)
    ep = -1j * cmath.exp(-1j * (phase0 + phase1)) * s
    em = -1j * cmath.exp(-1j * (phase0 - phase1)) * s
    epc = -1j * cmath.exp(1j * (phase0 + phase1)) * s
    emc = -1j * cmath.exp(1j * (phase0 - phase1)) * s
    return np.array(
        [
            [c, 0.0, 0.0, ep],
            [0.0, c, em, 0.0],
            [0.0, emc, c, 0.0],
            [epc, 0.0, 0.0, c],
        ],
        dtype=complex,
    )
