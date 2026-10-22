# Contributing to QViz

Thanks for helping. QViz is a small educational project, so the rules are short
and the tests are the source of truth.

## Set up

```bash
make venv
make install
make test
make lint
```

Python 3.12 or newer is required. The viewer is plain JavaScript (ES modules)
and three.js; there is no build step for local development.

## Run the viewer

```bash
make server        # http://localhost:8000, with compile and measure in Python
make open          # the same, and opens the browser
```

Use `make server`, not a plain `python -m http.server`: loading a circuit and
measuring need the Python endpoints. `make server` generates `out/` on the first
run, so a fresh clone works.

## Make a change

- Keep the pipeline modules independent. `compiler` only orchestrates; a module
  may use `core.model`, `core.errors`, `core.config`, `core.provider` and
  `core.to_qiskit`, never another pipeline module.
- Do not change the JSON contract (`spec.md` §6) without agreement.
- Use the public exceptions of `core/errors.py`; never `print` inside
  `source/backend/core` (use `logging`).
- Keep the viewer working without Qollab. Qollab-only behavior goes in optional
  hooks (`window.QVIZ_HOST`) or in the generated package.
- Code, identifiers, comments and commit messages are in English. The
  specification and the working notes are in Spanish; the Quarto book is in
  English.
- The internal notes and the AI prompts in `documentation/internal/` are public
  on purpose. Do not remove them or move them out of the repository; they are
  part of how the project was built.

## Before opening a pull request

```bash
make test
make lint
make qollab      # the package for Qollab must still build
# or all three at once:
make verify
```

Update `memory.md` with what changed and what is left, and update the Quarto
book when behavior or a module changes. Do not commit secrets, API keys or
generated files (`out/`, `qollab/`, `__pycache__`).

## Branches and commits

- `main` is stable; `development` is the integration branch.
- Use `make feature NAME=<module>` for a feature branch.
- Commit messages: a short summary in the first line, then bullet points when
  the body helps. Do not force-push and do not skip hooks.
