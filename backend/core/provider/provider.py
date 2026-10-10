"""Provider detection.

Turns any injected ``backend`` object into a :class:`BackendInfo` without ever
raising for an unexpected provider: unknown backends fall back to a generic
profile (``spec.md`` §M1b).

The detection is deliberately layered. The signals that are checked first are
the most reliable (the class module and the public attributes). A structural
fallback is used last: the operation names of the backend are inspected, so that
a backend with an unusual name is still classified correctly.

A note on IonQ. Every IonQ entry in Qollab is named ``ionq_simulator``, so the
name alone does not say whether the machine is an Aria (MS) or a Forte (ZZ).
The machine family is read from ``backend.options.noise_model`` instead, which is
``aria-2``, ``forte-1`` and so on (Qollab probe, ``spec.md`` §10).
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


def _safe_getattr(obj: Any, attr: str) -> Any:
    try:
        return getattr(obj, attr, None)
    except Exception:  # noqa: BLE001 - some backends raise on missing options
        return None


def _noise_model(backend: Any) -> str | None:
    """Return ``options.noise_model`` when it is a string, else ``None``.

    For IBM the value is a Qiskit ``NoiseModel`` object, and for AWS and the
    built-in simulator the attribute raises. In both cases ``None`` is returned.
    """
    options = _safe_getattr(backend, "options")
    value = _safe_getattr(options, "noise_model")
    if isinstance(value, str) and value:
        return value
    backend_value = _safe_getattr(backend, "noise_model")
    if isinstance(backend_value, str) and backend_value:
        return backend_value
    return None


def _machine_hints(backend: Any) -> list[str]:
    """Return the strings that may name the machine, best first."""
    hints: list[str] = []
    noise = _noise_model(backend)
    if noise:
        hints.append(noise)
    name = _name_of(backend)
    if name and name not in hints:
        hints.append(name)
    return hints


def _operation_names(backend: Any) -> set[str]:
    """Collect the operation names that a backend advertises, if any."""
    names: set[str] = set()
    target = _safe_getattr(backend, "target")
    target_ops = _safe_getattr(target, "operation_names")
    if target_ops:
        names.update(str(op).lower() for op in target_ops)

    direct_ops = _safe_getattr(backend, "operation_names")
    if direct_ops:
        names.update(str(op).lower() for op in direct_ops)

    configuration = _safe_getattr(backend, "configuration")
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
    """Infer the provider from the advertised operation names, if possible.

    Only ``gpi``, ``gpi2`` and ``ms`` are treated as IonQ-native, because
    ``zz`` and ``rxx`` also exist as ordinary Qiskit gates. The Qollab IBM
    simulators advertise ``cz``, ``rz`` and ``sx`` together (Qollab probe).
    """
    names = set(operation_names)
    if names & {"gpi", "gpi2", "ms"}:
        return "ionq"
    if "ecr" in names:
        return "ibm"
    if {"cz", "rz", "sx"} <= names:
        return "ibm"
    return "unknown"


_SIMULATOR_ATTRS = ("_simulator", "_is_simulator", "is_simulator", "simulator")


def _is_simulator(backend: Any, name: str) -> bool:
    """Return whether an IonQ backend is a simulator.

    A boolean attribute is preferred, because it is set by the SDK itself. The
    name is only inspected as a last resort.
    """
    for attr in _SIMULATOR_ATTRS:
        value = _safe_getattr(backend, attr)
        if isinstance(value, bool):
            return value
    return "simulator" in name.lower()


def _native_family(value: str | None) -> Entangler | None:
    """Return the native entangler implied by a machine family name, if any."""
    if not value:
        return None
    try:
        from qiskit_ionq.helpers import native_2q_gate
    except Exception:  # noqa: BLE001 - qiskit-ionq is optional at this point
        return None
    family = native_2q_gate(value)
    return family  # type: ignore[return-value]


def _infer_entangler(backend: Any, name: str) -> Entangler:
    """Choose the target entangler from the backend, the hints and the default."""
    names = _operation_names(backend)
    if "zz" in names and "ms" not in names:
        return "zz"
    if "ms" in names and "zz" not in names:
        return "ms"

    hints = _machine_hints(backend)
    for hint in hints:
        family = _native_family(hint)
        if family is not None:
            return family

    lowered = " ".join(hints).lower()
    if "forte" in lowered or "ideal" in lowered:
        return "zz"
    return "ms"


def _pretty_machine(value: str) -> str:
    """Turn ``forte-enterprise-1`` into ``Forte Enterprise 1``."""
    cleaned = value.strip().replace("-", " ").replace("_", " ")
    return " ".join(word.capitalize() for word in cleaned.split())


def _display_name(
    provider: Provider, backend: Any, name: str, entangler: Entangler
) -> str:
    if provider == "ionq":
        noise = _noise_model(backend)
        if noise:
            return f"IonQ {_pretty_machine(noise)}"
        lowered = name.lower()
        if _native_family(name) is not None or "forte" in lowered or "aria" in lowered:
            return f"IonQ {_pretty_machine(name)}"
        if name:
            return name if "ionq" in lowered else f"IonQ {name}"
        return "IonQ"
    reference = "Forte" if entangler == "zz" else "Aria"
    label = name if name else "backend"
    return f"{label} → iones (referencia {reference})"


def detect(backend: Any, entangler: Entangler | None = None) -> BackendInfo:
    """Detect provider, entangler and profile of ``backend``.

    ``entangler`` forces the target entangler (``"ms"`` or ``"zz"``). When it is
    ``None``, the entangler is read from the backend, then from the machine
    hints (``options.noise_model`` and the name). The rules are the following.

    - A backend whose native two-qubit gate is known is used directly.
    - A hint that contains ``forte`` or ``ideal`` gives ``"zz"``.
    - Every other case gives ``"ms"``.
    """
    provider = detect_provider(backend)
    name = _name_of(backend)

    if entangler is not None:
        chosen: Entangler = entangler
    else:
        chosen = _infer_entangler(backend, name)

    is_hardware = provider == "ionq" and not _is_simulator(backend, name)
    hints = _machine_hints(backend)
    profile = profiles.profile_for(provider, hints[0] if hints else name, chosen)

    return BackendInfo(
        provider=provider,
        name=name,
        display_name=_display_name(provider, backend, name, chosen),
        entangler=chosen,
        is_hardware=is_hardware,
        profile=profile,
    )
