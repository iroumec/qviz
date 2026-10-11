# Feature: línea de tiempo del circuito transpilado (franja inferior)

> **Estado (2026-10-11): implementada, sin commitear.** `source/frontend/js/timeline.js`, markup y CSS en `index.html`, cableado en `controls.js`/`data.js`/`scene.js`. Queda por probar en Qollab, y no se hizo el realce de las esferas 3D al pasar el mouse ni el clic en el nombre del qubit (opcionales); el realce 3D ya está hecho (`selection.js`) y se agregó zoom, arrastre y clic en el número de paso para circuitos largos. Prompt original: Diseño aprobado por el usuario el 2026-10-11 (ver "Decisiones"). Antes de empezar: `git pull --rebase origin development`, leer `memory.md`, `source/frontend/js/` y `documentation/docs/frontend/viewer.qmd`.

## Objetivo

Que el visor muestre el **circuito ya transpilado a compuertas nativas** (GPI, GPI2, MS/ZZ, VirtualZ) como un diagrama por qubit, con el paso actual resaltado, para ver **por dónde va** la ejecución. Cada compuerta se puede pulsar para saltar a su paso.

## Reglas (de `AGENTS.md`)

- Esta feature está aprobada en su diseño.
- El visor tiene que seguir funcionando solo con `python -m http.server`/`make server`. Nada específico de Qollab en el código de la feature.
- **No cambia el contrato JSON** ni el backend: todo sale de `steps[].operation`, `targets` y `step` (ver `spec.md` §6).
- Seguir la estética actual (variables CSS de `index.html`: `--panel`, `--panel-2`, `--border`, `--muted`, `--accent`, `--target`). Nada chocante: mismos bordes de 1 px, esquinas de 4–6 px, tipografía de 11–13 px.
- Al terminar: `make test`, `make lint`, `make qollab`, docs (`viewer.qmd`, `qollab.qmd` si cambia el empaquetado) y `memory.md`.

## Decisiones (aprobadas por el usuario)

1. **Ubicación:** franja **inferior**, entre `<main>` y la barra de reproducción (`.playback`). Plegable.
2. **Abierta por defecto**, con un botón de ocultar **bien visible** (no un icono tenue): texto + chevron, por ejemplo "Circuito ▾" / "Circuito ▸", en el encabezado de la franja. Al ocultarla queda solo esa cabecera, para que se vea cómo volver a abrirla.
3. **Las cajas no escriben ángulo ni fase.** Solo la etiqueta de la compuerta (`GPI`, `GPI2`, `MS`, `ZZ`, `Z`). El detalle sigue en el panel "Detalle del paso".
4. Coordinación (2026-10-11): el commit `0944af5` del compañero (óptica, altura del lente, soportes) solo toca la escena 3D, `config.js`, `environment.js`, `horizontal.js` y `scene.js` (constantes, sin cambiar `index.html`, `data.js` ni `controls.js`). No choca con esta feature; solo hay que recordar que el encuadre usa ahora `halfY = 5.6`.

## Qué se dibuja

- Una **fila por qubit** con su nombre (`qubitMath(q)`/`qubitLabel`) a la izquierda, fijo al hacer scroll horizontal, y una línea fina (`--border`) que la cruza.
- Una **columna por paso** (`step` 1…N), en orden. Las compuertas de 1 qubit son una caja sobre la fila del target.
- **MS y ZZ:** una caja en cada target unida por un conector vertical. Si los qubits no son adyacentes, el conector cruza las filas intermedias (caso de prueba `bell_distant`).
- **Estados de cada caja:** ya ejecutada (llena), **actual** (borde `--target`, amarillo), futura (atenuada, `opacity` ~0.45). Con el paso 0 no se marca ninguna.
- **Colores:** los del badge de `renderDetails` (`op-1q`, `op-2q`, `op-vz`) para no inventar una paleta. VirtualZ se distingue por una caja más chica o con borde punteado, ya que dura 0 y no dispara el láser.
- Un marcador vertical tenue (`--accent`) en la columna del paso actual ayuda a leer el avance también en las filas que no participan.

## Interacción

- **Clic en una compuerta** → `stopPlay()` y `updateStep(paso)`. Las cajas son `<button>` (foco con Tab, Enter/Espacio).
- **Auto-scroll:** al cambiar de paso, la columna actual se centra en la franja (`scrollIntoView({ inline: "center", block: "nearest" })`, con `behavior: "smooth"` salvo `prefers-reduced-motion`). Si el usuario acaba de hacer scroll a mano, no se pelea con él hasta el próximo cambio de paso.
- **Tooltip** (atributo `title` o uno propio) con: número de paso, operación legible (mismos nombres que `OPERATIONS`), qubits y fidelidad acumulada. Sin ángulo ni fase.
- **Hover** sobre una compuerta: realza las filas de sus targets.
- **Teclado:** ←/→ cambian de paso y Inicio/Fin saltan al primero/último, **solo si el foco no está en un campo de texto**. Cuidado con `scene.js` (`keydown` de WASD/espacio/ctrl): no se pueden pisar esas teclas.
- **Plegar:** botón en la cabecera, con `aria-expanded`. Recordar el estado en `localStorage` (clave p. ej. `qviz.timeline.open`) **dentro de `try/catch`**, porque en el iframe de Qollab puede fallar; sin él arranca abierta.
- **Altura acotada:** máximo ~170 px de cuerpo (unas 5–6 filas) con scroll vertical para 16 qubits; el scroll horizontal es para los pasos. La cabecera de los nombres de qubit debe seguir visible (`position: sticky`).
- **Responsive:** se oculta bajo 860 px, igual que `.aside-right`. Sin circuito cargado, muestra el texto "Cargá un circuito para ver su secuencia." (en `TEXT`/`data-i18n`).

## Cómo se construye

- **Módulo nuevo `source/frontend/js/timeline.js`** con `initTimeline()`, `buildTimeline(data)` (al cargar un circuito) y `highlightStep(index)` (en cada `updateStep`).
- **Sin ciclos de imports.** Hoy el grafo de módulos no tiene ciclos y `bundle_modules` de `package_qollab.py` asume cada módulo después de lo que importa. `timeline.js` **no** importa `data.js` ni `controls.js`: `initTimeline(onSelect)` recibe un callback y lo cablea `controls.js` (`initTimeline((n) => { stopPlay(); updateStep(n); })`). `data.js` llama a `buildTimeline`/`highlightStep` igual que hoy llama a `updateReadouts`/`renderDetails`.
- **`OPERATIONS` hoy es privado de `panels.js`** (nombres y `kind` de cada operación). Moverlo a `config.js` o `utils.js` y exportarlo para compartirlo, sin cambiar el panel.
- **Redimensionado del canvas.** `scene.js` llama a `onResize` solo con el `resize` de la ventana, y al plegar o abrir la franja cambia el alto de `#stage` sin que cambie la ventana. Hay que avisar a la escena: un `ResizeObserver` sobre `#stage` que llame a `onResize` (hoy no exportada) o exportarla y llamarla desde el botón de plegar. `computeFitRadius` depende del aspecto (y desde `0944af5` usa `halfY = 5.6`), así que el encuadre se recalcula solo.
- **HTML/CSS** en `source/frontend/index.html`: `<section class="timeline">` entre `</main>` y `.playback`. CSS en el bloque `<style>` existente (Qollab usa ese bloque tal cual como `main.css`). Grid CSS con una columna por paso; sin canvas ni librerías.
- **Escala:** 16 qubits × cientos de pasos son pocas miles de cajas: aceptable construyendo el DOM una vez por circuito y solo cambiando clases en `highlightStep`. No virtualizar salvo que se mida lentitud (`ghz16`, `layered16`, `qft3`).
- **Empaquetado:** `bundle_modules` sigue los `import` desde `main.js`, así que `timeline.js` entra solo si algún módulo lo importa. Verificar con `make qollab` que está en `qollab/main.js` y que el CSS llegó a `main.css`.
- **i18n:** textos nuevos por `TEXT`/`data-i18n` (título, vacío, tooltips), como el resto del visor.
- **Accesibilidad:** `role="group"` con `aria-label` en la franja, `aria-current="step"` en la caja actual, contraste de las atenuadas suficiente y `prefers-reduced-motion`.

## Pasos de implementación

1. **Maqueta estática** en `index.html` con los datos de `bell` (sin JS), para que el equipo apruebe el aspecto.
2. `timeline.js`: construir el DOM desde `state.data.steps` y resaltar el paso actual; cablear `loadData`/`updateStep`.
3. Interacción: clic, auto-scroll, tooltip, hover, teclado, plegar con `localStorage`.
4. Conector de MS/ZZ no adyacentes, circuitos de 16 qubits y scroll.
5. i18n, responsive, accesibilidad.
6. `make test`, `make lint`, `make qollab`; prueba manual local (`make server`) y en Qollab; docs y `memory.md`.

## Pruebas y criterios de aceptación

- No hay tests de JS en el repo. Agregar: (a) `node --check` de `timeline.js` y del `main.js` generado; (b) un test de Python en `source/tests/test_package_qollab.py` que arme el paquete y compruebe que `timeline` está en `main.js`, que no quedan `import` relativos y que el CSS de la franja está en `main.css`.
- Manual, con `bell`, `bell_distant`, `ghz3`, `ghz16`, `layered16`, `adder_n2_1_1` y un `.qasm` cargado:
  - la franja tiene una caja por paso y el orden coincide con "Detalle del paso";
  - el clic salta al paso correcto, pausa el Play y la escena 3D lo refleja;
  - con Play, la caja actual avanza y queda centrada;
  - plegar/desplegar funciona, el botón se ve sin pasar el mouse y el estado persiste al recargar;
  - sin `localStorage` (ventana privada o iframe de Qollab) no hay errores y arranca abierta;
  - WASD y espacio/ctrl siguen moviendo la cámara;
  - el visor 3D no se deforma al abrir o cerrar la franja (el canvas se redimensiona: revisar el `resize` de `scene.js`);
  - bajo 860 px la franja no aparece.
- Verificar en Qollab (Built-in) que la franja aparece y responde; anotar el resultado en `documentation/prompts/qollab_pruebas.md` §4.

## Fuera de alcance

- Ángulo y fase escritos en las cajas (descartado por el usuario).
- Cambiar el contrato JSON o el backend.
- Mostrar el circuito **lógico** original (antes de transpilar): requeriría datos nuevos.
- Arrastrar, reordenar o editar compuertas.
- Cambiar el aspecto del resto del visor.
