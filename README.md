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

## Tools

Tools used during the project development:

<!-- markdownlint-disable MD033 -->
<table>
    <tr>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg" alt="Python" width="40" height="40" />
            <br/>Python
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg" alt="JavaScript" width="40" height="40" />
            <br/>JavaScript
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg" alt="HTML" width="40" height="40" />
            <br/>HTML
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg" alt="CSS" width="40" height="40" />
            <br/>CSS
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/makefile/makefile-original.svg" alt="Makefile" width="40" height="40" />
            <br/>Makefile
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg" alt="Git" width="40" height="40" />
            <br/>Git
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg" alt="GitHub" width="40" height="40" />
            <br/>GitHub
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/qiskit/qiskit-original.svg" alt="Qiskit" width="40" height="40" />
            <br/>Qiskit
        </td>
    </tr>
    <tr>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg" alt="Visual Studio Code" width="40" height="40" />
            <br/>VS Code
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
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bash/bash-original.svg" alt="Bash" width="40" height="40" />
            <br/>Bash
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/plantuml/plantuml-original.svg" alt="PlantUML" width="40" height="40" />
            <br/>PlantUML
        </td>
        <td align="center" width="96" style="background: transparent; border: none;">
            <img src="https://quarto.org/favicon.png" alt="Quarto" width="40" height="40" />
            <br/>Quarto
        </td>
    </tr>
</table>
<!-- markdownlint-enable MD033 -->

## License

QViz is released under the [MIT License](LICENSE). It uses Qiskit, qiskit-ionq and
qiskit-qasm3-import (Apache-2.0) and NumPy (BSD-3-Clause) as dependencies, which
does not change the license of this code.
