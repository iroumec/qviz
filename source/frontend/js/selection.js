// The selection marker of the ions: four thin arcs that face the camera and turn
// slowly around an ion, like the selection of a unit in a game. They fade in
// around every ion in `state.hovered`, which the timeline sets while the pointer
// is over a gate (one ion, or the two of an MS or ZZ gate).

import * as THREE from "three";
import { state } from "./state.js";
import {
  SELECTION_COLOR,
  SELECTION_FADE_MS,
  SELECTION_OPACITY,
  SELECTION_RADIUS,
} from "./config.js";

const ARCS = 4;
const GAP = 0.45; // radians left empty between two arcs

/** One marker per ion, all hidden until an ion is hovered. */
export function createSelection(n) {
  const group = new THREE.Group();
  state.three.selection = [];
  const inner = SELECTION_RADIUS;
  const length = (2 * Math.PI) / ARCS - GAP;
  const geometry = new THREE.RingGeometry(inner, inner + 0.1, 24, 1, 0, length);
  for (let i = 0; i < n; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: SELECTION_COLOR,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const facing = new THREE.Group();
    const spinner = new THREE.Group();
    for (let a = 0; a < ARCS; a++) {
      const arc = new THREE.Mesh(geometry, material);
      arc.rotation.z = (a * 2 * Math.PI) / ARCS;
      arc.renderOrder = 10;
      spinner.add(arc);
    }
    facing.add(spinner);
    facing.position.set(state.qubits[i].x, 0, 0);
    facing.visible = false;
    group.add(facing);
    state.three.selection.push({ facing, spinner, material, amount: 0 });
  }
  return group;
}

let previous = 0;

/** Fade the markers in or out and keep them facing the camera. */
export function updateSelection(time) {
  const markers = state.three.selection;
  if (!markers || !state.three.camera) return;
  // The fade follows the time, not the frames, so it takes the same on a slow screen.
  const blend = previous ? 1 - Math.exp(-(time - previous) / SELECTION_FADE_MS) : 1;
  previous = time;
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const want = state.hovered.includes(i) ? 1 : 0;
    marker.amount += (want - marker.amount) * blend;
    if (Math.abs(want - marker.amount) < 0.01) marker.amount = want;
    marker.facing.visible = marker.amount > 0;
    if (!marker.facing.visible) continue;
    marker.facing.quaternion.copy(state.three.camera.quaternion);
    marker.spinner.rotation.z = time * 0.0007;
    const breathe = 0.85 + 0.15 * Math.sin(time * 0.004);
    marker.material.opacity = SELECTION_OPACITY * marker.amount * breathe;
  }
}
