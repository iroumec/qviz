"""M0 smoke tests: public API and intermediate representation."""

import backend
from backend.core.model import NativeOp


def test_backend_exposes_compile():
    assert callable(backend.compile)


def test_backend_exposes_export():
    assert callable(backend.export)


def test_backend_exposes_version():
    assert isinstance(backend.__version__, str)


def test_native_op_is_frozen():
    op = NativeOp("gpi", (0,), phases=(0.0,))
    assert op.name == "gpi"
    assert op.targets == (0,)
    assert op.phases == (0.0,)
