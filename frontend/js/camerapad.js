// The on-screen camera buttons: rotate, tilt, zoom and center. They work with the
// pointer (hold to keep moving), with the touch screen and with the keyboard
// (Enter or Space), so the camera can be moved without the letter keys.

import { holdCamera, resetCamera } from "./scene.js";
import { isEnglish } from "./utils.js";

const LABELS = isEnglish()
  ? {
      rotateLeft: "Rotate left", rotateRight: "Rotate right", tiltUp: "Tilt up",
      tiltDown: "Tilt down", zoomIn: "Zoom in", zoomOut: "Zoom out",
      reset: "Center the camera", group: "Camera",
    }
  : {
      rotateLeft: "Girar a la izquierda", rotateRight: "Girar a la derecha",
      tiltUp: "Subir la vista", tiltDown: "Bajar la vista", zoomIn: "Acercar",
      zoomOut: "Alejar", reset: "Centrar la cámara", group: "Cámara",
    };

/** Wire the buttons of the camera pad and give them their text. */
export function initCameraPad() {
  const pad = document.getElementById("cameraPad");
  if (!pad) return;
  pad.setAttribute("aria-label", LABELS.group);

  for (const button of pad.querySelectorAll("[data-cam]")) {
    const action = button.getAttribute("data-cam");
    button.setAttribute("aria-label", LABELS[action]);
    button.title = LABELS[action];

    if (action === "reset") {
      button.addEventListener("click", resetCamera);
      continue;
    }
    const release = () => holdCamera(action, false);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      holdCamera(action, true);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      holdCamera(action, true);
    });
    button.addEventListener("keyup", (event) => {
      if (event.key === "Enter" || event.key === " ") release();
    });
    button.addEventListener("blur", release);
  }
}
