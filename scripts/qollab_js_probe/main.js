// QViz probe for a Qollab JS project. Copy index.html and main.js to the root of
// a project that also has backend/, examples/, qollab_api.py and requirements.txt
// (and NO main.py). See documentation/prompts/qollab_pruebas.md.
import * as api from "qollab_api";

const $ = (id) => document.getElementById(id);
const log = (line) => { $("log").textContent += line + "\n"; };
const ms = (start) => `${(performance.now() - start).toFixed(0)} ms`;

let text = null;   // the exported JSON, as a string
let total = 0;     // number of steps
let calls = 0;     // how many clicks reached Python after the first run

function report(error) {
  log(`ERROR  ${error && error.message ? error.message : error}`);
  $("status").textContent = "Error: see the log";
}

try {
  log(`module "qollab_api" imported; exports: ${Object.keys(api).join(", ")}`);
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
    const data = JSON.parse(text);
    total = data.steps.length;
    log(`COMPILE ok in ${ms(start)}: ${data.backend}`);
    log(`        ${data.total_qubits} qubits, ${total} steps, ${(text.length / 1000).toFixed(0)} kB, typeof result: ${typeof text}`);
    $("measure").disabled = false;
    $("status").textContent = "Compiled. Press 2. Measure as many times as you want.";
  } catch (error) {
    report(error);
  }
});

$("measure").addEventListener("click", async () => {
  try {
    const start = performance.now();
    const step = Number($("step").value) || total;
    const shots = Number($("shots").value);
    const reply = await api.sample_step.callPromising(text, step, shots);
    const pairs = JSON.parse(reply);   // [[bitstring, count], ...], most frequent first
    const counts = Object.fromEntries(pairs);
    calls += 1;
    log(`MEASURE #${calls} ok in ${ms(start)}: step ${step}, ${shots} shots, typeof result: ${typeof reply}`);
    for (const [bits, n] of pairs.slice(0, 8)) {
      log(`  ${bits}  ${String(n).padStart(6)}  ${(100 * n / shots).toFixed(1).padStart(5)} %`);
    }
    if ($("circuit").value === "bell" && step === total) {
      const wrong = (counts["01"] || 0) + (counts["10"] || 0);
      const verdict = wrong / shots < 0.05 ? "PASS" : "FAIL";
      log(`  ${verdict}: Bell gives 00 and 11 (01 and 10 are only ${(100 * wrong / shots).toFixed(1)} %)`);
    }
  } catch (error) {
    report(error);
  }
});
