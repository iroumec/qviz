# QViz — project card

**See what a trapped-ion quantum computer really does with your circuit.**

![QViz: a Mølmer–Sørensen gate between two ions, with the phonon bus, the Bloch spheres and the fidelity](images/viewer-ms.png)

## What is it?

QViz is an educational visualiser for trapped-ion quantum computers. You load a
circuit written in OpenQASM 2 or 3 and choose a backend (IonQ or the built-in
simulator). QViz compiles it into the **native gates** of an IonQ machine and
shows every ion as a **Bloch sphere** that moves gate by gate, inside a 3D model
of the trap: the laser pulse that drives each gate, the phonon bus that joins two
ions, the electrodes and the readout lens. A **Medir** button measures the
current step. It runs entirely in the browser on Qollab.

## Why does it matter, and who is it for?

A circuit is written with logical gates (`h`, `cx`), but a trapped-ion machine
runs a handful of native ones, and one `cx` becomes a sequence of them. That gap
between the circuit and the hardware is where understanding is usually lost. QViz
shows the native gates and the state of each ion after each one, so a teacher can
explain the physics of every gate, and a student can see entanglement and noise
instead of only reading about them.

It is for **students, teachers and curious people** who know the basics of
circuits and nothing about the hardware. The interface is in Spanish and English
for classroom use, and it is built to be accessible: palettes for colour
blindness, high contrast, reduced motion, text size, screen-reader announcements
and a camera that can be moved with the mouse alone.

## How does the quantum part work?

- **Native gates.** IonQ's machines run GPI(φ) and GPI2(φ) (π and π/2 rotations
  about an axis of the equator, set by the laser phase), VirtualZ (a Z rotation
  done by shifting the phase of later gates, at no cost) and one entangler:
  Mølmer–Sørensen (MS) on Aria or ZZ on Forte, which entangles two ions through
  the shared vibration of the chain. QViz translates the circuit with Qiskit and
  checks every translation against IonQ's gate matrices
  (`Operator.equiv`).
- **State.** After each native gate, an exact simulation gives the statevector,
  and the reduced density matrix of each ion gives its Bloch vector. The vector
  has length 1 for a pure state and **shrinks when the ion is entangled**,
  vanishing for a Bell pair. That is how entanglement appears on the screen.
- **Noise.** A simple, didactic model adds a fidelity per gate, an idle error and
  a preparation-and-measurement error, so the fidelity of the circuit falls as
  gates accumulate. The numbers are order-of-magnitude values, not a calibrated
  model, and nothing is sent to real hardware.
- **Measurement.** **Medir** samples the exact statevector with a readout error
  per ion, so correlations survive: a Bell pair gives `00` and `11`, never `01`.
- **Example.** `h; cx` on two qubits becomes seven native steps: a VirtualZ, two
  GPI2 that take the first ion to |1⟩, an MS gate that entangles both ions (their
  vectors vanish and the fidelity drops from 99.5 % to 98.9 %), and three GPI2
  that finish the CNOT.

The Python backend (`provider → transpiler → translator → simulator →
vectorizer → metrics → formatter → exporter`) produces one JSON, validated against
a schema, with the gate sequence and the Bloch state at every step. A three.js
viewer draws it.

## How do I run it?

**On Qollab** (no installation):

```bash
make qollab
```

Upload the **content** of the generated `qollab/` folder (not the folder itself)
to a Qollab JS project and run it. Python runs in the browser (Pyodide), with the
backend you select in Qollab. Use **Cargar circuito**, or drag a `.qasm` file, to
load a circuit; examples are in `resources/examples/qasm/`.

**Locally**, with Python 3.12 or newer:

```bash
make venv && make install
make test       # 426 tests
make server     # the viewer at http://localhost:8000
```

## Details

- **Built with:** Python, Qiskit, qiskit-ionq, NumPy, JavaScript, three.js, Quarto.
- **Limits:** up to 16 qubits; IonQ and the built-in simulator only; one IonQ job
  per run on Qollab (loaded circuits never spend it).
- **Documentation:** the Quarto book in `documentation/`, and `documentation/prompts/spec.md` for the
  architecture and the JSON contract.
- **License:** MIT. Dependencies: Qiskit, qiskit-ionq and qiskit-qasm3-import
  (Apache-2.0), NumPy (BSD-3-Clause).
