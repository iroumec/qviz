"""Export the visualization dictionary as JSON.

The output is indented like ``json.dumps(indent=2)``, but a **simple array** is
written on a single line. A simple array is a list of numbers, strings, booleans
or nulls, or a list of such lists. For example, a ``states`` field is written as
``[[0.0, 0.0, 1.0], [0.0, 0.0, 1.0]]`` instead of four separate lines. Objects
and arrays that contain objects stay indented.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_INDENT = 2


def _is_scalar(value: Any) -> bool:
    return value is None or isinstance(value, (bool, int, float, str))


def _is_simple_array(value: list) -> bool:
    """Return whether a list can be written on one line."""
    for item in value:
        if _is_scalar(item):
            continue
        if isinstance(item, list) and all(_is_scalar(element) for element in item):
            continue
        return False
    return True


def _dumps(value: Any, level: int = 0) -> str:
    """Serialize ``value`` with indentation, but inline simple arrays."""
    pad = " " * (_INDENT * level)
    inner_pad = " " * (_INDENT * (level + 1))

    if isinstance(value, dict):
        if not value:
            return "{}"
        parts = []
        for key, item in value.items():
            rendered_key = json.dumps(key, ensure_ascii=False)
            parts.append(f"{inner_pad}{rendered_key}: {_dumps(item, level + 1)}")
        return "{\n" + ",\n".join(parts) + "\n" + pad + "}"

    if isinstance(value, list):
        if not value:
            return "[]"
        if _is_simple_array(value):
            return json.dumps(value, ensure_ascii=False)
        parts = [f"{inner_pad}{_dumps(item, level + 1)}" for item in value]
        return "[\n" + ",\n".join(parts) + "\n" + pad + "]"

    return json.dumps(value, ensure_ascii=False)


def export(data: dict, path: str | None = None) -> str:
    """Serialize ``data`` to indented JSON and optionally write it to disk.

    Simple arrays are kept on one line, so that the file stays readable.
    """
    text = _dumps(data)
    if path is not None:
        Path(path).write_text(text, encoding="utf-8")
        logger.info("wrote visualization JSON to %s", path)
    return text
