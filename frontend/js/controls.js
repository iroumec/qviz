// The controls of the viewer: the buttons, the slider, and the drag and drop of
// a JSON file.

import { state } from "./state.js";
import { setError } from "./utils.js";
import { loadFile, loadFromText, updateStep } from "./data.js";
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
  if (file) file.text().then(loadFromText);
}

export function initControls() {
  document.getElementById("file").addEventListener("change", (event) => {
    readFile(event.target.files[0]);
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
