from unittest.mock import MagicMock

from qiskit import QuantumCircuit

from backend import compile


def test_bell_circuit_compiles():
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)

    job = MagicMock()
    job.compiled_circuit.return_value = QuantumCircuit(2)
    backend = MagicMock()
    backend.run.return_value = job

    result = compile(backend, qc)
    
    print(result)

    assert result is job.compiled_circuit.return_value
