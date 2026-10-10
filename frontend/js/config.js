// Configuration of the viewer: the sizes, the URLs of the resources, and the
// hooks that a host page may define before the viewer runs.
//
// A host page may define `window.QVIZ_HOST`; every field is optional. Without a
// host, the viewer fetches the shaders and the JSON over HTTP and samples the
// measurement itself.
//   shaders  {vert, frag, lensVert, lensFrag}  shader sources
//   circuits [{file, label}]                   what the selector lists
//   load     async (file) -> object            the JSON of a selector entry
//   sample   async (data, step, shots) -> [[bitstring, count], ...]

export const HOST = window.QVIZ_HOST || {};

export const BOX = 2.6;
export const SPACING = 3.0;

export const VERT_URL = "../shaders/bloch.vert";
export const FRAG_URL = "../shaders/bloch.frag";
export const LENS_VERT_URL = "../shaders/lens.vert";
export const LENS_FRAG_URL = "../shaders/lens.frag";

export const MANIFEST_URL = "../out/manifest.json";
export const OUT_URL = "../out/";

export const OBJ_URL = "../models/laser_lens.obj";
export const MTL_URL = "../models/laser_lens.mtl";
