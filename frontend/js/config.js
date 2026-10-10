// Configuration of the viewer: the sizes, the URLs of the resources, and the
// hooks that a host page may define before the viewer runs.
//
// A host page may define `window.QVIZ_HOST`; every field is optional. Without a
// host, the viewer fetches the shaders and the JSON over HTTP and samples the
// measurement itself.
//   shaders  {vert, frag, lensVert, lensFrag, laserVert, laserFrag}  shader sources
//   circuits [{file, label}]                   what the selector lists
//   load     async (file) -> object            the JSON of a selector entry
//   sample   async (data, step, shots) -> [[bitstring, count], ...]
//   compileQasm async (text) -> object        compiles a circuit written in OpenQASM;
//            it is how the user loads a circuit
//
// The viewer needs Python for `compileQasm` and `sample`. Without a host that gives
// them, host.js asks the local server of scripts/server.py (`make serverr`).

export const HOST = window.QVIZ_HOST || {};

export const BOX = 2.6;
export const SPACING = 3.0;

export const VERT_URL = "../shaders/bloch.vert";
export const FRAG_URL = "../shaders/bloch.frag";
export const LENS_VERT_URL = "../shaders/lens.vert";
export const LENS_FRAG_URL = "../shaders/lens.frag";
export const LASER_VERT_URL = "../shaders/laser.vert";
export const LASER_FRAG_URL = "../shaders/laser.frag";

// The volumetric laser beam, one instance per ion. The box spans the segment
// between the ion (LASER_MIN_Y) and the lens (LASER_MAX_Y); it is wide enough
// to contain the glow around the thin core. These are the values to calibrate
// by hand so that the beam meets the lens exactly.
//
// The beam is off by default. It is fired only for the target ions of a GPI or
// GPI2 step, for LASER_PULSE_MS, so that the gate is shown as a laser pulse.
export const LASER_MIN_Y = 0.0;
export const LASER_MAX_Y = 2.5;
export const LASER_BOX = 0.6;
export const LASER_PULSE_SPEED = 0.0;
export const LASER_PULSE_MS = 650;

export const MANIFEST_URL = "../out/manifest.json";
export const OUT_URL = "../out/";

export const COMPILE_URL = "../api/compile";
export const SAMPLE_URL = "../api/sample";

export const OBJ_URL = "../models/laser_lens.obj";
export const MTL_URL = "../models/laser_lens.mtl";
