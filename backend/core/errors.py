"""Exception hierarchy for the QViz backend."""

from __future__ import annotations


class QVizError(Exception):
    """Base class for every error raised by QViz."""


class UnsupportedOperationError(QVizError):
    """The circuit contains an operation the visualizer cannot represent."""


class CircuitTooLargeError(QVizError):
    """The circuit has more qubits than ``config.MAX_QUBITS``."""


class TranspilationError(QVizError):
    """The circuit could not be transpiled for the requested backend."""
