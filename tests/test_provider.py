"""Tests for provider detection."""

from __future__ import annotations

from backend.core.provider import provider


class _IonQFake:
    def __init__(self, name: str, is_simulator: bool = True) -> None:
        self.name = name
        self._is_simulator = is_simulator


_IonQFake.__module__ = "qiskit_ionq.ionq_backend"


class _UnknownFake:
    def __init__(self, name: str = "weird_backend") -> None:
        self.name = name


_UnknownFake.__module__ = "some_pkg.some_module"


def test_basic_simulator_is_local(basic_backend):
    info = provider.detect(basic_backend)
    assert info.provider == "local"
    assert info.entangler == "ms"
    assert info.is_hardware is False


def test_generic_backend_is_ibm(heron_backend):
    info = provider.detect(heron_backend)
    assert info.provider == "ibm"
    assert info.display_name.endswith("(referencia Aria)")


def test_unknown_provider_never_raises():
    info = provider.detect(_UnknownFake())
    assert info.provider == "unknown"


def test_ionq_aria_uses_ms():
    info = provider.detect(_IonQFake("Aria 1"))
    assert info.provider == "ionq"
    assert info.entangler == "ms"
    assert info.display_name == "IonQ Aria 1"
    assert info.is_hardware is False


def test_ionq_forte_uses_zz():
    info = provider.detect(_IonQFake("Forte 1", is_simulator=False))
    assert info.provider == "ionq"
    assert info.entangler == "zz"
    assert info.is_hardware is True


def test_entangler_can_be_forced():
    info = provider.detect(_IonQFake("Aria 1"), entangler="zz")
    assert info.entangler == "zz"


def test_ideal_machine_uses_zz():
    info = provider.detect(_IonQFake("ideal simulator"))
    assert info.entangler == "zz"


def test_simulator_attribute_is_preferred_over_name():
    backend = _IonQFake("Aria 1", is_simulator=False)
    # The name contains no "simulator", but the attribute says it is hardware.
    info = provider.detect(backend)
    assert info.is_hardware is True


class _StructuralIBM:
    __module__ = "some_pkg.some_module"

    def __init__(self) -> None:
        self.name = "mystery_machine"
        self.target = type(
            "T", (), {"operation_names": ("ecr", "rz", "sx", "x")}
        )()


class _StructuralIonQ:
    __module__ = "another_pkg.somewhere"

    def __init__(self) -> None:
        self.name = "mystery_ion"
        self.target = type("T", (), {"operation_names": ("gpi", "gpi2", "ms")})()


class _IonQNoise:
    __module__ = "qiskit_ionq.ionq_backend"

    def __init__(self, noise_model: str) -> None:
        self.name = "ionq_simulator"
        self._simulator = True
        self.options = type("O", (), {"noise_model": noise_model})()


def test_structural_detection_of_ibm():
    assert provider.detect_provider(_StructuralIBM()) == "ibm"


def test_structural_detection_of_ionq():
    assert provider.detect_provider(_StructuralIonQ()) == "ionq"


def test_ionq_noise_model_selects_ms():
    # Every IonQ entry is named "ionq_simulator"; the family comes from the
    # noise model ("aria-2" -> MS).
    info = provider.detect(_IonQNoise("aria-2"))
    assert info.provider == "ionq"
    assert info.entangler == "ms"
    assert info.display_name == "IonQ Aria 2"


def test_ionq_noise_model_selects_zz():
    info = provider.detect(_IonQNoise("forte-1"))
    assert info.entangler == "zz"
    assert info.display_name == "IonQ Forte 1"
