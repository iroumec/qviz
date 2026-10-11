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

  // One entry per ion: the animated vector and its target.
  qubits: [],

  // The shader sources, loaded once.
  shaders: {
    vert: null, frag: null, lensVert: null, lensFrag: null,
    laserVert: null, laserFrag: null,
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
  },

  // The laser model and its materials.
  laser: {
    template: null,
    movingLight: null,
    customLensMaterial: null,
    plasticMaterial: null,
    metalMaterial: null,
  },

  // The orbit of the camera around the chain.
  orbit: { azimuth: 0.7, elevation: 0.32, zoom: 1, fitRadius: 16 },

  // The frame-rate counter, shown in the header.
  fps: { frames: 0, last: 0, value: 0 },
};
