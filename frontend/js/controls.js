// The controls of the viewer: the buttons, the slider, and the loading of a
// circuit file (OpenQASM) with the button or by dropping it.

import { PLAY_INTERVAL_MS, PLAY_MARGIN_MS } from "./config.js";
import { state } from "./state.js";
import { setError } from "./utils.js";
import { loadCircuitFile, loadFile, updateStep } from "./data.js";
import { refreshPlayButton, runMeasurement } from "./panels.js";

// The wait before the next step: the base interval, or the laser pulse of the
// current step (plus a margin) when the gate fires one, so a long MS or ZZ
// pulse is not cut in the middle.
function playDelay() {
  return Math.max(PLAY_INTERVAL_MS, state.pulseMs + PLAY_MARGIN_MS);
}

function schedulePlay() {
  state.playTimer = setTimeout(() => {
    if (!state.playing) return;
    if (state.stepIndex >= state.data.steps.length) {
      stopPlay();
      return;
    }
    updateStep(state.stepIndex + 1);
    schedulePlay();
  }, playDelay());
}

function startPlay() {
  if (!state.data) return;
  state.playing = true;
  refreshPlayButton();
  schedulePlay();
}

function stopPlay() {
  state.playing = false;
  refreshPlayButton();
  clearTimeout(state.playTimer);
}

/** True when the last step has been reached, so nothing is left to resume. */
function isFinished() {
  return Boolean(state.data) && state.stepIndex >= state.data.steps.length;
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
    if (state.playing) {
      stopPlay();
    } else if (isFinished()) {
      updateStep(0);
      startPlay();
    } else {
      startPlay();
    }
  });
  document.getElementById("reset").addEventListener("click", () => {
    stopPlay();
    updateStep(0);
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
