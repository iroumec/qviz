SHELL := /bin/bash

VENV := .venv
PY := $(VENV)/bin/python
PUML_DIR := documentation/diagrams

.PHONY: venv install test lint demo render-puml install-plantuml

venv:
	python3 -m venv $(VENV)

install:
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -e ".[dev]"

test:
	$(PY) -m pytest tests/ -v

lint:
	$(PY) -m flake8 backend examples main.py scripts tests
	$(PY) -m pydocstyle backend examples

demo:
ifndef M
	$(error Usage: make demo M=translator)
endif
	$(PY) scripts/demo_$(M).py

install-plantuml:
	@sudo apt update && sudo apt install -y plantuml graphviz

render-puml:
	plantuml -tsvg -o svg $(PUML_DIR)/*.puml

test-view:
	python3 -m http.server 8000

# Git workflow makefile is included so that its targets become
# available from the this Makefile.
include Makefile.git

# Quarto.
include Makefile.quarto