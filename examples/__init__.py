"""Worked quantum-circuit examples for QViz.

The examples are plain Qiskit circuits. They are not part of the backend
pipeline; they are used to demonstrate the visualiser and to feed the demo
scripts. The most interesting one is the QFT adder, which adds two numbers with
the quantum Fourier transform.
"""

from examples.performance import ghz, layered
from examples.qft import inverse_qft, qft, qft_adder

__all__ = ["qft", "inverse_qft", "qft_adder", "ghz", "layered"]
