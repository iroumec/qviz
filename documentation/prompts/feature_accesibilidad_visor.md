# Feature: accesibilidad y legibilidad del visor (panel "Vista")

> Prompt para la próxima sesión de código. **Estado: planificada el 2026-10-11, sin implementar y sin código tocado.** Antes de empezar: `git pull --rebase origin development`, leer `memory.md`, `frontend/js/`, `shaders/bloch.frag` y `documentation/docs/frontend/viewer.qmd`. Para el formato se siguió el de `feature_timeline_circuito.md`.

## Por qué

El usuario probó el visor en Qollab y reportó (2026-10-11):

1. **La luz se ve mucho más que en local** y "dificulta ver los vectores". (La captura se vio después: ver los hallazgos de §1.)
2. **La tecla D no mueve la cámara en Qollab** (las otras sí). En local y con eventos reales (CDP) D funciona; ya se agregó el respaldo por `event.key`, y **no alcanzó**.
3. Pidió **opciones de accesibilidad en un lugar visible**: cambiar colores, cambiar la forma de ver la esfera para que el vector se vea más, y quizá **quitar elementos que sumen ruido visual**.

## Reglas (de `AGENTS.md`)

- El frontend es del equipo: el diseño de este prompt se aprueba con el usuario y se coordina con el compañero antes de editar `index.html` y los shaders (`git pull` justo antes, commits chicos, subir rápido).
- **El aspecto por defecto no cambia** sin aprobación: lo nuevo son opciones; el perfil "Predeterminado" debe verse **igual que hoy**. (Excepción a decidir: si el diagnóstico de la sección 1 muestra un exceso de brillo propio de Qollab, se corrige el valor por defecto con aprobación.)
- El visor sigue funcionando solo con `python -m http.server`. Nada específico de Qollab en la feature; `localStorage` siempre en `try/catch` (en el iframe de Qollab puede fallar).
- Sin cambios en el backend ni en el contrato JSON.
- Al terminar: `make test`, `make lint`, `make qollab`, probar en Chromium y en Qollab, docs (`viewer.qmd`) y `memory.md`.

## 1. Diagnóstico previo (antes de diseñar nada más)

**Hallazgos con la captura de Qollab (2026-10-11) y un experimento local.** En la captura, las esferas aparecen **casi blancas** (borde grueso y relleno lavado), y detrás hay una mesa gris clara con un punto brillante en el centro y electrodos amarillo pálido. No es una sola luz; son dos efectos que se suman:

1. **Las esferas se dibujan con mezcla aditiva** (`bloch.frag`, `AdditiveBlending`): el color de la esfera **se suma** al de lo que hay detrás. Delante de un fondo claro (mesa, electrodos dorados, hoja global) el resultado se satura a blanco y el vector se pierde. Incluso sobre fondo negro el borde de la esfera ya es blanco y denso.
2. **El fondo está demasiado iluminado.** Con la cámara baja (la que usa el usuario), tras las esferas están la mesa metálica (`metalness 0.8`, `roughness 0.4`) y las filas de electrodos. Los ilumina el mapa de entorno `RoomEnvironment`, el ambiente, la direccional y las `PointLight` (el punto brillante del centro es el reflejo de la luz de acento o de la móvil).

Experimento local (Chromium, cámara baja y cerca): apagar las `PointLight` casi no cambia el fondo (los electrodos siguen claros por el entorno y la direccional); apagar **todas las luces y el entorno** deja el fondo oscuro, pero **el borde blanco de la esfera sigue ahí**. Conclusión: **para ver el vector hay que actuar sobre las dos cosas**: oscurecer o atenuar el fondo (entorno, luces, exposición) y bajar la ganancia de la esfera o cambiar cómo se mezcla con el fondo. Los controles de §3.3 y §3.5 salen de esto. Falta confirmar si Qollab ilumina más que el local (hipótesis 1 de abajo).

Una mejora de fondo para evaluar en el paso 3: dibujar la esfera con **mezcla normal premultiplicada** o con un **disco oscuro semitransparente detrás** (un "respaldo" suave) para que el vector tenga siempre un fondo del que destacar, sin depender de lo que haya detrás; es un cambio visible y necesita aprobación.

**1.1 La luz en Qollab.** Hipótesis, de más a menos probable, a descartar en este orden:

1. **Versión de three.** Qollab usa three **0.186.1** y el visor solo, **0.160.0** (`importmap`). `memory.md` dice que el dibujo de datos es igual, pero nunca se comparó **la imagen**. Cambian los valores por defecto de luces, entorno y mapeo de tonos entre versiones. Probar el visor local con `three@0.186.1` en el `importmap` y comparar capturas: si se ve igual de brillante, la causa es la versión y se puede arreglar en el código.
2. **Resolución y `devicePixelRatio`.** El visor limita a 2. En una pantalla de 2× o más, los shaders de raymarching (esferas y láser, con mezcla aditiva) cambian de aspecto porque `iResolution` cambia. Comparar a DPR 1 y a DPR 2.
3. **Qué luz exactamente.** Candidatas en el código: la luz que se mueve (`state.laser.movingLight`, `PointLight` de intensidad 20, `scene.js`), la de acento celeste (40, `environment.js`), las dos de color por ion (2.0), la direccional (1.2), `ACESFilmicToneMapping` con exposición 1.2 y el brillo aditivo de los shaders (esfera, láser, hoja global, riel). Probar apagando una por una con la consola (`state.three.scene`) para saber cuál domina.
4. **Tamaño del iframe de Qollab.** El visor se dibuja en menos píxeles; la hoja global y el glow del láser ocupan más proporción.

Entregable: una línea en este archivo y en `qollab.qmd` con la causa confirmada. Si es la versión de three o el DPR, se corrige en código y las opciones de abajo quedan como ajuste fino.

**1.2 La tecla D en Qollab.** El código de `scene.js` es correcto y funciona con eventos reales, así que la causa es del entorno. Hipótesis: Qollab (la página que aloja el iframe) captura la tecla D o usa un atajo y corta la propagación antes de que llegue a `window`.

- Registrar el `keydown`/`keyup` en **fase de captura** (`addEventListener("keydown", handler, { capture: true })`) para recibirlo antes que otros manejadores.
- Añadir un modo de diagnóstico, activo solo con `?debug=keys` en la URL o con una opción oculta del panel, que muestre en pantalla `event.code`, `event.key`, `defaultPrevented` y si `isTyping()` bloqueó la tecla. El usuario lo prueba en Qollab y se ve si el evento llega.
- **Alternativas que no dependen de una letra** (lo necesita la accesibilidad de todos modos, ver §4): flechas ← → ↑ ↓ para orbitar o mover, y botones en pantalla (ver §3). Cuidado: ←/→ ya cambian de paso desde `controls.js` (franja del circuito); las flechas de cámara deben ser con **Shift** o con el foco en el canvas, y se decide con el usuario.

## 2. Un lugar visible: el panel "Vista"

- **Botón siempre visible** en la barra de arriba (`.controls`), a la derecha, con texto y un icono de ojo: **"Vista"** (y `View` en inglés). No escondido en un menú. Es un botón con `aria-expanded` y `aria-controls`.
- Abre un **panel desplegable** anclado debajo del botón (popover de unos 320 px, scroll interno, estilo de `.measure-panel`: borde `var(--border)`, fondo `var(--panel)`, esquinas `var(--radius)`). Se cierra con Esc, con otro clic en el botón o fuera del panel. No tapa la escena de forma permanente.
- Arriba del panel, **perfiles rápidos** (una fila de botones) y debajo las opciones sueltas, agrupadas en secciones plegables como las de `.panel-head`. Un botón **"Restablecer"** vuelve al perfil Predeterminado.
- Todo se guarda en `localStorage` (clave `qviz.view`, una sola entrada JSON con versión), en `try/catch`. Sin almacenamiento, arranca con los valores por defecto y funciona igual.
- Textos por `TEXT` (`isEnglish()` en `utils.js`).

## 3. Opciones

### 3.1 Perfiles rápidos

| Perfil | Qué hace |
| --- | --- |
| **Predeterminado** | Como hoy. |
| **Enfoque en el vector** | Quita el ruido (ver 3.4), baja la luz y el glow, vector grueso y esfera más tenue. Pensado para leer el estado. |
| **Alto contraste** | Fondo más oscuro, vector y ejes en colores saturados y opacos, bordes más fuertes en la interfaz. |
| **Daltonismo** | Paleta segura (Okabe-Ito, ver 3.2): ejes y vector sin depender de rojo/verde. |
| **Movimiento reducido** | Sin jiggle, sin parpadeo del láser, sin auto-scroll suave (ver 3.5). |

Un perfil es solo un conjunto de valores de las opciones de abajo; el usuario puede partir de uno y ajustar.

### 3.2 Color

- **Paleta de los ejes** (x, y, z) y **color del vector y de su punta**. Hoy son constantes del `.frag` (`COLOR_AXIS_X/Y/Z`, `COLOR_STATE_VEC`, `COLOR_STATE_TIP`) y el panel/leyenda usa `--x`, `--y`, `--z`: rojo contra verde es un problema de daltonismo. Opciones: Predeterminada, Okabe-Ito (x naranja `#E69F00`, y celeste `#56B4E9`, z amarillo `#F0E442`, vector magenta `#CC79A7`), Alto contraste, Monocroma.
- **Color de la esfera y de las líneas** (`COLOR_SPHERE`, `COLOR_LINES`), por separado del vector.
- **Color del láser**: respetar el de la especie (hoy) o un único color neutro.
- La **leyenda** de ejes y los acentos de la interfaz siguen la paleta elegida (variables CSS `--x`, `--y`, `--z`).

### 3.3 Forma de ver la esfera y el vector

- **Grosor del vector** (delgado / normal / grueso) y **tamaño de la punta**: hoy `INTENSITY_STATE_VEC`, `INTENSITY_STATE_TIP` y el radio de la cápsula son constantes del `.frag`.
- **Vector siempre visible**: dibujarlo encima de la esfera y de lo que haya delante (opción para ignorar la profundidad, o una flecha sólida con cilindro y cono en una segunda pasada), con un **borde claro** que lo separa del fondo.
- **Opacidad de la esfera** (0–100 %): la esfera, los puntos (`INTENSITY_DOTS`), las líneas de latitud/longitud (`INTENSITY_LINES`) y los sectores de barrido (`INTENSITY_SWEEP_*`) por separado o con un solo control "Detalle de la esfera" (completo / simple / solo contorno).
- **Etiqueta numérica del vector**: texto pequeño sobre cada esfera con `(x, y, z)` redondeado, para quien no distingue bien la flecha. Opcional y apagada por defecto.
- **Modos de esfera**: "Volumétrica" (hoy), "Contorno" (solo la circunferencia del ecuador, los ejes y el vector) y "Plana" (disco 2D con el vector proyectado), con la misma lógica que `states`.

Técnica: pasar las constantes del `bloch.frag` que se quieran ajustar a **uniformes** (`uAxisX`, `uStateVec`, `uStateGain`, `uSphereGain`, …) con los valores de hoy como defecto, y fijarlos desde `settings.js`. Los shaders se embeben igual en `package_qollab.py`; hay que actualizar sus tests.

### 3.4 Quitar ruido visual

Casillas para ocultar, cada una con su efecto inmediato (`group.visible = false` o ganancia a 0):

- el **entorno** completo (mesa con grilla, bobinas, postes, anillo de ventana, niebla): `createEnvironment`, `applyAtmosphere`;
- el **chip de trampa** y sus anillos de campo: `createIonTrap`;
- la **capa horizontal** (hoja global, riel fonónico, ópticas laterales): `createHorizontalLayer`;
- los **láseres verticales** y la cabeza del láser: `createLaserBeams`, `createLaserHead`;
- el **phonon bus**, el **jiggle** y el **halo** de entrelazamiento;
- las **etiquetas** `q₀…` y la **leyenda** de la escena.

Hace falta una referencia a cada grupo (`state.three.groups.environment`, `.trap`, …) que hoy no se guarda: `buildScene` solo los añade al `world`. El perfil **Enfoque** apaga casi todo y deja las esferas, los ejes y los vectores.

### 3.5 Luz, brillo y movimiento

- **Exposición** (`renderer.toneMappingExposure`, hoy 1.2) y **niebla** (`FogExp2`): un control "Brillo de la escena".
- **Intensidad de las luces**: factor global sobre las `PointLight`, la direccional y el ambiente; la luz móvil (`movingLight`) con opción de apagarla.
- **Intensidad del láser y de la hoja global** (uniformes de ganancia, p. ej. `uLaserGain`) y **del glow** de las esferas.
- **Movimiento reducido**: sin parpadeo del láser (pulso plano), sin `jiggle`, sin giro del marcador de selección, sin scroll suave de la franja y del conteo; respetar `prefers-reduced-motion` como valor inicial.
- **Duración del pulso**: factor sobre `LASER_PULSE_MS` (y la espera del Play, que ya depende de `state.pulseMs`).

### 3.6 Interfaz y teclado

- **Tamaño del texto** (90 / 100 / 115 / 130 %) con una variable CSS que escala `font-size` base.
- **Contraste de la interfaz** (bordes y texto secundario `--muted` más claros).
- **Cámara sin teclado de letras**: botones en pantalla (rotar ←/→, subir/bajar, acercar/alejar, centrar) además de WASD; flechas con Shift; atajo para volver al encuadre inicial. Pensado también para pantallas táctiles.
- **Foco visible** en todos los controles (ya hay `:focus-visible`; revisar la franja y el panel nuevo), orden de tabulación lógico y `aria-label` en los botones de icono.
- Anunciar el paso con una región `aria-live="polite"` (operación, qubits, fidelidad), para lectores de pantalla.

## 4. Cómo se construye

- **Módulo `frontend/js/settings.js`**: valores por defecto, perfiles, lectura y escritura en `localStorage` (con `try/catch` y versión), `applySettings()` y un `subscribe` mínimo. Sin dependencias de los módulos de escena: **no puede crear ciclos de imports** (hoy el grafo no tiene ciclos y `bundle_modules` lo necesita así). Quien dibuja (`scene.js`, `laser.js`, `trap.js`, …) **lee** `state.view` y se suscribe.
- **Módulo `frontend/js/viewpanel.js`**: construye el panel y el botón y escribe en `settings`. Lo cablea `main.js` o `controls.js`.
- `state.js`: `view` (los valores vigentes) y `three.groups` (referencias a los grupos para ocultarlos).
- `index.html`: el botón "Vista" en `.controls`, el contenedor del panel y su CSS, con las variables de diseño de hoy (`--panel`, `--border`, `--accent`, `--radius`, `--speed`).
- `shaders/bloch.frag`, `laser.frag`, `rail.frag`, `bus.frag`: constantes de color e intensidad pasadas a uniformes con el valor actual por defecto.
- `package_qollab.py`: los shaders ya se embeben; comprobar que los uniformes nuevos llegan y que no hay `import` relativos nuevos.
- Cuidado con los nombres reservados de GLSL (`active` ya dio problemas: usar `intensity`).

## 5. Pasos de implementación

1. **Diagnóstico** (§1): comparar three 0.160 y 0.186.1, DPR y luces; añadir el modo `?debug=keys`; cambiar el `keydown` a captura. Pedir al usuario que pruebe la D en Qollab con el diagnóstico.
2. `settings.js` + panel "Vista" vacío pero visible, con persistencia y "Restablecer".
3. **Quitar ruido** (§3.4) y **luz/brillo/movimiento** (§3.5): son las que dan resultado más rápido sin tocar shaders.
4. **Color y forma** (§3.2, §3.3): uniformes en el `.frag`, paletas y modos de esfera.
5. **Perfiles** (§3.1) y **interfaz/teclado** (§3.6, botones de cámara, `aria-live`).
6. Pruebas (abajo), docs y `memory.md`.

## 6. Pruebas y criterios de aceptación

- `node --check` de los módulos nuevos y del `main.js` generado; un test de Python en `tests/test_package_qollab.py` que compruebe que `settings` y `viewpanel` están en `main.js`, que el CSS del panel llegó a `main.css`, que los uniformes nuevos están en los shaders embebidos y que `settings.js` no importa módulos de escena.
- Manual (local y Qollab), con `bell`, `bell_distant`, `ghz16` y `layered16`:
  - el botón **Vista** se ve sin buscarlo; el panel abre y cierra con clic, Esc y clic afuera;
  - el perfil Predeterminado se ve **igual que antes** (comparar capturas);
  - **Enfoque** deja las esferas con el vector bien legible y sin entorno, trampa, láseres ni capa horizontal;
  - cada casilla y cada control actúa al instante y se recuerda al recargar; sin `localStorage` no hay errores;
  - la paleta de daltonismo se distingue en una simulación (p. ej. el filtro de Chromium DevTools: protanopia, deuteranopia, tritanopia);
  - la franja del circuito, la selección de esferas, la medición y el Play siguen igual;
  - la cámara se maneja con los botones en pantalla aunque la D no responda;
  - con lector de pantalla o inspeccionando el árbol de accesibilidad: el panel tiene nombre, rol y estado, y el `aria-live` anuncia el paso.
- Medir el costo: los uniformes nuevos no deben bajar los fps (el contador del encabezado).
- Anotar en `documentation/prompts/qollab_pruebas.md` §4 el resultado en Qollab (brillo, D, panel).

## Fuera de alcance

- Cambiar el contrato JSON o el backend.
- Cambiar el aspecto del perfil Predeterminado (salvo corregir un exceso de brillo propio de Qollab, con aprobación).
- Sonido, voz o lectura automática del circuito.
- Un editor de colores libre (selectores de color arbitrarios): se ofrecen paletas probadas; se puede sumar después.

## Preguntas abiertas para el usuario

1. ~~¿La captura muestra el brillo en toda la escena o sobre todo el láser?~~ Respondida: es el fondo claro más la mezcla aditiva de las esferas (ver §1).
2. ¿Qué navegador usás en Qollab y qué pantalla (resolución, escala del sistema)?
3. ¿Los perfiles de §3.1 te alcanzan o querés otros?
4. ¿Las flechas de la cámara van con Shift (para no chocar con ←/→ de los pasos), o preferís solo los botones en pantalla?
5. ¿Si el exceso de brillo es de Qollab, aceptás bajar el valor por defecto, o solo ofrecer el perfil?
