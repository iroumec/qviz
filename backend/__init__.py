from core.compiler import compile
from exporter import export



from qiskit import QuantumCircuit
from qiskit_ionq import IonQProvider
from qiskit.circuit import Gate

__version__ = "0.1.0"

# API
__all__ = [
    "compile",
    "export",
    "show",
    "__version__"
]

def __main__():
    
    qc = QuantumCircuit(2, 2)
    qc.h(0)
    qc.cx(0, 1)
    qc.measure([0, 1], [0, 1])

