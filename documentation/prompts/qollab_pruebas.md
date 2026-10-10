# Pruebas en Qollab: medición (M9) y lo que sigue pendiente

> Escrito el 2026-10-10. El código no se puede ejecutar en Qollab desde el repositorio: esta guía le dice al equipo qué subir, qué apretar y qué resultado esperar. Lo que salga distinto de lo esperado se anota en `spec.md` §10.

## 1. Qué se quiere comprobar

| # | Pregunta | Por qué importa |
|---|---|---|
| 1 | ¿Una página JS puede llamar a Python con `callPromising` desde un clic, **después** de la primera corrida? | Es el pendiente 2 de `qollab_context.md` §8 y decide cómo se hace el botón Medir. |
| 2 | ¿Cada clic recalcula con el valor actual de `Step` y `Shots`? | La medición tiene que cambiar al cambiar el paso. |
| 3 | ¿Funciona `import * as api from "qollab_api"` para un archivo Python de la raíz? | Es la forma documentada de importar, pero con un módulo suelto no está probada. |
| 4 | ¿Funciona en el simulador Built-in y en los simuladores de IonQ (Aria y Forte)? | Es el camino completo: detección, transpilación, simulación, formato y medición. |
| 5 | ¿Cuánto tardan `compile` y `sample` en Pyodide con 16 qubits? | Corre en un solo hilo y puede congelar la página (`qollab_context.md` §8, punto 5). |
| 6 | ¿Medir un paso gasta un job de IonQ? | No debería: la medición es local. |
| 7 | ¿Los IBM y el AWS local se rechazan con `ProviderDisabledError`? | Están desactivados por defecto (`spec.md` §5.5). |

> **Estado (2026-10-10).** La página de diagnóstico (`make qollab-probe`) ya pasó en Built-in: la llamada desde un clic funciona (ver `spec.md` §10). Ahora `make qollab` sube **el visor real** con el botón Medir conectado al backend; la sección 6 dice qué mirar. Reglas para tocar el visor: `documentation/docs/frontend/qollab.qmd`.

## 2. Qué subir a Qollab: un único proyecto JS

**No subas el repositorio entero.** Tiene más de 100 archivos, y Qollab admite 100 por proyecto y rechaza la subida completa si se pasa. Además, Qollab decide el tipo de proyecto solo por los archivos de la raíz (`qollab_context.md` §2), y hoy la raíz tiene `main.py` y ningún `index.html`: sería un proyecto Python, sin botones.

Corré:

```bash
make qollab
```

Arma la carpeta `qollab/` (no se versiona) con **un proyecto JS completo**:

```text
index.html        el visor real (o, con `make qollab-probe`, la página de diagnóstico)
main.css          el estilo del visor, sin cambios
main.js           un preludio generado + el script del visor, sin cambios
qollab_api.py     las funciones que llama la página (devuelven texto)
requirements.txt
backend/          la biblioteca
examples/         los circuitos de ejemplo
```

`make qollab` arma el visor (44 archivos) y `make qollab-probe` la página de diagnóstico (43), que es la de las secciones 3 a 5.

Subí el **contenido** de `qollab/` (no la carpeta misma), de modo que `index.html` y `main.js` queden en la raíz del proyecto. Se puede subir una y otra vez sobre el mismo proyecto de Qollab: después de cambiar algo en el repositorio, `make qollab` y volver a subir.

`main.py` queda fuera a propósito. En un proyecto JS podría correr también y compilar una segunda vez, y en IonQ eso gastaría un segundo job ("only one job is allowed"). La página hace lo mismo que `main.py` (compila y mide), así que no se pierde nada. `main.py` sigue siendo la entrada si se sube el proyecto como proyecto Python.

## 3. Cómo probar

1. Elegí un backend en *Select QPU* (empezá con **Built-in**) y apretá Run. Debería verse la página con `Ready. Press 1. Compile.`
2. **1. Compile.** Elegí antes el circuito (`bell` primero). En IonQ, apretalo una sola vez: el botón se desactiva solo.
3. **3. Run checks.** Es la prueba principal: hace 4 mediciones (pasos 0, 1, la mitad y el último) llamando a Python cada vez, y las compara con las probabilidades que el propio JSON ya trae. Termina con `ALL CHECKS PASS` o `N CHECK(S) FAILED`.
4. **2. Measure.** Para mirar a mano: cambiá `Step` y `Shots` y apretalo varias veces.

### Salida esperada (Built-in, `bell`)

```text
module "qollab_api" imported; exports: run, sample_step
typeof backend: object; name: basic_simulator
COMPILE ok in 1500 ms: basic_simulator → iones (referencia Aria)
        2 qubits, 7 steps, 3 kB, typeof result: string
CHECKS on bell (4000 shots per step)
  step   0: worst |measured - expected| = 0.001 in 120 ms  PASS
  step   1: worst |measured - expected| = 0.001 in 100 ms  PASS
  step   4: worst |measured - expected| = 0.012 in 100 ms  PASS
  step   7: worst |measured - expected| = 0.001 in 100 ms  PASS
  correlations: 1.5 % of the shots are not all-0 or all-1 (expected 1.6 %; independent qubits would give 50.0 %)  PASS
ALL CHECKS PASS
```

Los tiempos de Qollab serán mayores. Esta salida se verificó con un arnés de Node que usa el Python real; lo único que solo Qollab puede confirmar es el puente `callPromising`.

### Qué demuestra cada parte

- **Pregunta 1:** el registro muestra mediciones después de la compilación, una por cada clic.
- **Pregunta 2:** cada paso se compara con **sus** probabilidades del JSON (`step 0` contra `|0…0⟩`, `step 4` contra un estado intermedio, etc.). Si Python devolviera siempre lo mismo, fallarían los otros pasos.
- **Correlaciones:** con `bell`, `ghz3` y `ghz16` se comprueba que en el último paso casi todos los disparos son `00…0` o `11…1`. Con qubits independientes serían 50 %, 75 % y 100 % de otros resultados. Esa es la comprobación del problema original.
- **Pregunta 6:** mirá que no aparezca ningún error de job durante las mediciones.

### Medición a mano con el Bell (MS: Built-in y Aria)

Con `Step` en el valor indicado, el resultado ideal es:

| Step | Qué se espera (con ~1 % de ruido) |
|---|---|
| 0 | `00` ≈ 100 % |
| 2 | `00` 50 % y `01` 50 % |
| 3 | `01` ≈ 100 % |
| 4 | `01` 50 % y `10` 50 % |
| 5 y 6 | 25 % cada uno de los cuatro |
| 7 (el último) | `00` 50 % y `11` 50 % |

En Forte (ZZ) los pasos intermedios son otros (hay más `virtual_z`); solo el último paso coincide. Los checks automáticos no dependen de esto.

## 4. Backends y circuitos a probar

| Backend | Qué hacer | Qué se espera |
|---|---|---|
| Built-in | `bell`, `ghz3`, `ghz16`, `layered16` | `ALL CHECKS PASS`. Anotá los tiempos de `layered16`. |
| IonQ Aria 2 (simulador) | `bell` | Lo mismo. Compile gasta el único job (el dry-run del transpiler). |
| IonQ Forte 1 y Forte Enterprise 1 (simuladores) | `bell` | Lo mismo, con pasos `zz`. |
| AWS Braket local, IBM (Boston…) | Compile | El visor muestra `This machine is not currently supported (detected: AWS Braket). Currently supported: IonQ (Aria and Forte), the built-in simulator.` (sin el traceback). |
| Hardware de IonQ | **No correr** | Gasta créditos. |

Si en IonQ aparece "only one job is allowed", apretá Stop y volvé a correr.

### Errores posibles

| Mensaje | Qué significa |
|---|---|
| `ImportError: cannot import name …` de `qiskit_ionq` u otro paquete | La versión que trae Qollab es distinta de la de desarrollo. Pegá la línea `libraries:` del registro, y probamos esa versión. |
| `ConnectionError ... XHR is not supported` | Se llamó a Python sin `callPromising`. No debería pasar con este código: avisanos. |
| `only one job is allowed per code run` | Se apretó Compile dos veces en IonQ, o se volvió a correr sin Stop. |
| `No module named 'examples'` o `'backend'` | Falta una carpeta o un `__init__.py` en la subida. |
| `api.run is undefined`, o el módulo no importa | `import * as api from "qollab_api"` no funciona para un archivo de la raíz. Anotá el mensaje exacto: hay que probar otro nombre de módulo. |
| `Map` o `{}` en vez de una lista | No debería pasar: las funciones devuelven texto. |
| `This machine is not currently supported …` | Elegiste un backend IBM o AWS (`ProviderDisabledError`). Es lo esperado. |

## 5. Resultados (completar)

| Fecha | Backend | Circuito | ¿`ALL CHECKS PASS`? | Compile (ms) | Un check (ms) | Observaciones |
|---|---|---|---|---|---|---|
| | Built-in | `bell` | | | | |
| | Built-in | `ghz16` | | | | |
| | Built-in | `layered16` | | | | |
| | IonQ Aria 2 (sim) | `bell` | | | | |
| | IonQ Forte 1 (sim) | `bell` | | | | |
| | IonQ Forte Enterprise 1 (sim) | `bell` | | | | |
| | AWS Braket local | Compile | | | | esperado: `ProviderDisabledError` |
| | IBM Boston | Compile | | | | esperado: `ProviderDisabledError` |

## 6. Probar el visor real (`make qollab`)

Subí el contenido de `qollab/` sobre el mismo proyecto, elegí Built-in y apretá Run.

| # | Qué mirar | Esperado |
|---|---|---|
| 1 | La consola y la línea roja de errores del visor | Sin errores. Si dice `No se pudo conectar con Python`, copiame el mensaje. |
| 2 | El selector de arriba | Lista los 4 circuitos (Bell, GHZ 3, GHZ 16, capas aleatorias) y carga el Bell. |
| 3 | La escena 3D | Las esferas se ven como en el visor local (ver nota). Rotar con el mouse y el zoom con la rueda. |
| 4 | Play, flechas y la barra de paso | Igual que en el visor local. |
| 5 | **Medir** con el Bell en el paso 7 | Casi solo `00` y `11` (~50 % cada uno). **No** aparece la nota de "qubits entrelazados". |
| 6 | **Medir** con el Bell en el paso 4 | `01` y `10` cerca de 50 % cada uno (el muestreo anterior daba 25 % para los cuatro). |
| 7 | Cambiar `shots` (por ejemplo 100 y 20000) y medir de nuevo | El histograma cambia con cada clic; la suma de los porcentajes es 100. |
| 8 | Elegir otro circuito (`ghz16`, `layered16`) | Carga. Anotá cuánto tarda y si la página se congela. En IonQ, la segunda compilación falla con "only one job is allowed": el visor lo muestra en la línea de errores. |

**Nota sobre la escena 3D.** El visor se escribió para three.js r128 y Qollab trae la 0.186.1. El paquete ajusta el manejo de color para que se vea igual, pero eso solo se puede confirmar a ojo: compará los colores de las esferas, de las etiquetas `q0`, `q1` y de los ejes con `python -m http.server` en local. Si algo se ve distinto, decime qué, y lo aprobamos antes de tocar nada.

Si algo falla, corré `make qollab-probe`, subilo y apretá **3. Run checks**: dice si el problema es la conexión con Python o el visor.

### Resultados del visor (completar)

| Fecha | Backend | # (de la tabla) | ¿Bien? | Observaciones |
|---|---|---|---|---|
| | Built-in | 1 a 8 | | |
| | IonQ Aria 2 (sim) | 1, 2, 5, 6 | | |
| | IonQ Forte 1 (sim) | 1, 2, 5, 6 | | |

## 7. Cómo decidir con los resultados

- **Si los checks pasan (preguntas 1, 2, 3 y 6 bien):** el botón Medir del visor usa `sample_step` y se descarta el muestreo por marginales del frontend. El pedido para el frontend es una llamada: `JSON.parse(await api.sample_step.callPromising(jsonText, step, shots))`.
- **Si el clic no puede llamar a Python:** la alternativa es reconstruir y simular el circuito en JavaScript a partir del JSON (ver `spec.md` §M9). Avisanos y lo preparamos.
- **Si `sample` es muy lento con 16 qubits:** se puede limitar `MAX_QUBITS` para esta función o guardar la última simulación en `qollab_api.py`; los tiempos que anotes definen qué hacer.
