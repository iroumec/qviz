# QViz — project card

**Tagline.** See what a trapped-ion quantum computer really does with your circuit.

**What it is.** QViz is an educational visualiser for trapped-ion quantum
computers. It takes a circuit written in OpenQASM 2 or 3, compiles it to the
native gates of IonQ (GPI, GPI2, MS or ZZ, VirtualZ), simulates it exactly and
draws every ion as a Bloch sphere that moves gate by gate. The laser pulses, the
phonon bus between ions, the trap and the measurement are animated, and the
fidelity of the circuit drops as the machine accumulates error.

**Why.** There is a barrier between the logical gates of a circuit (H, CX) and
what the machine runs. Showing the native gates and the state of each ion
removes that barrier and lets a teacher explain the physics behind every gate.

**How it works.** A Python backend (`provider → transpiler → translator →
simulator → vectorizer → metrics → formatter → exporter`) produces a JSON with
the gate sequence and the Bloch state at each step. A Three.js viewer draws it.
The **Medir** button samples a measurement with the same backend, so entangled
states keep their correlations.

**Where it runs.** On Qollab, entirely in the browser: Python through Pyodide
and a JS project for the viewer, using the backend the user selects (built-in
simulator or IonQ). Locally, `make server` runs the same code.

**Built with.** Python, Qiskit, qiskit-ionq, NumPy, JavaScript, Three.js, Quarto.

**Limits.** Up to 16 qubits; IonQ and the built-in simulator only; one IonQ job
per run on Qollab (loaded circuits never spend it).

**License.** MIT. Dependencies: Qiskit, qiskit-ionq, qiskit-qasm3-import
(Apache-2.0) and NumPy (BSD-3-Clause).
