"""Didactic noise profiles of the reference trapped-ion machines.

The numbers are order-of-magnitude estimates gathered from public IonQ
material and AWS Braket / Azure price pages. They are **not** a calibrated
noise model: ``spec.md`` calls this a simple didactic model. They must be
refreshed before the demo, and ``spec.md`` §10 marks the calibration route as
**[a verificar]** once ``backend.calibration()`` behaviour in Qollab is known.

Per-gate fidelities and the SPAM error are taken from the IonQ Aria and Forte
spec sheets (2023-2024). Prices are illustrative USD per gate-shot chosen so
that the example in ``spec.md`` §6 (``acumulative_cost`` = 0.0003 for one
single-qubit gate at 1024 shots) is reproduced.
"""

from __future__ import annotations

from backend.core.model import NoiseProfile

ARIA = NoiseProfile(
    spam_error=0.005,
    fidelity_1q=0.9998,
    fidelity_2q=0.995,
    idle_error_per_step=0.0001,
    price_1q=0.0003 / 1024,
    price_2q=4 * 0.0003 / 1024,
)

FORTE = NoiseProfile(
    spam_error=0.004,
    fidelity_1q=0.9997,
    fidelity_2q=0.994,
    idle_error_per_step=0.0001,
    price_1q=0.0003 / 1024,
    price_2q=4 * 0.0003 / 1024,
)

IDEAL = NoiseProfile(
    spam_error=0.0,
    fidelity_1q=1.0,
    fidelity_2q=1.0,
    idle_error_per_step=0.0,
    price_1q=0.0,
    price_2q=0.0,
)

PROFILES = {
    "aria": ARIA,
    "forte": FORTE,
    "ideal": IDEAL,
}


def get_profile(machine: str) -> NoiseProfile:
    """Return the noise profile for a reference machine name."""
    return PROFILES[machine]


def profile_for(provider: str, name: str, entangler: str) -> NoiseProfile:
    """Pick a profile from the provider, backend name and entangler.

    IonQ uses the profile of the named machine (``aria``/``forte``/``ideal``);
    every other provider falls back to the reference machine of its entangler
    (MS -> Aria, ZZ -> Forte), because the visualizer always shows the circuit
    *as if* it ran on trapped ions.
    """
    lowered = name.lower()
    if "ideal" in lowered:
        return IDEAL
    if "forte" in lowered:
        return FORTE
    if "aria" in lowered:
        return ARIA
    return FORTE if entangler == "zz" else ARIA
