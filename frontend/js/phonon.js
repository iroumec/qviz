// The phonon bus and the mechanical jiggle of a two-qubit gate (MS or ZZ).
//
// The two ions do not talk with light: the whole chain is one elastic spring, so
// the bus is a horizontal energy tube that joins the two targets and passes
// through the ions in between. While the pulse runs, the chain between the two
// targets swings (the targets more than the ions in between). Once the pulse
// ends, the two targets keep a halo that pulses in step, to show the
// entanglement.

import * as THREE from "three";
import { state } from "./state.js";
import { pulseIntensity } from "./laser.js";
import {
  BUS_OPACITY,
  BUS_RADIUS,
  JIGGLE_FAINT,
  JIGGLE_SPEED,
  JIGGLE_STRONG,
  LASER_ENTANGLER_COLOR,
} from "./config.js";

const dummy = new THREE.Object3D();

/** Build the bus mesh, or null when the host did not provide its shaders. */
export function createPhononBus() {
  if (!state.shaders.busVert || !state.shaders.busFrag) return null;

  // A unit cylinder along X: the caller scales it to the distance between the
  // two ions, so one mesh serves every pair.
  const geometry = new THREE.CylinderGeometry(BUS_RADIUS, BUS_RADIUS, 1, 20, 1, true);
  geometry.rotateZ(Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      uColor: { value: new THREE.Color(...LASER_ENTANGLER_COLOR) },
      uOpacity: { value: 0 },
    },
    vertexShader: state.shaders.busVert,
    fragmentShader: state.shaders.busFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

/**
 * Update the bus, the jiggle and the synchronized halo for this frame.
 *
 * It is called from the render loop. When no two-qubit gate is running, it
 * still writes the ion matrices (with no offset) and the halo flags, so the
 * chain returns to rest.
 */
export function updatePhonon(time) {
  const { gate, qubits, three } = state;
  const twoIons = gate.targets.length === 2;
  const intensity = twoIons ? pulseIntensity(gate.start, gate.end, time) : 0;
  const running = intensity > 0;

  const bus = three.busMesh;
  if (bus) {
    if (running) {
      const first = qubits[gate.targets[0]];
      const second = qubits[gate.targets[1]];
      bus.visible = true;
      bus.position.set((first.x + second.x) / 2, 0, 0);
      bus.scale.x = Math.abs(second.x - first.x);
      bus.material.uniforms.iTime.value = time * 0.001;
      bus.material.uniforms.uOpacity.value = intensity * BUS_OPACITY;
    } else {
      bus.visible = false;
    }
  }

  const low = running ? Math.min(gate.targets[0], gate.targets[1]) : 0;
  const high = running ? Math.max(gate.targets[0], gate.targets[1]) : -1;
  const entangled = three.entangledAttribute;

  for (let i = 0; i < qubits.length; i++) {
    const qubit = qubits[i];
    let y = 0;
    if (running && i >= low && i <= high) {
      const strong = i === gate.targets[0] || i === gate.targets[1];
      const amplitude = (strong ? JIGGLE_STRONG : JIGGLE_FAINT) * intensity;
      y = amplitude * Math.sin(time * JIGGLE_SPEED + i * 0.6);
    }
    dummy.position.set(qubit.x, y, 0);
    dummy.updateMatrix();
    three.instMesh.setMatrixAt(i, dummy.matrix);
    if (entangled) {
      entangled.array[i] = qubit.entangled && !running ? 1 : 0;
    }
  }
  three.instMesh.instanceMatrix.needsUpdate = true;
  if (entangled) entangled.needsUpdate = true;
}
