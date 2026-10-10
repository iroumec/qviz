// Load a visualization and move through its steps. A visualization is a JSON
// file that follows the contract of spec.md §6.

import { HOST, MANIFEST_URL, OUT_URL } from "./config.js";
import { DEMO } from "./demo.js";
import { state } from "./state.js";
import { escapeHtml, setError } from "./utils.js";
import { buildScene, updatePerf } from "./scene.js";
import {
  buildReadouts,
  closeMeasurement,
  renderDetails,
  updateHealth,
  updateReadouts,
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
  document.getElementById("backendMeta").innerHTML =
    `<b>${escapeHtml(state.data.backend)}</b> · fidelidad inicial ` +
    `<b>${state.data.initial_fidelity}%</b>`;
  const slider = document.getElementById("slider");
  slider.max = String(state.data.steps.length);
  slider.value = "0";
  setError("");
  updateStep(0, true);
  updatePerf();
}

/** The circuits that the user loaded, by selector key, to show them again. */
const userCircuits = new Map();

/** Compile a circuit file (OpenQASM 2 or 3) with the host and show it. */
export async function loadCircuitFile(file) {
  if (!HOST.compileQasm) {
    setError(
      "Cargar un circuito necesita Python para compilarlo (Qollab). " +
      "Sin Qollab solo se pueden ver los ejemplos de la lista."
    );
    return;
  }
  setError("Compilando " + file.name + "…");
  try {
    const compiled = await HOST.compileQasm(await file.text());
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
    setError("Error: " + error.message);
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

  const step = state.stepIndex === 0 ? null : state.data.steps[state.stepIndex - 1];
  const states = step ? step.states : initialState(state.data.total_qubits);
  const targets = step ? new Set(step.targets) : new Set();

  for (let q = 0; q < state.qubits.length; q++) {
    const vector = (states[q] || [0, 0, 1]).slice();
    state.qubits[q].target = vector;
    state.qubits[q].isTarget = targets.has(q);
    state.qubits[q].vibration = step && step.vibration ? step.vibration[q] || 0 : 0;
    if (instant) state.qubits[q].current = vector.slice();
  }
  updateReadouts(step);
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
      setError("No se pudo cargar " + error.message);
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
