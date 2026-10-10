"""Copy exactly the files of the Qollab JS project into ``qollab/``.

The whole repository is more than Qollab accepts (100 files per project, and an
upload over the limit is rejected completely), and Qollab only looks at the
files of the root to decide the type of the project. This script builds the JS
project that is uploaded: ``index.html`` and ``main.js`` (from
``scripts/qollab_js_probe``), ``qollab_api.py``, ``requirements.txt`` and the
libraries ``backend/`` and ``examples/``. ``main.py`` is left out on purpose: in
a JS project it could compile a second time and spend a second IonQ job.

Upload the **content** of ``qollab/``. See ``documentation/prompts/qollab_pruebas.md``.

Run with: python scripts/package_qollab.py   (or: make qollab)
"""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "qollab"
MAX_FILES = 100
MAX_BYTES = 2_000_000

_LIBRARY = ("backend", "examples")
_SHARED = ("qollab_api.py", "requirements.txt")
_PAGE = Path("scripts") / "qollab_js_probe"
_PAGE_FILES = ("index.html", "main.js")


def _library_files() -> list[Path]:
    """Return the paths, relative to the root, of the library and shared files."""
    files = [Path(name) for name in _SHARED]
    for folder in _LIBRARY:
        files += sorted(
            path.relative_to(ROOT)
            for path in (ROOT / folder).rglob("*")
            if path.is_file()
            and "__pycache__" not in path.parts
            and path.suffix != ".pyc"
        )
    return files


def package(out_dir: Path = OUT) -> list[Path]:
    """Write the project folder and return its files, as paths inside it."""
    if out_dir.exists():
        shutil.rmtree(out_dir)
    pairs = [(path, path) for path in _library_files()]
    pairs += [(_PAGE / name, Path(name)) for name in _PAGE_FILES]
    for source, target in pairs:
        destination = out_dir / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / source, destination)

    too_big = [
        str(target)
        for _, target in pairs
        if (out_dir / target).stat().st_size > MAX_BYTES
    ]
    if len(pairs) > MAX_FILES or too_big:
        raise SystemExit(
            f"{len(pairs)} files (max {MAX_FILES}); too big: {too_big}"
        )
    return [target for _, target in pairs]


def main() -> None:
    """Build the folder and print what to upload."""
    files = package()
    print(f"qollab/: {len(files)} files (limit {MAX_FILES})")
    print("Upload the content of qollab/ (not the folder itself) as a JS project.")


if __name__ == "__main__":
    main()
