import backend

def test_backend_exposes_compile():
    assert callable(backend.compile)

def test_backend_exposes_version():
    assert isinstance(backend.__version__, str)
