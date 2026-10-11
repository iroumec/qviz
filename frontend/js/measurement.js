// The measurement animation: state-dependent fluorescence.
//
// A broad horizontal readout beam floods the whole chain (the horizontal layer
// does the illumination). An ion in |1> scatters photons and glows; an ion in
// |0> is off resonance and stays dark. The photons are collected by the side
// readout lens, and a |0> or |1> badge is shown above every ion once the
// measurement resolves. The individual vertical lasers are not fired.

import * as THREE from "three";
import { state } from "./state.js";
import { OPTICS_MARGIN, SPACING } from "./config.js";

const READOUT_COLOR = 0x54ff9f;
const GATE_BEAM_COLOR = 0x00f3ff;
const ONE_COLOR = "#8ef0ff";
const ZERO_COLOR = "#8b98b8";
const FLARE_SCALE = 3.4;
const BADGE_Y = 1.9;
const MAX_PARTICLES = 240;

// The four phases, in milliseconds.
const BEAM_UP = 200;
const GLOW_UP = 450;
const STREAM_START = 450;
const STREAM_END = 1000;
const FADE_START = 1000;
const FADE_END = 1300;
const BADGE_START = 1100;
const END = 1400;

/** A soft radial glow, for the fluorescence flares and the photons. */
function radialTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.55)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** A text sprite texture, for the |0> and |1> badges. */
function textTexture(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.font = "bold 46px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 64, 34);
  return new THREE.CanvasTexture(canvas);
}

/** A ramp from 0 to 1 between a and b. */
function ramp(t, a, b) {
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
}

/** Build the flares, the photon stream and the badges, one set for the chain. */
export function createMeasurement(n) {
  const group = new THREE.Group();
  const glow = radialTexture();

  const flares = [];
  const badges = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * SPACING;

    const flare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color: READOUT_COLOR, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    flare.position.set(x, 0, 0);
    flare.scale.setScalar(FLARE_SCALE);
    group.add(flare);
    flares.push(flare);

    const badge = new THREE.Sprite(new THREE.SpriteMaterial({
      map: null, transparent: true, opacity: 0, depthTest: false,
    }));
    badge.position.set(x, BADGE_Y, 0);
    badge.scale.set(1.1, 0.55, 1);
    group.add(badge);
    badges.push(badge);
  }

  const positions = new Float32Array(MAX_PARTICLES * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: glow, color: READOUT_COLOR, size: 0.35, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  particles.frustumCulled = false;
  group.add(particles);

  state.three.measure = {
    flares, badges, particles,
    texOne: textTexture("|1>", ONE_COLOR),
    texZero: textTexture("|0>", ZERO_COLOR),
    assign: [],
  };
  return group;
}

/**
 * Start the animation for one measurement outcome (0 or 1 per ion).
 *
 * The photons are spread over the ions that are in |1>, and each is given a
 * phase and a small offset so the stream converges on the readout lens.
 */
export function startMeasurement(outcome) {
  const data = state.three.measure;
  if (!data) return;
  state.measure = { active: true, start: performance.now(), outcome, showBadges: true };

  const ones = [];
  for (let i = 0; i < outcome.length; i++) if (outcome[i]) ones.push(i);
  data.assign = [];
  for (let p = 0; p < MAX_PARTICLES; p++) {
    if (ones.length === 0) {
      data.assign.push(null);
      continue;
    }
    data.assign.push({
      ion: ones[p % ones.length],
      phase: Math.random(),
      offsetY: (Math.random() - 0.5) * 1.6,
      offsetZ: (Math.random() - 0.5) * 1.6,
    });
  }

  for (let i = 0; i < data.badges.length; i++) {
    data.badges[i].material.map = outcome[i] ? data.texOne : data.texZero;
    data.badges[i].material.needsUpdate = true;
  }
}

/** Hide the measurement animation and the badges (a step change). */
export function clearMeasurement() {
  state.measure = { active: false, start: 0, outcome: [], showBadges: false };
}

/** Advance the animation. Called from the render loop. */
export function updateMeasurement(time) {
  const data = state.three.measure;
  if (!data) return;
  const measure = state.measure;
  const t = measure.active ? time - measure.start : Infinity;

  // Phase 1 and 4: the readout beam floods, then fades. The measurement drives
  // the global beam of the horizontal layer while it runs.
  const beam = ramp(t, 0, BEAM_UP) * (1 - ramp(t, FADE_START, FADE_END));
  const layer = state.three.horizontal;
  if (layer) {
    layer.beam.material.opacity = 0.8 * beam;
    layer.beam.material.color.setHex(beam > 0 ? READOUT_COLOR : GATE_BEAM_COLOR);
  }

  // Phase 2: the |1> ions glow, the |0> ions stay dark.
  const glow = ramp(t, BEAM_UP, GLOW_UP) * (1 - ramp(t, FADE_START, FADE_END));
  for (let i = 0; i < data.flares.length; i++) {
    const one = measure.outcome[i];
    const flicker = 0.85 + 0.15 * Math.sin(time * 0.02 + i);
    data.flares[i].material.opacity = one ? glow * flicker : 0;
  }

  // Phase 3: photons stream from the |1> ions to the readout lens.
  const stream = ramp(t, STREAM_START, STREAM_START + 100) * (1 - ramp(t, STREAM_END - 50, STREAM_END + 100));
  const positions = data.particles.geometry.attributes.position;
  if (stream <= 0) {
    data.particles.material.opacity = 0;
  } else {
    const count = state.qubits.length;
    const lensX = -(((count - 1) / 2) * SPACING + OPTICS_MARGIN);
    for (let p = 0; p < MAX_PARTICLES; p++) {
      const a = data.assign[p];
      if (!a) {
        positions.setXYZ(p, 0, 0, 0);
        continue;
      }
      const progress = ((time - measure.start - STREAM_START) / 700 + a.phase) % 1;
      const ionX = state.qubits[a.ion].x;
      const x = ionX + (lensX - ionX) * progress;
      positions.setXYZ(p, x, a.offsetY * (1 - progress), a.offsetZ * (1 - progress));
    }
    positions.needsUpdate = true;
    data.particles.material.opacity = stream * 0.9;
  }

  // Phase 4: the state badges appear and stay.
  const badge = measure.showBadges ? ramp(t, BADGE_START, FADE_END) : 0;
  for (const sprite of data.badges) sprite.material.opacity = badge;

  if (measure.active && t > END) measure.active = false;
}
