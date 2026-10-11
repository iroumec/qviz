# QViz — Frontend Design

> This document describes the **web frontend** of QViz. The Python backend and
> the JSON contract are described in `spec.md`; here the JSON is treated as a
> fixed interface that the frontend consumes. The UI text is bilingual
> (Spanish and English).

## 1. Purpose

QViz is an educational visualiser for trapped-ion quantum circuits. The
frontend turns the JSON produced by the backend into an animation: one Bloch
sphere per ion, in a chain, that moves step by step through the native gates of
the circuit.

The design is optimised for the **general public**: a curious person with no
physics background should understand what is happening within a few seconds,
without reading a manual.

## 2. Goals and non-goals

**Goals**

- Show the state of every qubit after every native gate, as a 3D Bloch sphere.
- Make a Bell state, a GHZ state or a QFT adder look alive and understandable.
- Run entirely in the browser, with no server and no build step.
- Work on Qollab (as a JS project) and as a standalone static page.
- Be readable in Spanish and English.

**Non-goals**

- Simulating the real physics (lasers, motional modes, crosstalk).
- Editing circuits in the browser. The circuit comes from the backend.
- Sending jobs to hardware from the frontend.
- Replacing the backend's measurement model. (Out of scope for this document.)
- Mobile-first layout. A desktop browser is assumed; small screens must not
  break, but they are not the target.

## 3. Decisions taken

These decisions came out of the design review and are fixed for this version.

| Topic | Decision |
| --- | --- |
| Scope of this document | Frontend only. |
| Audience | General public. |
| Delivery | Qollab JS project, and also a library with static viewers. |
| Technology | Vanilla JavaScript + three.js. No build step. |
| Maximum circuit width | 16 qubits. |
| Non-IonQ reference | Trapped-ion reference (Aria for MS, Forte for ZZ). |
| Cost unit | US dollars. |
| UI language | Bilingual, Spanish and English, switchable. |

## 4. Context and constraints

The frontend runs in the browser. On Qollab, the following constraints apply and
shape the design (see `documentation/prompts/qollab_context.md`):

- **No server.** No `POST`, no database, no persistence. The page is a single
  `index.html` with its `main.js` and CSS, and the Python code runs in the same
  browser (Pyodide).
- **JavaScript cannot read the project files.** The JSON produced by Python is
  passed to JavaScript through a Python function call (`callPromising`), or it
  is written by Python and handed over as a string. A `fetch` of a local file is
  not available on Qollab.
- **Three.js** is imported by name (`three`). Other libraries are imported by
  full URL, which is avoided here.
- **One thread.** A long computation freezes the page. The frontend work is
  therefore kept small: the heavy simulation is done by the backend, and the
  frontend only draws.
- **No storage.** `localStorage`, cookies and IndexedDB are not available, so the
  language choice is not remembered between runs.

## 5. System overview

The frontend has one job: read the JSON and draw it. The JSON is produced either
by the Python backend (the normal path) or by a pre-generated file (the demos).

```
                 backend (Python)                 frontend (JS)
  circuit + backend ──► compile() ──► JSON ──►  parse + validate
                                                   │
                                                   ▼
                                            scene  (three.js)
                                                   │
                                        ┌──────────┴──────────┐
                                        ▼                     ▼
                                  Bloch spheres          panels
                                  (shaders)         (details, health,
                                                     probabilities)
```

### 5.1 Two delivery modes

1. **Qollab JS project.** `index.html` + `main.js`. The Python backend is
   imported and called; the JSON is passed to `main.js`, which renders it. This
   is the mode for the published project. A `make qollab` target assembles the
   `qollab/` folder before upload.
2. **Standalone library + viewers.** The same viewers are opened over a local
   HTTP server. They read `out/manifest.json` and the files produced by
   `make outputs`. This is the mode used for development and for the demos.

Both modes share the same rendering code, so no logic is duplicated.

### 5.2 Files

```
source/frontend/
  index.html      # main viewer: shaders, manifest selector, panels
  viewer3d.html   # standalone 3D demo (always loads out/bell.json)
  viewer.html     # 2D canvas fallback; no three.js
source/shaders/
  bloch.vert      # instanced vertex shader (per-instance state vector)
  bloch.frag      # volumetric raymarching fragment shader
out/              # JSON files and manifest.json, produced by the backend
```

## 6. The JSON interface

The frontend reads only the fields of the contract. Nothing else is assumed.

| Field | Used for |
| --- | --- |
| `backend` | the name shown in the header |
| `total_qubits` | the number of spheres in the chain |
| `initial_fidelity` | the health bar at step 0 |
| `steps[].step`, `operation`, `targets` | the step label and the highlight |
| `steps[].phases`, `angle` | the detail panel |
| `steps[].states` | the vector of each sphere (`x, y, z`) |
| `steps[].probabilities` | the `p(|1⟩)` readout of each qubit |
| `steps[].virtual_z` | the detail panel |
| `steps[].fidelities` | the per-qubit fidelity in the detail and in the readouts |
| `steps[].cumulative_fidelity` | the **health bar** |
| `steps[].inactivity`, `vibration` | the detail panel and the vector wobble |
| `steps[].cumulative_cost` | the detail panel (US dollars) |

Units and conventions follow the backend: phases in radians, `angle` in turns,
little-endian qubit order, `|0⟩` at `+z`.

## 7. Rendering design

### 7.1 The volumetric shader

The spheres are drawn with the two shaders in `source/shaders/`. The fragment shader
is a volumetric raymarcher: from each ray it derives the axes, the state vector,
the azimuth and polar sweeps, the sphere shell and the dotted grid. The vertex
shader is **instanced**, so all the ions are drawn in a single draw call. Each
instance carries its own Bloch vector in the `instancePsi` attribute, and the
animation is driven by the `iTime` uniform.

This choice was made because the shader gives a pleasant, "physical" look
(glow, sweeps) that a plain sphere mesh cannot match, and because instancing
keeps the draw cost flat as the number of ions grows.

### 7.2 The ion chain

The ions are laid out in a **single chain**, one after another along the `x`
axis, to resemble an ion trap. A grid is not used. The camera orbits the chain
(drag to rotate, wheel to zoom) and the framing adapts to the chain length.

### 7.3 From the JSON vector to the shader

The backend gives the reduced Bloch vector `(x, y, z)`. It is passed to the
shader as `(x, z, -y)`, so that the Bloch `+z` axis (the `|0⟩` pole) points up
along the shader's polar axis. The length of the vector is the length `r` of the
reduced state:

- `r = 1` for a pure single-qubit state;
- `r < 1` when the qubit is entangled, and the arrow is shorter;
- `r = 0` for a maximally entangled qubit, and the arrow disappears (only the
  sphere and its axes remain).

The disappearance of the vector for a Bell state is correct and is a teaching
point, not a bug.

### 7.4 Step 0

The initial state (every ion in `|0⟩`) is **not** part of the JSON. The frontend
adds it as step 0, so the user can see the starting point before the first gate.

## 8. Layout and interaction

```
┌──────────────────────────────────────────────────────────────┐
│ header:  QViz · backend name · health bar · qubits/steps/fps  │
├──────────────────────────────────────────────────────────────┤
│ controls: [file ▾] [Cargar circuito] [◀] [Play] [▶] [─slider─]    │
├───────────────────────────────────────────┬──────────────────┤
│                                           │                  │
│            stage (three.js)               │  detail panel    │
│            chain of Bloch spheres         │  (current step)  │
│                                           │                  │
│  readouts (p(|1⟩) per qubit)              │                  │
│  legend (axes)                            │                  │
└───────────────────────────────────────────┴──────────────────┘
```

| Control | Effect |
| --- | --- |
| File selector | Chooses one of the generated JSON files (`out/manifest.json`). |
| Load JSON | Opens the file picker; a file can also be dragged onto the page. |
| ◀ / ▶ | Moves to the previous or next step. |
| Play / Pause | Plays the steps automatically. |
| Slider | Jumps to a step; step 0 is the initial state. |
| Language toggle | Switches the UI between Spanish and English. |

The **health bar** in the header shows `cumulative_fidelity` of the current step
(green above 99%, amber above 95%, red below). At step 0 it shows the initial
fidelity of the backend.

The **detail panel** shows the operation, the targets, the phases, the angle,
the accumulated fidelity and cost, the virtual Z rotation, the inactivity, the
fidelities and the vibration.

## 9. Bilingual interface

The interface is bilingual and switchable.

- All the visible strings live in one **string table** per language, keyed by a
  short id. No sentence is built by joining fragments, so that word order can
  change between languages.
- A **language toggle** is placed in the header. The default language is taken
  from the browser (`navigator.language`): Spanish for `es-*`, English
  otherwise.
- The choice is **not persisted** (Qollab has no storage). It resets on reload,
  which is acceptable.
- The JSON field names are not translated; the labels that name them are.

## 10. Loading the JSON

The frontend offers three ways to get a JSON file, in this order:

1. **From the backend** (Qollab JS project): the JSON is passed to `main.js` by
   the Python module and rendered directly.
2. **From the manifest** (standalone): `out/manifest.json` lists the generated
   files with a readable label. The selector is filled from it and the default
   file is loaded.
3. **From the user**: a file can be dragged onto the page or chosen with the
   file picker.

When no file is available, a small example embedded in the page is used, so the
viewer is never empty.

The JSON is validated against the expected shape (a `total_qubits` integer and a
`steps` array) before it is drawn.

## 11. Performance budget

- **16 qubits maximum.** The backend enforces the limit; the frontend shows at
  most 16 spheres, in a single instanced chain.
- **One draw call** for all the spheres (instancing).
- The raymarcher is the dominant cost (a few dozen steps per pixel). The design
  keeps it in check with:
  - a bounded marching distance and step count in the shader;
  - a capped device pixel ratio (at most 2);
  - a live **frames-per-second** readout in the header, so a regression is
    visible.
- The per-frame JavaScript work is small: it only interpolates the vectors and
  uploads one small attribute buffer.

## 12. Accessibility and onboarding

For the general public, the first seconds matter.

- A short **legend** explains the axis colours and the drag/zoom gestures.
- A plain-language **hint** is always visible when no file is loaded.
- The values are shown as numbers next to the colours, so colour is never the
  only channel (useful for colour-blind users).
- The animation is smooth but not required: the slider allows a step-by-step
  reading.
- The bilingual interface removes the language barrier for the intended
  audience.
- Keyboard support for the step controls is a goal (arrow keys to change step,
  space to play/pause).

## 13. Error handling

The frontend must degrade gracefully, never with a blank page.

| Situation | Behaviour |
| --- | --- |
| Malformed JSON | A clear error message is shown; the previous scene is kept. |
| Missing file | The manifest entry is skipped; otherwise the embedded example is used. |
| three.js not available | A message is shown and the 2D viewer is offered as a fallback. |
| Shaders not reachable | A message asks the user to serve the project over HTTP. |
| Backend error (unsupported gate) | The error text from the backend is shown; nothing is drawn. |

## 14. Testing and validation

- **Automated, in Node:** a small DOM/three.js harness runs the data logic
  (`loadData`, `updateStep`, the panels) for the embedded example and for a real
  `out/bell.json`, so the rendering path is checked without a browser.
- **Schema:** the JSON used in the tests validates against
  `documentation/schema/visualization.schema.json`.
- **Manual:** the demos (`make outputs`) are opened in the viewer, and the FPS
  and the health bar are watched for the 16-qubit circuits.

## 15. Future work

- A single-page **help / about** screen for the general public.
- A **quality** selector for the raymarcher on weaker machines.
- An explicit **mode selector** for the sphere look (solid vs glow).
- A guided tour that explains a Bell state step by step.
- English strings reviewed by a native speaker.

## 16. References

- `spec.md` — backend specification and JSON contract.
- `documentation/docs/frontend/viewer.qmd` — the viewers, in the book.
- `documentation/prompts/qollab_context.md` — platform constraints.
- `documentation/references/ionq_native_gates.md` — the native gates.
