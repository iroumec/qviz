# Referencia: compuertas nativas de IonQ

> Fuente principal: [Getting started with native gates](https://docs.ionq.com/features/getting-started-with-native-gates), leída el 2026-10-09, más las guías enlazadas desde ahí: [API v0.3](https://docs.ionq.com/api-reference/v0.3/native-gates-api), [Qiskit](https://docs.ionq.com/sdks/qiskit/native-gates-qiskit), [Cirq](https://docs.ionq.com/sdks/cirq/native-gates-cirq) y [PennyLane](https://docs.ionq.com/sdks/pennylane/native-gates-pennylane).
>
> Es un resumen propio en español, no una copia. Las matrices están transcritas tal cual. Lo marcado **[verificado]** se comprobó numéricamente con NumPy contra esas matrices el 2026-10-09. Lo marcado **[error en la doc]** contradice las matrices de la propia doc; en esos casos mandan las matrices (y los tests de M2/M3).

---

## 1. Unidades

- **Todos los parámetros de las compuertas nativas van en turnos**: 1 turno = 2π rad. IonQ dice que así evita errores de conversión de punto flotante, porque el hardware sigue la fase en turnos.
- La API acepta fases entre **−1 y 1** turnos.
- QViz usa **radianes** para las fases y **turnos** para `angle` (ver `spec.md` §5.1). La conversión se hace en el borde: φ_rad = 2π·φ_turnos.

## 2. El gateset

Hay dos compuertas de 1 qubit y **una** de entrelazamiento por QPU:

| Compuerta | Aria | Forte |
| --- | --- | --- |
| GPi | sí | sí |
| GPi2 | sí | sí |
| MS | sí | **no** |
| ZZ | **no** | sí |

- Aria y Forte implementan las transiciones Raman de forma distinta; por eso cambia el entrelazador.
- Las guías de los SDK marcan Aria como **retirado**. En Qollab, las entradas "Aria" son simuladores de un sistema retirado.
- **No se pueden mezclar** compuertas nativas y abstractas en un mismo circuito.
- No existe MS global (GMS): solo MS de 2 qubits.

### 2.1 GPi(φ): rotación de π sobre un eje del ecuador

$$
\mathrm{GPi}(\phi)=\begin{bmatrix}0 & e^{-2\pi i\phi}\\ e^{2\pi i\phi} & 0\end{bmatrix}
$$

- GPi(0) = X y GPi(0.25) = Y. **[verificado]**
- En general GPi(φ) = σ_φ = cos(2πφ)·X + sin(2πφ)·Y: una rotación de π sobre el eje (cos 2πφ, sin 2πφ, 0).
- La doc da `GPi(ϕ) = RZ(-ϕ) · X · RZ(ϕ)`. Con la convención estándar de RZ, eso solo coincide con la matriz si se lee en **orden temporal** (primero RZ(−ϕ)), y además mezcla turnos con radianes. **[error en la doc, o convención no explicitada]**. Usar la matriz.

### 2.2 GPi2(φ): rotación de π/2 sobre un eje del ecuador

$$
\mathrm{GPi2}(\phi)=\frac{1}{\sqrt2}\begin{bmatrix}1 & -ie^{-2\pi i\phi}\\ -ie^{2\pi i\phi} & 1\end{bmatrix}
$$

- Equivale a exp(−iπ/4·σ_φ), sin fase global.
- GPi2(0) = RX(π/2). GPi2(0.5) = RX(−π/2). GPi2(0.25) = RY(π/2). GPi2(−0.25) = RY(−π/2). **[verificado]**
- La doc dice que GPi2(0.5) equivale a RX(π/2). **[error en la doc]**: con su matriz da RX(−π/2).
- Físicamente es un pulso de menor amplitud o más corto que GPi. Con rotaciones de π/2 más control de fase alcanza para la universalidad.

### 2.3 VirtualZ(θ): rotación Z "gratis"

$$
\mathrm{VirtualZ}(\theta)=\begin{bmatrix}e^{-i\pi\theta} & 0\\ 0 & e^{i\pi\theta}\end{bmatrix}=\mathrm{RZ}(2\pi\theta)
$$

- IonQ no tiene una compuerta Z/RZ/P real. La rotación Z se implementa **corriendo la fase de las compuertas que siguen** en ese qubit ("propagación de fase"). En hardware es prácticamente sin ruido.
- La rotación se suma a **todas** las compuertas de 1 qubit que vienen después en ese qubit, no solo a la siguiente.
- **Signo de la propagación.** Con las matrices de arriba, **RZ(λ) seguido de GPi(φ) ≡ GPi(φ − λ) seguido de RZ(λ)**, y lo mismo vale para GPi2. **[verificado]**
  - El ejemplo de la doc (`RZ(θ)–GPi(0.5)–GPi2(0) = GPi(θ+0.5)–GPi2(θ+0)`) usa el signo **+**. **[error en la doc, o convención opuesta no explicitada]**
  - QViz usa el signo verificado: fase física del láser = φ − virtual_z[q] (`spec.md` §6.1).
- RZ conmuta con ZZ. Para MS, la doc solo dice que tener dos fases simplifica la contabilidad de VirtualZ por qubit; la regla está en §3.

### 2.4 MS(φ0, φ1, θ): Mølmer–Sørensen (solo Aria)

$$
\mathrm{MS}(\phi_0,\phi_1,\theta)=\begin{bmatrix}
\cos\pi\theta & 0 & 0 & -ie^{-2\pi i(\phi_0+\phi_1)}\sin\pi\theta\\
0 & \cos\pi\theta & -ie^{-2\pi i(\phi_0-\phi_1)}\sin\pi\theta & 0\\
0 & -ie^{2\pi i(\phi_0-\phi_1)}\sin\pi\theta & \cos\pi\theta & 0\\
-ie^{2\pi i(\phi_0+\phi_1)}\sin\pi\theta & 0 & 0 & \cos\pi\theta
\end{bmatrix}
$$

- MS(φ0, φ1, θ) = exp(−iπθ·σ_φ0 ⊗ σ_φ1). Con φ0 = φ1 = 0 es una compuerta XX.
- **θ en turnos, de 0 (identidad) a 0.25 (entrelazamiento máximo); por defecto 0.25.** El hardware respeta unas **3 cifras decimales** de θ.
- Con θ = 0.25 la matriz es la de "MS totalmente entrelazante" (1/√2 · …) que muestra la doc.
- Distintos pares (φ0, φ1) pueden dar la misma fase relativa. Tener dos parámetros simplifica la contabilidad de VirtualZ por qubit.
- **MS parcial (θ < 0.25):** reemplaza hasta 2 MS completos más 4 rotaciones de 1 qubit. Los ángulos chicos usan menos potencia y tienen menos error: en un sistema ya retirado, la fidelidad 2q pasó de ~97.5 % (π/2) a ~99.6 % (π/100). No hay datos de los sistemas actuales.
- Orden de las matrices: la doc escribe las matrices de 2 qubits con el **primer qubit como bit más significativo** (big-endian). Qiskit es little-endian. En los tests con `qiskit_ionq.MSGate`, verificá el orden de los targets en lugar de suponerlo.

### 2.5 ZZ(θ): solo Forte

$$
\mathrm{ZZ}(\theta)=\exp(-i\pi\theta\,Z\otimes Z)=\mathrm{diag}(e^{-i\pi\theta},\,e^{i\pi\theta},\,e^{i\pi\theta},\,e^{-i\pi\theta})
$$

- La doc **no define rango ni valor por defecto** para θ de ZZ. La API lista `angle` para `zz`, pero el rango 0–0.25 lo enuncia solo para MS.
- QViz normaliza ZZ a [0, 0.25] igual que MS, porque así lo pide el contrato (`spec.md` M2 §2c).

---

## 3. Identidades útiles para la traducción (todas [verificado])

El orden es temporal (primero lo de la izquierda). Las igualdades son salvo fase global; fases en turnos.

| Identidad | Uso en QViz |
| --- | --- |
| H = Z, luego GPi2(0.25) | Regla de `h` |
| CZ = ZZ(0.25), luego RZ(−π/2) en ambos qubits | Regla de `cz` con entrelazador ZZ |
| ZZ(0.25) = GPi2(0.25) en ambos, MS(0, 0, 0.25), GPi2(−0.25) en ambos | `cz` con entrelazador MS; conmutación ZZ→MS |
| MS(0, 0, t) = GPi2(−0.25) en ambos, ZZ(t), GPi2(0.25) en ambos | Conmutación MS→ZZ |
| MS(φ0, φ1, t) = VZ(−φ0), VZ(−φ1), MS(0, 0, t), VZ(φ0), VZ(φ1) | Sacar las fases de MS |
| **CNOT(c,t) = GPi2(c, 0.25), MS(0, 0, 0.25), GPi2(c, 0.5), GPi2(t, 0.5), GPi2(c, −0.25)** | Regla de `cx` con entrelazador MS (5 ops en vez de 11) |

La regla de CNOT es la descomposición CNOT → XX que da la doc (RY(π/2)_c · XX(π/4) · RX(−π/2)_c · RX(−π/2)_t · RY(−π/2)_c, de Maslov, [arXiv:1603.07678](https://arxiv.org/abs/1603.07678)), escrita con compuertas nativas. XX(π/4) = MS(0, 0, 0.25).

**Algoritmo general de conversión** que sugiere IonQ:
1. Descomponer en compuertas de ≤ 2 qubits.
2. Pasar las fáciles a RX/RY/RZ/CNOT.
3. Convertir CNOT a XX.
4. Para unitarias de 2 qubits arbitrarias, usar KAK, `cirq.kak_decomposition` o `qiskit.synthesis.TwoQubitBasisDecomposer` (no siempre óptimos).
5. Reescribir RX/RY/RZ/XX como GPi/GPi2/MS, en turnos.

Es el mismo esquema que sigue `spec.md` M2.

---

## 4. Cómo se envía un circuito nativo

### 4.1 API de IonQ (v0.3)

- `"gateset": "native"` dentro de `input` (por defecto es `"qis"`).
- Cada compuerta lleva:

| `gate` | Parámetros |
| --- | --- |
| `gpi` | `phase`, `target` |
| `gpi2` | `phase`, `target` |
| `ms` (Aria) | `phases` [φ0, φ1], `angle` (opcional, 0.25 por defecto), `targets` |
| `zz` (Forte) | `angle`, `targets` |

- Fases y ángulos en turnos. Índices de qubit desde 0. Un `gate` desconocido da error.

```json
{
  "shots": 1024,
  "target": "simulator",
  "input": {
    "gateset": "native",
    "qubits": 2,
    "circuit": [
      {"gate": "ms", "targets": [0, 1], "phases": [0, 0]},
      {"gate": "gpi", "phase": 0, "target": 0},
      {"gate": "gpi2", "phase": 0, "target": 1}
    ]
  }
}
```

Es probable que `job.compiled_circuit(lang="native")` (`spec.md` M1) devuelva algo con esta forma. **[a verificar en Qollab]**. El translator tiene que aceptar este formato además de un `QuantumCircuit`.

### 4.2 Qiskit (qiskit-ionq)

- Para construir circuitos con compuertas nativas: qiskit-ionq ≥ 0.3.1. Para **transpilar a nativas para Aria y Forte**: ≥ 1.0.0.
- Clases: `GPIGate(phi)`, `GPI2Gate(phi)`, `MSGate(phi0, phi1, theta=0.25)` y `ZZGate(theta)`, importadas **de `qiskit_ionq`**. Las MS y ZZ de `qiskit.circuit.library` son **otras** compuertas.
- `provider.get_backend("simulator", gateset="native")` crea un backend que espera nativas y **saltea el compilador de IonQ**.
- **`transpile(qc, backend=backend_native)` transpila a nativas en local, sin mandar ningún job.** Ver la implicancia para M1 en §6.
- Para el gateset abstracto (`qis`), usar `optimization_level` 0 o 1 (si no, aparece `IonQTranspileLevelWarning`). Mandar una compuerta no soportada da `IonQGateError`.

```python
from qiskit import QuantumCircuit, transpile
from qiskit_ionq import IonQProvider, GPIGate, GPI2Gate, MSGate, ZZGate

backend_native = IonQProvider().get_backend("simulator", gateset="native")

qc = QuantumCircuit(2)
qc.append(MSGate(0, 0), [0, 1])     # turnos
qc.append(GPIGate(0), [0])
qc.append(GPI2Gate(1), [1])

qc_abstract = QuantumCircuit(2); qc_abstract.h(0); qc_abstract.cx(0, 1)
qc_native = transpile(qc_abstract, backend=backend_native)   # local, sin job
```

### 4.3 Otros SDK (solo como referencia)

- **Cirq** (`cirq_ionq.ionq_native_gates`): tiene GPI, GPI2 y MS, pero **no ZZ**. Transpila a Aria con `AriaNativeGateset`; Forte está "en progreso".
- **PennyLane** (`pennylane_ionq.ops`, ≥ 0.28): tiene GPI, GPI2 y MS, sin ZZ y sin transpilación automática.

---

## 5. Compilador, mitigación y advertencias

- Mandar nativas es **la única forma de saltear el compilador y el optimizador** de IonQ. Se ejecuta exactamente lo que se envía.
- Con nativas, el toolchain de compilación y optimización se apaga por completo, y la **mitigación de errores (debiasing) también se apaga por defecto**. Se puede volver a activar, pero la doc no dice cómo.
- IonQ advierte que, para correr algoritmos comunes, las nativas suelen dar **peores** resultados que dejar que IonQ compile: su compilador hace optimizaciones propietarias y no documentadas (elimina y conmuta compuertas, aplica heurísticas, reoptimiza).
- Las nativas sirven cuando hace falta saber **exactamente qué corrió**: caracterización de ruido, mitigación propia, desarrollo de compiladores… y visualización pedagógica, que es el caso de QViz.

---

## 6. Implicancias para QViz

| Tema | Qué hace QViz | Dónde |
| --- | --- | --- |
| Turnos ↔ radianes | Fases en rad en la representación intermedia y en el JSON; `angle` en turnos | `spec.md` §5.1 |
| Signo de la propagación de VirtualZ | Fase del láser = φ − virtual_z[q] (verificado; la doc dice +) | `spec.md` §6.1 |
| Rango de ZZ | Se normaliza a [0, 0.25] como MS (la doc no lo define) | `spec.md` M2 §2c |
| CNOT con MS | Descomposición de Maslov en 5 ops nativas | `spec.md` M2 §2b |
| Formato de IonQ | El translator acepta el JSON nativo de la API, además de `QuantumCircuit` | `spec.md` M2 §2b |
| Transpilación nativa local | Estrategia candidata para IonQ que no gasta el único job: `transpile(qc, backend=<backend con gateset="native">)`. Hay que verificar si en Qollab se puede obtener un backend nativo (qollab_context §8.4) | `spec.md` M1 §1c |
| Tomografía (M8) | Si se mandan prefijos nativos, IonQ no recompila ni mitiga: el estado medido corresponde exactamente a los ops visualizados | `spec.md` M8 |
| Precisión de θ | El hardware respeta ~3 decimales; el JSON usa 6. No afecta a la visualización | — |

---

## 7. Referencias externas citadas por IonQ

- Maslov, *Basic circuit compilation techniques for an ion-trap quantum machine*: [arXiv:1603.07678](https://arxiv.org/abs/1603.07678) (CNOT → XX).
- KAK: [arXiv:quant-ph/0507171](https://arxiv.org/abs/quant-ph/0507171). [`qiskit.synthesis.TwoQubitBasisDecomposer`](https://docs.quantum.ibm.com/api/qiskit/qiskit.synthesis.TwoQubitBasisDecomposer).
- Mølmer–Sørensen: [PRL 82, 1835](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.82.1835) y [PRA 59, R2539](https://journals.aps.org/pra/abstract/10.1103/PhysRevA.59.R2539).
- MS parcial y fidelidad: [Nat. Commun. 10, 5464 (2019)](https://www.nature.com/articles/s41467-019-13534-2) y [npj QI 6, 34 (2020)](https://www.nature.com/articles/s41534-020-0259-3).
