// The mutable state of the viewer, in one place. Every module reads and writes
// these fields, so that no state is hidden in the document or in a local
// variable. The fields are grouped by the part of the scene they describe.

export const state = {
  // The loaded visualization and the current position in it.
  data: null,
  stepIndex: 0,

  // The duration of the laser pulse of the current step, in milliseconds. The
  // automatic play waits for it, so a long pulse is not cut.
  pulseMs: 0,

  // The automatic play of the steps.
  playing: false,
  playTimer: null,

  // The ions that the pointer is over in the timeline (the targets of a gate),
  // which get the selection marker.
  hovered: [],

  // One entry per ion: the animated vector and its target.
  qubits: [],

  // The two-qubit gate that is running (MS or ZZ), its two ions and its pulse
  // window. Empty when the step is not a two-qubit gate.
  gate: { targets: [], start: 0, end: 0 },

  // The measurement animation: whether it runs, when it started, the outcome
  // (0 or 1 per ion) and whether the state badges are shown.
  measure: { active: false, start: 0, outcome: [], showBadges: false },

  // The shader sources, loaded once.
  shaders: {
    vert: null, frag: null, lensVert: null, lensFrag: null,
    laserVert: null, laserFrag: null, busVert: null, busFrag: null,
    railVert: null, railFrag: null,
  },

  // The three.js objects.
  three: {
    renderer: null,
    scene: null,
    camera: null,
    world: null,
    instMesh: null,
    psiAttribute: null,
    laserMesh: null,
    laserActive: null,
    busMesh: null,
    entangledAttribute: null,
    trapRings: [],
    trapGlow: [],
    horizontal: null,
    measure: null,
    selection: [],
  },

  // The laser model and its materials.
  laser: {
    template: null,
    movingLight: null,
    customLensMaterial: null,
    plasticMaterial: null,
    metalMaterial: null,
  },

  // The orbit of the camera around the chain. `target` is the point that is
  // looked at; it is moved with the keyboard (WASD, space and left control).
  orbit: {
    azimuth: 0.7, elevation: 0.32, zoom: 1, fitRadius: 16,
    target: { x: 0, y: 0, z: 0 },
  },

  // The movement keys that are held down.
  keys: { forward: false, back: false, left: false, right: false, up: false, down: false },

  // The frame-rate counter, shown in the header.
  fps: { frames: 0, last: 0, value: 0 },
};
