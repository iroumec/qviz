"""Provider detection.

Turns any injected ``backend`` object into a :class:`BackendInfo` without ever
raising for an unexpected provider: unknown backends fall back to a generic
profile (``spec.md`` §M1b).

The detection is deliberately layered. The signals that are checked first are
the most reliable (the class module and the public attributes). A structural
fallback is used last: the operation names of the backend are inspected, so that
a backend with an unusual name is still classified correctly.
"""

from __future__ import annotations

from typing import Any, Iterable

from backend.core.model import BackendInfo, Entangler, Provider
from backend.core.provider import profiles


def _module_of(backend: Any) -> str:
    return (getattr(type(backend), "__module__", "") or "").lower()


def _type_name(backend: Any) -> str:
    return (getattr(type(backend), "__name__", "") or "").lower()


def _name_of(backend: Any) -> str:
    return str(getattr(backend, "name", "") or "")


def _operation_names(backend: Any) -> set[str]:
    """Collect the operation names that a backend advertises, if any."""
    names: set[str] = set()
    target = getattr(backend, "target", None)
    target_ops = getattr(target, "operation_names", None)
    if target_ops:
        names.update(str(op).lower() for op in target_ops)

    direct_ops = getattr(backend, "operation_names", None)
    if direct_ops:
        names.update(str(op).lower() for op in direct_ops)

    configuration = getattr(backend, "configuration", None)
    if callable(configuration):
        try:
            basis = configuration().basis_gates
        except Exception:  # noqa: BLE001 - the configuration is optional
            basis = None
        if basis:
            names.update(str(op).lower() for op in basis)
    return names


def detect_provider(backend: Any) -> Provider:
    """Classify the injected backend into one of the known providers.

    The class module and the name are checked first. When they give no answer,
    the advertised operation names are inspected as a fallback.
    """
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

    return _structural_provider(_operation_names(backend))


def _structural_provider(operation_names: Iterable[str]) -> Provider:
    """Infer the provider from the advertised operation names, if possible."""
    names = set(operation_names)
    if names & {"gpi", "gpi2", "ms", "zz"}:
        return "ionq"
    if "ecr" in names:
        return "ibm"
    if {"cz", "sx", "rz"} <= names:
        return "ibm"
    if {"rxx", "ryy"} & names:
        return "ionq"
    return "unknown"


_SIMULATOR_ATTRS = ("_simulator", "_is_simulator", "is_simulator", "simulator")


def _is_simulator(backend: Any, name: str) -> bool:
    """Return whether an IonQ backend is a simulator.

    A boolean attribute is preferred, because it is set by the SDK itself. The
    name is only inspected as a last resort.
    """
    for attr in _SIMULATOR_ATTRS:
        value = getattr(backend, attr, None)
        if isinstance(value, bool):
            return value
    return "simulator" in name.lower()


def _native_family(name: str) -> Entangler | None:
    """Return the native entangler implied by a machine family name, if any."""
    try:
        from qiskit_ionq.helpers import native_2q_gate
    except Exception:  # noqa: BLE001 - qiskit-ionq is optional at this point
        return None
    family = native_2q_gate(name)
    return family  # type: ignore[return-value]


def _infer_entangler(backend: Any, name: str) -> Entangler:
    """Choose the target entangler from the backend, the name and the default."""
    names = _operation_names(backend)
    if "zz" in names and "ms" not in names:
        return "zz"
    if "ms" in names and "zz" not in names:
        return "ms"

    family = _native_family(name)
    if family is not None:
        return family

    lowered = name.lower()
    if "forte" in lowered or "ideal" in lowered:
        return "zz"
    return "ms"


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

    ``entangler`` forces the target entangler (``"ms"`` or ``"zz"``). When it is
    ``None``, the entangler is read from the backend, then from the machine
    name. The rules are the following.

    - A backend whose native two-qubit gate is known is used directly.
    - A name that contains ``forte`` or ``ideal`` gives ``"zz"``.
    - Every other case gives ``"ms"``.
    """
    provider = detect_provider(backend)
    name = _name_of(backend)

    if entangler is not None:
        chosen: Entangler = entangler
    else:
        chosen = _infer_entangler(backend, name)

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
