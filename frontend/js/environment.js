// The laboratory environment: the ultra-high-vacuum chamber and the optical
// table that hold the trap.
//
// A dark anodised optical breadboard sits below everything, with a grid of
// threaded holes. Two thick copper Helmholtz coils (above and below the trap)
// give the static magnetic field, held by steel posts. Each vertical laser is
// born from a black collimator head. A polished ring frames the scene as the
// vacuum viewport. Fog and a blue ambient give the volume of the chamber.

import * as THREE from "three";
import { SPACING, TABLE_TOP } from "./config.js";

const TABLE_COLOR = 0x0f172a;
const COPPER_COLOR = 0xb87333;
const STEEL_COLOR = 0x94a3b8;
const POST_COLOR = 0x64748b;
const COLLIMATOR_COLOR = 0x18181b;
const GRID_COLOR = 0x1d3a5c;
const GRID_BASE = 0x122036;

const TABLE_HEIGHT = 0.5;
const COIL_TOP_Y = 5.4;
const COIL_BOTTOM_Y = -2.6;
const COIL_TUBE = 0.28;
const POST_RADIUS = 0.1;
const COLLIMATOR_Y = 4.0;

/** Build the chamber environment for a chain of `n` ions. */
export function createEnvironment(n) {
  const group = new THREE.Group();
  const half = ((n - 1) * SPACING) / 2;
  const coilRadius = Math.max(6.5, half + 3);
  const viewportRadius = Math.max(11, half + 7);
  const tableSize = 2 * viewportRadius + 8;

  // The optical breadboard, with its grid of holes.
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(tableSize, TABLE_HEIGHT, tableSize),
    new THREE.MeshStandardMaterial({ color: TABLE_COLOR, roughness: 0.4, metalness: 0.8 })
  );
  table.position.set(0, TABLE_TOP - TABLE_HEIGHT / 2, 0);
  group.add(table);

  const grid = new THREE.GridHelper(tableSize, Math.round(tableSize), GRID_COLOR, GRID_BASE);
  grid.position.set(0, TABLE_TOP + 0.01, 0);
  group.add(grid);

  // The two copper Helmholtz coils.
  const coilGeometry = new THREE.TorusGeometry(coilRadius, COIL_TUBE, 16, 64);
  coilGeometry.rotateX(Math.PI / 2);
  const copper = new THREE.MeshStandardMaterial({ color: COPPER_COLOR, metalness: 0.9, roughness: 0.25 });
  for (const y of [COIL_TOP_Y, COIL_BOTTOM_Y]) {
    const coil = new THREE.Mesh(coilGeometry, copper);
    coil.position.set(0, y, 0);
    group.add(coil);
  }

  // Steel posts at the corners, from the table up to the top coil.
  const postHeight = COIL_TOP_Y - TABLE_TOP;
  const postGeometry = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, postHeight, 12);
  const postMaterial = new THREE.MeshStandardMaterial({ color: POST_COLOR, metalness: 0.95, roughness: 0.15 });
  const offset = coilRadius * 0.72;
  for (const x of [-offset, offset]) {
    for (const z of [-offset, offset]) {
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(x, TABLE_TOP + postHeight / 2, z);
      group.add(post);
    }
  }

  // A black collimator head at the top of every vertical laser.
  const collimatorGeometry = new THREE.CylinderGeometry(0.3, 0.22, 0.8, 16);
  const collimatorMaterial = new THREE.MeshStandardMaterial({
    color: COLLIMATOR_COLOR, metalness: 0.9, roughness: 0.2,
  });
  for (let i = 0; i < n; i++) {
    const head = new THREE.Mesh(collimatorGeometry, collimatorMaterial);
    head.position.set((i - (n - 1) / 2) * SPACING, COLLIMATOR_Y, 0);
    group.add(head);
  }

  // The vacuum viewport frame, an octagonal polished ring around the trap.
  const viewport = new THREE.Mesh(
    new THREE.TorusGeometry(viewportRadius, 0.5, 8, 8),
    new THREE.MeshStandardMaterial({ color: STEEL_COLOR, metalness: 0.95, roughness: 0.1 })
  );
  viewport.geometry.rotateX(Math.PI / 2);
  group.add(viewport);

  // Floor anchors at each bend of the ring, like the supports of an above-ground
  // pool: a post to the table and a collar that embraces the ring tube.
  const anchorMaterial = new THREE.MeshStandardMaterial({ color: POST_COLOR, metalness: 0.95, roughness: 0.15 });
  const anchorGeometry = new THREE.CylinderGeometry(0.16, 0.22, 0.5 - TABLE_TOP, 12);
  const collarGeometry = new THREE.TorusGeometry(0.62, 0.1, 10, 24);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = viewportRadius * Math.cos(angle);
    const z = viewportRadius * Math.sin(angle);

    const post = new THREE.Mesh(anchorGeometry, anchorMaterial);
    post.position.set(x, (TABLE_TOP + 0.5) / 2, z);
    group.add(post);

    const collar = new THREE.Mesh(collarGeometry, anchorMaterial);
    collar.position.set(x, 0, z);
    collar.lookAt(x - Math.sin(angle), 0, z + Math.cos(angle));
    group.add(collar);
  }

  return group;
}

/** Set the fog and the chamber lights on the scene, once. */
export function applyAtmosphere(scene) {
  scene.fog = new THREE.FogExp2(0x0a0e17, 0.011);
  scene.add(new THREE.AmbientLight(0x3a5a7a, 0.9));

  const accent = new THREE.PointLight(0x38bdf8, 40, 45);
  accent.position.set(0, -3, 0);
  scene.add(accent);
}
