SHELL := /bin/bash

VENV := .venv
PY := $(VENV)/bin/python
PUML_DIR := documentation/diagrams

.PHONY: venv install test lint demo outputs qollab server open render-puml install-plantuml

venv:
	python3 -m venv $(VENV)

install:
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -e ".[dev]"

test:
	$(PY) -m pytest source/tests/ -v

lint:
	$(PY) -m flake8 source/backend resources/examples main.py qollab_api.py resources/scripts source/tests
	$(PY) -m pydocstyle source/backend resources/examples

demo:
ifndef M
	$(error Usage: make demo M=translator)
endif
	$(PY) resources/scripts/demo_$(M).py

outputs:
	$(PY) resources/scripts/generate_outputs.py

qollab:
	$(PY) resources/scripts/package_qollab.py viewer

install-plantuml:
	@sudo apt update && sudo apt install -y plantuml graphviz

render-puml:
	plantuml -tsvg -o svg $(PUML_DIR)/*.puml

# The viewer with the Python services of Qollab (resources/scripts/server.py); PORT=9000 changes the port.
server:
	$(PY) resources/scripts/server.py $(if $(PORT),--port $(PORT))

# Like `server`, but it also opens the viewer in the browser.
open:
	$(PY) resources/scripts/server.py $(if $(PORT),--port $(PORT)) --open

install-requirements:
	pip install -r requirements.txt

# Git workflow makefile is included so that its targets become
# available from the this Makefile.
include resources/make/Makefile.git

# Quarto.
include resources/make/Makefile.quarto
