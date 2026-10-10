SHELL := /bin/bash

VENV := .venv
PY := $(VENV)/bin/python
PUML_DIR := documentation/diagrams

.PHONY: venv install test lint demo outputs qollab server resume render-puml install-plantuml

venv:
	python3 -m venv $(VENV)

install:
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -e ".[dev]"

test:
	$(PY) -m pytest tests/ -v

lint:
	$(PY) -m flake8 backend examples main.py qollab_api.py scripts tests
	$(PY) -m pydocstyle backend examples

demo:
ifndef M
	$(error Usage: make demo M=translator)
endif
	$(PY) scripts/demo_$(M).py

outputs:
	$(PY) scripts/generate_outputs.py

qollab:
	$(PY) scripts/package_qollab.py viewer

resume:
	@git fetch -q 2>/dev/null; git status -sb; echo; git log --oneline -5
	@echo; echo "--- Pendientes (memory.md) ---"
	@sed -n '/^## Pendientes/,/^## Equipo/p' memory.md | sed '$$d'

install-plantuml:
	@sudo apt update && sudo apt install -y plantuml graphviz

render-puml:
	plantuml -tsvg -o svg $(PUML_DIR)/*.puml

# The viewer with the Python services of Qollab (scripts/server.py); PORT=9000 changes the port.
server:
	$(PY) scripts/server.py $(if $(PORT),--port $(PORT))

install-requirements:
	pip install -r requirements.txt

# Git workflow makefile is included so that its targets become
# available from the this Makefile.
include make/Makefile.git

# Quarto.
include make/Makefile.quarto