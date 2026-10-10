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
