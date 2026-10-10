from abc import ABC, abstractmethod

from qiskit import QuantumCircuit

class Translator(ABC):
    """Interface for provider-specific translators."""

    @abstractmethod
    def translate(self, transpiled: QuantumCircuit) -> QuantumCircuit:
        """Normalize a transpiled circuit into the native gate set."""


class IonQTranslator(Translator):
    """Translator for IonQ backends."""

    def translate(self, transpiled: QuantumCircuit) -> QuantumCircuit:
        raise NotImplementedError


class IBMTranslator(Translator):
    """Translator for IBM backends."""

    def translate(self, transpiled: QuantumCircuit) -> QuantumCircuit:
        raise NotImplementedError


class AWSTranslator(Translator):
    """Translator for AWS backends."""

    def translate(self, transpiled: QuantumCircuit) -> QuantumCircuit:
        raise NotImplementedError


class LocalTranslator(Translator):
    """Translator for local simulators."""

    def translate(self, transpiled: QuantumCircuit) -> QuantumCircuit:
        raise NotImplementedError


class GenericTranslator(Translator):
    """Translator for unknown backends."""

    def translate(self, transpiled: QuantumCircuit) -> QuantumCircuit:
        raise NotImplementedError
