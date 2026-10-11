// The three.js scene: the chain of raymarched Bloch spheres, the camera, the
// render loop and the frame-rate counter.

import * as THREE from "three";
import { RoomEnvironment } from "./three-addons.js";
import { BOX, MOVE_SPEED, SPACING } from "./config.js";
import { state } from "./state.js";
import { showStageMessage } from "./utils.js";
import { loadShaders } from "./shaders.js";
import { createLaserBeams, loadLaserModel, pulseIntensity } from "./laser.js";
import { createPhononBus, updatePhonon } from "./phonon.js";

/** A small text sprite, used as the label above an ion. */
function makeLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.fillStyle = "#e6ecff";
  context.font = "bold 40px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 64, 34);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );
  sprite.scale.set(0.95, 0.48, 1);
  return sprite;
}

/** Build the chain of ions, one sphere per qubit, as one instanced mesh. */
export function buildScene(n) {
  if (!state.three.renderer) {
    state.qubits.length = 0;
    return;
  }

  while (state.three.world.children.length) {
    state.three.world.remove(state.three.world.children[0]);
  }
  state.qubits.length = 0;
  state.orbit.target = { x: 0, y: 0, z: 0 };

  const geometry = new THREE.BoxGeometry(BOX, BOX, BOX);
  state.three.psiAttribute = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  geometry.setAttribute("instancePsi", state.three.psiAttribute);
  state.three.entangledAttribute = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  geometry.setAttribute("instanceEntangled", state.three.entangledAttribute);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(1, 1, 1) },
    },
    vertexShader: state.shaders.vert,
    fragmentShader: state.shaders.frag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  state.three.instMesh = new THREE.InstancedMesh(geometry, material, n);
  state.three.instMesh.frustumCulled = false;

  // One volumetric beam per ion, placed with the same instance matrix as the
  // spheres. `null` when the host gave no laser shaders.
  state.three.laserMesh = createLaserBeams(n);
  state.three.laserActive = state.three.laserMesh
    ? state.three.laserMesh.geometry.getAttribute("instanceActive")
    : null;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * SPACING;
    dummy.position.set(x, 0, 0);
    dummy.updateMatrix();
    state.three.instMesh.setMatrixAt(i, dummy.matrix);
    if (state.three.laserMesh) state.three.laserMesh.setMatrixAt(i, dummy.matrix);

    const label = makeLabel("q" + i);
    label.position.set(x, 3.5, 0);
    state.three.world.add(label);

    if (state.laser.template) {
      const device = state.laser.template.clone();
      device.position.set(x, 2.5, 0);
      state.three.world.add(device);
    }

    const lightColor = (i % 2 === 0) ? 0xff00aa : 0x0088ff;
    const pointLight = new THREE.PointLight(lightColor, 2.0, 7.0);
    pointLight.position.set(x, 0, 0);
    state.three.world.add(pointLight);

    state.qubits.push({
      x, label, current: [0, 0, 1], target: [0, 0, 1], vibration: 0, isTarget: false,
      laserStart: 0, laserEnd: 0, entangled: false,
    });
  }
  state.three.instMesh.instanceMatrix.needsUpdate = true;
  state.three.world.add(state.three.instMesh);

  if (state.three.laserMesh) {
    state.three.laserMesh.instanceMatrix.needsUpdate = true;
    state.three.world.add(state.three.laserMesh);
  }

  // The phonon bus of a two-qubit gate (hidden until one runs).
  state.three.busMesh = createPhononBus();
  if (state.three.busMesh) state.three.world.add(state.three.busMesh);

  computeFitRadius();
}

/** Fit the camera distance to the length of the chain. */
function computeFitRadius() {
  if (!state.three.camera || state.qubits.length === 0) return;
  const halfX = ((state.qubits.length - 1) / 2) * SPACING + 1.8;
  const halfY = 1.8;
  const vFov = (state.three.camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * state.three.camera.aspect);
  state.orbit.fitRadius = Math.max(
    halfX / Math.tan(hFov / 2), halfY / Math.tan(vFov / 2)
  ) + 1;
  updateCamera();
}

/** Place the camera on its orbit around the target. */
function updateCamera() {
  if (!state.three.camera) return;
  const { azimuth, elevation, target } = state.orbit;
  const radius = state.orbit.fitRadius * state.orbit.zoom;
  state.three.camera.position.set(
    target.x + radius * Math.sin(azimuth) * Math.cos(elevation),
    target.y + radius * Math.sin(elevation),
    target.z + radius * Math.cos(azimuth) * Math.cos(elevation)
  );
  state.three.camera.lookAt(target.x, target.y, target.z);
}

// The keys that move the camera: WASD on the horizontal plane, space up and the
// left control down.
const MOVE_KEYS = {
  KeyW: "forward",
  KeyS: "back",
  KeyA: "left",
  KeyD: "right",
  Space: "up",
  ControlLeft: "down",
};

/** True when the keyboard event comes from a field, so the key is not stolen. */
function isTyping() {
  const tag = document.activeElement && document.activeElement.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

/**
 * Move the orbit target with the held keys. The step grows with the distance of
 * the camera, so the movement feels the same at every zoom.
 */
function moveCamera(dt) {
  const { keys, orbit } = state;
  const step = orbit.fitRadius * orbit.zoom * MOVE_SPEED * dt;
  if (step <= 0) return;

  const camera = state.three.camera;
  const forward = {
    x: orbit.target.x - camera.position.x,
    z: orbit.target.z - camera.position.z,
  };
  const length = Math.hypot(forward.x, forward.z);
  if (length > 1e-4) {
    forward.x /= length;
    forward.z /= length;
  } else {
    forward.x = 0;
    forward.z = -1;
  }
  const right = { x: -forward.z, z: forward.x };

  let moved = false;
  const shift = (key, dx, dy, dz) => {
    if (!keys[key]) return;
    orbit.target.x += dx;
    orbit.target.y += dy;
    orbit.target.z += dz;
    moved = true;
  };
  shift("forward", forward.x * step, 0, forward.z * step);
  shift("back", -forward.x * step, 0, -forward.z * step);
  shift("right", right.x * step, 0, right.z * step);
  shift("left", -right.x * step, 0, -right.z * step);
  shift("up", 0, step, 0);
  shift("down", 0, -step, 0);

  if (moved) updateCamera();
}

/** Drag to rotate the chain, the wheel to zoom, the keyboard to move. */
function addCameraControls() {
  const canvas = state.three.renderer.domElement;
  let dragging = false;
  let previous = { x: 0, y: 0 };

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    previous = { x: event.clientX, y: event.clientY };
  });
  window.addEventListener("pointerup", () => { dragging = false; });
  window.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    state.orbit.azimuth -= (event.clientX - previous.x) * 0.008;
    state.orbit.elevation = Math.max(
      -1.4, Math.min(1.4, state.orbit.elevation + (event.clientY - previous.y) * 0.008)
    );
    previous = { x: event.clientX, y: event.clientY };
    updateCamera();
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    state.orbit.zoom = Math.max(
      0.25, Math.min(4, state.orbit.zoom * (1 + event.deltaY * 0.001))
    );
    updateCamera();
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    const action = MOVE_KEYS[event.code];
    if (!action || isTyping()) return;
    state.keys[action] = true;
    event.preventDefault();
  });
  window.addEventListener("keyup", (event) => {
    const action = MOVE_KEYS[event.code];
    if (action) state.keys[action] = false;
  });
  // A key that is held while the window loses the focus would stay down.
  window.addEventListener("blur", () => {
    for (const action of Object.keys(state.keys)) state.keys[action] = false;
  });
}

export async function initThree() {
  try {
    await loadShaders();
  } catch (error) {
    showStageMessage(
      "No se pudieron cargar los shaders de <code>shaders/</code>. " +
      "Serví el proyecto por HTTP (<code>python -m http.server</code>)."
    );
    return false;
  }

  const stage = document.getElementById("stage");
  state.three.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.three.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.three.renderer.setClearColor(0x0b0f1a, 1);
  state.three.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.three.renderer.toneMappingExposure = 1.2;
  stage.appendChild(state.three.renderer.domElement);

  state.three.scene = new THREE.Scene();
  state.three.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  state.three.world = new THREE.Group();
  state.three.scene.add(state.three.world);

  const pmremGenerator = new THREE.PMREMGenerator(state.three.renderer);
  const roomEnvironment = new RoomEnvironment();
  state.three.scene.environment = pmremGenerator.fromScene(roomEnvironment).texture;
  roomEnvironment.dispose();

  state.three.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  const directionalLight = new THREE.DirectionalLight(0xaabbff, 1.5);
  directionalLight.position.set(5, 10, 7);
  state.three.scene.add(directionalLight);

  state.laser.movingLight = new THREE.PointLight(0xffffff, 20.0, 20);
  state.three.scene.add(state.laser.movingLight);

  await loadLaserModel();

  addCameraControls();
  window.addEventListener("resize", onResize);
  onResize();
  return true;
}

function onResize() {
  if (!state.three.renderer) return;
  const stage = document.getElementById("stage");
  const width = stage.clientWidth || 1;
  const height = stage.clientHeight || 1;
  state.three.renderer.setSize(width, height, false);
  state.three.camera.aspect = width / height;
  state.three.camera.updateProjectionMatrix();
  if (state.three.instMesh) {
    state.three.instMesh.material.uniforms.iResolution.value.set(width, height, 1);
  }
  computeFitRadius();
}

/**
 * The intensity of the laser of one ion at this time: a flat-top pulse that
 * starts when the step fired it (``laserStart``) and returns to zero at
 * ``laserEnd``. It rises and falls in the first and last 15 % of the pulse, and
 * is zero when the ion was not fired, so the beam is dark at rest.
 */
function laserIntensity(qubit, time) {
  return pulseIntensity(qubit.laserStart, qubit.laserEnd, time);
}

// The timestamp of the previous frame, for the keyboard movement.
let previousFrame = 0;

export function animate(time) {
  requestAnimationFrame(animate);
  if (!state.three.renderer || !state.three.psiAttribute) return;

  // The time since the last frame, for the keyboard movement.
  const dt = previousFrame ? Math.min(0.1, (time - previousFrame) / 1000) : 0;
  previousFrame = time;
  moveCamera(dt);

  if (state.laser.movingLight) {
    state.laser.movingLight.position.x = Math.sin(time * 0.0005) * 30.0;
    state.laser.movingLight.position.y = 4.0;
    state.laser.movingLight.position.z = 3.0;
  }

  const array = state.three.psiAttribute.array;
  for (let i = 0; i < state.qubits.length; i++) {
    const qubit = state.qubits[i];
    let moving = false;
    for (let axis = 0; axis < 3; axis++) {
      const difference = qubit.target[axis] - qubit.current[axis];
      if (Math.abs(difference) > 1e-3) moving = true;
      qubit.current[axis] += difference * 0.18;
    }
    if (!moving) qubit.current = qubit.target.slice();

    const vector = qubit.current.slice();
    // The wobble is shown only while the ion moves, so the chain settles when a
    // step is reached.
    if (moving && qubit.vibration > 0) {
      const wobble = qubit.vibration * 0.25 * Math.sin(time * 0.006);
      vector[0] += wobble;
      vector[1] += wobble * 0.5;
    }
    // Backend Bloch (x, y, z) -> shader (x, z, -y): |0> points up (+y).
    array[i * 3 + 0] = vector[0];
    array[i * 3 + 1] = vector[2];
    array[i * 3 + 2] = -vector[1];
    qubit.label.material.color.setHex(qubit.isTarget ? 0xffd166 : 0xe6ecff);
    if (state.three.laserActive) {
      state.three.laserActive.array[i] = laserIntensity(qubit, time);
    }
  }
  state.three.psiAttribute.needsUpdate = true;
  if (state.three.laserActive) state.three.laserActive.needsUpdate = true;
  state.three.instMesh.material.uniforms.iTime.value = time * 0.001;
  if (state.three.laserMesh) {
    state.three.laserMesh.material.uniforms.iTime.value = time * 0.001;
  }
  updatePhonon(time);

  state.three.renderer.render(state.three.scene, state.three.camera);

  state.fps.frames += 1;
  if (time - state.fps.last >= 500) {
    state.fps.value = (state.fps.frames * 1000) / (time - state.fps.last);
    state.fps.frames = 0;
    state.fps.last = time;
    updatePerf();
  }
}

export function updatePerf() {
  if (!state.data) return;
  document.getElementById("perfMeta").textContent =
    `${state.data.total_qubits} qubits · ${state.data.steps.length} pasos · ` +
    `${state.fps.value.toFixed(0)} fps`;
}
