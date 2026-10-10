"""Public API of the QViz backend.

``compile`` runs the whole pipeline and returns the JSON-ready dictionary;
``export`` serializes it; ``sample`` measures a step of that dictionary. Import
these functions; never ``import backend`` inside ``main.py``.
"""

from backend.core.compiler.compiler import compile
from backend.core.exporter.exporter import export
from backend.core.sampler.sampler import sample

__version__ = "0.1.0"

# Public API. Never `import backend` inside main.py: it shadows the global
# `backend` injected by Qollab (spec.md §2.3).
__all__ = [
    "compile",
    "export",
    "sample",
    "__version__",
]
