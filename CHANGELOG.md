# Changelog

All notable changes to QViz are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `CONTRIBUTING.md`, `.editorconfig`, issue and pull-request templates, and
  `make verify` (tests, linters and the Qollab package in one command).
- JavaScript syntax checking in `make lint` and in CI, plus a Python 3.14 job.
- Node tests for the file helpers, the host bridge and the availability probe.

### Changed

- The viewer style moved from `index.html` to `source/frontend/styles.css`;
  `make qollab` copies it to `main.css`.
- The internal notes and AI prompts moved to `documentation/internal/` and stay
  public. Nothing was removed from the repository.
- `make server` generates `out/` on the first run, and the demo scripts always
  write to the repository `out/`, not the current directory.
- The example circuits come from one catalog (`resources/examples/catalog.py`),
  shared by the viewer, the Qollab package and the generator.
- The load button and *Medir* are disabled when the page has no Python, and the
  previous circuit stays on screen if a new file fails to compile. A newer
  circuit choice wins over a slower, older load, and the status line shows what
  is loading.
- The local server serves files only: no directory listings and no `.git`,
  `.venv` or `__pycache__`.

### Fixed

- OpenQASM files saved with a UTF-8 BOM are accepted.
- A non-JSON reply from the server is reported as a readable error instead of a
  parser error.
- The scene no longer allocates small arrays on idle frames, which keeps the
  frame rate steadier with sixteen ions.
- The selector no longer stays empty when `out/manifest.json` is missing.

## [0.1.0] - 2026-10-11

The hackathon delivery: the full compile pipeline, the trapped-ion viewer, the
Qollab package, the accessibility panel, the circuit timeline and the Quarto
book.
