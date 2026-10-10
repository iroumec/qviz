"""Fixed constants of the backend.

These values are mathematical or structural. They are part of the definition of
the project and are **never** changed at runtime. Parameters that a user or a
maintainer may want to tune are kept in ``config.py`` instead.
"""

from __future__ import annotations

import math

TWO_PI: float = 2.0 * math.pi
"""A full turn, in radians. Used for the turns-to-radians conversion."""

NATIVE_OPS = ("gpi", "gpi2", "ms", "zz", "virtual_z")
"""The names of the allowed native operations."""
