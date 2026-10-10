// Load the laser model and its materials. If the model or its MTL file cannot be
// read, a warning is logged and the viewer continues without the laser meshes.

import * as THREE from "three";
import { BufferGeometryUtils, OBJLoader } from "./three-addons.js";
import {
  HOST,
  MTL_URL,
  OBJ_URL,
  LASER_BOX,
  LASER_MIN_Y,
  LASER_MAX_Y,
  LASER_PULSE_SPEED,
} from "./config.js";
import { state } from "./state.js";

/** Map every material name of the MTL file to plastic, metal or laser. */
function parseMaterialDictionary(mtlText) {
  const dictionary = {};
  let currentName = "";
  for (const rawLine of mtlText.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("newmtl ")) {
      currentName = line.substring(7).trim();
    } else if (line.startsWith("map_Kd ")) {
      const texture = line.substring(7).toLowerCase();
      if (texture.includes("plastic")) dictionary[currentName] = "plastic";
      else if (texture.includes("metal")) dictionary[currentName] = "metal";
      else if (texture.includes("laser")) dictionary[currentName] = "laser";
    }
  }
  return dictionary;
}

/** Build the three materials used by the meshes of the laser. */
function buildMaterials() {
  state.laser.plasticMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111, roughness: 0.5, metalness: 0.3, flatShading: false,
  });
  state.laser.metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.3, metalness: 1.0, envMapIntensity: 2.0,
    flatShading: false,
  });
  state.laser.customLensMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uLightPos: { value: state.laser.movingLight.position },
      uLocalCenter: { value: new THREE.Vector3() },
    },
    vertexShader: state.shaders.lensVert,
    fragmentShader: state.shaders.lensFrag,
    transparent: true,
    depthWrite: false,
  });
}

/** Give one mesh the material that its name asks for. */
function prepareMesh(mesh, dictionary) {
  mesh.geometry.deleteAttribute("uv");
  mesh.geometry.deleteAttribute("normal");
  mesh.geometry = BufferGeometryUtils.mergeVertices(mesh.geometry, 1e-4);
  mesh.geometry.computeVertexNormals();

  const kind = dictionary[mesh.material.name.trim()];
  if (kind === "laser") {
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getCenter(
      state.laser.customLensMaterial.uniforms.uLocalCenter.value
    );
    mesh.material = state.laser.customLensMaterial;
  } else if (kind === "metal") {
    mesh.geometry = BufferGeometryUtils.toCreasedNormals(mesh.geometry, Math.PI / 2.0);
    mesh.material = state.laser.metalMaterial;
  } else {
    mesh.geometry = BufferGeometryUtils.toCreasedNormals(mesh.geometry, Math.PI / 6.0);
    mesh.material = state.laser.plasticMaterial;
  }
}

export async function loadLaserModel() {
  buildMaterials();
  try {
    // The host gives the model as text; on its own the viewer reads the files.
    const mtlText = HOST.laser ? HOST.laser.mtl : await (await fetch(MTL_URL)).text();
    const dictionary = parseMaterialDictionary(mtlText);
    const loader = new OBJLoader();
    const template = HOST.laser
      ? loader.parse(HOST.laser.obj)
      : await new Promise((resolve, reject) => {
          loader.load(OBJ_URL, resolve, undefined, reject);
        });
    template.scale.set(0.25, 0.25, 0.25);
    template.traverse((child) => {
      if (child.isMesh && child.material) prepareMesh(child, dictionary);
    });
    state.laser.template = template;
  } catch (error) {
    console.warn(
      "No se pudo leer el modelo de láser o su MTL (ignorando instancia visual).",
      error
    );
  }
}

/**
 * The colour of the laser, from the trapped-ion species of the backend.
 *
 * Ytterbium (Aria, Harmony) is simulated as neon magenta, barium (Forte) as
 * green, and anything else (unknown, or a backend without a species) as an
 * ultraviolet violet.
 */
export function laserColorFor(backend) {
  const name = String(backend || "").toLowerCase();
  if (name.includes("forte")) return new THREE.Color(0.1, 1.0, 0.2);
  if (name.includes("aria") || name.includes("harmony")) {
    return new THREE.Color(0.8, 0.1, 1.0);
  }
  return new THREE.Color(0.5, 0.0, 0.8);
}

/**
 * Build the volumetric laser beams as one instanced mesh, one box per ion.
 *
 * The box spans the segment between the ion (``LASER_MIN_Y``) and the lens
 * (``LASER_MAX_Y``); the instances are placed by the caller, with the same
 * ``dummy.matrix`` that places the Bloch spheres. Each instance carries its own
 * intensity in the ``instanceActive`` attribute, so a beam is shown only while
 * its ion is fired (see ``scene.js``). ``null`` is returned when the host did
 * not provide the laser shaders, so the viewer still runs.
 */
export function createLaserBeams(n) {
  if (!state.shaders.laserVert || !state.shaders.laserFrag) return null;

  const height = LASER_MAX_Y - LASER_MIN_Y;
  const geometry = new THREE.BoxGeometry(LASER_BOX, height, LASER_BOX);
  geometry.translate(0, LASER_MIN_Y + height / 2, 0);
  geometry.setAttribute(
    "instanceActive",
    new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
  );

  const material = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      uLaserColor: { value: laserColorFor(state.data ? state.data.backend : "") },
      uPulseSpeed: { value: LASER_PULSE_SPEED },
      uLaserMinY: { value: LASER_MIN_Y },
      uLaserMaxY: { value: LASER_MAX_Y },
      uLaserActive: { value: 1.0 },
    },
    vertexShader: state.shaders.laserVert,
    fragmentShader: state.shaders.laserFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, n);
  mesh.frustumCulled = false;
  return mesh;
}
