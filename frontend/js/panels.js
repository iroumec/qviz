// The panels around the scene: the readouts, the detail of the step, the
// fidelity panel and the measurement.

import { OPERATIONS } from "./config.js";
import { sampleStep } from "./host.js";
import { clearMeasurement, startMeasurement } from "./measurement.js";
import { state } from "./state.js";
import { ketMath, probCorrectionMath, probOneMath, qubitMath, setError } from "./utils.js";

// The step of the last fidelity number that was popped, so a number is shown
// once per step and not again while the same step is redrawn.
let lastFidelityStep = 0;

/** Build one readout row per qubit, below the scene. */
export function buildReadouts(n) {
  lastFidelityStep = 0;
  const container = document.getElementById("readouts");
  container.innerHTML = "";
  for (let q = 0; q < n; q++) {
    const row = document.createElement("div");
    row.className = "readout";
    row.innerHTML = `<b>${qubitMath(q)}</b><div class="bar"><span></span></div><span class="p1">0.00</span>`;
    container.appendChild(row);
  }
}

/** Show the probability p(|1>) of every qubit for the current step. */
export function updateReadouts(step) {
  const rows = document.getElementById("readouts").children;
  for (let q = 0; q < rows.length; q++) {
    const p1 = step && step.probabilities ? step.probabilities[q][1] : 0;
    rows[q].querySelector(".bar > span").style.width = (100 * p1).toFixed(1) + "%";
    rows[q].querySelector(".p1").textContent = p1.toFixed(2);
  }
}

/** Show every field of the current step in the step-details panel. */
export function renderDetails(step) {
  const content = document.getElementById("detailsContent");
  if (!step) {
    content.innerHTML = `<p class="hint">${TEXT.initial}</p>`;
    return;
  }
  const count = state.data.total_qubits;
  const operation = OPERATIONS[step.operation] || { name: step.operation, kind: "1q" };
  const detail = operation.kind === "2q" ? TEXT.op2q
    : operation.kind === "vz" ? TEXT.opvz : TEXT.op1q;

  let html = `<div class="op-line"><span class="op-badge op-${operation.kind}">${operation.name}</span></div>` +
    `<p class="op-detail">${detail}</p>` +
    `<table class="kv"><tr><td>${TEXT.targets}</td><td>` +
    step.targets.map((t) => `<span class="qchip">${qubitMath(t)}</span>`).join(" ") + "</td></tr>";
  if (step.phases) {
    html += `<tr><td>${TEXT.phases}</td><td>${step.phases.map((p) => p.toFixed(4)).join(", ")}</td></tr>`;
  }
  if (typeof step.angle === "number") {
    html += `<tr><td>${TEXT.angle}</td><td>${step.angle.toFixed(4)}</td></tr>`;
  }
  html += `<tr><td>${TEXT.cumFidelity}</td><td>${step.cumulative_fidelity.toFixed(4)} %</td></tr>`;
  html += `<tr><td>${TEXT.cumCost}</td><td>$${step.cumulative_cost.toFixed(6)}</td></tr>`;
  html += "</table>";

  html += `<table class="qubits"><thead><tr><th></th><th>${TEXT.virtualZ}</th>` +
    `<th>${TEXT.inactivity}</th><th>${TEXT.fidelity}</th><th>${TEXT.vibration}</th></tr></thead><tbody>`;
  for (let q = 0; q < count; q++) {
    html += `<tr><td>${qubitMath(q)}</td><td>${step.virtual_z[q].toFixed(2)}</td>` +
      `<td>${step.inactivity[q]}</td><td>${step.fidelities[q].toFixed(2)}</td>` +
      `<td>${step.vibration[q].toFixed(3)}</td></tr>`;
  }
  html += "</tbody></table>";
  content.innerHTML = html;
}

/** Fill the simulation details (model, initial fidelity, size) in the left panel. */
export function updateSimulationDetails() {
  if (!state.data) return;
  document.getElementById("simModel").textContent = state.data.backend;
  document.getElementById("simInitial").textContent = state.data.initial_fidelity + "%";
  document.getElementById("simQubits").textContent = String(state.data.total_qubits);
  document.getElementById("simSteps").textContent = String(state.data.steps.length);
}

/**
 * Refresh the label of the play button: *Pausa* while it plays, *Reiniciar*
 * when the simulation is over (it makes no sense to resume it), *Reanudar* in
 * the middle, and *Play* at the start.
 */
export function refreshPlayButton() {
  const button = document.getElementById("play");
  if (!button) return;
  if (state.playing) button.textContent = "Pausa";
  else if (state.data && state.stepIndex >= state.data.steps.length) button.textContent = "Reiniciar";
  else button.textContent = state.stepIndex > 0 ? "Reanudar" : "Play";
}

// The word for the fidelity, in the language of the page (`<html lang>`).
const PAGE_LANG =
  (typeof document !== "undefined" && document.documentElement
    && document.documentElement.lang) || "es";
const ENGLISH = PAGE_LANG.toLowerCase().startsWith("en");
const FIDELITY_LABEL = ENGLISH ? "Fidelity" : "Fidelidad";

// The texts of the panels, in the language of the page.
const TEXT = ENGLISH
  ? {
      probabilities: "Probabilities",
      probabilitiesHint: `${probOneMath()} = probability of measuring 1 on each qubit.`,
      details: "Step details",
      zAxis: `z (${ketMath(0)} up)`,
      simulation: "Simulation details",
      model: "Model", initialFidelity: "Initial fidelity", qubits: "Qubits", steps: "Steps",
      measurementTitle: "Measurement", step: "Step", shots: "Shots",
      initial: `Initial state: every ion in ${ketMath(0)}.`,
      targets: "Target qubits",
      phases: "Phases (rad)", angle: "Angle (turns)",
      cumFidelity: "Accumulated fidelity", cumCost: "Accumulated cost",
      virtualZ: "VirtualZ", inactivity: "Inact.", fidelity: "Fid.", vibration: "Vibr.",
      op1q: "single-qubit gate", op2q: "two-qubit entangling gate", opvz: "virtual phase rotation",
    }
  : {
      probabilities: "Probabilidades",
      probabilitiesHint: `${probOneMath()} = probabilidad de medir 1 en cada qubit.`,
      details: "Detalle del paso",
      zAxis: `z (${ketMath(0)} arriba)`,
      simulation: "Detalles de la simulación",
      model: "Modelo", initialFidelity: "Fidelidad inicial", qubits: "Qubits", steps: "Pasos",
      measurementTitle: "Medición", step: "Paso", shots: "Shots",
      initial: `Estado inicial: todos los iones en ${ketMath(0)}.`,
      targets: "Qubits objetivo",
      phases: "Fases (rad)", angle: "Ángulo (turnos)",
      cumFidelity: "Fidelidad acumulada", cumCost: "Costo acumulado",
      virtualZ: "VirtualZ", inactivity: "Inact.", fidelity: "Fidel.", vibration: "Vibr.",
      op1q: "compuerta de un qubit", op2q: "compuerta entrelazadora de dos qubits", opvz: "rotación virtual de fase",
    };

/** Translate the panel titles and wire the collapse of each panel. */
export function initPanels() {
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const key = node.getAttribute("data-i18n");
    if (TEXT[key]) node.innerHTML = TEXT[key];
  }
  for (const head of document.querySelectorAll(".panel-head")) {
    head.addEventListener("click", () => {
      const collapsed = head.nextElementSibling.classList.toggle("collapsed");
      head.setAttribute("aria-expanded", String(!collapsed));
    });
  }
}

/**
 * Show the fidelity of the circuit: the accumulated fidelity of the step, a
 * bar and the total error (the fidelity that was lost). The bar is green above
 * 99 %, amber above 95 % and red below; the error value takes the same colour.
 */
export function updateHealth(step) {
  if (!state.data) return;
  const value = step ? step.cumulative_fidelity : state.data.initial_fidelity;
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 99 ? "#6fbf8f" : clamped >= 95 ? "#e0b06a" : "#f05291";

  document.getElementById("fidelityLabel").textContent = FIDELITY_LABEL;
  document.getElementById("healthValue").textContent = clamped.toFixed(2) + "%";

  const fill = document.getElementById("healthFill");
  fill.style.width = clamped + "%";
  fill.style.background = color;

  const error = document.getElementById("fidelityErrorValue");
  error.textContent = (100 - clamped).toFixed(2) + "%";
  error.style.color = color;

  // What this step subtracted from the fidelity: the difference with the
  // previous step (or with the initial fidelity for the first step). It is
  // popped over the panel, like a damage number, when a gate is applied.
  const previous = state.stepIndex <= 1
    ? state.data.initial_fidelity
    : state.data.steps[state.stepIndex - 2].cumulative_fidelity;
  const loss = step ? Math.max(0, previous - clamped) : 0;
  if (step && loss > 0 && state.stepIndex > lastFidelityStep) {
    showFidelityLoss(loss);
  }
  lastFidelityStep = state.stepIndex;
}

/** Pop the fidelity that this step subtracted, over the panel, like damage. */
function showFidelityLoss(loss) {
  const panel = document.getElementById("fidelity");
  const float = document.createElement("div");
  float.className = "fidelity-float";
  float.textContent = "\u2212" + loss.toFixed(2);
  panel.appendChild(float);
  float.addEventListener("animationend", () => {
    if (typeof float.remove === "function") float.remove();
    else if (typeof panel.removeChild === "function") panel.removeChild(float);
  });
}

export function closeMeasurement() {
  document.getElementById("measurePanel").classList.add("hidden");
  clearMeasurement();
}

/**
 * Measure the current step. The backend draws the outcomes from the statevector,
 * so the correlations of the entanglement are kept. The JSON only has marginal
 * probabilities, which cannot give them, so there is no other way to measure.
 */
export async function runMeasurement() {
  if (!state.data) return;
  const shots = Math.max(
    1,
    Math.min(100000, Math.round(Number(document.getElementById("shots").value) || 1024))
  );
  const n = state.data.total_qubits;
  const step = state.stepIndex === 0 ? null : state.data.steps[state.stepIndex - 1];

  const p1 = [];
  const fidelity = [];
  for (let q = 0; q < n; q++) {
    const base = step ? step.probabilities[q][1] : 0;
    const f = step ? step.fidelities[q] / 100 : 1;
    p1.push(0.5 + (base - 0.5) * f);
    fidelity.push(f);
  }

  const at = state.stepIndex;
  const measured = state.data;
  let sorted;
  try {
    sorted = await sampleStep(state.data, at, shots);
  } catch (error) {
    setError("No se pudo medir: " + error.message);
    return;
  }
  // The user may have moved to another step or file while the backend worked.
  if (at !== state.stepIndex || measured !== state.data) return;
  setError("");

  // Little-endian: qubit 0 is the rightmost character.
  const ones = new Array(n).fill(0);
  for (const [bits, count] of sorted) {
    for (let q = 0; q < n; q++) if (bits[n - 1 - q] === "1") ones[q] += count;
  }

  // Play the 3D measurement animation with the most likely outcome: the |1>
  // ions glow and send photons to the readout lens, the |0> ions stay dark.
  const top = sorted[0][0];
  const outcome = [];
  for (let q = 0; q < n; q++) outcome[q] = top[n - 1 - q] === "1" ? 1 : 0;
  startMeasurement(outcome);

  renderMeasurement(sorted, shots, p1, ones, fidelity, n, at);
}

function renderMeasurement(sorted, shots, p1, ones, fidelity, n, step) {
  const top = sorted.slice(0, 15);
  const rows = top
    .map(([bits, count]) => {
      const percentage = (100 * count) / shots;
      return (
        `<div class="measure-row"><span class="bits">${bits}</span>` +
        `<div class="bar"><span style="width:${percentage.toFixed(1)}%"></span></div>` +
        `<span class="pct">${percentage.toFixed(1)}%</span></div>`
      );
    })
    .join("");

  const qubitRows = [];
  for (let q = 0; q < n; q++) {
    const measured = ones[q] / shots;
    qubitRows.push(
      `<tr><td>${qubitMath(q)}</td><td>${probOneMath()} ajustado ${p1[q].toFixed(3)} · ` +
      `medido ${measured.toFixed(3)} · fid ${(100 * fidelity[q]).toFixed(2)}%</td></tr>`
    );
  }

  document.getElementById("measurePanel").innerHTML =
    `<button class="close" id="measureClose">Cerrar</button>` +
    `<h2>${TEXT.measurementTitle}</h2>` +
    `<div class="measure-meta">` +
    `<div class="measure-stat"><span>${TEXT.step}</span><b>${step} / ${state.data.steps.length}</b></div>` +
    `<div class="measure-stat"><span>${TEXT.shots}</span><b>${shots}</b></div>` +
    `</div>` +
    `<p class="hint">La probabilidad se corrige con la fidelidad: ${probCorrectionMath()}.</p>` +
    `<div>${rows}</div>` +
    (sorted.length > top.length
      ? `<p class="hint">… y ${sorted.length - top.length} resultados más.</p>`
      : "") +
    `<hr /><table>${qubitRows.join("")}</table>`;

  document.getElementById("measurePanel").classList.remove("hidden");
  document.getElementById("measureClose").addEventListener("click", closeMeasurement);
}
