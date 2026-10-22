// Volumetric laser beam (raymarching). The box of `laser.vert` is the bounding
// volume; the beam is the set of points whose horizontal distance to the axis
// is below a radius. `vInstancePos` shifts the ray into the local frame of the
// ion, so one instanced mesh draws every beam.
//
// The values to calibrate by hand are `LASER_RADIUS` (the width of the beam)
// and `ENERGY_AMPLITUDE` (the deformation of its edge). `uLaserMinY` and
// `uLaserMaxY` (set from JavaScript) cut the beam between the ion and the lens.

uniform float iTime;
uniform vec3 uLaserColor;
uniform float uPulseSpeed;
uniform float uLaserMinY;
uniform float uLaserMaxY;
uniform float uLaserActive;
// The brightness of the beam, from the "Vista" panel (1 is the default).
uniform float uLaserGain;

varying vec3 vWorldPosition;
varying vec3 vInstancePos;
varying float vInstanceActive;

const float LASER_RADIUS = 0.02;
// The beam and its glow fit inside this cylinder. A ray that misses it cannot
// contribute, so the march starts at the near intersection (or discards it).
const float BOUND_RADIUS = 0.25;
const float ENERGY_FREQ = 0.0;
const float ENERGY_SPEED = 100.0;
const float ENERGY_AMPLITUDE = 0.05;
const int MAX_STEPS = 80;
const float GLOW_INTENSITY = 0.002;
const float GLOW_SHARPNESS = 0.01;
const float CORE_INTENSITY = 0.15;

float map(vec3 p) {
    float pulse = sin(iTime * uPulseSpeed) * 0.5 + 0.5;
    float energy = sin(p.y * ENERGY_FREQ + iTime * ENERGY_SPEED) * ENERGY_AMPLITUDE;
    float r = LASER_RADIUS + energy * pulse;
    return length(p.xz) - r;
}

void main() {
    float intensity = uLaserActive * vInstanceActive;
    if (intensity <= 0.0) discard;

    vec3 ro = vWorldPosition;
    vec3 rd = normalize(vWorldPosition - cameraPosition);

    // Bounding cylinder around the beam, in the local frame of the ion.
    vec3 oc = ro - vInstancePos;
    vec2 oxz = oc.xz;
    vec2 dxz = rd.xz;
    float a = dot(dxz, dxz);
    float b = 2.0 * dot(oxz, dxz);
    float c = dot(oxz, oxz) - BOUND_RADIUS * BOUND_RADIUS;
    float tNear = 0.0;
    float tFar = 15.0;
    if (a > 1e-6) {
        float disc = b * b - 4.0 * a * c;
        if (disc < 0.0) discard;
        float sqrtDisc = sqrt(disc);
        tNear = max(0.0, (-b - sqrtDisc) / (2.0 * a));
        tFar = (-b + sqrtDisc) / (2.0 * a);
        if (tFar < 0.0) discard;
    } else if (c > 0.0) {
        discard;
    }

    // Clip the cylinder by the height of the beam, with a margin for the glow.
    if (abs(rd.y) > 1e-6) {
        float y0 = oc.y;
        float t0 = (uLaserMinY - 0.1 - y0) / rd.y;
        float t1 = (uLaserMaxY + 0.1 - y0) / rd.y;
        tNear = max(tNear, min(t0, t1));
        tFar = min(tFar, max(t0, t1));
    }
    if (tNear > tFar) discard;

    float t = tNear;
    float rayLimit = min(15.0, tFar + 0.05);
    float glow = 0.0;

    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t - vInstancePos;

        if (p.y > uLaserMaxY) {
            t += 0.05;
            continue;
        }
        if (p.y < uLaserMinY) {
            break;
        }

        float d = map(p);
        float verticalFade = smoothstep(uLaserMinY, uLaserMinY + 0.4, p.y);

        glow += GLOW_INTENSITY / (GLOW_SHARPNESS + d * d) * verticalFade;

        t += max(abs(d) * 0.5, 0.01);

        if (t > rayLimit) break;
    }

    vec3 baseColor = uLaserColor * glow;
    vec3 coreColor = vec3(1.0, 0.8, 0.8) * pow(glow * CORE_INTENSITY, 2.0);

    vec3 finalColor = (baseColor + coreColor) * intensity * uLaserGain;

    gl_FragColor = vec4(finalColor, min(glow * intensity * uLaserGain, 1.0));
}
