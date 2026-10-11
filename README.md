# QViz

[![CI](https://github.com/iroumec/QViz/actions/workflows/ci.yml/badge.svg)](https://github.com/iroumec/QViz/actions/workflows/ci.yml)

QViz is an educational visualiser for trapped-ion quantum circuits. It takes a
Qiskit circuit and a backend, compiles the circuit into the native ion gates
(GPI, GPI2, MS or ZZ, and VirtualZ), and shows the state of every ion after
every gate as a Bloch sphere.

The purpose is **pedagogical**. There is a barrier between the logical gates of
a circuit and what the machine really runs. By visualising the native gates and
the state of each ion, that barrier is removed, and the physics behind every
gate can be explained. See
[Why QViz](documentation/docs/concepts/motivation.qmd), and the full book under
`documentation/`.

## What it does

- Each qubit is a Bloch sphere, and every native gate (GPI, GPI2, MS or ZZ,
  VirtualZ) moves it, with the laser pulse, the phonon bus and the trap shown.
- The fidelity of the circuit drops as the machine accumulates error, and the
  **Medir** button shows what a measurement would give, including the
  correlations of entangled states.
- A circuit comes in as **OpenQASM 2 or 3** (`.qasm`, by button or drag and
  drop). It is transpiled, translated to IonQ's native gates, simulated exactly
  and given the error model. A gate with no native translation (`opaque`, an
  undefined gate, `reset`, control flow, …) is rejected with an error that says
  why.
- Examples are in `examples/qasm/`. Supported backends: the built-in simulator
  and IonQ. Any other provider is rejected with an explicit error.

## Use it

### On Qollab

```bash
make qollab
```

Upload the **content** of the generated `qollab/` folder (not the folder
itself) to a Qollab JS project. The repository has more than the 100 files that
Qollab allows, which is why the package is built. Python (Pyodide) runs the
backend and the browser draws the viewer, with the backend that you select. Do
not edit `qollab/`. Loaded circuits are transpiled locally, so they never spend
the one IonQ job that each run allows.

### Reading the viewer

The **Vista** (*View*) button, at the top right, opens the accessibility
options: profiles (focus on the vector, high contrast, colour blindness,
reduced motion), colour palettes, the shape of the sphere and the vector, what
to hide, light and text size. The camera buttons at the bottom right of the
scene move the camera without the keyboard. The choice is remembered in the
browser. See [`viewer.qmd`](documentation/docs/frontend/viewer.qmd).

### Locally

```bash
make venv && make install   # needs Python 3.12 or newer (see Versions)
make test                   # the test suite
make server                 # the viewer at http://localhost:8000 (PORT=9000)
```

`make server` serves the viewer and runs the same Python code as Qollab. The
viewer has no calculation of its own: compiling and measuring go through Python.
`make demo M=translator` runs the demo of one module; the pipeline is described
in [`spec.md`](spec.md).

## Versions

| Piece | Required | Tested with | Notes |
| --- | --- | --- | --- |
| Python | `>=3.12` | 3.13.16 (CI: 3.12 and 3.13) | Qollab runs 3.14 (Pyodide v314.0.7). Python 3.11 is refused by `pip install`. |
| Qiskit | `>=2.5.2,<3` | 2.5.2 | Qollab ships 2.5.2. |
| qiskit-ionq | `>=1.0.0,<2` | 1.0.0 to 1.1.1 | Qollab ships 1.0.2. Before 1.0.3, tomography on a non-IonQ backend fails. |
| NumPy | `>=2.0,<3` | 2.0.2 and 2.5.4 | Qollab ships 2.4.6. |
| qiskit-qasm3-import | `>=0.6,<1` | 0.6.0 | Only for OpenQASM 3. |
| three.js | n/a | 0.186.1 (standalone and on Qollab) | Loaded from a CDN, so it is not in `requirements.txt`; Qollab provides its own. The standalone viewer uses the same version so both look alike. |

`pyproject.toml` and `requirements.txt` declare the same Python packages (a test
checks it). Details and the reasons: [installation](documentation/docs/getting-started/installation.qmd).
The last full run: 419 tests passed, 1 skipped, and `make lint` clean.

## Limitations

- At most 16 qubits.
- Only IonQ (Aria, Forte, Harmony) and the built-in simulator; IBM, AWS and
  others are not supported.
- The viewer needs WebGL. Under Qollab, the standard three.js addons and the
  speed with 16 qubits are still being verified.
- Qollab does not serve the other files of a project and gives one IonQ job per
  run; the details and the workarounds are in
  [`qollab.qmd`](documentation/docs/frontend/qollab.qmd).
- The vectors of Bloch get shorter, or vanish, while a qubit is entangled
  (`r < 1`). This is expected, and it can happen in the middle of a two-qubit
  gate even if the circuit has no entanglement.
- Tomography (`strategy="tomography"`) on a non-IonQ backend needs
  qiskit-ionq ≥ 1.0.3.

## Tools

Tools used during the project development:

<!-- markdownlint-disable MD033 -->
<table>
    <tr>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/python/python-original.svg" alt="Python" width="40" height="40" />
            <br/>Python
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/javascript/javascript-original.svg" alt="JavaScript" width="40" height="40" />
            <br/>JavaScript
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/html5/html5-original.svg" alt="HTML" width="40" height="40" />
            <br/>HTML
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/css3/css3-original.svg" alt="CSS" width="40" height="40" />
            <br/>CSS
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/numpy/numpy-original.svg" alt="NumPy" width="40" height="40" />
            <br/>NumPy
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.simpleicons.org/qiskit/a56eff" alt="Qiskit" width="40" height="40" />
            <br/>Qiskit
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/threejs/threejs-original.svg" alt="three.js" width="40" height="40" />
            <br/>three.js
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.simpleicons.org/make/9aa4b2" alt="Makefile" width="40" height="40" />
            <br/>Makefile
        </td>
    </tr>
    <tr>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/git/git-original.svg" alt="Git" width="40" height="40" />
            <br/>Git
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/github/github-original.svg" alt="GitHub" width="40" height="40" />
            <br/>GitHub
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/githubactions/githubactions-original.svg" alt="GitHub Actions" width="40" height="40" />
            <br/>GitHub Actions
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/vscode/vscode-original.svg" alt="Visual Studio Code" width="40" height="40" />
            <br/>VS Code
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/bash/bash-original.svg" alt="Bash" width="40" height="40" />
            <br/>Bash
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.simpleicons.org/uv/de5fe9" alt="uv" width="40" height="40" />
            <br/>uv
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/pytest/pytest-original.svg" alt="pytest" width="40" height="40" />
            <br/>pytest
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://plantuml.com/favicon.ico" alt="PlantUML" width="40" height="40" />
            <br/>PlantUML
        </td>
    </tr>
    <tr>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://quarto.org/favicon.png" alt="Quarto" width="40" height="40" />
            <br/>Quarto
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.simpleicons.org/typst/3fb6c4" alt="Typst" width="40" height="40" />
            <br/>Typst
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.simpleicons.org/googlegemini/8E75B2" alt="Gemini" width="40" height="40" />
            <br/>Gemini
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.simpleicons.org/claude/D97757" alt="Claude" width="40" height="40" />
            <br/>Claude Code
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://opencode.ai/favicon.ico" alt="OpenCode" width="40" height="40" />
            <br/>OpenCode
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.simpleicons.org/deepseek/4D6BFE" alt="DeepSeek" width="40" height="40" />
            <br/>DeepSeek
        </td>
    </tr>
</table>
<!-- markdownlint-enable MD033 -->

## License

QViz is released under the [MIT License](LICENSE). It uses Qiskit, qiskit-ionq and
qiskit-qasm3-import (Apache-2.0) and NumPy (BSD-3-Clause) as dependencies, which
does not change the license of this code.
