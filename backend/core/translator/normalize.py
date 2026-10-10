"""Normalize entangling angles to ``t`` in [0, 0.25] turns.

Both identities are exact up to a global phase, which does not affect Bloch
vectors (``spec.md`` §2d):

- ``ZZ(t + 0.5) = (Z x Z) . ZZ(t)``
- ``MS(p0, p1, t + 0.5) = GPi(p0) x GPi(p1) . MS(p0, p1, t)``
"""

from __future__ import annotations

import math

from backend.core.model import NativeOp


def _wrap(angle: float) -> float:
    """Fold ``angle`` into (-0.5, 0.5] turns (±1 turn is a global phase)."""
    wrapped = (angle + 0.5) % 1.0 - 0.5
    return wrapped


def normalize_zz(targets: tuple[int, ...], angle: float) -> list[NativeOp]:
    """Return native ops implementing ``ZZ(angle)`` with ``|t| <= 0.25``."""
    t = _wrap(angle)
    a = targets[0]
    ops: list[NativeOp] = []

    if abs(t) > 0.25:
        t -= 0.5 * math.copysign(1.0, t)
        for q in targets:
            ops.append(NativeOp("virtual_z", (q,), z_rotation=math.pi))

    if math.isclose(t, 0.0, abs_tol=1e-15):
        return ops

    if t < 0:
        t = -t
        ops.append(NativeOp("gpi", (a,), phases=(0.0,)))
        ops.append(NativeOp("zz", tuple(targets), angle=t))
        ops.append(NativeOp("gpi", (a,), phases=(0.0,)))
        return ops

    ops.append(NativeOp("zz", tuple(targets), angle=t))
    return ops


def normalize_ms(
    targets: tuple[int, ...], phases: tuple[float, float], angle: float
) -> list[NativeOp]:
    """Return native ops implementing ``MS(phases, angle)`` with ``|t| <= 0.25``."""
    t = _wrap(angle)
    a, b = targets
    ops: list[NativeOp] = []

    if abs(t) > 0.25:
        t -= 0.5 * math.copysign(1.0, t)
        ops.append(NativeOp("gpi", (a,), phases=(phases[0],)))
        ops.append(NativeOp("gpi", (b,), phases=(phases[1],)))

    if math.isclose(t, 0.0, abs_tol=1e-15):
        return ops

    if t < 0:
        t = -t
        ops.append(NativeOp("virtual_z", (a,), z_rotation=math.pi))
        ops.append(NativeOp("ms", tuple(targets), phases=tuple(phases), angle=t))
        ops.append(NativeOp("virtual_z", (a,), z_rotation=math.pi))
        return ops

    ops.append(NativeOp("ms", tuple(targets), phases=tuple(phases), angle=t))
    return ops
