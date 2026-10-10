// The controls of the viewer: the buttons, the slider, and the loading of a
// circuit file (OpenQASM) with the button or by dropping it.

import { state } from "./state.js";
import { setError } from "./utils.js";
import { loadCircuitFile, loadFile, updateStep } from "./data.js";
import { runMeasurement } from "./panels.js";

function startPlay() {
  if (!state.data) return;
  state.playing = true;
  document.getElementById("play").textContent = "Pausa";
  state.playTimer = setInterval(() => {
    if (state.stepIndex >= state.data.steps.length) {
      stopPlay();
      return;
    }
    updateStep(state.stepIndex + 1);
  }, 700);
}

function stopPlay() {
  state.playing = false;
  document.getElementById("play").textContent = "Play";
  clearInterval(state.playTimer);
}

function readFile(file) {
  if (!file) return;
  stopPlay();
  loadCircuitFile(file);
}

export function initControls() {
  document.getElementById("file").addEventListener("change", (event) => {
    readFile(event.target.files[0]);
    event.target.value = "";
  });
  document.getElementById("fileSelect").addEventListener("change", (event) => {
    stopPlay();
    loadFile(event.target.value).catch((error) => {
      setError("No se pudo cargar " + error.message);
    });
  });
  document.getElementById("prev").addEventListener("click", () => {
    stopPlay();
    updateStep(state.stepIndex - 1);
  });
  document.getElementById("next").addEventListener("click", () => {
    stopPlay();
    updateStep(state.stepIndex + 1);
  });
  document.getElementById("play").addEventListener("click", () => {
    state.playing ? stopPlay() : startPlay();
  });
  document.getElementById("slider").addEventListener("input", (event) => {
    stopPlay();
    updateStep(Number(event.target.value));
  });
  document.getElementById("measure").addEventListener("click", runMeasurement);

  document.addEventListener("dragover", (event) => {
    event.preventDefault();
    document.body.classList.add("drop");
  });
  document.addEventListener("dragleave", () => document.body.classList.remove("drop"));
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    document.body.classList.remove("drop");
    readFile(event.dataTransfer.files[0]);
  });
}
