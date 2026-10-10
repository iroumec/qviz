"""Exception hierarchy for the QViz backend."""

from __future__ import annotations


class QVizError(Exception):
    """Base class for every error raised by QViz."""


class UnsupportedOperationError(QVizError):
    """The circuit contains an operation the visualizer cannot represent."""


class CircuitTooLargeError(QVizError):
    """The circuit has more qubits than ``config.MAX_QUBITS``."""


class UnsupportedProviderError(QVizError):
    """The backend is neither an IonQ machine nor the built-in simulator."""


class CircuitParseError(QVizError):
    """The text of a circuit (OpenQASM) could not be read."""


class TranspilationError(QVizError):
    """The circuit could not be transpiled for the requested backend."""
