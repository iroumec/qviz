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

// A very long circuit does not put one element per step in the document: only
// the columns near the viewport are built, and they are replaced while the strip
// scrolls. Below the threshold the whole circuit is built, which is simpler.
const VIRTUAL_THRESHOLD = 250;
const WINDOW = 120; // columns rendered on each side of the viewport

// The elements of the current circuit, rebuilt by `buildTimeline`.
const view = {
  gates: [], names: [], wires: [], playhead: null, scroll: null, grid: null,
  holdUntil: 0, picked: false, pending: null,
  steps: [], nodes: new Map(), renderedFirst: -1, renderedLast: -1,
  virtual: false, frame: 0,
};

// While the user drives the strip (its scrollbar, a drag or the wheel), playing
// must not pull it back to the current step; the strip is left alone until a
// moment after the last gesture.
const HOLD_MS = 2500;
function holdScroll(ms = HOLD_MS) {
  view.holdUntil = performance.now() + ms;
}

/** Select a step because the user clicked it in the strip. */
function pick(step) {
  view.picked = true;
  try {
    onSelect(step);
  } finally {
    view.picked = false;
  }
}
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
  if (view.virtual && view.scroll) {
    // The column width changed, so the window of built columns changed with it.
    clearRendered();
    ensureRendered(state.stepIndex > 0 ? state.stepIndex - 1 : 0);
  }
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
    // The strip is built only when it is first shown, so a long circuit does not
    // pay for a hidden one.
    if (open && view.pending) {
      buildTimeline(view.pending);
      highlightStep(state.stepIndex);
    }
  });
  const zoomIn = document.getElementById("timelineZoomIn");
  const zoomOut = document.getElementById("timelineZoomOut");
  zoomIn.title = TEXT.zoomIn;
  zoomOut.title = TEXT.zoomOut;
  zoomIn.setAttribute("aria-label", TEXT.zoomIn);
  zoomOut.setAttribute("aria-label", TEXT.zoomOut);
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
  view.gates = [];
  view.names = [];
  view.wires = [];
  view.playhead = null;
  if (document.getElementById("timeline").classList.contains("collapsed")) {
    view.pending = data;
    view.virtual = false;
    view.grid = null;
    view.scroll = null;
    view.nodes.clear();
    view.renderedFirst = -1;
    view.renderedLast = -1;
    body.innerHTML = `<p class="tl-empty">${TEXT.empty}</p>`;
    return;
  }
  view.pending = null;
  body.innerHTML = "";
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

  view.grid = grid;
  view.steps = steps;
  view.virtual = steps.length > VIRTUAL_THRESHOLD;
  view.nodes = new Map();
  view.renderedFirst = -1;
  view.renderedLast = -1;
  view.gates = [];

  const scroll = document.createElement("div");
  scroll.className = "tl-scroll";
  scroll.appendChild(grid);
  body.appendChild(scroll);
  view.scroll = scroll;
  view.playhead = playhead;

  if (view.virtual) {
    renderWindow(true);
    scroll.addEventListener("scroll", scheduleWindow);
  } else {
    for (let index = 0; index < steps.length; index++) renderStep(index);
  }

  enablePan(scroll);
  enableBar(body, scroll, grid);
}

/** The width of one column in pixels, from the CSS variable of the strip. */
function columnWidth() {
  const value = parseFloat(
    getComputedStyle(document.getElementById("timelineBody")).getPropertyValue("--tl-col")
  );
  return Number.isFinite(value) && value > 0 ? value : 38;
}

/** Add the head, the link and the gates of one step to the grid. */
function renderStep(index) {
  const step = view.steps[index];
  const column = index + 2;
  const operation = OPERATIONS[step.operation] || { short: step.operation, kind: "1q" };
  const elements = [];

  const head = document.createElement("div");
  head.className = "tl-index" + (step.step % 5 === 0 ? " m5" : "") + (step.step % 10 === 0 ? " m10" : "");
  head.textContent = String(step.step);
  head.title = `${TEXT.jump} ${step.step}`;
  head.addEventListener("click", () => pick(index + 1));
  head.style.gridArea = `1 / ${column}`;
  view.grid.appendChild(head);
  elements.push(head);

  const rows = step.targets.map((target) => target + 2);
  if (rows.length > 1) {
    const link = document.createElement("div");
    link.className = "tl-link";
    link.style.gridArea = `${Math.min(...rows)} / ${column} / ${Math.max(...rows) + 1} / ${column + 1}`;
    view.grid.appendChild(link);
    elements.push(link);
  }
  const buttons = [];
  for (const row of rows) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tl-gate op-${operation.kind}`;
    button.textContent = operation.short;
    button.title = describe(step);
    button.style.gridArea = `${row} / ${column}`;
    button.addEventListener("click", () => pick(index + 1));
    button.addEventListener("mouseenter", () => highlightWires(step.targets, true));
    button.addEventListener("mouseleave", () => highlightWires(step.targets, false));
    button.addEventListener("focus", () => highlightWires(step.targets, true));
    button.addEventListener("blur", () => highlightWires(step.targets, false));
    view.grid.appendChild(button);
    buttons.push(button);
    elements.push(button);
  }
  view.nodes.set(index, elements);
  view.gates[index] = buttons;
}

/** Remove the elements of one step from the grid. */
function removeStep(index) {
  const elements = view.nodes.get(index);
  if (!elements) return;
  for (const element of elements) element.remove();
  view.nodes.delete(index);
  view.gates[index] = undefined;
}

/** Remove every built step, to rebuild the window after a zoom change. */
function clearRendered() {
  for (const index of [...view.nodes.keys()]) removeStep(index);
  view.renderedFirst = -1;
  view.renderedLast = -1;
}

/**
 * The range of columns to build for a viewport: the visible ones plus one
 * window on each side. Exported because it is the whole virtualization rule.
 */
export function windowRange(scrollLeft, clientWidth, column, total) {
  const first = Math.max(0, Math.floor(scrollLeft / column) - WINDOW);
  const last = Math.min(
    total - 1,
    Math.ceil((scrollLeft + clientWidth) / column) + WINDOW
  );
  return [first, Math.max(first, last)];
}

/** Build the steps around the current scroll position, and drop the rest. */
function renderWindow(force = false) {
  if (!view.virtual || !view.scroll) return;
  const [first, last] = windowRange(
    view.scroll.scrollLeft, view.scroll.clientWidth, columnWidth(), view.steps.length
  );
  if (!force && first === view.renderedFirst && last === view.renderedLast) return;
  for (const index of [...view.nodes.keys()]) {
    if (index < first || index > last) removeStep(index);
  }
  for (let index = first; index <= last; index++) {
    if (!view.nodes.has(index)) renderStep(index);
  }
  view.renderedFirst = first;
  view.renderedLast = last;
}

/** Make sure the steps around ``index`` are built (used before centering on it). */
function ensureRendered(index) {
  if (!view.virtual) return;
  const first = Math.max(0, index - WINDOW);
  const last = Math.min(view.steps.length - 1, index + WINDOW);
  for (const step of [...view.nodes.keys()]) {
    if (step < first || step > last) removeStep(step);
  }
  for (let step = first; step <= last; step++) {
    if (!view.nodes.has(step)) renderStep(step);
  }
  view.renderedFirst = first;
  view.renderedLast = last;
}

/** Coalesce the scroll events into one window update per frame. */
function scheduleWindow() {
  if (view.frame) return;
  view.frame = window.requestAnimationFrame(() => {
    view.frame = 0;
    renderWindow();
  });
}

// The horizontal scrollbar of the strip is drawn by the viewer and not by the
// browser: the native one is not the same in every browser and system (and some
// of them do not let a page keep its press), so dragging and clicking it would
// not always work. The strip itself only scrolls vertically by itself; this bar
// moves it sideways: drag the thumb, or press the track to go a page that way.
function enableBar(body, scroll, grid) {
  const bar = document.createElement("div");
  bar.className = "tl-bar";
  bar.setAttribute("role", "scrollbar");
  bar.setAttribute("aria-orientation", "horizontal");
  const thumb = document.createElement("div");
  thumb.className = "tl-thumb";
  bar.appendChild(thumb);
  body.appendChild(bar);

  /** Place and size the thumb after the strip, its width or the zoom changed. */
  const sync = () => {
    const total = scroll.scrollWidth;
    const shown = scroll.clientWidth;
    bar.hidden = total <= shown + 1;
    if (bar.hidden) return;
    const track = bar.clientWidth;
    const width = Math.max(32, (track * shown) / total);
    const left = ((track - width) * scroll.scrollLeft) / (total - shown);
    thumb.style.width = `${width}px`;
    thumb.style.transform = `translateX(${Math.max(0, left)}px)`;
  };
  scroll.addEventListener("scroll", sync);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      sync();
      scheduleWindow();
    });
    observer.observe(scroll);
    observer.observe(grid);
  }
  window.requestAnimationFrame(sync);

  let drag = null;
  thumb.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    holdScroll(8000);
    thumb.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, left: scroll.scrollLeft };
    bar.classList.add("dragging");
  });
  thumb.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const travel = bar.clientWidth - thumb.offsetWidth;
    if (travel <= 0) return;
    const ratio = (scroll.scrollWidth - scroll.clientWidth) / travel;
    scroll.scrollLeft = drag.left + (event.clientX - drag.x) * ratio;
  });
  const release = () => {
    if (!drag) return;
    drag = null;
    holdScroll();
    bar.classList.remove("dragging");
  };
  thumb.addEventListener("pointerup", release);
  thumb.addEventListener("pointercancel", release);
  thumb.addEventListener("lostpointercapture", release);

  bar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target !== bar) return;
    event.preventDefault();
    holdScroll();
    const box = thumb.getBoundingClientRect();
    const direction = event.clientX < box.left ? -1 : 1;
    scroll.scrollBy({ left: direction * scroll.clientWidth * 0.9, behavior: "auto" });
  });
}

/** True when the press landed on a scrollbar of the element (not on its content). */
function onScrollbar(element, event) {
  const box = element.getBoundingClientRect();
  const x = event.clientX - box.left - element.clientLeft;
  const y = event.clientY - box.top - element.clientTop;
  return x >= element.clientWidth || y >= element.clientHeight;
}

// Long circuits: drag the background of the strip to pan it, and let the wheel
// move it sideways when there is nothing to scroll vertically.
function enablePan(scroll) {
  let drag = null;
  scroll.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, .tl-index")) return;
    // The native scrollbars belong to the browser: a press on one must not start
    // a pan, or capturing the pointer would break dragging the scrollbar thumb.
    if (onScrollbar(scroll, event)) {
      holdScroll(8000);
      return;
    }
    holdScroll();
    drag = { x: event.clientX, left: scroll.scrollLeft };
    scroll.setPointerCapture(event.pointerId);
    scroll.classList.add("panning");
  });
  scroll.addEventListener("pointermove", (event) => {
    if (drag) scroll.scrollLeft = drag.left - (event.clientX - drag.x);
  });
  const stop = () => {
    holdScroll();
    drag = null;
    scroll.classList.remove("panning");
  };
  scroll.addEventListener("pointerup", stop);
  // A drag of a native scrollbar may end outside the strip, or without an event.
  window.addEventListener("pointerup", () => {
    if (view.holdUntil > performance.now()) holdScroll();
  });
  scroll.addEventListener("pointercancel", stop);
  scroll.addEventListener("wheel", (event) => {
    if (scroll.scrollHeight > scroll.clientHeight + 1 || event.shiftKey) return;
    event.preventDefault();
    holdScroll();
    scroll.scrollLeft += event.deltaY;
  }, { passive: false });
}

/** Mark the gates as done, current or pending for this step (0 = initial state). */
export function highlightStep(index) {
  if (!view.playhead) return;
  if (view.virtual && index > 0) ensureRendered(index - 1);
  view.gates.forEach((buttons, i) => {
    if (!buttons) return;
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
  if (mode !== "auto" && performance.now() < view.holdUntil) return;
  const buttons = view.gates[index - 1];
  if (!buttons || !buttons[0]) return;
  const current = buttons[0];
  const scroll = view.scroll;
  // A click on a gate that is already in view must not move the strip under the
  // pointer: it only scrolls when the column is cut off.
  if (view.picked) {
    const left = current.offsetLeft;
    const right = left + current.offsetWidth;
    const visible = left >= scroll.scrollLeft + 60 && right <= scroll.scrollLeft + scroll.clientWidth;
    if (visible) return;
  }
  const reduced = state.view.reducedMotion;
  const behavior = reduced || mode === "auto" ? "auto" : "smooth";
  const left = current.offsetLeft + current.offsetWidth / 2 - scroll.clientWidth / 2;
  let top = scroll.scrollTop;
  if (current.offsetTop < top) top = current.offsetTop - 22;
  else if (current.offsetTop + current.offsetHeight > top + scroll.clientHeight) {
    top = current.offsetTop + current.offsetHeight - scroll.clientHeight + 6;
  }
  scroll.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior });
}
