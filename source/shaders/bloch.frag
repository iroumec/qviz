uniform vec3 iResolution;
uniform float iTime;

// The look of the sphere, set from `source/frontend/js/scene.js` (the "Vista" panel).
// The colours come from a palette; the gains scale the glow of the shell and of
// the state vector; `uDetail` is 0 for the outline only, 1 for the shell and the
// great circles, 2 for everything; `uMotion` and `uHalo` are 0 or 1.
uniform vec3 uAxisX;
uniform vec3 uAxisY;
uniform vec3 uAxisZ;
uniform vec3 uVecColor;
uniform vec3 uTipColor;
uniform vec3 uSphereColor;
uniform vec3 uLinesColor;
uniform vec3 uDotsStart;
uniform vec3 uDotsEnd;
uniform vec3 uSweepAzimuth;
uniform vec3 uSweepPolar;
uniform float uSphereGain;
uniform float uVectorGain;
uniform float uVectorWidth;
uniform float uDetail;
uniform float uMotion;
uniform float uHalo;

varying vec3 vWorldPos;
varying vec3 vInstancePos;
varying vec3 vPsi;
varying float vEntangled;
varying float vDecoherence;

#define MAX_STEPS 64
#define MAX_DIST 4.5
#define SURF_DIST 0.001
#define PI 3.14159265359

// The specular edge is the colour of the sphere, lightened.
const float SPECULAR_LIGHTEN = 0.4;

// The halo of an entangled ion, in the entangler colour (neon orange).
const vec3 COLOR_HALO = vec3(1.0, 0.5, 0.1);

const float INTENSITY_AXIS = 0.0008;
const float INTENSITY_STATE_VEC = 0.0025;
const float INTENSITY_STATE_TIP = 0.0045;
const float INTENSITY_SPHERE = 0.0003;
const float INTENSITY_SPECULAR = 0.001;
const float INTENSITY_LINES = 0.0007;
const float INTENSITY_DOTS = 0.0015;
const float INTENSITY_SWEEP_AZIMUTH = 0.00015;
const float INTENSITY_SWEEP_POLAR = 0.00015;
const float INTENSITY_HALO = 0.0005;

// The speed of the synchronized halo of an entangled ion.
const float HALO_SPEED = 5.0;

const float RADIUS_SPHERE = 1.0;
const float RADIUS_SWEEP_AZIMUTH = 0.45;
const float RADIUS_SWEEP_POLAR = 0.45;
const float THICKNESS_SPHERE = 0.002;
const float THICKNESS_LINES = 0.003;
const float THICKNESS_AXIS = 0.002;
const float THICKNESS_SWEEPS = 0.001;
const float LENGTH_AXIS = 1.25;
const float RADIUS_STATE_VEC = 0.012;
const float RADIUS_STATE_TIP = 0.035;

const float DOTS_SPACING = 16.0;
const float DOTS_THICKNESS = 0.08;

const float VOLUMETRIC_NOISE_BASE = 3.0;

const float BUMP_FREQ = 40.0;
const float BUMP_SPEED = 2.0;
const float BUMP_AMP = 2.0;
const float BUMP_PERTURBATION_WEIGHT = 0.004;

const float FRESNEL_EDGE_POWER = 10.5;
const float FRESNEL_SPECULAR_POWER = 8.5;
const float FRESNEL_SPECULAR_MULT = 1.8;
const float FRESNEL_LINES_BASE = 0.2;

const float EXPOSURE = 1.6;
const float RAY_ADVANCE = 0.85;

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 ab = b - a;
    vec3 ap = p - a;
    float t = clamp(dot(ab, ap) / dot(ab, ab), 0.0, 1.0);
    return length(p - (a + t * ab)) - r;
}

float sdPie(vec2 p, vec2 c, float r) {
    p.x = abs(p.x);
    float l = length(p) - r;
    float m = length(p - c * clamp(dot(p, c), 0.0, r));
    return max(l, m * sign(c.y * p.x - c.x * p.y));
}

float sdAzimuthSector(vec3 p, float angle, float r, float h) {
    float halfA = angle * 0.5;
    vec2 p2 = rot(-halfA) * vec2(p.x, p.z);
    p2.y = abs(p2.y);
    vec2 dir = vec2(cos(halfA), sin(halfA));
    float l = length(p2) - r;
    float m = length(p2 - dir * clamp(dot(p2, dir), 0.0, r));
    float d2 = max(l, m * sign(dir.x * p2.y - dir.y * p2.x));
    vec2 w = vec2(d2, abs(p.y) - h);
    return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}

void main() {
    vec3 ro = vWorldPos;
    vec3 rd = normalize(vWorldPos - cameraPosition);

    vec3 glow = vec3(0.0);
    // ``vPsi`` is zero for a fully entangled qubit, and the normalisation of a
    // zero vector is NaN. The normalised direction is used for the sweeps, and
    // the raw vector for the arrow, so that the length r is shown and no NaN
    // appears (a NaN would make the whole sphere disappear).
    float psiLen = length(vPsi);
    vec3 psi = psiLen > 1e-6 ? vPsi / psiLen : vec3(0.0, 1.0, 0.0);

    float anglePsi = atan(psi.z, psi.x);
    if(anglePsi < 0.0) anglePsi += 2.0 * PI;

    float anglePolar = acos(clamp(psi.y, -1.0, 1.0)); 
    float halfPolar = anglePolar * 0.5;
    vec3 vPolar = length(psi.xz) > 0.0001 ? normalize(vec3(psi.x, 0.0, psi.z)) : vec3(1.0, 0.0, 0.0);
    mat2 rotPolar = rot(halfPolar);
    vec2 cPolar = vec2(sin(halfPolar), cos(halfPolar));
    vec3 nPolar = length(psi.xz) > 0.0001 ? normalize(vec3(-psi.z, 0.0, psi.x)) : vec3(0.0, 0.0, -1.0);

    float d0 = 0.0;
    bool hitAxes = false;
    
    float radiusVec = RADIUS_STATE_VEC * uVectorWidth;
    float radiusTip = RADIUS_STATE_TIP * uVectorWidth;
    float gainVec = INTENSITY_STATE_VEC * uVectorGain;
    float gainTip = INTENSITY_STATE_TIP * uVectorGain;

    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = (ro + rd * d0) - vInstancePos;
        
        float xAx = sdCapsule(p, vec3(-LENGTH_AXIS, 0, 0), vec3(LENGTH_AXIS, 0, 0), THICKNESS_AXIS);
        float yAx = sdCapsule(p, vec3(0, -LENGTH_AXIS, 0), vec3(0, LENGTH_AXIS, 0), THICKNESS_AXIS);
        float zAx = sdCapsule(p, vec3(0, 0, -LENGTH_AXIS), vec3(0, 0, LENGTH_AXIS), THICKNESS_AXIS);
        
        float stateVec = psiLen > 1e-6
            ? sdCapsule(p, vec3(0), vPsi, radiusVec)
            : 1e9;
        float stateTip = psiLen > 1e-6
            ? length(p - vPsi) - radiusTip
            : 1e9;

        float d = min(min(xAx, yAx), min(zAx, min(stateVec, stateTip)));

        if(d < SURF_DIST) hitAxes = true;

        glow += uAxisX * (INTENSITY_AXIS / (xAx * xAx + 0.0001));
        glow += uAxisY * (INTENSITY_AXIS / (yAx * yAx + 0.0001));
        glow += uAxisZ * (INTENSITY_AXIS / (zAx * zAx + 0.0001));
        glow += uVecColor * (gainVec / (stateVec * stateVec + 0.0001));
        glow += uTipColor * (gainTip / (stateTip * stateTip + 0.0001));

        d0 += d * RAY_ADVANCE;
        if(d0 > MAX_DIST) break;
    }

    d0 = 0.0;
    bool hitSweeps = false;

    // The sweeps are drawn only at the full level of detail.
    for(int i = 0; i < MAX_STEPS; i++) {
        if (uDetail < 1.5) break;
        vec3 p = (ro + rd * d0) - vInstancePos;
        
        float sweepAzimuth = sdAzimuthSector(p, (anglePsi + PI * 2.0) * -1.0, RADIUS_SPHERE * RADIUS_SWEEP_AZIMUTH, THICKNESS_SWEEPS);

        vec2 p2dPolar = vec2(dot(p, -vPolar), p.y);
        vec2 pRotPolar = rotPolar * p2dPolar;
        float sweepPolar2D = sdPie(pRotPolar, cPolar, RADIUS_SPHERE * RADIUS_SWEEP_POLAR);
        vec2 wPolar = vec2(sweepPolar2D, abs(dot(p, nPolar)) - THICKNESS_SWEEPS);
        float sweepPolar = min(max(wPolar.x, wPolar.y), 0.0) + length(max(wPolar, 0.0));

        float d = min(sweepAzimuth, sweepPolar);
        d = max(d, 0.0002); 

        if(d < SURF_DIST) hitSweeps = true;

        glow += uSweepAzimuth * (INTENSITY_SWEEP_AZIMUTH * uSphereGain / (max(sweepAzimuth, 0.0) * max(sweepAzimuth, 0.0) + 0.0001));
        glow += uSweepPolar * (INTENSITY_SWEEP_POLAR * uSphereGain / (max(sweepPolar, 0.0) * max(sweepPolar, 0.0) + 0.0001));

        d0 += d * RAY_ADVANCE;
        if(d0 > MAX_DIST) break;
    }

    d0 = 0.0;
    bool hitSphere = false;

    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = (ro + rd * d0) - vInstancePos;
        
        float distToCenter = length(p);
        
        float theta = atan(p.z, p.x);
        float phi = asin(p.y / (distToCenter + 0.0001));
        
        float bumpTime = iTime * BUMP_SPEED * uMotion;
        float bumps = sin(theta * BUMP_FREQ + bumpTime) * cos(phi * BUMP_FREQ + bumpTime) * BUMP_AMP;
        float radiusPerturbation = bumps * BUMP_PERTURBATION_WEIGHT; 
        
        float sphereRadius = RADIUS_SPHERE + radiusPerturbation;
        float sphere = abs(distToCenter - sphereRadius) - THICKNESS_SPHERE;

        if(sphere < SURF_DIST) hitSphere = true;

        vec3 normal = normalize(p);
        vec3 viewDir = -rd; 
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        
        float edgeOpacity = pow(fresnel, FRESNEL_EDGE_POWER);
        float specularEdge = pow(fresnel, FRESNEL_SPECULAR_POWER) * FRESNEL_SPECULAR_MULT;
        float volumetricNoise = VOLUMETRIC_NOISE_BASE;

        glow += uSphereColor * (INTENSITY_SPHERE * uSphereGain / (sphere * sphere + 0.0001)) * edgeOpacity * volumetricNoise;
        glow += mix(uSphereColor, vec3(1.0), SPECULAR_LIGHTEN) * (INTENSITY_SPECULAR * uSphereGain / (sphere * sphere + 0.00005)) * specularEdge;

        // An entangled ion carries a halo that pulses with the others of its
        // pair (they share the time, so the two pulses are in step).
        if (vEntangled > 0.5 && uHalo > 0.5) {
            float halo = uMotion > 0.5 ? 0.5 + 0.5 * sin(iTime * HALO_SPEED) : 1.0;
            glow += COLOR_HALO * (INTENSITY_HALO / (sphere * sphere + 0.0001)) * edgeOpacity * halo;
        }
        
        d0 += sphere * RAY_ADVANCE;
        if(d0 > MAX_DIST) break;
    }

    d0 = 0.0;
    bool hitLines = false;

    // The great circles and the dots are not drawn in the outline.
    for(int i = 0; i < MAX_STEPS; i++) {
        if (uDetail < 0.5) break;
        vec3 p = (ro + rd * d0) - vInstancePos;
        
        float baseSphere = abs(length(p) - RADIUS_SPHERE) - THICKNESS_SPHERE;
        float equator = max(baseSphere, abs(p.y) - THICKNESS_LINES);
        float meridianX = max(baseSphere, abs(p.x) - THICKNESS_LINES);
        float meridianZ = max(baseSphere, abs(p.z) - THICKNESS_LINES);
        
        vec3 pDots = fract(p * DOTS_SPACING) - 0.5;
        float dotsGrid = (length(pDots) - DOTS_THICKNESS) / DOTS_SPACING;
        float dots = max(baseSphere, dotsGrid);

        float d = uDetail > 1.5
            ? min(min(equator, min(meridianX, meridianZ)), dots)
            : min(equator, min(meridianX, meridianZ));
        
        if(d < SURF_DIST) hitLines = true;

        vec3 normal = normalize(p);
        vec3 viewDir = -rd; 
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        float edgeOpacity = pow(fresnel, FRESNEL_EDGE_POWER);

        glow += uLinesColor * (INTENSITY_LINES * uSphereGain / (equator * equator + 0.0001)) * (FRESNEL_LINES_BASE + edgeOpacity);
        glow += uLinesColor * (INTENSITY_LINES * uSphereGain / (meridianX * meridianX + 0.0001)) * (FRESNEL_LINES_BASE + edgeOpacity);
        glow += uLinesColor * (INTENSITY_LINES * uSphereGain / (meridianZ * meridianZ + 0.0001)) * (FRESNEL_LINES_BASE + edgeOpacity);
        
        float gradientFactor = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 colorDotsGradient = mix(uDotsStart, uDotsEnd, gradientFactor);
        float dotsGain = uDetail > 1.5 ? INTENSITY_DOTS * uSphereGain : 0.0;
        glow += colorDotsGradient * (dotsGain / (dots * dots + 0.0001)) * (FRESNEL_LINES_BASE + edgeOpacity);

        d0 += d * RAY_ADVANCE;
        if(d0 > MAX_DIST) break;
    }

    if(!hitAxes && !hitSweeps && !hitSphere && !hitLines) discard;

    vec3 rawCol = glow * 0.02;
    vec3 finalCol = 1.0 - exp(-rawCol * EXPOSURE);

    // A qubit that has been idle for a while accumulates error, so its colour
    // shifts towards red (the decoherence heat).
    finalCol *= vec3(1.0, 1.0 - 0.85 * vDecoherence, 1.0 - 0.85 * vDecoherence);

    float glowMag = length(glow * 0.02);
    float alpha = clamp(glowMag * 15.0, 0.0, 1.0);

    gl_FragColor = vec4(finalCol, alpha);
}