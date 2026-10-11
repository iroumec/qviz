// Load the shader sources into the state. They come from the host when it
// provides them, or from the shaders/ folder over HTTP otherwise.

import {
  HOST,
  VERT_URL,
  FRAG_URL,
  LENS_VERT_URL,
  LENS_FRAG_URL,
  LASER_VERT_URL,
  LASER_FRAG_URL,
  BUS_VERT_URL,
  BUS_FRAG_URL,
  RAIL_VERT_URL,
  RAIL_FRAG_URL,
} from "./config.js";
import { state } from "./state.js";

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url);
  return response.text();
}

export async function loadShaders() {
  if (HOST.shaders) {
    state.shaders = {
      vert: HOST.shaders.vert,
      frag: HOST.shaders.frag,
      lensVert: HOST.shaders.lensVert,
      lensFrag: HOST.shaders.lensFrag,
      laserVert: HOST.shaders.laserVert,
      laserFrag: HOST.shaders.laserFrag,
      busVert: HOST.shaders.busVert,
      busFrag: HOST.shaders.busFrag,
      railVert: HOST.shaders.railVert,
      railFrag: HOST.shaders.railFrag,
    };
    return;
  }
  const sources = await Promise.all([
    fetchText(VERT_URL),
    fetchText(FRAG_URL),
    fetchText(LENS_VERT_URL),
    fetchText(LENS_FRAG_URL),
    fetchText(LASER_VERT_URL),
    fetchText(LASER_FRAG_URL),
    fetchText(BUS_VERT_URL),
    fetchText(BUS_FRAG_URL),
    fetchText(RAIL_VERT_URL),
    fetchText(RAIL_FRAG_URL),
  ]);
  const [vert, frag, lensVert, lensFrag, laserVert, laserFrag, busVert, busFrag, railVert, railFrag] =
    sources;
  state.shaders = {
    vert, frag, lensVert, lensFrag, laserVert, laserFrag, busVert, busFrag, railVert, railFrag,
  };
}
