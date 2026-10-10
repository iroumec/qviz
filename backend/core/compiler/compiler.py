from core.transpiler import transpiler
from core.translator import translator
from core.simulator import simulator
from core.vectorizer import vectorizer
from core.formatter import formatter

def compile(backend, qc):
    
    # Transoilation.
    transpiled_circuit = transpiler.transpile(backend, qc)
    return transpiled_circuit
    
    # Translation.
    #translated_circuit = translator.translate(transpiled_circuit)
    
    # Simulation.
    #simulated_circuit = simulator.simulate(translated_circuit)
    
    # Vectorization.
    #vectorized_circuit = vectorizer.vectorize(simulated_circuit)
    
    # Formatting.
    #return formatter.format(vectorized_circuit)