// The three.js addons the viewer needs. Each one is loaded on its own, with a
// fallback, so that the viewer still starts without the laser and the
// environment light when an addon cannot be resolved.

import * as THREE from "three";

async function load(importer, fallback) {
  try {
    return await importer();
  } catch (error) {
    console.warn("QViz: a three.js addon could not be loaded", error);
    return fallback;
  }
}

export const { OBJLoader } = await load(
  () => import("three/addons/loaders/OBJLoader.js"),
  {
    OBJLoader: class {
      load(url, onLoad, onProgress, onError) {
        onError(new Error("OBJLoader is not available"));
      }
      parse() {
        throw new Error("OBJLoader is not available");
      }
    },
  }
);

export const { RoomEnvironment } = await load(
  () => import("three/addons/environments/RoomEnvironment.js"),
  { RoomEnvironment: class extends THREE.Scene { dispose() {} } }
);

export const BufferGeometryUtils = await load(
  () => import("three/addons/utils/BufferGeometryUtils.js"),
  {}
);
