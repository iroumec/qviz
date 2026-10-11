// Load a visualization and move through its steps. A visualization is a JSON
// file that follows the contract of spec.md §6.

import { HOST, MANIFEST_URL, OUT_URL } from "./config.js";
import { laserColorFor, laserPulseFor } from "./laser.js";
import { compileQasm } from "./host.js";
import { DEMO } from "./demo.js";
import { state } from "./state.js";
import { clearErrorCard, reportError, setError, setStatus } from "./utils.js";
import { buildScene, updatePerf } from "./scene.js";
import { buildTimeline, highlightStep } from "./timeline.js";
import {
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
    throw new Error("El JSON no tiene el contrato esperado (backend/steps).");
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
  updatePerf();
}

/** The circuits that the user loaded, by selector key, to show them again. */
const userCircuits = new Map();

/** Compile a circuit file (OpenQASM 2 or 3) and show it. */
export async function loadCircuitFile(file) {
  setStatus("Compilando " + file.name + "…");
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

/** Show the step with this index. Step 0 is the initial state. */
export function updateStep(index, instant = false) {
  if (!state.data) return;
  closeMeasurement();
  state.stepIndex = Math.max(0, Math.min(state.data.steps.length, index));
  document.getElementById("slider").value = String(state.stepIndex);
  document.getElementById("stepLabel").textContent =
    `paso ${state.stepIndex} / ${state.data.steps.length}`;
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

  // The two-qubit gate that is running (MS or ZZ): its ions and its window,
  // for the phonon bus and the jiggle.
  const twoIonGate = step && (step.operation === "ms" || step.operation === "zz")
    && step.targets.length === 2;
  state.gate = twoIonGate
    ? { targets: step.targets.slice(), start: now, end: now + pulse.ms }
    : { targets: [], start: 0, end: 0 };

  // The last two-qubit gate up to this step marks its two ions as entangled,
  // so their halos pulse in step after the gate.
  let entangledPair = null;
  for (let s = state.stepIndex - 1; s >= 0 && !entangledPair; s--) {
    const candidate = state.data.steps[s];
    if ((candidate.operation === "ms" || candidate.operation === "zz")
        && candidate.targets.length === 2) {
      entangledPair = candidate.targets;
    }
  }

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
    qubit.entangled = entangledPair ? entangledPair.includes(q) : false;
    qubit.vibration = step && step.vibration ? step.vibration[q] || 0 : 0;
    // The laser is off unless this step fires it on this ion, so moving to a
    // step that does not fire it cancels a pulse that is still fading.
    if (pulse && qubit.isTarget) {
      qubit.laserStart = now;
      qubit.laserEnd = now + pulse.ms;
    } else {
      qubit.laserStart = 0;
      qubit.laserEnd = 0;
    }
    if (instant) qubit.current = vector.slice();
  }
  updateReadouts(step);
  highlightStep(state.stepIndex);
  renderDetails(step);
  updateHealth(step);
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
    select.innerHTML = '<option value="">(sin out/manifest.json)</option>';
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
