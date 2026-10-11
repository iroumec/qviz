# Pruebas en Qollab: el visor real

> Actualizado el 2026-10-10. El código no se puede ejecutar en Qollab desde el repositorio: esta guía le dice al equipo qué subir, qué mirar y qué resultado esperar. Lo que salga distinto de lo esperado se anota en `spec.md` §10. (Antes había una página de diagnóstico, `make qollab-probe`; se retiró porque el visor real prueba lo mismo y la consola de Qollab muestra los errores. Sigue en el historial de git.)

## 1. Qué subir a Qollab: un único proyecto JS

**No subas el repositorio entero.** Tiene más de 100 archivos, y Qollab admite 100 por proyecto y rechaza la subida completa si se pasa. Además, Qollab decide el tipo de proyecto solo por los archivos de la raíz (`qollab_context.md` §2), y hoy la raíz tiene `main.py` y ningún `index.html`: sería un proyecto Python, sin botones.

Corré:

```bash
make qollab
```

Arma la carpeta `qollab/` (no se versiona) con **un proyecto JS completo** de 51 archivos:

```text
index.html        el visor real
main.css          el estilo del visor, sin cambios
main.js           un preludio generado (los servicios de Qollab) + todos los módulos del visor en un solo script
qollab_api.py     las funciones que llama la página (devuelven texto)
requirements.txt
LICENSE           el texto MIT
backend/          la biblioteca
examples/         los circuitos de ejemplo
```

Subí el **contenido** de `qollab/` (no la carpeta misma), de modo que `index.html` y `main.js` queden en la raíz del proyecto. Se puede subir una y otra vez sobre el mismo proyecto de Qollab: después de cambiar algo en el repositorio, `make qollab` y volver a subir.

`main.py` queda fuera a propósito. En un proyecto JS podría correr también y compilar una segunda vez, y en IonQ eso gastaría un segundo job ("only one job is allowed"). `main.py` sigue siendo la entrada si se sube el proyecto como proyecto Python.

## 2. Probar el visor (`make qollab`)

Elegí un backend en *Select QPU* (empezá con **Built-in**), apretá Run y abrí la consola del navegador.

| # | Qué mirar | Esperado |
|---|---|---|
| 1 | La consola y la línea roja de errores del visor | Sin errores. Si dice `No se pudo conectar con Python`, copiá el mensaje. |
| 2 | El selector de arriba | Lista los 4 circuitos (Bell, GHZ 3, GHZ 16, capas aleatorias) y carga el Bell. |
| 3 | La escena 3D | Las esferas, el láser con su lente y las luces se ven como en el visor local (ver nota). Rotar con el mouse y zoom con la rueda. |
| 4 | Play, flechas y la barra de paso | Igual que en el visor local. |
| 5 | **Medir** con el Bell en el último paso | Casi solo `00` y `11` (~50 % cada uno). |
| 6 | **Medir** con el Bell en el paso 4 | `01` y `10` cerca de 50 % cada uno. |
| 7 | Cambiar `shots` (por ejemplo 100 y 20000) y medir de nuevo | El histograma cambia con cada clic; la suma de los porcentajes es 100. |
| 8 | Elegir otro circuito (`ghz16`, `layered16`) | Carga. Anotá cuánto tarda y si la página se congela. En IonQ, la segunda compilación de un ejemplo falla con "only one job is allowed": el visor lo muestra en la línea de errores. |
| 9 | **Cargar circuito** con `examples/qasm/bell.qasm` (OpenQASM 3) y con `bell_qasm2.qasm` (OpenQASM 2); también arrastrar el archivo a la página | Aparece como entrada nueva del selector y se ve el Bell. Funciona también en IonQ y todas las veces que se quiera (no gasta el job). Medir anda igual. |
| 10 | Cargar un `.qasm` con un `if`, un `reset`, una compuerta `opaque`, una inexistente (`rzz`) o 17 qubits | La línea roja de errores dice por qué no se puede (`control flow … is not supported`, `reset … not supported`, `opaque gates have no definition`, `gate 'rzz' is not defined`, `maximum is 16`). |
| 11 | Botón **Vista** (arriba a la derecha): perfil *Enfoque en el vector*, luego *Daltonismo*, luego *Restablecer* | El panel abre y cierra (clic, Esc, clic afuera). Con *Enfoque* quedan solo las esferas y se ve bien el vector; con *Daltonismo* cambian los colores de los ejes y de la leyenda; *Restablecer* vuelve al defecto. |
| 12 | Recargar la página después de elegir un perfil | Si Qollab deja usar `localStorage`, recuerda el perfil; si no, arranca con el defecto sin errores. |
| 13 | Cámara solo con el mouse: botones de abajo a la derecha de la escena (girar, inclinar, mover, zoom, centrar) manteniendo apretado, y arrastrar con el botón derecho | La cámara gira, se mueve y hace zoom sin usar el teclado; el clic derecho no abre el menú del navegador. |

**Si el 9 falla con OpenQASM 3** y dice `OpenQASM 3 needs the package qiskit-qasm3-import`, Qollab no instaló `qiskit-qasm3-import` (ni `openqasm3`, `antlr4-python3-runtime`). OpenQASM 2 sigue funcionando; hay que decidir qué hacer con el 3 y pegar el mensaje exacto.

**Nota sobre la escena 3D.** El visor usa three.js 0.186.1 (import map), la misma que trae Qollab. El paquete importa `three` y los addons (`OBJLoader`, `RoomEnvironment`, `BufferGeometryUtils`) con un respaldo: si Qollab no resuelve `three/addons/`, la consola muestra `QViz: a three.js addon could not be loaded` y el visor arranca sin láser ni luz de entorno. Se confirma a ojo: compará las esferas, el láser con su lente, las luces, las etiquetas `q0`, `q1` y los ejes con `make server` en local, y pegá la consola. Si algo se ve distinto, decime qué y lo ajustamos.

### Medición a mano con el Bell (MS: Built-in y Aria)

En el paso indicado, el resultado ideal es (con ~1 % de ruido):

| Paso | Qué se espera |
|---|---|
| 0 | `00` ≈ 100 % |
| 2 | `00` 50 % y `01` 50 % |
| 3 | `01` ≈ 100 % |
| 4 | `01` 50 % y `10` 50 % |
| 5 y 6 | 25 % cada uno de los cuatro |
| 7 (el último) | `00` 50 % y `11` 50 % |

En Forte (ZZ) los pasos intermedios son otros (hay más `virtual_z`); solo el último paso coincide.

## 3. Backends a probar

| Backend | Qué hacer | Qué se espera |
|---|---|---|
| Built-in | Los 13 puntos; `layered16` para los tiempos | Todo bien. |
| IonQ Aria 2 (simulador) | 1, 2, 5, 6, 9, 10 y 11 a 13 | Lo mismo. La primera compilación (el ejemplo del arranque) gasta el único job; los `.qasm` no. |
| IonQ Forte 1 y Forte Enterprise 1 (simuladores) | 1, 2, 5, 6 y 9 | Lo mismo, con pasos `zz`. |
| AWS Braket local, IBM (Boston…) o cualquier otra máquina | Mirar el arranque | El visor muestra `This machine is not currently supported (detected: …). Currently supported: IonQ (Aria and Forte), the built-in simulator.` (sin el traceback). Verificado el 2026-10-11. |
| Hardware de IonQ | **No correr** | Gasta créditos. |

Si en IonQ aparece "only one job is allowed", apretá Stop y volvé a correr.

### Errores posibles

| Mensaje | Qué significa |
|---|---|
| `ImportError: cannot import name …` de `qiskit_ionq` u otro paquete | La versión que trae Qollab es distinta de la de desarrollo. Pegá el mensaje y probamos esa versión. |
| `ConnectionError ... XHR is not supported` | Se llamó a Python sin `callPromising`. No debería pasar con este código: avisanos. |
| `only one job is allowed per code run` | Se eligió otro ejemplo del selector en IonQ, o se volvió a correr sin Stop. |
| `No module named 'examples'` o `'backend'` | Falta una carpeta o un `__init__.py` en la subida. |
| `api.run is undefined`, o el módulo no importa | `import * as api from "qollab_api"` no funciona. Anotá el mensaje exacto. |
| `Map` o `{}` en vez de una lista | No debería pasar: las funciones devuelven texto. |
| `This machine is not currently supported …` | Elegiste un backend IBM o AWS (`UnsupportedProviderError`). Es lo esperado. |

## 4. Resultados (completar)

| Fecha | Backend | # (de la tabla) | ¿Bien? | Observaciones |
|---|---|---|---|---|
| | Built-in | 1 a 13 | | |
| | IonQ Aria 2 (sim) | 1, 2, 5, 6, 9, 10 | | |
| | IonQ Forte 1 (sim) | 1, 2, 5, 6, 9 | | |
| | IonQ Forte Enterprise 1 (sim) | 1, 2, 5, 6, 9 | | |
| 2026-10-11 | AWS Braket local | arranque | Sí | `UnsupportedProviderError` con el mensaje de máquina no soportada. |
| 2026-10-11 | IBM Boston | arranque | Sí | `UnsupportedProviderError` con el mensaje de máquina no soportada (antes se quedaba en "loading"). |

## 5. Cómo decidir con los resultados

- **Si Medir (5 a 7) da las correlaciones del Bell:** el puente `callPromising` y `sample_step` funcionan. No hay que hacer nada más.
- **Si el clic no puede llamar a Python:** la alternativa es reconstruir y simular el circuito en JavaScript a partir del JSON (ver `spec.md` §M9). Avisanos y lo preparamos.
- **Si `sample` es muy lento con 16 qubits:** se puede limitar `MAX_QUBITS` para esta función o guardar la última simulación en `qollab_api.py`; los tiempos que anotes definen qué hacer.
- **Si OpenQASM 3 no se instala:** se queda OpenQASM 2 y se documenta; el mensaje del visor ya lo explica.
