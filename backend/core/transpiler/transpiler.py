"""Transpile the user circuit to the provider basis or to IonQ native gates.

This is the only pipeline module (besides tomography) allowed to touch
``backend.run``. For IonQ it tries, in order:
``native-local`` -> ``remote`` (a single dry-run job) -> ``local``.
"""

from __future__ import annotations

import logging
from typing import Any

from qiskit import QuantumCircuit
from qiskit import transpile as qiskit_transpile

from backend.core import config
from backend.core.errors import (
    CircuitTooLargeError,
    TranspilationError,
    UnsupportedOperationError,
)
from backend.core.model import BackendInfo, Source, TranspiledCircuit

logger = logging.getLogger(__name__)

_FALLBACK_BASIS = ["rz", "sx", "x", "cz", "cx"]
_JOB_SETTINGS = {"compilation": {"service_version": "v0.4"}}


def transpile(
    info: BackendInfo,
    backend: Any,
    qc: QuantumCircuit,
    *,
    allow_remote: bool = True,
) -> TranspiledCircuit:
    """Transpile ``qc`` for ``backend`` without measurements and with a size check.

    ``allow_remote=False`` forbids the IonQ dry-run job, which the tomography
    strategy needs because it spends the single allowed job itself.
    """
    circuit = qc.remove_final_measurements(inplace=False)

    limit = _effective_max_qubits(backend)
    if circuit.num_qubits > limit:
        raise CircuitTooLargeError(
            f"circuit has {circuit.num_qubits} qubits, maximum is {limit}"
        )
    if circuit.num_qubits == 0:
        raise TranspilationError("circuit has no qubits")
    if circuit.parameters:
        names = ", ".join(sorted(p.name for p in circuit.parameters))
        raise UnsupportedOperationError(
            f"circuit has unbound parameters ({names}); bind them before compiling"
        )

    if info.provider == "ionq":
        return _transpile_ionq(info, backend, circuit, allow_remote=allow_remote)
    return _transpile_generic(info, backend, circuit)


def _effective_max_qubits(backend: Any) -> int:
    """Return the allowed width: the smaller of the cap and the backend width.

    The cap is ``config.MAX_QUBITS``. When the backend exposes its own number of
    qubits, that value is also respected, so that a circuit is never sent to a
    backend that is too small for it.
    """
    backend_qubits = getattr(backend, "num_qubits", None)
    if isinstance(backend_qubits, int) and backend_qubits > 0:
        return min(config.MAX_QUBITS, backend_qubits)
    return config.MAX_QUBITS


def _layout_of(circuit: QuantumCircuit) -> tuple[int, ...] | None:
    layout = getattr(circuit, "layout", None)
    if layout is None:
        return None
    initial = layout.initial_index_layout(filter_ancillas=True)
    if initial is None:
        return None
    return tuple(int(q) for q in initial)


def _as_transpiled(circuit: QuantumCircuit, source: Source) -> TranspiledCircuit:
    return TranspiledCircuit(
        source=source,
        num_qubits=circuit.num_qubits,
        circuit=circuit,
        layout=_layout_of(circuit),
    )


def _gateset_of(backend: Any) -> str | None:
    options = getattr(backend, "options", None)
    if options is None:
        return None
    gateset = getattr(options, "gateset", None)
    return gateset if isinstance(gateset, str) else None


def _remote_native(backend: Any, circuit: QuantumCircuit) -> Any:
    job = backend.run(circuit, dry_run=True, job_settings=_JOB_SETTINGS)
    wait = getattr(job, "wait_for_final_state", None)
    if callable(wait):
        wait(timeout=config.REMOTE_JOB_TIMEOUT_S)
    return job.compiled_circuit(lang="native")


def _transpile_ionq(
    info: BackendInfo,
    backend: Any,
    circuit: QuantumCircuit,
    *,
    allow_remote: bool = True,
) -> TranspiledCircuit:
    # Strategy 1: native-local transpile, no job spent.
    if _gateset_of(backend) == "native":
        try:
            native_qc = qiskit_transpile(circuit, backend=backend, optimization_level=1)
            return _as_transpiled(native_qc, source="ionq-native")
        except Exception as exc:  # noqa: BLE001 - any failure falls back
            logger.warning(
                "IonQ native-local transpile failed (%s); trying remote", exc
            )

    # Strategy 2: remote dry-run, consumes the single allowed job.
    if allow_remote:
        try:
            result = _remote_native(backend, circuit)
            if isinstance(result, QuantumCircuit):
                return _as_transpiled(result, source="ionq-native")
            if isinstance(result, dict):
                result = result.get("circuit", result)
            if isinstance(result, (list, tuple)):
                ops = tuple(dict(op) for op in result)
                return TranspiledCircuit(
                    source="ionq-native",
                    num_qubits=circuit.num_qubits,
                    native_ops=ops,
                )
            raise TranspilationError(
                f"unexpected native payload: {type(result).__name__}"
            )
        except Exception as exc:  # noqa: BLE001 - fall back to local transpile
            logger.warning(
                "IonQ remote native transpile failed (%s); "
                "falling back to local transpile",
                exc,
            )
    else:
        logger.info("IonQ remote transpile disabled (allow_remote=False)")

    # Strategy 3: local standard transpile, treated like any other provider.
    return _transpile_generic(info, backend, circuit)


def _transpile_generic(
    info: BackendInfo, backend: Any, circuit: QuantumCircuit
) -> TranspiledCircuit:
    try:
        result = qiskit_transpile(circuit, backend=backend, optimization_level=1)
    except Exception as exc:  # noqa: BLE001 - retry without coupling map
        logger.warning(
            "transpile with backend failed (%s); retrying with fallback basis", exc
        )
        try:
            result = qiskit_transpile(
                circuit, basis_gates=list(_FALLBACK_BASIS), optimization_level=1
            )
        except Exception as exc2:  # noqa: BLE001
            raise TranspilationError(f"could not transpile circuit: {exc2}") from exc2
    return _as_transpiled(result, source="qiskit")
