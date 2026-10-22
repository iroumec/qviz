"""The example circuits that the viewer offers, in one place.

The viewer, the Qollab package and the generator of ``out/`` all read this
catalog, so a new example is added here once. The circuits themselves live in
the sibling modules.
"""

from __future__ import annotations

from collections.abc import Callable

from qiskit import QuantumCircuit

from examples.bell import bell, distant_bell
from examples.performance import ghz, layered

__all__ = ["CIRCUITS", "LABELS"]

# The key is the name that the viewer uses in its selector and in ``run``.
CIRCUITS: dict[str, Callable[[], QuantumCircuit]] = {
    "bell": bell,
    "bell_distant": distant_bell,
    "ghz3": lambda: ghz(3),
    "ghz16": lambda: ghz(16),
    "layered16": lambda: layered(16),
}

# The text that the selector shows for each circuit.
LABELS: dict[str, str] = {
    "bell": "Bell (2 qubits)",
    "bell_distant": "Distant Bell pair (q0-q2, 3 qubits)",
    "ghz3": "GHZ (3 qubits)",
    "ghz16": "GHZ (16 qubits, performance)",
    "layered16": "Random layers, depth 4 (16 qubits, performance)",
}
