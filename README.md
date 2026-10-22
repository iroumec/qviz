# QViz

[![CI](https://github.com/iroumec/QViz/actions/workflows/ci.yml/badge.svg)](https://github.com/iroumec/QViz/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **See what a trapped-ion quantum computer really does with your circuit.**

QViz takes a circuit written in OpenQASM 2 or 3 and a backend (IonQ or the
built-in simulator), compiles it into the **native gates** of an ion trap,
simulates it exactly and draws every ion as a **Bloch sphere** that moves, gate
by gate, inside a 3D model of the trap.

![A GPI2 pulse on the first ion of a Bell circuit](documentation/images/viewer-gpi2.png)

It runs in the browser on [Qollab](documentation/docs/frontend/qollab.qmd) and
locally with one command. The interface is in Spanish and English (switch it with
the language button in the header) and includes colour-blind palettes, high
contrast and reduced motion.

## Quick start

### On Qollab

```bash
make qollab
```

Upload the **content** of the generated `qollab/` folder (not the folder itself)
as a Qollab JS project. Python (Pyodide) runs the backend and the browser draws
the viewer with the backend you select. Do not edit `qollab/`; change
`source/frontend/` and run `make qollab` again. The generated `main.js` is about
0.5 MB because Qollab does not serve project files, so the shaders and the laser
model are embedded; the limit is 2 MB per file.

### Locally

```bash
make venv && make install   # Python 3.12 or newer
make install-js             # ESLint (Node.js 20.19+ and pnpm via corepack)
make server                 # http://localhost:8000
make open                   # the same, and opens the browser
```

`make server` generates `out/` on the first run and compiles and measures with
the same Python code as Qollab. Use it, not a plain `python -m http.server`, when
you want to load a circuit or measure.

Then choose an example, press **Load circuit** or drag a `.qasm` file from
`resources/examples/qasm/`, press **Play** and press **Measure**.

## What it does

- Shows how a logical gate is built from the native gates (GPI, GPI2, MS or ZZ
  and VirtualZ) and what each one does to one ion.
- Shows **entanglement** appear: the Bloch vector of an ion shrinks, and
  vanishes when the ion is fully entangled.
- Shows **noise**: the fidelity falls with every gate, and _Measure_ samples the
  exact statevector, so a Bell pair gives `00` and `11`, never `01` or `10`.
- Lets you change the view: profiles, palettes, camera without the keyboard.

![The Mølmer–Sørensen gate: the phonon bus joins the two ions](documentation/images/viewer-ms.png)

## How it works

```text
OpenQASM → provider → transpiler → translator → simulator → vectorizer → metrics → formatter → exporter → JSON → viewer
```

1. **provider** detects the backend and its noise profile.
2. **transpiler** and **translator** rewrite the circuit with Qiskit and then
   into the native gates of IonQ.
3. **simulator** computes the exact statevector after every gate.
4. **metrics** adds a simple didactic error model, a fidelity and a price.
5. **formatter** and **exporter** produce the JSON contract that the viewer
   reads.

The viewer has no calculation of its own: compiling and measuring always go
through Python. See the [pipeline](documentation/docs/concepts/pipeline-overview.qmd),
the [native gates](documentation/docs/concepts/motivation.qmd) and the
[JSON contract](documentation/docs/concepts/json-contract.qmd).

## Repository map

| Path                                                 | What is in it                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `source/backend/`                                    | The Python pipeline, one package per module.                           |
| `source/frontend/`                                   | The viewer: `index.html`, `styles.css` and the ES modules of `js/`.    |
| `source/shaders/`                                    | The GLSL shaders of the spheres, the laser and the phonon bus.         |
| `resources/examples/`                                | Worked circuits in Python and OpenQASM.                                |
| `resources/scripts/`                                 | The demos, the generator of `out/`, the packager and the local server. |
| `source/tests/`                                      | The test suite (no network; IonQ is mocked).                           |
| `documentation/`                                     | The Quarto book, the JSON schema and the internal notes.               |
| `package.json`, `pnpm-lock.yaml`, `eslint.config.js` | ESLint and the JavaScript development tools (Node.js only).            |

Generated and ignored: `out/`, `qollab/`, `_book/`, `node_modules/`.

## Tests

```bash
make verify   # tests with coverage, linters and the Qollab package
```

444 tests pass, 1 is skipped, and `source/backend` has 96 % coverage
(`make coverage`). The last full run used Python 3.13.5, Qiskit 2.5.2 and
NumPy 2.5.3. See [versions](documentation/docs/getting-started/installation.qmd).

## Status

QViz was built for the Qollab hackathon (2026) and is now in maintenance. The
design decisions live in
[`spec.md`](documentation/internal/spec.md); the session hand-over is in
[`memory.md`](documentation/internal/memory.md). The internal notes and the AI
prompts are public on purpose.

See [limitations](documentation/docs/getting-started/limitations.qmd) and the
[changelog](CHANGELOG.md).

## Contributing and license

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. QViz is released under the
[MIT License](LICENSE). Qiskit, qiskit-ionq and qiskit-qasm3-import are
Apache-2.0, and NumPy is BSD-3-Clause; all of them are compatible with MIT.

## Documentation

The full book is built with Quarto from `documentation/` (`make render`). Good
places to start: [Why QViz](documentation/docs/concepts/motivation.qmd), the
[pipeline](documentation/docs/concepts/pipeline-overview.qmd), the
[viewer](documentation/docs/frontend/viewer.qmd) and
[running on Qollab](documentation/docs/frontend/qollab.qmd).
