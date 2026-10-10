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

varying vec3 vWorldPosition;
varying vec3 vInstancePos;
varying float vInstanceActive;

const float LASER_RADIUS = 0.02;
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

    float t = 0.0;
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

        if (t > 15.0) break;
    }

    vec3 baseColor = uLaserColor * glow;
    vec3 coreColor = vec3(1.0, 0.8, 0.8) * pow(glow * CORE_INTENSITY, 2.0);

    vec3 finalColor = (baseColor + coreColor) * intensity;

    gl_FragColor = vec4(finalColor, min(glow * intensity, 1.0));
}
