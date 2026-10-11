"""Public API of the QViz backend.

``load_circuit`` reads an OpenQASM text into a circuit; ``compile`` runs the whole
pipeline and returns the JSON-ready dictionary; ``export`` serializes it;
``sample`` measures a step of that dictionary. Import
these functions; never ``import backend`` inside ``main.py``.
"""

from backend.core.compiler.compiler import compile
from backend.core.exporter.exporter import export
from backend.core.importer.importer import load_circuit
from backend.core.sampler.sampler import sample

__version__ = "0.1.0"

__all__ = [
    "compile",
    "export",
    "load_circuit",
    "sample",
    "__version__",
]
