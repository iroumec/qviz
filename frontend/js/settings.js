// The view options of the viewer ("Vista" panel): the palette, the shape of the
// sphere and the vector, what is shown, the light, the motion and the interface.
// Every option has a default, a profile is a set of values for them, and the
// choice is kept in the browser. This module only holds the values: the scene and
// the interface read `state.view` and subscribe to its changes, so it imports no
// module of the scene.

import { state } from "./state.js";

const STORAGE_KEY = "qviz.view";
const STORAGE_VERSION = 1;

/** The palettes of the sphere. The colours are `#rrggbb`, shown as they are. */
export const PALETTES = {
  default: {
    axisX: "#ff1a1a", axisY: "#1aff1a", axisZ: "#1a66ff",
    vector: "#e60dff", tip: "#ff59ff",
    sphere: "#4db3ff", lines: "#3380e6",
    dotsStart: "#1acdff", dotsEnd: "#ff1a99",
    sweepAzimuth: "#1a99ff", sweepPolar: "#ffb31a",
  },
  // Okabe and Ito: told apart by the three kinds of colour blindness.
  okabe: {
    axisX: "#e69f00", axisY: "#56b4e9", axisZ: "#f0e442",
    vector: "#cc79a7", tip: "#f2bcd8",
    sphere: "#0072b2", lines: "#3d8fc2",
    dotsStart: "#56b4e9", dotsEnd: "#e69f00",
    sweepAzimuth: "#56b4e9", sweepPolar: "#e69f00",
  },
  contrast: {
    axisX: "#ffd400", axisY: "#00e5ff", axisZ: "#ffffff",
    vector: "#ff2d95", tip: "#ffffff",
    sphere: "#8f95a8", lines: "#c9ced9",
    dotsStart: "#c9ced9", dotsEnd: "#c9ced9",
    sweepAzimuth: "#00e5ff", sweepPolar: "#ffd400",
  },
  mono: {
    axisX: "#c8c8c8", axisY: "#c8c8c8", axisZ: "#c8c8c8",
    vector: "#ffffff", tip: "#ffffff",
    sphere: "#7c7c88", lines: "#a0a0ab",
    dotsStart: "#8a8a94", dotsEnd: "#8a8a94",
    sweepAzimuth: "#a0a0ab", sweepPolar: "#a0a0ab",
  },
};

/** The values of every option when nothing else is chosen. */
export const DEFAULT_VIEW = {
  profile: "default",
  palette: "default",
  sphereBlend: "solid", // "solid" covers what is behind; "glow" adds to it
  sphereDetail: "full", // "full", "simple" (no dots or sweeps) or "outline"
  sphereGlow: 0.3, // the gain of the sphere (its shell, circles and dots)
  vectorGain: 2, // the brightness of the state vector and its tip
  vectorWidth: 1.8, // the thickness of the state vector and its tip
  vectorOnTop: false, // draw the spheres over everything that is in front
  valueLabels: false, // the (x, y, z) of each vector, written under its sphere
  showEnvironment: true,
  showTrap: true,
  showHorizontal: true,
  showLasers: true,
  showBus: true,
  showLabels: true,
  showLegend: true,
  showCameraPad: true,
  jiggle: true,
  halo: true,
  brightness: 1, // the exposure of the scene
  lights: 1, // the factor of every light and of the environment
  reducedMotion: false,
  textScale: 1, // the size of the text of the panels
  uiContrast: false,
};

/** What each profile changes with respect to the defaults. */
export const PROFILES = {
  default: {},
  focus: {
    sphereDetail: "simple", sphereGlow: 0.25, vectorGain: 2.4, vectorWidth: 2.4,
    vectorOnTop: true, brightness: 0.9, lights: 0.6,
    showEnvironment: false, showTrap: false, showHorizontal: false, showLasers: false,
    showBus: false, jiggle: false, halo: false,
  },
  contrast: {
    palette: "contrast", sphereDetail: "simple", sphereGlow: 0.35, vectorGain: 2.4,
    vectorWidth: 2.4, vectorOnTop: true, brightness: 0.9, lights: 0.5,
    showEnvironment: false, uiContrast: true,
  },
  colorblind: {
    palette: "okabe", vectorGain: 2.4, vectorWidth: 2.2, valueLabels: true,
  },
  calm: {
    reducedMotion: true, jiggle: false, halo: false,
  },
};

const listeners = [];

/** The `#rrggbb` colour as [r, g, b] between 0 and 1. */
export function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
}

/** True when the system asks for less motion. */
function prefersReducedMotion() {
  try {
    return typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (error) {
    return false;
  }
}

/** The saved choice, or an empty object when there is none or it cannot be read. */
function readSaved() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return saved && saved.version === STORAGE_VERSION && saved.view ? saved.view : {};
  } catch (error) {
    return {};
  }
}

function save() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, view: state.view })
    );
  } catch (error) {
    // No storage (a private window, or a frame that blocks it): the choice lasts
    // until the page is closed.
  }
}

function notify() {
  for (const listener of listeners) listener(state.view);
}

/** Call `listener(view)` every time an option changes. */
export function subscribe(listener) {
  listeners.push(listener);
}

/** The saved value of an option, only if it has the type of the default. */
function sanitize(saved) {
  const view = {};
  for (const [key, value] of Object.entries(saved)) {
    if (key in DEFAULT_VIEW && typeof value === typeof DEFAULT_VIEW[key]) view[key] = value;
  }
  if (view.palette && !PALETTES[view.palette]) delete view.palette;
  return view;
}

/** Read the saved options (or the defaults) and tell the listeners. */
export function initSettings() {
  const saved = sanitize(readSaved());
  const initial = { ...DEFAULT_VIEW };
  if (prefersReducedMotion()) Object.assign(initial, PROFILES.calm, { profile: "calm" });
  state.view = { ...initial, ...saved };
  notify();
}

/** Change one option. The profile becomes "custom": it is no longer a pure one. */
export function setOption(key, value) {
  if (!(key in DEFAULT_VIEW) || state.view[key] === value) return;
  state.view = { ...state.view, [key]: value, profile: "custom" };
  save();
  notify();
}

/** Replace every option with the values of a profile. */
export function applyProfile(name) {
  if (!(name in PROFILES)) return;
  state.view = { ...DEFAULT_VIEW, ...PROFILES[name], profile: name };
  save();
  notify();
}

/** Go back to the default profile. */
export function resetView() {
  applyProfile("default");
}
