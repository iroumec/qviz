// The entry point of the viewer. It wires the controls, builds the scene and
// loads the first visualization.

import { initControls } from "./controls.js";
import { loadManifest } from "./data.js";
import { animate, initThree } from "./scene.js";

initControls();

(async function start() {
  const ready = await initThree();
  if (ready) requestAnimationFrame(animate);
  await loadManifest();
})();
