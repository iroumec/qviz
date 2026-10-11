// How a Bloch vector travels from one step to the next. A single-qubit gate is a
// rotation, so the vector must move along the surface of the sphere and keep its
// length; a straight line between the two ends would cross the inside of the
// ball and make a pure state look mixed (or entangled) half way. The two-qubit
// gates do change the length, so there the length is blended and the direction
// is turned along the shortest arc. All the vectors are in Bloch coordinates
// (x, y, z); the mapping to the screen is done by the scene.

const EPSILON = 1e-9;

/** The vector ``v`` rotated by ``angle`` radians about the unit ``axis`` (Rodrigues). */
export function rotateAbout(v, axis, angle) {
  const [x, y, z] = axis;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = x * v[0] + y * v[1] + z * v[2];
  const cross = [y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0]];
  return [
    v[0] * cos + cross[0] * sin + x * dot * (1 - cos),
    v[1] * cos + cross[1] * sin + y * dot * (1 - cos),
    v[2] * cos + cross[2] * sin + z * dot * (1 - cos),
  ];
}

function length(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

/**
 * The rotation that a native single-qubit operation applies to the Bloch
 * vector, as ``{axis, angle}``, or ``null`` for any other operation.
 *
 * GPI(phi) is a half turn and GPI2(phi) a quarter turn about the equatorial axis
 * (cos phi, sin phi, 0); the VirtualZ turns about z by ``zAngle`` radians.
 */
export function gateRotation(operation, phases, zAngle) {
  if (operation === "gpi" && phases && phases.length) {
    return { axis: [Math.cos(phases[0]), Math.sin(phases[0]), 0], angle: Math.PI };
  }
  if (operation === "gpi2" && phases && phases.length) {
    return { axis: [Math.cos(phases[0]), Math.sin(phases[0]), 0], angle: Math.PI / 2 };
  }
  if (operation === "virtual_z") return { axis: [0, 0, 1], angle: zAngle || 0 };
  return null;
}

/** The angle in (-pi, pi] that is equivalent to ``angle``. */
export function wrapAngle(angle) {
  const turn = 2 * Math.PI;
  let wrapped = angle % turn;
  if (wrapped > Math.PI) wrapped -= turn;
  if (wrapped <= -Math.PI) wrapped += turn;
  return wrapped;
}

/**
 * The movement from ``from`` to ``to`` as an object that ``animatedVector``
 * reads. With a ``rotation`` that really takes ``from`` to ``to`` the vector
 * turns about its axis; otherwise it blends the length and swings the direction
 * along the shortest arc (a straight line when one end has no direction).
 */
export function makeMotion(from, to, rotation, start, ms) {
  const motion = { from: from.slice(), to: to.slice(), start, ms };
  if (rotation) {
    const end = rotateAbout(from, rotation.axis, rotation.angle);
    if (Math.hypot(end[0] - to[0], end[1] - to[1], end[2] - to[2]) < 1e-3) {
      motion.rotation = rotation;
    }
  }
  return motion;
}

/** The vector of a motion at ``time`` (ms), and whether it is still moving. */
export function animatedVector(motion, time) {
  const progress = motion.ms > 0 ? Math.min(1, Math.max(0, (time - motion.start) / motion.ms)) : 1;
  if (progress >= 1) return { vector: motion.to.slice(), moving: false };
  const eased = progress * progress * (3 - 2 * progress);
  const { from, to } = motion;

  if (motion.rotation) {
    return {
      vector: rotateAbout(from, motion.rotation.axis, motion.rotation.angle * eased),
      moving: true,
    };
  }

  const fromLength = length(from);
  const toLength = length(to);
  const blended = fromLength + (toLength - fromLength) * eased;
  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
  const cos = fromLength > EPSILON && toLength > EPSILON ? dot / (fromLength * toLength) : 2;
  // Without two directions, or with them opposite (no single arc), the straight
  // line is the only choice.
  if (cos > 1 || cos < -1 + 1e-6) {
    return {
      vector: from.map((value, axis) => value + (to[axis] - value) * eased),
      moving: true,
    };
  }
  const angle = Math.acos(Math.min(1, cos));
  if (angle < 1e-6) {
    return { vector: from.map((value) => (value / fromLength) * blended), moving: true };
  }
  const sinAngle = Math.sin(angle);
  const a = Math.sin((1 - eased) * angle) / sinAngle;
  const b = Math.sin(eased * angle) / sinAngle;
  return {
    vector: from.map((value, axis) =>
      ((a * value) / fromLength + (b * to[axis]) / toLength) * blended
    ),
    moving: true,
  };
}
