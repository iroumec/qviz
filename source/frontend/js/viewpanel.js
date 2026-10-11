// The "View and accessibility" panel: a button that is always in sight, and a
// popover with the profiles and every view option (colour, shape of the sphere
// and the vector, what is shown, light and motion, interface). It writes to
// settings.js and follows its changes, so the panel and the scene always agree.

import { PALETTES, PROFILES, applyProfile, resetView, setOption, subscribe } from "./settings.js";
import { state } from "./state.js";
import { isEnglish } from "./utils.js";

const ENGLISH = isEnglish();

// The texts, as [Spanish, English].
const t = (es, en) => (ENGLISH ? en : es);

const PROFILE_LABELS = {
  default: t("Predeterminado", "Default"),
  focus: t("Enfoque en el vector", "Focus on the vector"),
  contrast: t("Alto contraste", "High contrast"),
  colorblind: t("Daltonismo", "Colour blindness"),
  calm: t("Movimiento reducido", "Reduced motion"),
};

const TEXT = {
  button: t("Vista y accesibilidad", "View and Accessibility Options"),
  title: t("Vista y accesibilidad", "View and Accessibility Options"),
  close: t("Cerrar", "Close"),
  reset: t("Restablecer", "Reset"),
  profiles: t("Perfiles", "Profiles"),
};

// The options, in sections. A control is a select, a range or a check.
const SECTIONS = [
  {
    title: t("Color", "Colour"),
    open: true,
    controls: [
      {
        key: "palette", type: "select", label: t("Paleta", "Palette"),
        options: [
          ["default", t("Predeterminada", "Default")],
          ["okabe", t("Daltonismo (Okabe-Ito)", "Colour blind (Okabe-Ito)")],
          ["contrast", t("Alto contraste", "High contrast")],
          ["mono", t("Monocroma", "Monochrome")],
        ],
      },
    ],
  },
  {
    title: t("Esfera y vector", "Sphere and vector"),
    open: true,
    controls: [
      {
        key: "sphereBlend", type: "select", label: t("Mezcla de la esfera", "Sphere blending"),
        options: [
          ["solid", t("Sólida (cubre el fondo)", "Solid (covers the background)")],
          ["glow", t("Brillo (suma al fondo)", "Glow (adds to the background)")],
        ],
      },
      {
        key: "sphereDetail", type: "select", label: t("Detalle de la esfera", "Sphere detail"),
        options: [
          ["full", t("Completo", "Full")],
          ["simple", t("Simple (sin puntos ni barridos)", "Simple (no dots or sweeps)")],
          ["outline", t("Solo contorno", "Outline only")],
        ],
      },
      { key: "sphereGlow", type: "range", label: t("Brillo de la esfera", "Sphere glow"), min: 0.1, max: 2, step: 0.05 },
      { key: "vectorGain", type: "range", label: t("Brillo del vector", "Vector brightness"), min: 0.5, max: 3, step: 0.1 },
      { key: "vectorWidth", type: "range", label: t("Grosor del vector", "Vector thickness"), min: 0.5, max: 4, step: 0.1 },
      { key: "vectorOnTop", type: "check", label: t("Esferas siempre al frente", "Spheres always in front") },
      { key: "valueLabels", type: "check", label: t("Escribir (x, y, z) de cada vector", "Write the (x, y, z) of each vector") },
    ],
  },
  {
    title: t("Qué se muestra", "What is shown"),
    controls: [
      { key: "showEnvironment", type: "check", label: t("Entorno (mesa, bobinas, ventana)", "Environment (table, coils, window)") },
      { key: "showTrap", type: "check", label: t("Chip de la trampa", "Trap chip") },
      { key: "showHorizontal", type: "check", label: t("Capa horizontal (haz global, riel)", "Horizontal layer (global beam, rail)") },
      { key: "showLasers", type: "check", label: t("Láseres verticales", "Vertical lasers") },
      { key: "showBus", type: "check", label: t("Bus de fonones", "Phonon bus") },
      { key: "jiggle", type: "check", label: t("Vibración de los iones", "Ion jiggle") },
      { key: "halo", type: "check", label: t("Halo de entrelazamiento", "Entanglement halo") },
      { key: "showLabels", type: "check", label: t("Etiquetas de los qubits", "Qubit labels") },
      { key: "showLegend", type: "check", label: t("Leyenda de los ejes", "Axes legend") },
      { key: "showCameraPad", type: "check", label: t("Botones de la cámara", "Camera buttons") },
    ],
  },
  {
    title: t("Luz y movimiento", "Light and motion"),
    controls: [
      { key: "brightness", type: "range", label: t("Brillo de la escena", "Scene brightness"), min: 0.3, max: 1.6, step: 0.05 },
      { key: "lights", type: "range", label: t("Intensidad de las luces", "Light intensity"), min: 0, max: 1.5, step: 0.05 },
      { key: "laserGain", type: "range", label: t("Brillo de los láseres", "Laser brightness"), min: 0.1, max: 1.5, step: 0.05 },
      { key: "sheetGain", type: "range", label: t("Brillo del haz global", "Global beam brightness"), min: 0, max: 1.5, step: 0.05 },
      { key: "reducedMotion", type: "check", label: t("Movimiento reducido", "Reduced motion") },
    ],
  },
  {
    title: t("Interfaz", "Interface"),
    controls: [
      {
        key: "textScale", type: "select", number: true, label: t("Tamaño del texto", "Text size"),
        options: [[0.9, "90 %"], [1, "100 %"], [1.15, "115 %"], [1.3, "130 %"]],
      },
      { key: "uiContrast", type: "check", label: t("Texto y bordes más marcados", "Stronger text and borders") },
    ],
  },
];

// The elements by option key, to follow the changes of the view.
const inputs = {};
let profileButtons = [];

function buildControl(control, id) {
  const row = document.createElement("div");
  row.className = "view-row";
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = control.label;
  row.appendChild(label);

  let input;
  if (control.type === "select") {
    input = document.createElement("select");
    for (const [value, text] of control.options) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = text;
      input.appendChild(option);
    }
    input.addEventListener("change", () => {
      setOption(control.key, control.number ? Number(input.value) : input.value);
    });
  } else if (control.type === "range") {
    input = document.createElement("input");
    input.type = "range";
    input.min = control.min;
    input.max = control.max;
    input.step = control.step;
    input.addEventListener("input", () => setOption(control.key, Number(input.value)));
  } else {
    input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener("change", () => setOption(control.key, input.checked));
  }
  input.id = id;
  inputs[control.key] = input;
  row.appendChild(input);
  return row;
}

/** Build the content of the panel: the profiles, the sections and the reset. */
function buildPanel(panel) {
  panel.innerHTML = "";
  const head = document.createElement("div");
  head.className = "view-head";
  head.innerHTML = `<h2 id="viewTitle">${TEXT.title}</h2>`;
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = TEXT.close;
  close.addEventListener("click", () => togglePanel(false));
  head.appendChild(close);
  panel.appendChild(head);

  const profiles = document.createElement("div");
  profiles.className = "view-profiles";
  profiles.setAttribute("role", "group");
  profiles.setAttribute("aria-label", TEXT.profiles);
  profileButtons = Object.keys(PROFILES).map((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.profile = name;
    button.textContent = PROFILE_LABELS[name];
    button.addEventListener("click", () => applyProfile(name));
    profiles.appendChild(button);
    return button;
  });
  panel.appendChild(profiles);

  SECTIONS.forEach((section, index) => {
    const details = document.createElement("details");
    details.className = "view-section";
    details.open = Boolean(section.open);
    const summary = document.createElement("summary");
    summary.textContent = section.title;
    details.appendChild(summary);
    section.controls.forEach((control, position) => {
      details.appendChild(buildControl(control, `view-${index}-${position}`));
    });
    panel.appendChild(details);
  });

  const foot = document.createElement("div");
  foot.className = "view-foot";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = TEXT.reset;
  reset.addEventListener("click", resetView);
  foot.appendChild(reset);
  panel.appendChild(foot);
}

/** Show the values of the view in the controls of the panel. */
function syncPanel(view) {
  for (const [key, input] of Object.entries(inputs)) {
    if (input.type === "checkbox") input.checked = Boolean(view[key]);
    else input.value = String(view[key]);
  }
  for (const button of profileButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.profile === view.profile));
  }
}

/** Apply the options that belong to the page and not to the scene. */
function applyInterface(view) {
  const root = document.documentElement;
  root.classList.toggle("reduce-motion", Boolean(view.reducedMotion));
  root.classList.toggle("hc-ui", Boolean(view.uiContrast));
  root.style.setProperty("--ui-zoom", String(view.textScale));

  const palette = PALETTES[view.palette];
  if (palette) {
    root.style.setProperty("--ax", palette.axisX);
    root.style.setProperty("--ay", palette.axisY);
    root.style.setProperty("--az", palette.axisZ);
  }
  const legend = document.querySelector("legend");
  if (legend) legend.hidden = !view.showLegend;
  const pad = document.getElementById("cameraPad");
  if (pad) pad.hidden = !view.showCameraPad;
}

function togglePanel(open) {
  const panel = document.getElementById("viewPanel");
  const toggle = document.getElementById("viewToggle");
  const show = open === undefined ? panel.hidden : open;
  panel.hidden = !show;
  toggle.setAttribute("aria-expanded", String(show));
  if (show) {
    const first = panel.querySelector(".view-profiles button");
    if (first) first.focus();
  }
}

/** Wire the button and the panel, and follow the view from now on. */
export function initViewPanel() {
  const panel = document.getElementById("viewPanel");
  const toggle = document.getElementById("viewToggle");
  if (!panel || !toggle) return;

  document.getElementById("viewToggleText").textContent = TEXT.button;
  buildPanel(panel);
  subscribe((view) => {
    syncPanel(view);
    applyInterface(view);
  });
  syncPanel(state.view);
  applyInterface(state.view);

  toggle.addEventListener("click", () => togglePanel());
  // Esc closes the panel and gives the focus back to the button.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || panel.hidden) return;
    togglePanel(false);
    toggle.focus();
  });
  // A click outside the panel closes it.
  document.addEventListener("pointerdown", (event) => {
    if (panel.hidden || panel.contains(event.target) || toggle.contains(event.target)) return;
    togglePanel(false);
  });
}
