"""Global constants and thresholds shared by the pipeline."""

from __future__ import annotations

import math

MAX_QUBITS: int = 16
"""Hard limit on circuit width. Above this a ``CircuitTooLargeError`` is raised."""

MAX_STEPS_WARNING: int = 500
"""If a circuit produces more native steps than this, a warning is logged."""

VIBRATION_THRESHOLD: float = 0.01
"""Minimum per-qubit error before it is reported as vibration."""

JSON_DECIMALS: int = 6
"""Number of decimals used when serializing floating point values."""

TWO_PI: float = 2.0 * math.pi
"""A full turn in radians."""

NATIVE_OPS = ("gpi", "gpi2", "ms", "zz", "virtualz")
"""Names of the allowed native operations."""
