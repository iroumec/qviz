"""Immutable data structures exchanged between pipeline modules."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from qiskit import QuantumCircuit

Provider = Literal["ionq", "local", "unsupported"]
Entangler = Literal["ms", "zz"]
OpName = Literal["gpi", "gpi2", "ms", "zz", "virtual_z"]
Source = Literal["ionq-native", "qiskit"]
Strategy = Literal["statevector", "tomography"]


@dataclass(frozen=True)
class NoiseProfile:
    """Didactic noise parameters of a reference machine.

    Fidelities are in the [0, 1] range and prices are USD per gate-shot.
    """

    spam_error: float
    fidelity_1q: float
    fidelity_2q: float
    idle_error_per_step: float
    price_1q: float
    price_2q: float


@dataclass(frozen=True)
class BackendInfo:
    """Result of detecting the provider behind an injected backend."""

    provider: Provider
    name: str
    display_name: str
    entangler: Entangler
    is_hardware: bool
    profile: NoiseProfile


@dataclass(frozen=True)
class TranspiledCircuit:
    """Output of the transpiler.

    Either ``circuit`` (a provider-level ``QuantumCircuit``) or ``native_ops``
    (a raw IonQ native gate list) is set, never both.
    """

    source: Source
    num_qubits: int
    circuit: QuantumCircuit | None = None
    native_ops: tuple[dict, ...] | None = None
    layout: tuple[int, ...] | None = None


@dataclass(frozen=True)
class NativeOp:
    """A single native operation of the intermediate representation.

    - ``phases`` are in radians (gpi/gpi2: one phase; ms: two phases).
    - ``angle`` is in turns and only used by ms/zz.
    - ``z_rotation`` is in radians and only used by virtual_z.
    """

    name: OpName
    targets: tuple[int, ...]
    phases: tuple[float, ...] = ()
    angle: float | None = None
    z_rotation: float | None = None
    source_index: int | None = None


@dataclass(frozen=True)
class NativeCircuit:
    """Normalized circuit made only of native trapped-ion operations."""

    backend: BackendInfo
    num_qubits: int
    ops: tuple[NativeOp, ...]


@dataclass(frozen=True)
class QubitAngles:
    """Reduced Bloch state of one qubit in spherical coordinates.

    ``theta`` is in [0, pi] measured from +z and ``phi`` in [0, 2*pi) from +x.
    """

    r: float
    theta: float
    phi: float


@dataclass(frozen=True)
class SimulatedStep:
    """State of every qubit after one native operation."""

    index: int
    op: NativeOp
    qubits: tuple[QubitAngles, ...]
    virtual_z: tuple[float, ...]


@dataclass(frozen=True)
class SimulatedCircuit:
    """A native circuit plus the reduced state after every operation."""

    native: NativeCircuit
    steps: tuple[SimulatedStep, ...]


@dataclass(frozen=True)
class VectorizedStep:
    """Cartesian Bloch vectors and computational-basis probabilities."""

    index: int
    op: NativeOp
    states: tuple[tuple[float, float, float], ...]
    probabilities: tuple[tuple[float, float], ...]
    virtual_z: tuple[float, ...]


@dataclass(frozen=True)
class VectorizedCircuit:
    """A native circuit plus the Cartesian state after every operation."""

    native: NativeCircuit
    steps: tuple[VectorizedStep, ...]


@dataclass(frozen=True)
class MeasuredStep:
    """Vectorized step decorated with the didactic metrics."""

    index: int
    op: NativeOp
    states: tuple[tuple[float, float, float], ...]
    probabilities: tuple[tuple[float, float], ...]
    virtual_z: tuple[float, ...]
    fidelities: tuple[float, ...]
    cumulative_fidelity: float
    inactivity: tuple[int, ...]
    vibration: tuple[float, ...]
    cumulative_cost: float


@dataclass(frozen=True)
class MeasuredCircuit:
    """A native circuit plus the metrics after every operation."""

    native: NativeCircuit
    steps: tuple[MeasuredStep, ...]
