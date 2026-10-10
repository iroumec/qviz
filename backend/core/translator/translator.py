"""Provider-specific translators.

Every provider shares the same translation rule (``rules.py``); the subclass
only encodes provider identity and target entangler, and ``compiler`` picks it
from ``BackendInfo.provider``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from backend.core.model import BackendInfo, NativeCircuit, TranspiledCircuit
from backend.core.translator import rules


class Translator(ABC):
    """Interface for provider-specific translators."""

    def __init__(self, info: BackendInfo) -> None:
        """Store the backend information that selects entangler and profile."""
        self.info = info

    @abstractmethod
    def translate(self, transpiled: TranspiledCircuit) -> NativeCircuit:
        """Normalize a transpiled circuit into the native gate set."""

    def _translate(self, transpiled: TranspiledCircuit) -> NativeCircuit:
        """Apply the shared translation rules for this backend's entangler."""
        entangler = self.info.entangler
        if transpiled.native_ops is not None:
            num_qubits = transpiled.num_qubits
            ops = rules.translate_native_ops(
                transpiled.native_ops, num_qubits, entangler
            )
        else:
            if transpiled.circuit is None:  # pragma: no cover - model invariant
                raise ValueError(
                    "transpiled circuit has neither circuit nor native ops"
                )
            ops, num_qubits = rules.translate_circuit(
                transpiled.circuit, transpiled.layout, entangler
            )
        return NativeCircuit(
            backend=self.info, num_qubits=num_qubits, ops=tuple(ops)
        )


class IonQTranslator(Translator):
    """Translator for IonQ backends."""

    def translate(self, transpiled: TranspiledCircuit) -> NativeCircuit:
        """Translate using the shared rule set."""
        return self._translate(transpiled)


class IBMTranslator(Translator):
    """Translator for IBM backends."""

    def translate(self, transpiled: TranspiledCircuit) -> NativeCircuit:
        """Translate using the shared rule set."""
        return self._translate(transpiled)


class AWSTranslator(Translator):
    """Translator for AWS backends."""

    def translate(self, transpiled: TranspiledCircuit) -> NativeCircuit:
        """Translate using the shared rule set."""
        return self._translate(transpiled)


class LocalTranslator(Translator):
    """Translator for local simulators."""

    def translate(self, transpiled: TranspiledCircuit) -> NativeCircuit:
        """Translate using the shared rule set."""
        return self._translate(transpiled)


class GenericTranslator(Translator):
    """Translator for unknown backends."""

    def translate(self, transpiled: TranspiledCircuit) -> NativeCircuit:
        """Translate using the shared rule set."""
        return self._translate(transpiled)


_TRANSLATORS = {
    "ionq": IonQTranslator,
    "ibm": IBMTranslator,
    "aws": AWSTranslator,
    "local": LocalTranslator,
    "unknown": GenericTranslator,
}


def create(info: BackendInfo) -> Translator:
    """Instantiate the translator matching ``info.provider``."""
    return _TRANSLATORS[info.provider](info)
