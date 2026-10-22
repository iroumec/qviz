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

451 tests pass, 1 is skipped, and `source/backend` has 96 % coverage
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

## Tools

Built with:

<!-- markdownlint-disable MD033 -->
<table>
    <tr>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/python.svg" alt="Python" width="40" height="40" />
            <br/>Python
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/javascript.svg" alt="JavaScript" width="40" height="40" />
            <br/>JavaScript
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/html5.svg" alt="HTML" width="40" height="40" />
            <br/>HTML
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/css3.svg" alt="CSS" width="40" height="40" />
            <br/>CSS
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/numpy.svg" alt="NumPy" width="40" height="40" />
            <br/>NumPy
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/qiskit.svg" alt="Qiskit" width="40" height="40" />
            <br/>Qiskit
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/threejs.svg" alt="three.js" width="40" height="40" />
            <br/>three.js
        </td>
    </tr>
    <tr>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/nodejs.svg" alt="Node.js" width="40" height="40" />
            <br/>Node.js
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/pnpm.svg" alt="pnpm" width="40" height="40" />
            <br/>pnpm
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/eslint.svg" alt="ESLint" width="40" height="40" />
            <br/>ESLint
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/pytest.svg" alt="pytest" width="40" height="40" />
            <br/>pytest
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/make.svg" alt="Makefile" width="40" height="40" />
            <br/>Makefile
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/bash.svg" alt="Bash" width="40" height="40" />
            <br/>Bash
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/uv.svg" alt="uv" width="40" height="40" />
            <br/>uv
        </td>
    </tr>
    <tr>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/git.svg" alt="Git" width="40" height="40" />
            <br/>Git
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/github.svg" alt="GitHub" width="40" height="40" />
            <br/>GitHub
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/githubactions.svg" alt="GitHub Actions" width="40" height="40" />
            <br/>GitHub Actions
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/vscode.svg" alt="Visual Studio Code" width="40" height="40" />
            <br/>VS Code
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/plantuml.ico" alt="PlantUML" width="40" height="40" />
            <br/>PlantUML
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/quarto.png" alt="Quarto" width="40" height="40" />
            <br/>Quarto
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/typst.svg" alt="Typst" width="40" height="40" />
            <br/>Typst
        </td>
    </tr>
    <tr>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/gemini.svg" alt="Gemini" width="40" height="40" />
            <br/>Gemini
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/claude.svg" alt="Claude Code" width="40" height="40" />
            <br/>Claude Code
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/opencode.ico" alt="OpenCode" width="40" height="40" />
            <br/>OpenCode
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="documentation/images/tools/deepseek.svg" alt="DeepSeek" width="40" height="40" />
            <br/>DeepSeek
        </td>
    </tr>
</table>
<!-- markdownlint-enable MD033 -->

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
