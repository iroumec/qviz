"""Provider detection.

Turns any injected ``backend`` object into a :class:`BackendInfo` without ever
raising for an unexpected provider: unknown backends fall back to a generic
profile (``spec.md`` §M1b).
"""

from __future__ import annotations

from typing import Any

from backend.core.model import BackendInfo, Entangler, Provider
from backend.core.provider import profiles


def _module_of(backend: Any) -> str:
    return (getattr(type(backend), "__module__", "") or "").lower()


def _type_name(backend: Any) -> str:
    return (getattr(type(backend), "__name__", "") or "").lower()


def _name_of(backend: Any) -> str:
    return str(getattr(backend, "name", "") or "")


def detect_provider(backend: Any) -> Provider:
    """Classify the injected backend into one of the known providers."""
    module = _module_of(backend)
    name = _name_of(backend).lower()
    type_name = _type_name(backend)

    if module.startswith("qiskit_ionq") or "ionq" in name:
        return "ionq"
    if (
        module.startswith("qiskit_ibm_runtime")
        or module.startswith("qiskit_ibm_provider")
        or name.startswith("fake_")
        or name.startswith("ibm_")
        or type_name == "genericbackendv2"
        or "ibm" in module
    ):
        return "ibm"
    if module.startswith("qiskit_braket_provider") or "braket" in name:
        return "aws"
    if (
        "basicsimulator" in module
        or "basicsimulator" in type_name
        or "basic_simulator" in name
        or "aer_simulator" in name
        or "aersimulator" in type_name
    ):
        return "local"
    return "unknown"


def _is_simulator(backend: Any, name: str) -> bool:
    flag = getattr(backend, "_is_simulator", None)
    if isinstance(flag, bool):
        return flag
    return "simulator" in name.lower()


def _display_name(provider: Provider, name: str, entangler: Entangler) -> str:
    if provider == "ionq":
        if not name:
            return "IonQ"
        return name if "ionq" in name.lower() else f"IonQ {name}"
    reference = "Forte" if entangler == "zz" else "Aria"
    label = name if name else "backend"
    return f"{label} → iones (referencia {reference})"


def detect(backend: Any, entangler: Entangler | None = None) -> BackendInfo:
    """Detect provider, entangler and profile of ``backend``.

    ``entangler`` forces the target entangler (``"ms"`` or ``"zz"``); when it
    is ``None`` the entangler is inferred from the machine name.
    """
    provider = detect_provider(backend)
    name = _name_of(backend)
    lowered = name.lower()

    if entangler is not None:
        chosen: Entangler = entangler
    elif "forte" in lowered:
        chosen = "zz"
    else:
        chosen = "ms"

    is_hardware = provider == "ionq" and not _is_simulator(backend, name)
    profile = profiles.profile_for(provider, name, chosen)

    return BackendInfo(
        provider=provider,
        name=name,
        display_name=_display_name(provider, name, chosen),
        entangler=chosen,
        is_hardware=is_hardware,
        profile=profile,
    )
