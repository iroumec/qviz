// The horizontal optical layer, at the height of the chain.
//
// A shared "global" Raman beam runs along the chain as a cylinder that passes
// through every ion, and flashes with every gate (and once at the start, to
// prepare the ions). A thin phonon guide rail threads the ion centres (the
// confinement axis): it is a faint blue thread that glows amber between the two
// ions of a two-qubit gate, with wave rings travelling along it. The side optics
// (a readout objective lens and a mirror) sit at the two ends of the chain.

import * as THREE from "three";
import { state } from "./state.js";
import { pulseIntensity } from "./laser.js";
import {
  GLOBAL_BEAM_OPACITY,
  GLOBAL_BEAM_RADIUS,
  INTRO_MS,
  OPTICS_MARGIN,
  RAIL_EXTRA,
  RAIL_RADIUS,
  SPACING,
  TABLE_TOP,
  WAVE_RING_COUNT,
  WAVE_RING_RADIUS,
  WAVE_RING_TUBE,
} from "./config.js";

const BEAM_COLOR = 0x00f3ff;
const RAIL_IDLE_COLOR = 0x38bdf8;
const RAIL_ACTIVE_COLOR = 0xff8c1a;

/** A multi-tiered readout objective lens, its glass facing the ions (+X). */
function createReadoutLens() {
  const group = new THREE.Group();

  const barrelGeometry = new THREE.CylinderGeometry(1.2, 1.5, 2.5, 32);
  barrelGeometry.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(
    barrelGeometry,
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 })
  ));

  const glassGeometry = new THREE.SphereGeometry(1.1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.3);
  glassGeometry.rotateZ(-Math.PI / 2);
  const glass = new THREE.Mesh(
    glassGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xf05291, metalness: 0.9, roughness: 0.08,
      emissive: 0x7a2748, emissiveIntensity: 0.5,
    })
  );
  glass.position.set(1.0, 0, 0);
  group.add(glass);
  return group;
}

/** A mirror mount with a gold disc facing the ions (-X). */
function createMirror() {
  const group = new THREE.Group();

  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.2, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 })
  ));

  const discGeometry = new THREE.CylinderGeometry(0.9, 0.9, 0.1, 32);
  discGeometry.rotateZ(Math.PI / 2);
  const disc = new THREE.Mesh(
    discGeometry,
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1.0, roughness: 0.1 })
  );
  disc.position.set(-0.65, 0, 0);
  group.add(disc);
  return group;
}

/** Build the horizontal layer and keep its animated parts in the state. */
export function createHorizontalLayer(n) {
  const group = new THREE.Group();
  const chainWidth = (n - 1) * SPACING;
  const half = chainWidth / 2;

  // The global Raman beam: a cylinder that runs along the chain, through every
  // ion, from one side optic to the other. Invisible until a gate fires.
  const beamGeometry = new THREE.CylinderGeometry(
    GLOBAL_BEAM_RADIUS, GLOBAL_BEAM_RADIUS, 2 * (half + OPTICS_MARGIN), 24, 1, true
  );
  beamGeometry.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(
    beamGeometry,
    new THREE.MeshBasicMaterial({
      color: BEAM_COLOR, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  group.add(beam);

  // The phonon guide rail (a shader draws the idle thread and the active
  // segment). It is skipped when the host gave no rail shaders.
  let rail = null;
  if (state.shaders.railVert && state.shaders.railFrag) {
    const railGeometry = new THREE.CylinderGeometry(RAIL_RADIUS, RAIL_RADIUS, chainWidth + RAIL_EXTRA, 12);
    railGeometry.rotateZ(Math.PI / 2);
    rail = new THREE.Mesh(railGeometry, new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        uActiveCenter: { value: 0 },
        uActiveHalf: { value: 0 },
        uIntensity: { value: 0 },
        uIdleColor: { value: new THREE.Color(RAIL_IDLE_COLOR) },
        uActiveColor: { value: new THREE.Color(RAIL_ACTIVE_COLOR) },
      },
      vertexShader: state.shaders.railVert,
      fragmentShader: state.shaders.railFrag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    group.add(rail);
  }

  // The wave rings that travel along the active segment.
  const waveGeometry = new THREE.TorusGeometry(WAVE_RING_RADIUS, WAVE_RING_TUBE, 8, 32);
  waveGeometry.rotateY(Math.PI / 2);
  const waves = [];
  for (let i = 0; i < WAVE_RING_COUNT; i++) {
    const ring = new THREE.Mesh(waveGeometry, new THREE.MeshBasicMaterial({
      color: RAIL_ACTIVE_COLOR, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    group.add(ring);
    waves.push(ring);
  }

  // The side optics at the two ends of the chain.
  const lens = createReadoutLens();
  lens.position.set(-(half + OPTICS_MARGIN), 0, 0);
  group.add(lens);
  const mirror = createMirror();
  mirror.position.set(half + OPTICS_MARGIN, 0, 0);
  group.add(mirror);

  // The side optics rest on stands down to the optical table.
  const standMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
  const standGeometry = new THREE.CylinderGeometry(0.18, 0.24, -TABLE_TOP, 12);
  for (const x of [-(half + OPTICS_MARGIN), half + OPTICS_MARGIN]) {
    const stand = new THREE.Mesh(standGeometry, standMaterial);
    stand.position.set(x, TABLE_TOP / 2, 0);
    group.add(stand);
  }

  state.three.horizontal = { beam, rail, waves };
  return group;
}

/** Flash the global beam, light the rail segment and move the wave rings. */
export function updateHorizontal(time) {
  const layer = state.three.horizontal;
  if (!layer) return;

  // The global beam flashes with any gate (single- or two-qubit). At the start
  // of the simulation it is emitted once, to prepare the ions. While a
  // measurement runs, the measurement animation drives the beam instead.
  if (!state.measure.active) {
    let wanted;
    if (state.intro && state.intro.active) {
      const elapsed = time - state.intro.start;
      if (elapsed >= INTRO_MS) {
        state.intro.active = false;
        wanted = 0;
      } else {
        wanted = GLOBAL_BEAM_OPACITY * state.view.sheetGain * Math.sin(Math.PI * (elapsed / INTRO_MS));
      }
    } else {
      let intensity = 0;
      for (const qubit of state.qubits) {
        intensity = Math.max(intensity, pulseIntensity(qubit.laserStart, qubit.laserEnd, time));
      }
      wanted = intensity * GLOBAL_BEAM_OPACITY * state.view.sheetGain;
    }
    layer.beam.material.opacity += (wanted - layer.beam.material.opacity) * 0.2;
  }

  // The guide rail and the wave rings belong to a two-qubit gate.
  const gate = state.gate;
  const twoIons = gate.targets.length === 2;
  const active = twoIons ? pulseIntensity(gate.start, gate.end, time) : 0;
  const first = twoIons ? state.qubits[gate.targets[0]].x : 0;
  const second = twoIons ? state.qubits[gate.targets[1]].x : 0;

  if (layer.rail) {
    const uniforms = layer.rail.material.uniforms;
    uniforms.iTime.value = time * 0.001;
    uniforms.uIntensity.value = active;
    uniforms.uActiveCenter.value = (first + second) / 2;
    uniforms.uActiveHalf.value = Math.abs(second - first) / 2 + 0.3;
  }

  for (let i = 0; i < layer.waves.length; i++) {
    const ring = layer.waves[i];
    if (active <= 0) {
      ring.material.opacity = 0;
      continue;
    }
    const progress = (time * 0.0006 + i / layer.waves.length) % 1;
    ring.position.set(first + (second - first) * progress, 0, 0);
    ring.scale.setScalar(0.4 + 0.8 * progress);
    ring.material.opacity = active * (1 - progress) * 0.7;
  }
}

/** Emit the global beam once, to show the ions being prepared. */
export function startIntro() {
  state.intro = { active: true, start: performance.now() };
}
