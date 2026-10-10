# Contexto de la plataforma Qollab (para usar como prompt)

> Fuente: documentación oficial de Qollab (qollab.xyz/learn/docs), leída el 2026-10-09. Las páginas están fechadas entre 2026-09-05 y 2026-09-27; la plataforma cambia, así que ante cualquier duda hay que volver a la doc.
> Lo que NO está en la documentación está marcado como **[no documentado]** o **[inferencia]**. No lo trates como un hecho.

## 0. Instrucciones para el asistente que lea esto

Vas a ayudarme a desarrollar un proyecto en Qollab. Antes de proponer código:

1. Respetá las limitaciones de las secciones 3 y 5. Si una idea las viola, decímelo y proponé un workaround de la sección 7.
2. No inventes APIs de Qollab. Si algo está en la sección 9 (no documentado), marcalo como suposición y decime cómo probarlo.
3. Todo corre en el navegador. No existe un servidor propio: "backend" significa Python corriendo en el navegador.
4. Escribí el código como un proyecto multi-archivo (sección 8), con la lógica cuántica en Python y la interfaz en JS/HTML.

## 1. Qué es Qollab, en una frase

Un playground donde los proyectos cuánticos (Qiskit) corren **enteramente en el navegador**: Python vía Pyodide (WebAssembly) y JavaScript en la propia página. La única parte que corre en un servidor es el job cuántico en sí, cuando se elige un backend remoto de IonQ. Nada se instala en la máquina del usuario.

## 2. Cómo decide Qollab el tipo de proyecto

Se decide **en cada Run**, mirando solo los archivos del **nivel superior**:

| Archivos en la raíz                            | Tipo de proyecto                            | Salida                                   |
| ---------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| `index.html` + `main.js` (con o sin `main.py`) | **JS project** (el editor lo llama HTML/JS) | La página se dibuja arriba de la consola |
| solo `main.py`                                 | **Python project**                          | Consola                                  |
| ninguno                                        | No corre (Run deshabilitado)                | —                                        |

- Los archivos dentro de carpetas no cuentan para decidir (`app/main.py` no hace un proyecto Python).
- Si están los tres archivos, corre como JS project. No hay un setting aparte: se cambia agregando o quitando archivos.

## 3. La respuesta a "¿tengo que elegir Python o JS?"

**No, no hay que elegir uno solo.** La limitación es parcial, y el workaround es oficial:

- Un JS project puede **importar tus archivos Python** y los paquetes Python instalados, con el nombre de módulo con puntos (no con ruta de archivo).
- La división natural: **JS/HTML/CSS = frontend; módulos Python = "backend" (lógica cuántica y de datos).**

Pero "backend" acá es **un módulo Python en el mismo navegador**, no un servidor. No hay base de datos, ni endpoints, ni persistencia (ver sección 5).

Ejemplo oficial de la doc:

```js
import { renderCounts } from "./ui/chart.js"; // tu ui/chart.js
import * as bell from "quantum.bell"; // tu quantum/bell.py
import { QuantumCircuit } from "qiskit"; // paquete Python instalado

const counts = (await bell.run_bell.callPromising(backend, 1000)).toJs();
renderCounts(document.getElementById("chart"), counts);
```

Reglas del puente JS↔Python (todas documentadas):

- Las funciones de **tus archivos Python** se llaman con `.callPromising(...)`, o `.callPromisingKwargs(...)` para argumentos con nombre. Una llamada normal como `bell.run_bell(backend, 1000)` **falla en backends IonQ** con `ConnectionError` ("XHR is not supported").
- Usá imports con nombre o `import * as`. Un import por defecto (`import bell from 'quantum.bell'`) da `undefined`.
- Un paquete Python que solo importa tu JS **no se instala solo**: agregalo a `requirements.txt`.
- Los valores de Python llegan como proxies: `.toJs()` los convierte a datos JS normales.
- Con la API de Qiskit en JS: sin `new` (`QuantumCircuit(2, 2)`), argumentos con nombre vía `.callKwargs({...})`, `import ... from 'qiskit'`.
- `backend` es una variable ya creada. En JS está en `main.js` y en todos los JS que importa. En Python es global en `main.py`: pasala como argumento a tus otros módulos.
- Se puede usar `await` al tope del código en `main.js`. `setTimeout` inyectado devuelve una promesa.
- JS importa otros JS con rutas `./` o `../` (prueba la ruta exacta, luego `.js`/`.mjs`, luego `index.js`/`index.mjs`). No se pueden importar otros tipos de archivo.
- Python importa como en una máquina normal: la raíz del proyecto es el directorio de trabajo y el primer elemento de `sys.path`. Los imports relativos no funcionan dentro de `main.py`. Un archivo tuyo con el mismo nombre que un paquete instalado le gana al paquete.

Proyecto de ejemplo oficial con este diseño: "QCFlows: Multi-file Example" (qollab.xyz/u/qollab/qcflows-multifile): UI en D3 con módulos JS, motor de correlaciones como paquete Python, ejemplos en JSON.

## 4. Entorno

- **Python 3.14**, **Qiskit 2.x** (si `requirements.txt` no lo nombra, se agrega `qiskit>=2.5.2,<3.0.0`), NumPy 2.x, la mayor parte de la biblioteca estándar.
- `requirements.txt`: una dependencia por línea, `nombre==1.2.3` o rangos. Se **rechazan**: opciones de pip (`-r`, `-e`, `--index-url`), marcadores de entorno (`; python_version...`) y requisitos por URL.
- Paquetes que vienen con Pyodide (NumPy, SciPy, Matplotlib) se cargan al importarlos. Cualquier paquete de PyPI con wheel de **Python puro** se instala, y los que Pyodide ya compiló a WebAssembly. Si un paquete necesita código compilado sin build de Pyodide, la corrida se detiene con `no installable distribution for '<n>'`.
- Fuente: https://qollab.xyz/learn/docs/runtime-environment (leída el 2026-10-10). Qiskit se instala siempre; si `requirements.txt` lo nombra, se usa esa línea tal cual. Admite comentarios (`#`) y líneas en blanco. Un paquete que necesita código compilado sin build de Pyodide detiene la corrida con `no installable distribution for '<n>'`. La página **no menciona `qiskit-ionq`** ni el instalador, ni da versiones de Python, Pyodide o NumPy. **Hallazgo:** el `qiskit-ionq` de la plataforma no tiene `helpers.native_2q_gate` (existe desde 1.0.3), así que es anterior a esa versión; la corrida usa Pyodide v314.0.7.
- Lista **Libraries** del editor (agrega líneas a `requirements.txt`): Qiskit Visualizations, Qiskit Algorithms 0.4.0, Qiskit Optimization 0.7.0, Qiskit Nature 0.8.0 (+PySCF), Qiskit Finance 0.4.1, Qiskit Machine Learning 0.9.1, QAVE 0.1.0, PQCA 2.1.0a1.
- `circuit.draw("mpl")` necesita activar **Qiskit Visualizations**. `print(circuit)` (texto) funciona sin eso. En JS, `URL.createObjectURL(figure)` da una URL para un `<img>` (el runtime lo convierte a SVG).
- **Librerías JS**: `three` y `three/addons/…` (0.186.1) y `postprocessing` (6.39.5) se importan por nombre. `@tweenjs/tween.js` y `meshline` vienen incluidos. Cualquier otra, por URL completa (por ejemplo `https://cdn.jsdelivr.net/npm/<paquete>/+esm`).
- **HTML/CSS**: `index.html` se inserta dentro del `<body>`, así que **solo contenido de body** (se descartan `<html>`, `<head>`, `<body>`). Los `<script>` **no corren**: todo el código va en `main.js`. `main.css` es opcional y es la **única** hoja de estilos que se carga. Otros `.html`/`.css` no se cargan: el markup extra se construye desde JS.
- `console.log` en JS: cada argumento sale como texto, un objeto se ve `[object Object]`; usá `JSON.stringify`.
- **Navegador**: requiere WebAssembly JSPI: Chrome, Edge, Opera recientes, o Firefox 153+. En otros, Run queda deshabilitado.

## 5. Limitaciones duras (lo que condiciona la arquitectura)

**Red**

- Solo se permiten `GET` (y `OPTIONS`): `fetch(url)` en JS o `pyodide.http.pyfetch(url)` en Python. `POST`, `PUT`, `DELETE`, etc. fallan con "network access is restricted".
- No hay `XMLHttpRequest`, `WebSocket` ni web workers.
- El servidor tiene que permitir CORS (lo más seguro: `Access-Control-Allow-Origin: *`). Un JS project corre en un iframe sandbox con origen `null`. No se envían cookies ni credenciales a otros sitios.

**Persistencia**

- No hay almacenamiento entre corridas. En un JS project, `localStorage`, `sessionStorage`, IndexedDB y cookies **no están disponibles**. Los archivos que escribe Python duran solo hasta que termina la corrida. Todo se pierde con Stop o recarga.

**Archivos**

- Hasta **100 archivos** por proyecto, **2 MB cada uno**, y **200 MB** entre todos tus proyectos. Una subida que exceda se rechaza completa.
- **JS no puede leer archivos del proyecto** (`fetch("data.csv")` no los alcanza). Hay que leerlos desde Python y devolvérselos a `main.js`.
- Python lee archivos del proyecto (`open`, `pathlib`, `numpy.loadtxt`, `pandas.read_csv`), pero **la ruta debe aparecer como string literal** en el código Python (en `main.py` o en un módulo importado). Rutas armadas con f-strings, `+` u `os.path.join` **no se cargan** y dan `OSError`.
- Los archivos se cargan enteros en memoria antes de la corrida.

**Ejecución**

- Sin límite de tiempo. **Stop** termina la corrida (a Python le da 5 segundos para cerrar).
- `input()` no funciona.
- En proyectos Python, si `main.py` define `def main(...)` con firma estricta (en una sola línea, parámetros anotados `int`/`float`/`str`/`bool`), el runtime la llama solo y genera un formulario en el diálogo Select QPU. Si la firma no cumple, **no avisa**: simplemente no se llama.
- Los simuladores locales corren en un solo hilo de WebAssembly. Los tiempos del navegador son varias veces mayores que los medidos en Python nativo.

**Publicación**

- **El código de un proyecto publicado es público**: nunca pongas API keys, tokens ni contraseñas.
- Hay un borrador privado (autoguardado) y versiones publicadas inmutables. Se pueden publicar hasta 10 versiones por hora. Un proyecto solo es visible para otros si tiene una versión pública marcada como default.
- Qué ve un visitante: la Project Card (write-up en Markdown con matemática) y la pestaña Code.
- Si el core depende de un servicio externo y ese servicio cae, el proyecto no debería romperse.

## 6. Backends y reglas cuánticas

El código **no elige** el backend: lo elige quien aprieta Run en el diálogo **Select QPU**, y llega como la variable `backend`. No lo crees ni lo fijes en el código.

| Grupo                                   | Backends                                                                        | Qubits  | Dónde corre   | Costo        |
| --------------------------------------- | ------------------------------------------------------------------------------- | ------- | ------------- | ------------ |
| Simulador local ideal                   | Built-in (`BasicSimulator`), AWS Braket local                                   | 24, 25  | Navegador     | Gratis       |
| Simulador local con ruido IBM           | Boston, Kingston, Pittsburgh, Fez, Marrakesh, Aachen (156); Miami, Berlin (120) | 156/120 | Navegador     | Gratis       |
| Simulador remoto IonQ (modelo de ruido) | Aria 1, Aria 2 (25), Forte 1, Forte Enterprise 1 (29)                           | 25/29   | Nube de IonQ  | Gratis       |
| Hardware IonQ                           | Forte 1, Forte Enterprise 1                                                     | 36      | Hardware IonQ | **Créditos** |

La lista de máquinas en línea cambia; el diálogo es la fuente de verdad. Aria 1 y 2 ya no existen como hardware (las entradas simulan un sistema retirado).

**Reglas críticas**

1. **Un solo job por corrida en backends IonQ** (simuladores remotos y hardware). Un segundo job detiene la corrida con "only one job is allowed per code run". Hay que pasar todos los circuitos en **una** llamada a `backend.run` (lista de circuitos donde el proveedor soporte multi-circuito), o apretar Stop y luego Run. En los simuladores locales no hay ese límite.
2. `BackendSamplerV2` **no funciona en IonQ**: no devuelve error, rellena todos los shots con 0 (un par de Bell sale como `00` siempre). En IonQ hay que usar `backend.run(...)` y `get_counts()`. `BackendSamplerV2` sí funciona en simuladores locales e IBM.
3. `BackendEstimatorV2` funciona en todos los backends, pero en IonQ es una sola llamada por corrida con todo adentro.
4. Shots: van en el código (`backend.run(circuit, shots=N)`); el default es 1024. Un parámetro `shots: int` en `main()` genera el campo Shots en el diálogo (proyectos Python).
5. Los simuladores ideales tardan casi igual con 10 que con 10.000 shots; los simuladores con ruido escalan con los shots (uno por shot). Empezar con ~100 shots en simuladores con ruido.
6. **Debiasing** (mitigación de IonQ): se activa por defecto con 500+ shots en QPUs; no disponible en simuladores de IonQ. Se desactiva con `backend.run(qc, shots=..., error_mitigation=ErrorMitigation.NO_DEBIASING)` (`from qiskit_ionq import ErrorMitigation`).
7. **Compilación**: IonQ recompila tu circuito a sus gates nativos (GPi, GPi2, MS en Aria, ZZ en Forte) y el conteo de gates final no es el que escribiste. `TooManyGates` se evalúa sobre el conteo compilado. No hace falta llamar `transpile()` antes de enviar a IonQ; si lo hacés, usá `optimization_level=1` (o 0) para evitar el warning `IonQTranspileLevelWarning`. Los simuladores locales e IBM **rechazan** `PauliEvolutionGate` sin transpilar.
8. Un circuito debe usar un solo juego de gates: **no se pueden mezclar gates nativos y estándar**. Los gates nativos (`GPIGate`, `GPI2Gate`, `MSGate`, `ZZGate`) vienen de `qiskit_ionq`, sus ángulos están en **turnos** (no radianes), y enviar nativos desactiva el compilador y la mitigación de errores por defecto. La doc dice que el `backend` precreado usa el gateset estándar (ver sección 9).
9. Gates multi-controlados: máximo 7 controles en IonQ.
10. Todos los simuladores son gratis. Solo el hardware gasta créditos; el runner muestra un costo estimado, pide confirmación si supera una asignación editable (por defecto 1/10 del saldo) y luego muestra el costo real. La forma documentada de conseguir créditos es el Qollab Grant Program.

**Errores frecuentes**: `ConnectionError ... XHR is not supported` (llamaste Python desde JS sin `callPromising`), "only one job is allowed per code run", "network access is restricted" (POST u otro método), `AttributeError` dentro de `qiskit-ionq` (suele ser error de auth o cuota de IonQ; la doc recomienda envolver el submit en `try`), `OSError` por archivo no cargado (ruta no literal). Lista completa en la sección Error reference de la doc.

## 7. Workarounds para lo que parece imposible

| Quiero...                                                 | Problema                                                   | Workaround documentado o derivado de la doc                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python de "back" y JS+HTML de "front"                     | Parece que hay que elegir uno                              | JS project (`index.html` + `main.js`) que importa módulos Python con `callPromising`. Es el patrón oficial.                                                                                                                                                                                                 |
| Una base de datos o estado persistente                    | No hay storage ni POST                                     | Enviar el estado como archivos del proyecto (ej. `states/demo.json`, `data/*.json`) y cargarlo al iniciar, con un selector si hay varios. Ejemplo oficial: Quantum Hackathon Soundtrack guarda tomas grabadas de IonQ Forte en `data/forte_takes.json`; un módulo Python las lee y se las pasa a `main.js`. |
| Que el usuario ejecute circuitos muchas veces desde la UI | Un job por corrida en IonQ                                 | En simuladores locales es libre. Para IonQ: agrupar todos los circuitos en un solo `backend.run`, o grabar resultados reales de antemano en JSON y mostrar la toma grabada, la simulación ideal y la corrida actual (como Quantum Hackathon Soundtrack).                                                    |
| Leer datos de un archivo desde JS                         | JS no ve los archivos del proyecto                         | Un módulo Python lee el archivo (ruta literal) y devuelve los datos con `callPromising` + `.toJs()`.                                                                                                                                                                                                        |
| Datasets de más de 2 MB                                   | Tope de 2 MB por archivo                                   | Alojarlos en otro sitio y leerlos con GET (con CORS), procesándolos en trozos con `pyfetch` en vez de bajar todo (ejemplo de streaming en la doc).                                                                                                                                                          |
| Una API propia o servicios externos                       | Solo GET, sin credenciales, código público                 | Solo APIs públicas de lectura con CORS abierto. Sin keys. Que el proyecto funcione si el servicio cae.                                                                                                                                                                                                      |
| Rutas de datos dinámicas en Python                        | Solo se cargan rutas literales                             | Declarar cada ruta como string literal (por ejemplo en un diccionario constante) aunque después se elija en tiempo de ejecución. La regla dice que el string puede estar en cualquier parte del código.                                                                                                     |
| Más de una página HTML                                    | Solo `index.html` y `main.css` se cargan                   | Construir las "pantallas" desde JS (módulos JS que generan el markup).                                                                                                                                                                                                                                      |
| Sampler en IonQ                                           | `BackendSamplerV2` devuelve ceros                          | `backend.run(...)` + `get_counts()`.                                                                                                                                                                                                                                                                        |
| Librería JS que no está incluida                          | Solo `three`, `postprocessing`, tween, meshline por nombre | Import por URL completa (ej. jsdelivr con `+esm`).                                                                                                                                                                                                                                                          |
| Ver circuitos dibujados                                   | `draw("mpl")` falla por defecto                            | Activar Qiskit Visualizations y `URL.createObjectURL(figure)` en un `<img>`.                                                                                                                                                                                                                                |

## 8. Lo que la documentación NO aclara (hay que probar antes de apostar el diseño)

1. **¿Qué devuelve `.toJs()` para un `dict`?** En Pyodide, por defecto, un `dict` se convierte en un `Map` de JS, y `JSON.stringify(map)` da `{}`. La doc usa `.toJs()` sobre `get_counts()` y luego `JSON.stringify` sin aclarar el tipo. **[inferencia]** Si ves `{}` o `Map`, convertí con `Object.fromEntries(...)`, o hacé que el módulo Python devuelva una lista/JSON string.
2. **¿La UI puede volver a llamar a Python después de la primera corrida?** (por ejemplo, desde un clic). La doc lo permite implícitamente con las funciones importadas, pero no lo dice. En IonQ de todos modos aplica el límite de un job. **[verificado 2026-10-10, Built-in]** Sí: un clic puede llamar a una función Python de un archivo de la raíz con `callPromising`, varias veces, después de la primera corrida. `import * as api from "qollab_api"` funciona con un archivo suelto de la raíz (aunque `Object.keys(api)` sale vacío), y un `str` de Python llega a JS como `string`. Versiones: ver §4.
3. **Imágenes, fuentes o assets binarios en la página:** JS no puede leer archivos del proyecto y la doc no explica cómo servirlos. **[inferencia]** posible vía Python (leer bytes y devolverlos) y `URL.createObjectURL`, sin verificar.
4. **Gates nativos desde el `backend` precreado:** la doc dice que `backend` usa el gateset estándar y que el backend nativo se crea con `provider.get_backend(name, gateset="native")`, pero no explica si eso se puede hacer dentro de Qollab (sin API key propia).
5. **Fluidez de la UI durante simulaciones pesadas:** la doc dice que corre en un solo hilo y no hay web workers. **[inferencia]** una simulación larga en el hilo principal puede congelar la página.
6. **Safari y otros navegadores sin JSPI:** no listados como compatibles.
7. **Qué pasa con la interacción del usuario durante `await`:** no documentado.

## 9. Fuentes (documentación oficial)

- JS / Qiskit projects: https://qollab.xyz/learn/docs/js-qiskit-projects
- Python / Qiskit projects: https://qollab.xyz/learn/docs/python-qiskit-projects
- The runtime environment: https://qollab.xyz/learn/docs/runtime-environment
- Running your code: https://qollab.xyz/learn/docs/run-your-code
- Compute backends: https://qollab.xyz/learn/docs/compute-backends
- Uploading your own files: https://qollab.xyz/learn/docs/upload-your-files
- Transpilation: https://qollab.xyz/learn/docs/transpilation
- Primitives: https://qollab.xyz/learn/docs/primitives
- How your circuit is compiled: https://qollab.xyz/learn/docs/how-your-circuit-is-compiled
- Error mitigation and debiasing: https://qollab.xyz/learn/docs/error-mitigation
- Ideal vs. noise-model simulators: https://qollab.xyz/learn/docs/ideal-vs-noise-model-simulators
- Gate reference (y páginas de GPi, ZZ): https://qollab.xyz/learn/docs/gates
- How credits work / Before you spend credits: https://qollab.xyz/learn/docs/how-credits-work
- Publishing and versions: https://qollab.xyz/learn/docs/publish
- Error reference, FAQ, Why your results look wrong: https://qollab.xyz/learn/docs/error-reference
- Ejemplo multi-archivo: https://qollab.xyz/u/qollab/qcflows-multifile
