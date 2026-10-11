// The panels around the scene: the readouts, the detail of the step, the
// fidelity panel and the measurement.

import { sampleStep } from "./host.js";
import { clearMeasurement, startMeasurement } from "./measurement.js";
import { state } from "./state.js";
import { setError } from "./utils.js";

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
    row.innerHTML = `<b>q${q}</b><div class="bar"><span></span></div><span class="p1">0.00</span>`;
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

/** Show every field of the current step in the side panel. */
export function renderDetails(step) {
  const aside = document.getElementById("details");
  if (!step) {
    aside.innerHTML = '<h2>Detalle del paso</h2><p class="hint">' +
      "Estado inicial: todos los iones en |0⟩.</p>";
    return;
  }
  const rows = [
    ["operación", `<span class="op-badge">${step.operation}</span>`],
    ["targets", "[" + step.targets.join(", ") + "]"],
  ];
  if (step.phases) {
    rows.push(["phases (rad)", step.phases.map((p) => p.toFixed(4)).join(", ")]);
  }
  if (typeof step.angle === "number") {
    rows.push(["angle (turnos)", step.angle.toFixed(4)]);
  }
  rows.push(["fid. acumulada", step.cumulative_fidelity.toFixed(4) + " %"]);
  rows.push(["costo acum.", "$" + step.cumulative_cost.toFixed(6)]);
  rows.push(["virtual_z", "[" + step.virtual_z.map((v) => v.toFixed(3)).join(", ") + "]"]);
  rows.push(["inactividad", "[" + step.inactivity.join(", ") + "]"]);
  rows.push(["fidelidades", "[" + step.fidelities.map((f) => f.toFixed(2)).join(", ") + "]"]);
  rows.push(["vibración", "[" + step.vibration.map((v) => v.toFixed(3)).join(", ") + "]"]);
  aside.innerHTML = "<h2>Detalle del paso</h2><table>" +
    rows.map(([key, value]) => `<tr><td>${key}</td><td>${value}</td></tr>`).join("") +
    "</table>";
}

// The word for the fidelity, in the language of the page (`<html lang>`).
const PAGE_LANG =
  (typeof document !== "undefined" && document.documentElement
    && document.documentElement.lang) || "es";
const FIDELITY_LABEL = PAGE_LANG.toLowerCase().startsWith("en")
  ? "Fidelity"
  : "Fidelidad";

/**
 * Show the fidelity of the circuit: the accumulated fidelity of the step, a
 * bar and the total error (the fidelity that was lost). The bar is green above
 * 99 %, amber above 95 % and red below; the error value takes the same colour.
 */
export function updateHealth(step) {
  if (!state.data) return;
  const value = step ? step.cumulative_fidelity : state.data.initial_fidelity;
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 99 ? "#51cf66" : clamped >= 95 ? "#ffd166" : "#ff6b6b";

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
      `<tr><td>q${q}</td><td>p(|1⟩) ajustado ${p1[q].toFixed(3)} · ` +
      `medido ${measured.toFixed(3)} · fid ${(100 * fidelity[q]).toFixed(2)}%</td></tr>`
    );
  }

  document.getElementById("measurePanel").innerHTML =
    `<button class="close" id="measureClose">Cerrar</button>` +
    `<h2>Medición · paso ${step} · ${shots} shots</h2>` +
    `<p class="hint">La probabilidad se corrige con la fidelidad: ` +
    `p → 0.5 + (p − 0.5)·f.</p>` +
    `<div>${rows}</div>` +
    (sorted.length > top.length
      ? `<p class="hint">… y ${sorted.length - top.length} resultados más.</p>`
      : "") +
    `<hr /><table>${qubitRows.join("")}</table>`;

  document.getElementById("measurePanel").classList.remove("hidden");
  document.getElementById("measureClose").addEventListener("click", closeMeasurement);
}
