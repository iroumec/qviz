SHELL := /bin/bash
PUML_DIR := documentation/diagrams

.PHONY: test

test:
	source .venv/bin/activate && python -m pytest tests/ -v

install-plantuml:
	@sudo apt update && sudo apt install -y plantuml graphviz

render-puml:
	plantuml -tsvg -o svg $(PUML_DIR)/*.puml

# Git workflow makefile is included so that its targets become
# available from the this Makefile.
include Makefile.git