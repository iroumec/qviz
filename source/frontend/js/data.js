// Load a visualization and move through its steps. A visualization is a JSON
// file that follows the contract of spec.md §6.

import { DECOHERENCE_IDLE_STEPS, ENTANGLED_R, HOST, MOTION_MS, MANIFEST_URL, OUT_URL } from "./config.js";
import { laserColorFor, laserPulseFor } from "./laser.js";
import { startIntro } from "./horizontal.js";
import { gateRotation, makeMotion, wrapAngle } from "./motion.js";
import { playGateSound, stopGateSounds } from "./sound.js";
import { compileQasm } from "./host.js";
import { DEMO } from "./demo.js";
import { state } from "./state.js";
import { clearErrorCard, reportError, setError, setStatus, t } from "./utils.js";
import { buildScene, updatePerf } from "./scene.js";
import { buildTimeline, highlightStep } from "./timeline.js";
import {
  announceStep,
  buildReadouts,
  closeMeasurement,
  refreshPlayButton,
  renderDetails,
  updateHealth,
  updateReadouts,
  updateSimulationDetails,
} from "./panels.js";

/** The initial state: every qubit in |0>. It is step 0, which is not in the JSON. */
function initialState(n) {
  return Array.from({ length: n }, () => [0, 0, 1]);
}

/** Load a visualization object, rebuild the scene and show step 0. */
export function loadData(obj) {
  if (!obj || !Array.isArray(obj.steps) || typeof obj.total_qubits !== "number") {
    throw new Error(t(
      "El JSON no tiene el contrato esperado (backend/steps).",
      "The JSON does not have the expected contract (backend/steps)."
    ));
  }
  state.data = obj;
  state.stepIndex = 0;
  buildScene(state.data.total_qubits);
  buildReadouts(state.data.total_qubits);
  updateSimulationDetails();
  buildTimeline(state.data);
  const slider = document.getElementById("slider");
  slider.max = String(state.data.steps.length);
  slider.value = "0";
  setError("");
  clearErrorCard();
  updateStep(0, true);
  startIntro();
  updatePerf();
}

/** The circuits that the user loaded, by selector key, to show them again. */
const userCircuits = new Map();

/** Compile a circuit file (OpenQASM 2 or 3) and show it. */
export async function loadCircuitFile(file) {
  setStatus(t("Compilando ", "Compiling ") + file.name + "…");
  try {
    const compiled = await compileQasm(await file.text());
    const key = "file:" + file.name;
    userCircuits.set(key, compiled);
    const select = document.getElementById("fileSelect");
    if (![...select.options].some((option) => option.value === key)) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = file.name;
      select.appendChild(option);
    }
    select.value = key;
    loadData(compiled);
  } catch (error) {
    reportError(error);
  }
}

/** The Bloch vector of qubit ``q`` after step ``index`` (0 is the initial state). */
function vectorAt(q, index) {
  if (index === 0) return [0, 0, 1];
  const states = state.data.steps[index - 1].states;
  return (states[q] || [0, 0, 1]).slice();
}

/** The turn of the VirtualZ of step ``index`` on qubit ``q``, in radians. */
function zTurn(q, index) {
  const steps = state.data.steps;
  const now = steps[index - 1].virtual_z ? steps[index - 1].virtual_z[q] : 0;
  const before = index >= 2 && steps[index - 2].virtual_z ? steps[index - 2].virtual_z[q] : 0;
  return wrapAngle(now - before);
}

/**
 * How the vector of qubit ``q`` travels when the viewer goes from step ``from``
 * to step ``to``. Moving one step with a single-qubit gate turns the vector about
 * the axis of the gate (forwards, or backwards with the opposite turn), so it
 * stays on the sphere; any other change swings it along the shortest arc
 * (see ``motion.js``).
 */
function motionFor(q, from, to, now, pulse) {
  const qubit = state.qubits[q];
  const end = vectorAt(q, to);
  const stepNumber = to === from + 1 ? to : from === to + 1 ? from : 0;
  const step = stepNumber ? state.data.steps[stepNumber - 1] : null;

  if (step && step.targets.length === 1 && step.targets[0] === q) {
    let rotation = gateRotation(step.operation, step.phases, zTurn(q, stepNumber));
    if (rotation && stepNumber === from) {
      rotation = { axis: rotation.axis, angle: -rotation.angle };
    }
    const ms = stepNumber === to && pulse ? pulse.ms : MOTION_MS;
    return makeMotion(vectorAt(q, from), end, rotation, now, ms || MOTION_MS);
  }

  const start = qubit.current;
  if (Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]) < 1e-6) return null;
  const twoIonPulse = step && stepNumber === to && pulse && step.targets.includes(q);
  return makeMotion(start, end, null, now, twoIonPulse ? pulse.ms : MOTION_MS);
}

/** Show the step with this index. Step 0 is the initial state. */
export function updateStep(index, instant = false) {
  if (!state.data) return;
  closeMeasurement();
  // Only a step forward by one has a sound: dragging the slider or jumping would
  // be a burst of clicks.
  const previous = state.stepIndex;
  const forward = index === previous + 1;
  state.stepIndex = Math.max(0, Math.min(state.data.steps.length, index));
  document.getElementById("slider").value = String(state.stepIndex);
  document.getElementById("stepLabel").textContent =
    `${t("paso", "step")} ${state.stepIndex} / ${state.data.steps.length}`;
  refreshPlayButton();

  const step = state.stepIndex === 0 ? null : state.data.steps[state.stepIndex - 1];
  const states = step ? step.states : initialState(state.data.total_qubits);
  const targets = step ? new Set(step.targets) : new Set();

  // A native gate fires the laser on its target ions for a pulse whose colour
  // and length depend on the gate (see `laserPulseFor` in laser.js); the
  // animation turns it off at rest (see `laserIntensity` in scene.js).
  const pulse = step ? laserPulseFor(step.operation, state.data.backend) : null;
  const now = performance.now();
  state.pulseMs = pulse ? pulse.ms : 0;
  stopGateSounds();
  if (step && forward && !instant) playGateSound(step.operation, state.pulseMs);

  // The two-qubit gate that is running (MS or ZZ): its ions and its window,
  // for the phonon bus and the jiggle.
  const twoIonGate = step && (step.operation === "ms" || step.operation === "zz")
    && step.targets.length === 2;
  state.gate = twoIonGate
    ? { targets: step.targets.slice(), start: now, end: now + pulse.ms }
    : { targets: [], start: 0, end: 0 };

  if (state.three.laserMesh) {
    state.three.laserMesh.material.uniforms.uLaserColor.value.copy(
      pulse ? pulse.color : laserColorFor(state.data.backend)
    );
  }

  for (let q = 0; q < state.qubits.length; q++) {
    const qubit = state.qubits[q];
    const vector = (states[q] || [0, 0, 1]).slice();
    qubit.target = vector;
    qubit.isTarget = targets.has(q);
    // The state of the register is pure, so a qubit is entangled with the others
    // exactly when its own Bloch vector is shorter than 1 (the reduced state is
    // mixed). The halo follows that, and not the last two-qubit gate that ran.
    qubit.entangled = Math.hypot(vector[0], vector[1], vector[2]) < ENTANGLED_R;
    qubit.vibration = step && step.vibration ? step.vibration[q] || 0 : 0;
    // The heat of the ion is how long it has spent idle: an ion that nobody
    // addresses keeps decohering while the others are driven, so it turns red.
    // Coherence decays with the idle time and not with the length of the
    // circuit, so the count is absolute (see DECOHERENCE_IDLE_STEPS). It only
    // grows, so a qubit never goes back to a healthy colour.
    qubit.decoherence = step && step.inactivity
      ? 1 - Math.exp(-step.inactivity[q] / DECOHERENCE_IDLE_STEPS)
      : 0;
    // The laser is off unless this step fires it on this ion, so moving to a
    // step that does not fire it cancels a pulse that is still fading.
    if (pulse && qubit.isTarget) {
      qubit.laserStart = now;
      qubit.laserEnd = now + pulse.ms;
    } else {
      qubit.laserStart = 0;
      qubit.laserEnd = 0;
    }
    if (instant) {
      qubit.current = vector.slice();
      qubit.motion = null;
    } else {
      qubit.motion = motionFor(q, previous, state.stepIndex, now, pulse);
    }
  }
  updateReadouts(step);
  highlightStep(state.stepIndex);
  renderDetails(step);
  updateHealth(step);
  announceStep(step);
}

/** Load one entry of the selector: a circuit of the user, or from the host or HTTP. */
export async function loadFile(name) {
  if (userCircuits.has(name)) {
    loadData(userCircuits.get(name));
    return;
  }
  if (HOST.load) {
    loadData(await HOST.load(name));
    return;
  }
  const response = await fetch(OUT_URL + name);
  if (!response.ok) throw new Error(name);
  loadData(await response.json());
}

function fillSelector(select, entries) {
  select.innerHTML = "";
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.file;
    option.textContent = entry.label || entry.file;
    select.appendChild(option);
  }
}

/** Fill the file selector, from the host, from out/manifest.json, or with the demo. */
export async function loadManifest() {
  const select = document.getElementById("fileSelect");

  if (HOST.circuits) {
    fillSelector(select, HOST.circuits);
    try {
      await loadFile(select.value);
    } catch (error) {
      reportError(error);
    }
    return;
  }

  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) throw new Error("no manifest");
    const manifest = await response.json();
    fillSelector(select, manifest.files);
    select.value = manifest.default || manifest.files[0].file;
    await loadFile(select.value);
  } catch (error) {
    select.innerHTML = `<option value="">${t("(sin out/manifest.json)", "(no out/manifest.json)")}</option>`;
    try {
      await loadFile("ghz16.json");
    } catch (firstError) {
      try {
        await loadFile("bell.json");
      } catch (secondError) {
        loadData(DEMO);
      }
    }
  }
}
