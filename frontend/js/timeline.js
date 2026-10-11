// The timeline strip: the transpiled circuit as one wire per qubit with the
// native gates in order. The current step is highlighted and a click on a gate
// jumps to its step. It does not import the data or controls modules; the
// controls wire the click with `initTimeline`.

import { OPERATIONS } from "./config.js";
import { state } from "./state.js";
import { isEnglish, qubitLabel } from "./utils.js";

const STORAGE_KEY = "qviz.timeline.open";
const ZOOM_KEY = "qviz.timeline.zoom";
const ZOOM_LEVELS = 3; // 1 = labelled boxes, 2 = small boxes, 3 = thin marks

const TEXT = isEnglish()
  ? {
      title: "Transpiled circuit", hide: "Hide", show: "Show",
      zoomIn: "Zoom in", zoomOut: "Zoom out", jump: "Go to step",
      empty: "Load a circuit to see its sequence.",
      step: "Step", fidelity: "Fidelity", label: "Native gates of the circuit, by qubit",
    }
  : {
      title: "Circuito transpilado", hide: "Ocultar", show: "Mostrar",
      zoomIn: "Acercar", zoomOut: "Alejar", jump: "Ir al paso",
      empty: "Cargá un circuito para ver su secuencia.",
      step: "Paso", fidelity: "Fidelidad", label: "Compuertas nativas del circuito, por qubit",
    };

// The elements of the current circuit, rebuilt by `buildTimeline`.
const view = { gates: [], names: [], wires: [], playhead: null, scroll: null };
let onSelect = () => {};

function readStored(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function store(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // The storage can be blocked (private window, sandboxed frame): not needed.
  }
}

let zoom = 1;

// The zoom changes the width of a column (CSS classes z1, z2 and z3), which
// matters for long circuits: at z3 hundreds of steps fit in a few screens.
function setZoom(level) {
  zoom = Math.max(1, Math.min(ZOOM_LEVELS, level));
  const body = document.getElementById("timelineBody");
  body.classList.remove("z1", "z2", "z3");
  body.classList.add(`z${zoom}`);
  document.getElementById("timelineZoomIn").disabled = zoom === 1;
  document.getElementById("timelineZoomOut").disabled = zoom === ZOOM_LEVELS;
  store(ZOOM_KEY, String(zoom));
  if (state.stepIndex > 0 && view.playhead) centerStep(state.stepIndex, "auto");
}

function setOpen(open) {
  const section = document.getElementById("timeline");
  const toggle = document.getElementById("timelineToggle");
  section.classList.toggle("collapsed", !open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.querySelector(".tl-toggle-text").textContent = open ? TEXT.hide : TEXT.show;
}

/** Translate the texts, restore the open/closed state and wire the toggle. */
export function initTimeline(select) {
  onSelect = select;
  document.getElementById("timelineTitle").textContent = TEXT.title;
  const body = document.getElementById("timelineBody");
  body.setAttribute("aria-label", TEXT.label);
  body.innerHTML = `<p class="tl-empty">${TEXT.empty}</p>`;
  setOpen(readStored(STORAGE_KEY) !== "0");
  document.getElementById("timelineToggle").addEventListener("click", () => {
    const open = document.getElementById("timeline").classList.contains("collapsed");
    setOpen(open);
    store(STORAGE_KEY, open ? "1" : "0");
  });
  const zoomIn = document.getElementById("timelineZoomIn");
  const zoomOut = document.getElementById("timelineZoomOut");
  zoomIn.title = TEXT.zoomIn;
  zoomOut.title = TEXT.zoomOut;
  zoomIn.addEventListener("click", () => setZoom(zoom - 1));
  zoomOut.addEventListener("click", () => setZoom(zoom + 1));
  setZoom(Number(readStored(ZOOM_KEY)) || 1);
}

function highlightWires(targets, on) {
  state.hovered = on ? targets.slice() : [];
  for (const q of targets) {
    if (view.names[q]) view.names[q].classList.toggle("hl", on);
    if (view.wires[q]) view.wires[q].classList.toggle("hl", on);
  }
}

function describe(step) {
  const operation = OPERATIONS[step.operation] || { name: step.operation };
  return `${TEXT.step} ${step.step} · ${operation.name} · ` +
    `${step.targets.map(qubitLabel).join(", ")} · ` +
    `${TEXT.fidelity} ${step.cumulative_fidelity.toFixed(2)} %`;
}

/** Draw the circuit of a loaded visualization: one wire per qubit, one column per step. */
export function buildTimeline(data) {
  const body = document.getElementById("timelineBody");
  const count = data.total_qubits;
  const steps = data.steps;
  body.innerHTML = "";
  view.gates = [];
  view.names = [];
  view.wires = [];
  view.playhead = null;
  if (steps.length === 0) {
    body.innerHTML = `<p class="tl-empty">${TEXT.empty}</p>`;
    return;
  }

  // Row 1 holds the step numbers; the qubit q is in row q + 2. Column 1 holds
  // the names; the step s is in column s + 1.
  const grid = document.createElement("div");
  grid.className = "tl-grid";
  grid.style.gridTemplateColumns = `max-content repeat(${steps.length}, var(--tl-col))`;
  grid.style.gridTemplateRows = `var(--tl-head) repeat(${count}, var(--tl-row))`;

  const playhead = document.createElement("div");
  playhead.className = "tl-playhead";
  playhead.style.gridRow = `1 / ${count + 2}`;
  playhead.hidden = true;
  grid.appendChild(playhead);

  const corner = document.createElement("div");
  corner.className = "tl-corner";
  corner.style.gridArea = "1 / 1";
  grid.appendChild(corner);

  for (let q = 0; q < count; q++) {
    const name = document.createElement("div");
    name.className = "tl-name";
    name.textContent = qubitLabel(q);
    name.style.gridArea = `${q + 2} / 1`;
    grid.appendChild(name);
    view.names.push(name);

    const wire = document.createElement("div");
    wire.className = "tl-wire";
    wire.style.gridArea = `${q + 2} / 2 / ${q + 3} / ${steps.length + 2}`;
    grid.appendChild(wire);
    view.wires.push(wire);
  }

  steps.forEach((step, index) => {
    const column = index + 2;
    const operation = OPERATIONS[step.operation] || { short: step.operation, kind: "1q" };
    const head = document.createElement("div");
    head.className = "tl-index" + (step.step % 5 === 0 ? " m5" : "") + (step.step % 10 === 0 ? " m10" : "");
    head.textContent = String(step.step);
    head.title = `${TEXT.jump} ${step.step}`;
    head.addEventListener("click", () => onSelect(index + 1));
    head.style.gridArea = `1 / ${column}`;
    grid.appendChild(head);

    const rows = step.targets.map((t) => t + 2);
    if (rows.length > 1) {
      const link = document.createElement("div");
      link.className = "tl-link";
      link.style.gridArea = `${Math.min(...rows)} / ${column} / ${Math.max(...rows) + 1} / ${column + 1}`;
      grid.appendChild(link);
    }
    const buttons = [];
    for (const row of rows) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tl-gate op-${operation.kind}`;
      button.textContent = operation.short;
      button.title = describe(step);
      button.style.gridArea = `${row} / ${column}`;
      button.addEventListener("click", () => onSelect(index + 1));
      button.addEventListener("mouseenter", () => highlightWires(step.targets, true));
      button.addEventListener("mouseleave", () => highlightWires(step.targets, false));
      button.addEventListener("focus", () => highlightWires(step.targets, true));
      button.addEventListener("blur", () => highlightWires(step.targets, false));
      grid.appendChild(button);
      buttons.push(button);
    }
    view.gates.push(buttons);
  });

  const scroll = document.createElement("div");
  scroll.className = "tl-scroll";
  scroll.appendChild(grid);
  body.appendChild(scroll);
  view.scroll = scroll;
  view.playhead = playhead;
  enablePan(scroll);
}

// Long circuits: drag the background of the strip to pan it, and let the wheel
// move it sideways when there is nothing to scroll vertically.
function enablePan(scroll) {
  let drag = null;
  scroll.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, .tl-index")) return;
    drag = { x: event.clientX, left: scroll.scrollLeft };
    scroll.setPointerCapture(event.pointerId);
    scroll.classList.add("panning");
  });
  scroll.addEventListener("pointermove", (event) => {
    if (drag) scroll.scrollLeft = drag.left - (event.clientX - drag.x);
  });
  const stop = () => {
    drag = null;
    scroll.classList.remove("panning");
  };
  scroll.addEventListener("pointerup", stop);
  scroll.addEventListener("pointercancel", stop);
  scroll.addEventListener("wheel", (event) => {
    if (scroll.scrollHeight > scroll.clientHeight + 1 || event.shiftKey) return;
    event.preventDefault();
    scroll.scrollLeft += event.deltaY;
  }, { passive: false });
}

/** Mark the gates as done, current or pending for this step (0 = initial state). */
export function highlightStep(index) {
  if (!view.playhead) return;
  view.gates.forEach((buttons, i) => {
    const step = i + 1;
    for (const button of buttons) {
      button.classList.toggle("done", step < index);
      button.classList.toggle("current", step === index);
      button.classList.toggle("pending", step > index);
      if (step === index) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    }
  });
  view.playhead.hidden = index === 0;
  if (index === 0) {
    view.scroll.scrollTo({ left: 0, top: 0 });
    return;
  }
  view.playhead.style.gridColumn = String(index + 1);
  centerStep(index);
}

// Scroll so that the current column is in the middle and its first wire is
// visible. Only the strip scrolls, never the page.
function centerStep(index, mode) {
  const current = view.gates[index - 1][0];
  const scroll = view.scroll;
  const reduced = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior = reduced || mode === "auto" ? "auto" : "smooth";
  const left = current.offsetLeft + current.offsetWidth / 2 - scroll.clientWidth / 2;
  let top = scroll.scrollTop;
  if (current.offsetTop < top) top = current.offsetTop - 22;
  else if (current.offsetTop + current.offsetHeight > top + scroll.clientHeight) {
    top = current.offsetTop + current.offsetHeight - scroll.clientHeight + 6;
  }
  scroll.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior });
}
