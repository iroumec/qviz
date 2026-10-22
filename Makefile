SHELL := /bin/bash

VENV := .venv
PY := $(VENV)/bin/python
PNPM ?= corepack pnpm
PUML_DIR := documentation/diagrams

.PHONY: venv install install-js test coverage lint lint-js audit-js demo outputs qollab verify server open resume render-puml install-plantuml

## venv: create the virtual environment (Python 3.12+).
venv:
	python3 -m venv $(VENV)

## install: install the package and the developer tools.
install:
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -e ".[dev]"

## test: run the pytest suite.
test:
	$(PY) -m pytest source/tests/ -v

## coverage: run the tests with coverage of the backend (fails under 90 %).
coverage:
	$(PY) -m pytest source/tests/ --cov=source/backend --cov-report=term-missing --cov-fail-under=90

## lint: run flake8, pydocstyle and the JavaScript linter.
lint: lint-js
	$(PY) -m flake8 source/backend resources/examples main.py qollab_api.py resources/scripts source/tests
	$(PY) -m pydocstyle source/backend resources/examples

## install-js: install the JavaScript linters with pnpm.
install-js:
	$(PNPM) install --frozen-lockfile --ignore-scripts

## lint-js: check the syntax and the style of the viewer modules.
lint-js:
	@if command -v node >/dev/null 2>&1; then \
		for file in source/frontend/js/*.js; do node --check "$$file" || exit 1; done; \
		if [ -x node_modules/.bin/eslint ]; then \
			node_modules/.bin/eslint --config eslint.config.js source/frontend/js; \
		else \
			echo "ESLint is not installed: run make install-js"; \
		fi; \
	else \
		echo "node not found: skipping the JavaScript syntax check"; \
	fi

## audit-js: check the JavaScript dependencies for known vulnerabilities.
audit-js:
	$(PNPM) audit --audit-level=high

## demo: run one module demo (M=translator).
demo:
ifndef M
	$(error Usage: make demo M=translator)
endif
	$(PY) resources/scripts/demo_$(M).py

## outputs: generate out/ with the example circuits and the manifest.
outputs:
	$(PY) resources/scripts/generate_outputs.py

## qollab: build the JS project that is uploaded to Qollab.
qollab:
	$(PY) resources/scripts/package_qollab.py viewer

## verify: run the tests with coverage, the linters and the Qollab package build.
verify: coverage lint qollab

## resume: show the branch, the last commits and the pending items.
resume:
	@git fetch -q 2>/dev/null; git status -sb; echo; git log --oneline -5
	@echo; echo "--- Pendientes (documentation/internal/memory.md) ---"
	@sed -n '/^## Pendientes/,/^## Equipo/p' documentation/internal/memory.md | sed '$$d'

## install-plantuml: install PlantUML and Graphviz with apt.
install-plantuml:
	@sudo apt update && sudo apt install -y plantuml graphviz

## render-puml: render the PlantUML diagrams to SVG.
render-puml:
	plantuml -tsvg -o svg $(PUML_DIR)/*.puml

## server: serve the viewer locally with compile and measure in Python (PORT=9000).
# The example circuits are generated on the first run, so that a fresh clone works.
server: out/manifest.json
	$(PY) resources/scripts/server.py $(if $(PORT),--port $(PORT))

## open: like server, and opens the browser.
open: out/manifest.json
	$(PY) resources/scripts/server.py $(if $(PORT),--port $(PORT)) --open

out/manifest.json: resources/scripts/generate_outputs.py
	$(PY) resources/scripts/generate_outputs.py

## install-requirements: install requirements.txt with the system pip.
install-requirements:
	pip install -r requirements.txt

# Git workflow makefile is included so that its targets become
# available from the this Makefile.
include resources/make/Makefile.git

# Quarto.
include resources/make/Makefile.quarto
