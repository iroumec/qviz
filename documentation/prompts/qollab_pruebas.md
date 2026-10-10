# Pruebas en Qollab: medición (M9) y lo que sigue pendiente

> Escrito el 2026-10-10. El código no se puede ejecutar en Qollab desde el repositorio: esta guía le dice al equipo qué subir, qué correr y qué resultado esperar. Lo que sale distinto de lo esperado se anota en `spec.md` §10.

## 1. Qué se quiere comprobar

| # | Pregunta | Por qué importa |
|---|---|---|
| 1 | ¿`main.py` corre en Built-in y en los simuladores de IonQ (Aria y Forte)? | Es el camino completo: detección, transpilación, simulación, formato y medición. |
| 2 | ¿Los IBM y el AWS local se rechazan con `ProviderDisabledError`? | Están desactivados por defecto (`spec.md` §5.5). |
| 3 | **¿Una página JS puede llamar a Python con `callPromising` desde un clic, después de la primera corrida?** | Es el pendiente 2 de `qollab_context.md` §8 y decide cómo se hace el botón Medir. |
| 4 | ¿Cuánto tardan `compile` y `sample` en Pyodide con 16 qubits? | Corre en un solo hilo y puede congelar la página (`qollab_context.md` §8, punto 5). |
| 5 | ¿Funciona `import * as api from "qollab_api"` para un archivo Python de la raíz? | Es la forma documentada de importar, pero con un módulo suelto no está probada. |
| 6 | ¿Medir un paso gasta un job de IonQ? | No debería: la medición es local. |

## 2. Qué subir a Qollab

Subí estos archivos, respetando las carpetas (son unos 42, el límite es 100 por proyecto y 2 MB cada uno):

```text
main.py                 (solo para la prueba 1)
qollab_api.py
requirements.txt
backend/                (todo, incluidos los __init__.py)
examples/               (todo, incluido __init__.py)
```

No hace falta subir `tests/`, `scripts/`, `documentation/`, `frontend/` ni `shaders/`.

`requirements.txt` ya tiene `qiskit`, `qiskit-ionq` y `numpy`. No agregues nada más.

## 3. Prueba 1: proyecto Python (`main.py`)

Con `main.py` y sin `index.html` Qollab lo trata como un proyecto Python y arma un formulario con los parámetros de `main`.

| Campo | Qué poner |
|---|---|
| `circuit` | `bell` (luego `ghz16` y `layered16`) |
| `shots` | `1024` |
| `entangler` | `auto` |
| `step` | `0` (el último paso) |

Corré con cada uno de estos backends, uno por vez:

1. **Built-in**.
2. **IonQ Aria 2 (simulador)**, **IonQ Forte 1 (simulador)** e **IonQ Forte Enterprise 1**. Cada corrida usa el único job permitido (el dry-run del transpiler); no vuelvas a apretar Run sin más: si sale "only one job is allowed", apretá Stop y Run.
3. **AWS Braket local** y un **IBM con ruido** (por ejemplo Boston): se espera un error.
4. **No corras en hardware de IonQ**: gasta créditos.

### Salida esperada (Built-in, `bell`)

```text
backend : basic_simulator → iones (referencia Aria)
circuit : bell (2 qubits, 7 steps)
compile : 1.xx s
{ ...el JSON completo... }
sample  : step 7, 1024 shots, 0.0x s
  00     5xx   5x.x %
  11     4xx   4x.x %
  01       x    0.x %
  10       x    0.x %
```

Lo que se mira:

- **`00` y `11` suman casi todo** (más del 95 %). `01` y `10` aparecen poco (alrededor del 1.5 %): es el ruido del modelo, no la falta de entrelazamiento. Con el muestreo independiente anterior habría salido 25 % cada uno.
- En IonQ Forte, los pasos usan `zz` en lugar de `ms`.
- Con `layered16` el JSON no se imprime (solo su tamaño, unos 1000 kB). Anotá `compile` y `sample`: en Python nativo tardan 0.9 s cada uno.

### Salida esperada en IBM y AWS

```text
ProviderDisabledError: backend 'fake_boston' was detected as provider 'ibm', which is not enabled (enabled providers: ionq, local); see config.ENABLED_PROVIDERS
```

## 4. Prueba 2: proyecto JS (llamar a Python desde un clic)

Qollab decide el tipo de proyecto por los archivos de la raíz: con `index.html` y `main.js` es un proyecto JS (la página se dibuja sobre la consola). **Hacelo en un proyecto aparte, o quitá `main.py`.** Así no queda dudas sobre cuál corre.

1. Creá un proyecto nuevo y subí `qollab_api.py`, `requirements.txt`, `backend/` y `examples/` (sin `main.py`).
2. Subí `index.html` y `main.js` desde `scripts/qollab_js_probe/`.
3. Elegí el backend (Built-in primero) y apretá Run. Debería aparecer la página con el estado `Ready. Press 1. Compile.`
4. Apretá **1. Compile**. Después apretá **2. Measure** varias veces, cambiando `Step` y `Shots`.

### Qué muestra el registro

```text
module "qollab_api" imported; exports: run, sample_step
typeof backend: object; name: basic_simulator
COMPILE ok in 1500 ms: basic_simulator → iones (referencia Aria)
        2 qubits, 7 steps, 3 kB, typeof result: string
MEASURE #1 ok in 100 ms: step 7, 1024 shots, typeof result: string
  00     5xx   5x.x %
  11     4xx   4x.x %
  01       x    0.x %
  10       x    0.x %
  PASS: Bell gives 00 and 11 (01 and 10 are only 1.x %)
MEASURE #2 ok ...
```

- **`MEASURE #2`, `#3`… funcionan** (aunque la primera ya se hizo): eso responde la pregunta 3.
- Con IonQ, **apretá Compile una sola vez**: el botón se desactiva solo. Medir muchas veces no debería dar ningún error de job (pregunta 6).
- Probá `layered16` con `Step` en 0 (el último): anotá los tiempos de `COMPILE` y `MEASURE` y fijate si la página se congela.

### Errores posibles

| Mensaje | Qué significa |
|---|---|
| `ConnectionError ... XHR is not supported` | Se llamó a Python sin `callPromising`. No debería pasar con este código: avisanos. |
| `only one job is allowed per code run` | Se apretó Compile dos veces en IonQ, o se volvió a correr sin Stop. |
| `No module named 'examples'` o `'backend'` | Falta una carpeta o un `__init__.py` en la subida. |
| `api.run is undefined` o el módulo no importa | `import * as api from "qollab_api"` no funciona para un archivo de la raíz. Anotá el mensaje exacto: hay que probar otro nombre de módulo. |
| `Map` o `{}` en vez de la lista | No debería pasar: las funciones devuelven texto. |
| `ProviderDisabledError` | Elegiste un backend IBM o AWS. Es lo esperado. |

## 5. Resultados (completar)

| Fecha | Backend | Prueba | ¿Funcionó? | `compile` (s) | `sample` / Measure (ms) | Observaciones |
|---|---|---|---|---|---|---|
| | Built-in | 1 (`bell`) | | | | |
| | Built-in | 1 (`layered16`) | | | | |
| | Built-in | 2 (clic, `bell`) | | | | |
| | Built-in | 2 (clic, `layered16`) | | | | |
| | IonQ Aria 2 (sim) | 1 | | | | |
| | IonQ Forte 1 (sim) | 1 | | | | |
| | IonQ Forte 1 (sim) | 2 | | | | |
| | IonQ Forte Enterprise 1 (sim) | 1 | | | | |
| | AWS Braket local | 1 | | | | esperado: `ProviderDisabledError` |
| | IBM Boston | 1 | | | | esperado: `ProviderDisabledError` |

## 6. Cómo decidir con los resultados

- **Si el clic llama a Python (preguntas 3, 5 y 6 bien):** el botón Medir del visor usa `sample_step` y se descarta el muestreo por marginales del frontend.
- **Si el clic no puede llamar a Python:** la alternativa es reconstruir y simular el circuito en JavaScript a partir del JSON (ver `spec.md` §M9). Avisanos y lo preparamos.
- **Si `sample` es muy lento con 16 qubits:** se puede bajar `MAX_QUBITS` para esta función o medir solo hasta 12 qubits; los tiempos que anotes definen el límite.
