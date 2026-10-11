// The entry point of the viewer. It reads the view options, wires the controls,
// builds the scene and loads the first visualization.

import { initCameraPad } from "./camerapad.js";
import { initControls } from "./controls.js";
import { loadManifest } from "./data.js";
import { initPanels } from "./panels.js";
import { animate, applyViewToScene, initThree } from "./scene.js";
import { initSettings, subscribe } from "./settings.js";
import { initViewPanel } from "./viewpanel.js";

// The scene follows every change of the view; the panel is wired after the first
// read, so it starts with the values that were saved.
subscribe(applyViewToScene);
initSettings();
initViewPanel();
initControls();
initPanels();
initCameraPad();

(async function start() {
  const ready = await initThree();
  if (ready) requestAnimationFrame(animate);
  await loadManifest();
})();
