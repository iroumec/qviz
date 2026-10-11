// Configuration of the viewer: the sizes, the URLs of the resources, and the
// hooks that a host page may define before the viewer runs.
//
// A host page may define `window.QVIZ_HOST`; every field is optional. Without a
// host, the viewer fetches the shaders and the JSON over HTTP and samples the
// measurement itself.
//   shaders  {vert, frag, lensVert, lensFrag, laserVert, laserFrag, busVert, busFrag}  shader sources
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

// The speed of the keyboard movement (WASD, space and left control), as a
// fraction of the camera distance per second.
export const MOVE_SPEED = 1.0;

export const VERT_URL = "../shaders/bloch.vert";
export const FRAG_URL = "../shaders/bloch.frag";
export const LENS_VERT_URL = "../shaders/lens.vert";
export const LENS_FRAG_URL = "../shaders/lens.frag";
export const LASER_VERT_URL = "../shaders/laser.vert";
export const LASER_FRAG_URL = "../shaders/laser.frag";
export const BUS_VERT_URL = "../shaders/bus.vert";
export const BUS_FRAG_URL = "../shaders/bus.frag";

// The volumetric laser beam, one instance per ion. The box spans the segment
// between the ion (LASER_MIN_Y) and the lens (LASER_MAX_Y); it is wide enough
// to contain the glow around the thin core. These are the values to calibrate
// by hand so that the beam meets the lens exactly.
//
// The beam is off by default. It is fired only for the target ions of a native
// gate, and only while the step is applied, so that the gate is seen as a laser
// pulse. The length of the pulse depends on the gate: a GPI2 pulse lasts
// LASER_PULSE_MS, a GPI pulse lasts LASER_GPI_FACTOR times that, and the
// two-qubit entanglers (MS and ZZ) last LASER_ENTANGLER_FACTOR times that.
export const LASER_MIN_Y = 0.0;
export const LASER_MAX_Y = 2.5;
export const LASER_BOX = 0.6;
export const LASER_PULSE_SPEED = 0.0;
export const LASER_PULSE_MS = 650;
export const LASER_GPI_FACTOR = 2;
export const LASER_ENTANGLER_FACTOR = 3;

// The colour of the two-qubit entangler laser (MS and ZZ), in linear RGB: a
// neon orange, so a two-qubit gate is told apart from the species colour of the
// single-qubit gates.
export const LASER_ENTANGLER_COLOR = [1.0, 0.5, 0.05];

// The phonon bus: the energy tube that joins the two ions of a two-qubit gate
// while it runs. It passes through the ions in between, because the whole chain
// is one elastic spring.
export const BUS_RADIUS = 0.14;
export const BUS_OPACITY = 0.85;

// The mechanical jiggle of the ions while a two-qubit gate runs. The targets
// swing more than the ions in between (which resonate with the chain), and the
// whole chain settles when the pulse ends.
export const JIGGLE_STRONG = 0.22;
export const JIGGLE_FAINT = 0.08;
export const JIGGLE_SPEED = 0.05;

// The automatic play. It waits at least PLAY_INTERVAL_MS between steps, and
// waits for the laser pulse of the step to finish (plus PLAY_MARGIN_MS) when
// the gate fires one, so a long pulse (MS or ZZ) is never cut in the middle.
export const PLAY_INTERVAL_MS = 700;
export const PLAY_MARGIN_MS = 150;

export const MANIFEST_URL = "../out/manifest.json";
export const OUT_URL = "../out/";

export const COMPILE_URL = "../api/compile";
export const SAMPLE_URL = "../api/sample";

export const OBJ_URL = "../models/laser_lens.obj";
export const MTL_URL = "../models/laser_lens.mtl";
