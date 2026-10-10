// QViz test page for Qollab (a JS project). It is built by `make qollab` together
// with backend/, examples/, qollab_api.py and requirements.txt. Python functions
// of our own files are called with `callPromising`, as qollab_context.md §3
// explains. See documentation/prompts/qollab_pruebas.md.
import * as api from "qollab_api";

const $ = (id) => document.getElementById(id);
const log = (line) => { $("log").textContent += line + "\n"; };
const ms = (start) => `${(performance.now() - start).toFixed(0)} ms`;

let text = null;   // the exported JSON, as a string
let data = null;   // the same JSON, parsed
let total = 0;     // number of steps
let calls = 0;     // how many clicks reached Python after the first run

function report(error) {
  log(`ERROR  ${error && error.message ? error.message : error}`);
  $("status").textContent = "Error: see the log";
}

// A measurement is a list of [bitstring, count] pairs, most frequent first.
async function measureStep(step, shots) {
  const reply = await api.sample_step.callPromising(text, step, shots);
  calls += 1;
  return { pairs: JSON.parse(reply), reply };
}

try {
  log(`module "qollab_api" imported; exports: ${Object.keys(api).join(", ")}`);
  log(`libraries: ${await api.versions.callPromising()}`);
  log(`typeof backend: ${typeof backend}; name: ${backend.name}`);
  $("status").textContent = "Ready. Press 1. Compile.";
} catch (error) {
  report(error);
}

$("compile").addEventListener("click", async () => {
  try {
    $("compile").disabled = true;   // IonQ allows one job per run: compile only once
    const start = performance.now();
    const shots = Number($("shots").value);
    text = await api.run.callPromising(backend, $("circuit").value, shots, "auto");
    data = JSON.parse(text);
    total = data.steps.length;
    log(`COMPILE ok in ${ms(start)}: ${data.backend}`);
    log(`        ${data.total_qubits} qubits, ${total} steps, ${(text.length / 1000).toFixed(0)} kB, typeof result: ${typeof text}`);
    $("measure").disabled = false;
    $("checks").disabled = false;
    $("status").textContent = "Compiled. Press 2. Measure or 3. Run checks as many times as you want.";
  } catch (error) {
    report(error);
  }
});

$("measure").addEventListener("click", async () => {
  try {
    const start = performance.now();
    const step = Number($("step").value) || total;
    const shots = Number($("shots").value);
    const { pairs, reply } = await measureStep(step, shots);
    log(`MEASURE #${calls} ok in ${ms(start)}: step ${step}, ${shots} shots, typeof result: ${typeof reply}`);
    for (const [bits, n] of pairs.slice(0, 8)) {
      log(`  ${bits}  ${String(n).padStart(6)}  ${(100 * n / shots).toFixed(1).padStart(5)} %`);
    }
  } catch (error) {
    report(error);
  }
});

// Chance that a qubit is read wrongly at `step`: the same model as the backend
// (the fidelity is a read-out error of (1 - f) / 2, plus the SPAM error).
function flipChance(step, qubit) {
  const spam = 1 - data.initial_fidelity / 100;
  const f = step === 0 ? 1 : data.steps[step - 1].fidelities[qubit] / 100;
  const gate = (1 - f) / 2;
  return gate + spam - 2 * gate * spam;
}

// The checks need no knowledge of the circuit: the measured frequency of each
// qubit must match the probabilities that the same JSON already holds (a
// different step gives a different answer, so every call is really recomputed),
// and a GHZ-type circuit must keep its correlations at the last step.
$("checks").addEventListener("click", async () => {
  try {
    const n = data.total_qubits;
    const shots = 4000;
    const steps = [...new Set([0, 1, Math.ceil(total / 2), total])];
    let failures = 0;
    log(`CHECKS on ${$("circuit").value} (${shots} shots per step)`);
    for (const step of steps) {
      const start = performance.now();
      const { pairs } = await measureStep(step, shots);
      const measured = Array(n).fill(0);
      for (const [bits, count] of pairs) {
        for (let q = 0; q < n; q++) if (bits[n - 1 - q] === "1") measured[q] += count / shots;
      }
      let worst = 0;
      for (let q = 0; q < n; q++) {
        const ideal = step === 0 ? 0 : data.steps[step - 1].probabilities[q][1];
        const flip = flipChance(step, q);
        const expected = ideal * (1 - flip) + (1 - ideal) * flip;
        worst = Math.max(worst, Math.abs(measured[q] - expected));
      }
      const ok = worst < 0.04;
      if (!ok) failures += 1;
      log(`  step ${String(step).padStart(3)}: worst |measured - expected| = ${worst.toFixed(3)} in ${ms(start)}  ${ok ? "PASS" : "FAIL"}`);
    }

    if (["bell", "ghz3", "ghz16"].includes($("circuit").value)) {
      const { pairs } = await measureStep(total, shots);
      const ends = pairs.filter(([bits]) => /^(0+|1+)$/.test(bits)).reduce((s, [, c]) => s + c, 0);
      let clean = 1, flipped = 1;
      for (let q = 0; q < n; q++) { clean *= 1 - flipChance(total, q); flipped *= flipChance(total, q); }
      const expectedOther = 1 - clean - flipped;
      const other = 1 - ends / shots;
      const ok = Math.abs(other - expectedOther) < 0.04;
      if (!ok) failures += 1;
      log(`  correlations: ${(100 * other).toFixed(1)} % of the shots are not all-0 or all-1 (expected ${(100 * expectedOther).toFixed(1)} %; independent qubits would give ${(100 * (1 - 2 / 2 ** n)).toFixed(1)} %)  ${ok ? "PASS" : "FAIL"}`);
    }
    log(failures === 0 ? "ALL CHECKS PASS" : `${failures} CHECK(S) FAILED`);
  } catch (error) {
    report(error);
  }
});
