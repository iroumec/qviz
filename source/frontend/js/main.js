// The entry point of the viewer. It reads the view options, wires the controls,
// builds the scene and loads the first visualization.

import { initCameraPad } from "./camerapad.js";
import { canCompile } from "./host.js";
import { initControls } from "./controls.js";
import { loadManifest, setCompileAvailable } from "./data.js";
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
  // The probe is not awaited: it only disables the load button when the page
  // has no Python, and it must not delay the first circuit.
  canCompile().then(setCompileAvailable);
  await loadManifest();
})();
