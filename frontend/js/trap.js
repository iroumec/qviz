// The surface-trap chip under the ion chain. A microfabricated chip holds the
// ions in mid-air: a dark silicon substrate, two rows of gold electrode pads on
// both sides of a central channel, and a glowing field ring around every ion
// (the radio-frequency quadrupole that traps it).
//
// The chain runs along X at y = 0, so the substrate is placed below it and the
// field rings encircle the chain. The gold pads glow when the ion above them is
// a target of the current step.

import * as THREE from "three";
import { state } from "./state.js";
import {
  SPACING,
  TABLE_TOP,
  TRAP_DEPTH,
  TRAP_MARGIN,
  TRAP_PAD_HEIGHT,
  TRAP_PAD_LENGTH,
  TRAP_PAD_SPACING,
  TRAP_PAD_WIDTH,
  TRAP_PAD_Z,
  TRAP_RING_RADIUS,
  TRAP_RING_TUBE,
  TRAP_THICKNESS,
  TRAP_TOP,
} from "./config.js";

const SUBSTRATE_COLOR = 0x0f172a;
const PAD_COLOR = 0xd4af37;
const FIELD_COLOR = 0x38bdf8;

const PAD_MATERIAL = { color: PAD_COLOR, roughness: 0.3, metalness: 0.95 };
const GLOW_OPACITY = 0.65;

/** Build the trap chip for a chain of `n` ions and add its rings to the state. */
export function createIonTrap(n) {
  const group = new THREE.Group();
  const width = (n - 1) * SPACING + 2 * TRAP_MARGIN;

  // The dark, mirror-like silicon substrate.
  const substrate = new THREE.Mesh(
    new THREE.BoxGeometry(width, TRAP_THICKNESS, TRAP_DEPTH),
    new THREE.MeshStandardMaterial({ color: SUBSTRATE_COLOR, roughness: 0.1, metalness: 0.9 })
  );
  substrate.position.set(0, TRAP_TOP - TRAP_THICKNESS / 2, 0);
  group.add(substrate);

  // Four legs hold the substrate down to the optical table.
  const substrateBottom = TRAP_TOP - TRAP_THICKNESS;
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
  const legGeometry = new THREE.CylinderGeometry(0.12, 0.16, substrateBottom - TABLE_TOP, 12);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(
        sx * (width / 2 - 0.7),
        (substrateBottom + TABLE_TOP) / 2,
        sz * (TRAP_DEPTH / 2 - 0.7)
      );
      group.add(leg);
    }
  }

  // The gold pads, segmented along the chain on both sides of the channel. One
  // instanced mesh per side. The spacing divides `SPACING` and the grid is
  // centred on zero, so a pad always sits right under every ion.
  const padCount = Math.max(3, Math.round(width / TRAP_PAD_SPACING) | 1);
  const padX0 = -((padCount - 1) / 2) * TRAP_PAD_SPACING;
  const padGeometry = new THREE.BoxGeometry(TRAP_PAD_WIDTH, TRAP_PAD_HEIGHT, TRAP_PAD_LENGTH);
  const padMaterial = new THREE.MeshStandardMaterial(PAD_MATERIAL);
  const dummy = new THREE.Object3D();
  const padY = TRAP_TOP + TRAP_PAD_HEIGHT / 2;
  for (const side of [-1, 1]) {
    const pads = new THREE.InstancedMesh(padGeometry, padMaterial, padCount);
    pads.frustumCulled = false;
    for (let i = 0; i < padCount; i++) {
      const x = padX0 + i * TRAP_PAD_SPACING;
      dummy.position.set(x, padY, side * TRAP_PAD_Z);
      dummy.updateMatrix();
      pads.setMatrixAt(i, dummy.matrix);
    }
    pads.instanceMatrix.needsUpdate = true;
    group.add(pads);
  }

  // A field ring around every ion, plus the glowing electrode strip that lights
  // up when the ion above it is a target.
  const ringGeometry = new THREE.TorusGeometry(TRAP_RING_RADIUS, TRAP_RING_TUBE, 12, 48);
  ringGeometry.rotateY(Math.PI / 2);
  const glowGeometry = new THREE.BoxGeometry(
    TRAP_PAD_WIDTH * 1.1, TRAP_PAD_HEIGHT, TRAP_PAD_LENGTH * 0.9
  );

  state.three.trapRings = [];
  state.three.trapGlow = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * SPACING;

    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: FIELD_COLOR,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ring.position.set(x, 0, 0);
    group.add(ring);
    state.three.trapRings.push(ring);

    const strips = [];
    for (const side of [-1, 1]) {
      const glow = new THREE.Mesh(
        glowGeometry,
        new THREE.MeshBasicMaterial({
          color: FIELD_COLOR,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      glow.position.set(x, padY + TRAP_PAD_HEIGHT * 0.6, side * TRAP_PAD_Z);
      group.add(glow);
      strips.push(glow);
    }
    state.three.trapGlow.push(strips);
  }

  return group;
}

/** Spin the field rings and light the electrodes of the target ions. */
export function updateTrap(time) {
  const rings = state.three.trapRings;
  for (let i = 0; i < rings.length; i++) {
    const target = state.qubits[i] && state.qubits[i].isTarget;
    const ring = rings[i];
    ring.rotation.y = Math.sin(time * 0.0012 + i * 0.6) * 0.16;
    const wanted = target ? 0.6 : 0.22;
    ring.material.opacity += (wanted - ring.material.opacity) * 0.1;

    const strips = state.three.trapGlow[i];
    if (!strips) continue;
    const glow = target ? GLOW_OPACITY * (0.7 + 0.3 * Math.sin(time * 0.008)) : 0;
    for (const strip of strips) {
      strip.material.opacity += (glow - strip.material.opacity) * 0.12;
    }
  }
}
