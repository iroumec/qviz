"""M0 smoke tests: public API and intermediate representation."""

import dataclasses

import pytest

import backend
from backend.core.model import NativeOp


def test_public_api():
    assert set(backend.__all__) == {
        "compile",
        "export",
        "load_circuit",
        "sample",
        "__version__",
    }
    for name in backend.__all__:
        assert hasattr(backend, name)


def test_native_op_is_frozen():
    op = NativeOp("gpi", (0,), phases=(0.0,))
    assert op.name == "gpi"
    assert op.targets == (0,)
    assert op.phases == (0.0,)
    with pytest.raises(dataclasses.FrozenInstanceError):
        op.name = "gpi2"
