// The three.js scene: the chain of raymarched Bloch spheres, the camera, the
// render loop and the frame-rate counter.

import * as THREE from "three";
import { RoomEnvironment } from "./three-addons.js";
import { BOX, ENVIRONMENT_INTENSITY, LABEL_Y, LENS_Y, MOVE_SPEED, SPACING } from "./config.js";
import { state } from "./state.js";
import { PALETTES, hexToRgb } from "./settings.js";
import { qubitLabel, showStageMessage } from "./utils.js";
import { loadShaders } from "./shaders.js";
import { createLaserBeams, createLaserHead, loadLaserModel, pulseIntensity } from "./laser.js";
import { createPhononBus, updatePhonon } from "./phonon.js";
import { createIonTrap, updateTrap } from "./trap.js";
import { createHorizontalLayer, updateHorizontal } from "./horizontal.js";
import { createMeasurement, updateMeasurement } from "./measurement.js";
import { createSelection, updateSelection } from "./selection.js";
import { applyAtmosphere, createEnvironment } from "./environment.js";

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

// The exposure of the renderer when the brightness of the view is 1.
const BASE_EXPOSURE = 1.2;

/** The text sprite under an ion with the (x, y, z) of its vector. */
function makeValueLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 64;
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );
  sprite.scale.set(3.0, 0.5, 1);
  sprite.userData.canvas = canvas;
  return sprite;
}

/** Write the vector of an ion under its sphere, when it changed. */
function updateValueLabel(qubit) {
  const [x, y, z] = qubit.target;
  const text = `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
  if (qubit.valueText === text) return;
  qubit.valueText = text;
  const canvas = qubit.valueLabel.userData.canvas;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f1ebef";
  context.font = "600 30px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 6;
  context.strokeStyle = "rgba(18, 16, 22, 0.9)";
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  qubit.valueLabel.material.map.needsUpdate = true;
}

/** The uniforms of the sphere shader, with the values of the default view. */
function blochUniforms() {
  const colour = () => ({ value: new THREE.Vector3() });
  return {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3(1, 1, 1) },
    uAxisX: colour(), uAxisY: colour(), uAxisZ: colour(),
    uVecColor: colour(), uTipColor: colour(),
    uSphereColor: colour(), uLinesColor: colour(),
    uDotsStart: colour(), uDotsEnd: colour(),
    uSweepAzimuth: colour(), uSweepPolar: colour(),
    uSphereGain: { value: 1 }, uVectorGain: { value: 1 }, uVectorWidth: { value: 1 },
    uDetail: { value: 2 }, uMotion: { value: 1 }, uHalo: { value: 1 },
  };
}

const DETAIL_LEVELS = { outline: 0, simple: 1, full: 2 };

/**
 * Apply the view options (state.view) to the scene: the palette and the shape of
 * the spheres, the groups that are shown, the lights and the motion. It is safe to
 * call it before the scene exists, and again after every rebuild.
 */
export function applyViewToScene() {
  const view = state.view;
  const { renderer, scene, groups, instMesh } = state.three;
  if (!renderer || !view.palette) return;

  renderer.toneMappingExposure = BASE_EXPOSURE * view.brightness;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY * view.lights;
  for (const light of [...state.three.lights, ...state.three.ionLights]) {
    light.intensity = light.userData.base * view.lights;
  }

  const shown = {
    environment: view.showEnvironment, trap: view.showTrap,
    horizontal: view.showHorizontal, lasers: view.showLasers, bus: view.showBus,
    labels: view.showLabels, values: view.valueLabels,
  };
  for (const [name, visible] of Object.entries(shown)) {
    if (groups[name]) groups[name].visible = visible;
  }

  if (state.three.laserMesh) {
    state.three.laserMesh.material.uniforms.uLaserGain.value = view.laserGain;
  }

  if (!instMesh) return;
  const palette = PALETTES[view.palette];
  const u = instMesh.material.uniforms;
  const colours = {
    uAxisX: "axisX", uAxisY: "axisY", uAxisZ: "axisZ", uVecColor: "vector",
    uTipColor: "tip", uSphereColor: "sphere", uLinesColor: "lines",
    uDotsStart: "dotsStart", uDotsEnd: "dotsEnd",
    uSweepAzimuth: "sweepAzimuth", uSweepPolar: "sweepPolar",
  };
  for (const [uniform, key] of Object.entries(colours)) {
    u[uniform].value.set(...hexToRgb(palette[key]));
  }
  u.uSphereGain.value = view.sphereGlow;
  u.uVectorGain.value = view.vectorGain;
  u.uVectorWidth.value = view.vectorWidth;
  u.uDetail.value = DETAIL_LEVELS[view.sphereDetail];
  u.uMotion.value = view.reducedMotion ? 0 : 1;
  u.uHalo.value = view.halo ? 1 : 0;

  const material = instMesh.material;
  const blending = view.sphereBlend === "glow" ? THREE.AdditiveBlending : THREE.NormalBlending;
  const depthTest = !view.vectorOnTop;
  if (material.blending !== blending || material.depthTest !== depthTest) {
    material.blending = blending;
    material.depthTest = depthTest;
    material.needsUpdate = true;
  }
  instMesh.renderOrder = view.vectorOnTop ? 10 : 0;
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
    uniforms: blochUniforms(),
    vertexShader: state.shaders.vert,
    fragmentShader: state.shaders.frag,
    transparent: true,
    blending: THREE.NormalBlending,
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

  // What the "Vista" panel can hide goes in its own group.
  const labels = new THREE.Group();
  const values = new THREE.Group();
  const lasers = new THREE.Group();
  const bus = new THREE.Group();
  state.three.ionLights = [];

  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * SPACING;
    dummy.position.set(x, 0, 0);
    dummy.updateMatrix();
    state.three.instMesh.setMatrixAt(i, dummy.matrix);
    if (state.three.laserMesh) state.three.laserMesh.setMatrixAt(i, dummy.matrix);

    const label = makeLabel(qubitLabel(i));
    label.position.set(x, LABEL_Y, 0);
    labels.add(label);

    const valueLabel = makeValueLabel();
    valueLabel.position.set(x, -1.45, 0);
    values.add(valueLabel);

    const device = createLaserHead();
    device.position.set(x, LENS_Y, 0);
    lasers.add(device);

    const lightColor = (i % 2 === 0) ? 0xff00aa : 0x0088ff;
    const pointLight = new THREE.PointLight(lightColor, 2.0, 7.0);
    pointLight.userData.base = 2.0;
    pointLight.position.set(x, 0, 0);
    state.three.world.add(pointLight);
    state.three.ionLights.push(pointLight);

    state.qubits.push({
      x, label, valueLabel, valueText: "", current: [0, 0, 1], target: [0, 0, 1],
      vibration: 0, isTarget: false, laserStart: 0, laserEnd: 0, entangled: false,
    });
  }
  state.three.instMesh.instanceMatrix.needsUpdate = true;
  state.three.world.add(state.three.instMesh);

  if (state.three.laserMesh) {
    state.three.laserMesh.instanceMatrix.needsUpdate = true;
    lasers.add(state.three.laserMesh);
  }
  state.three.world.add(labels, values, lasers, bus);

  // The phonon bus of a two-qubit gate (hidden until one runs).
  state.three.busMesh = createPhononBus();
  if (state.three.busMesh) bus.add(state.three.busMesh);

  // The surface-trap chip under the chain, with a field ring per ion.
  const trap = createIonTrap(n);
  state.three.world.add(trap);

  // The horizontal optical layer: the global beam sheet, the phonon guide rail
  // and the side optics at the ends of the chain.
  const horizontal = createHorizontalLayer(n);
  state.three.world.add(horizontal);

  // The measurement animation (flares, photons and state badges).
  state.three.world.add(createMeasurement(n));

  // The selection markers of the ions (shown while a gate is hovered).
  state.hovered = [];
  state.three.world.add(createSelection(n));

  // The laboratory environment: the vacuum chamber and the optical table.
  const environment = createEnvironment(n);
  state.three.world.add(environment);

  state.three.groups = { labels, values, lasers, bus, trap, horizontal, environment };
  applyViewToScene();
  computeFitRadius();
}

/** Fit the camera distance to the length of the chain. */
function computeFitRadius() {
  if (!state.three.camera || state.qubits.length === 0) return;
  const halfX = ((state.qubits.length - 1) / 2) * SPACING + 9.5;
  const halfY = 6.2;
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

// The same keys by the character, for the events that carry no physical key
// code (some embedded frames and input methods).
const MOVE_CHARS = { w: "forward", s: "back", a: "left", d: "right", " ": "up" };

/** The movement of a keyboard event, or undefined when it is not a movement key. */
function moveAction(event) {
  if (MOVE_KEYS[event.code]) return MOVE_KEYS[event.code];
  const noCode = !event.code || event.code === "Unidentified";
  return noCode && event.key ? MOVE_CHARS[event.key.toLowerCase()] : undefined;
}

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

// The speed of the on-screen camera buttons: rotation in radians per second and
// zoom as a factor per second.
const PAD_TURN_SPEED = 1.3;
const PAD_ZOOM_SPEED = 1.1;

/** Turn, tilt or zoom the camera while an on-screen button is held. */
function padCamera(dt) {
  const { keys, orbit } = state;
  const turn = (keys.rotateRight ? 1 : 0) - (keys.rotateLeft ? 1 : 0);
  const tilt = (keys.tiltUp ? 1 : 0) - (keys.tiltDown ? 1 : 0);
  const zoom = (keys.zoomOut ? 1 : 0) - (keys.zoomIn ? 1 : 0);
  if (!turn && !tilt && !zoom) return;
  orbit.azimuth += turn * PAD_TURN_SPEED * dt;
  orbit.elevation = Math.max(-1.4, Math.min(1.4, orbit.elevation + tilt * PAD_TURN_SPEED * dt));
  orbit.zoom = Math.max(0.25, Math.min(4, orbit.zoom * Math.exp(zoom * PAD_ZOOM_SPEED * dt)));
  updateCamera();
}

/** Hold (or release) one of the camera flags: the buttons of the camera pad use it. */
export function holdCamera(action, down) {
  if (action in state.keys) state.keys[action] = down;
}

/** Return the camera to the framing of a new circuit. */
export function resetCamera() {
  Object.assign(state.orbit, { azimuth: 0.7, elevation: 0.32, zoom: 1 });
  state.orbit.target = { x: 0, y: 0, z: 0 };
  updateCamera();
}

// How far the target moves for each pixel of a right-button drag, as a fraction of
// the distance of the camera (about one pixel of the scene).
const PAN_PER_PIXEL = 0.0016;

/** Slide the orbit target in the plane of the screen by a drag of (dx, dy) pixels. */
function panCamera(dx, dy) {
  const camera = state.three.camera;
  camera.updateMatrixWorld();
  const scale = state.orbit.fitRadius * state.orbit.zoom * PAN_PER_PIXEL;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const target = state.orbit.target;
  // The scene follows the pointer: dragging to the right moves the target left.
  target.x += (-right.x * dx + up.x * dy) * scale;
  target.y += (-right.y * dx + up.y * dy) * scale;
  target.z += (-right.z * dx + up.z * dy) * scale;
  updateCamera();
}

/**
 * Drag with the left button to rotate the chain and with the right button to move
 * it, the wheel to zoom, and the keyboard or the camera pad to do the same.
 */
function addCameraControls() {
  const canvas = state.three.renderer.domElement;
  let dragging = null; // "rotate", "pan" or null
  let previous = { x: 0, y: 0 };

  canvas.addEventListener("pointerdown", (event) => {
    dragging = event.button === 2 ? "pan" : "rotate";
    previous = { x: event.clientX, y: event.clientY };
  });
  // The right button moves the camera: the menu of the browser would be in the way.
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("pointerup", () => { dragging = null; });
  window.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    previous = { x: event.clientX, y: event.clientY };
    if (dragging === "pan") {
      panCamera(dx, dy);
      return;
    }
    state.orbit.azimuth -= dx * 0.008;
    state.orbit.elevation = Math.max(-1.4, Math.min(1.4, state.orbit.elevation + dy * 0.008));
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
    const action = moveAction(event);
    if (!action || isTyping()) return;
    // Space presses a button when one has the focus: it must not move the camera.
    if (action === "up" && event.target.closest && event.target.closest("button, summary, a")) return;
    state.keys[action] = true;
    event.preventDefault();
  });
  window.addEventListener("keyup", (event) => {
    const action = moveAction(event);
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
  state.three.renderer.setClearColor(0x121016, 1);
  state.three.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.three.renderer.toneMappingExposure = BASE_EXPOSURE;
  stage.appendChild(state.three.renderer.domElement);

  state.three.scene = new THREE.Scene();
  state.three.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  state.three.world = new THREE.Group();
  state.three.scene.add(state.three.world);

  const pmremGenerator = new THREE.PMREMGenerator(state.three.renderer);
  const roomEnvironment = new RoomEnvironment();
  state.three.scene.environment = pmremGenerator.fromScene(roomEnvironment).texture;
  state.three.scene.environmentIntensity = ENVIRONMENT_INTENSITY;
  roomEnvironment.dispose();

  const chamberLights = applyAtmosphere(state.three.scene);

  const directionalLight = new THREE.DirectionalLight(0xaabbff, 1.2);
  directionalLight.position.set(5, 12, 7);
  state.three.scene.add(directionalLight);

  state.laser.movingLight = new THREE.PointLight(0xffffff, 20.0, 20);
  state.three.scene.add(state.laser.movingLight);

  // The lights that the brightness of the view scales, with their base values.
  state.three.lights = [...chamberLights, directionalLight, state.laser.movingLight];
  for (const light of state.three.lights) light.userData.base = light.intensity;
  applyViewToScene();

  await loadLaserModel();

  addCameraControls();
  window.addEventListener("resize", onResize);
  // The stage also changes size when a strip around it opens or closes.
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(onResize).observe(document.getElementById("stage"));
  }
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
  padCamera(dt);

  if (state.laser.movingLight) {
    // The light that sweeps along the chain stands still with reduced motion.
    const sweep = state.view.reducedMotion ? 0 : Math.sin(time * 0.0005);
    state.laser.movingLight.position.x = sweep * 30.0;
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
    if (moving && qubit.vibration > 0 && !state.view.reducedMotion) {
      const wobble = qubit.vibration * 0.25 * Math.sin(time * 0.006);
      vector[0] += wobble;
      vector[1] += wobble * 0.5;
    }
    // Backend Bloch (x, y, z) -> shader (x, z, -y): |0> points up (+y).
    array[i * 3 + 0] = vector[0];
    array[i * 3 + 1] = vector[2];
    array[i * 3 + 2] = -vector[1];
    qubit.label.material.color.setHex(qubit.isTarget ? 0xffd166 : 0xe6ecff);
    if (state.view.valueLabels) updateValueLabel(qubit);
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
  updateTrap(time);
  updateHorizontal(time);
  updateMeasurement(time);
  updateSelection(time);

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
