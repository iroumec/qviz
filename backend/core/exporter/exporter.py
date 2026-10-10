"""Export the visualization dictionary as JSON."""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def export(data: dict, path: str | None = None) -> str:
    """Serialize ``data`` to indented JSON and optionally write it to disk."""
    text = json.dumps(data, ensure_ascii=False, indent=2)
    if path is not None:
        Path(path).write_text(text, encoding="utf-8")
        logger.info("wrote visualization JSON to %s", path)
    return text
