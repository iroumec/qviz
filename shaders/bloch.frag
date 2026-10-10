uniform vec3 iResolution;
uniform float iTime;

varying vec3 vWorldPos;
varying vec3 vInstancePos;
varying vec3 vPsi;

#define MAX_STEPS 64
#define MAX_DIST 4.5
#define SURF_DIST 0.001
#define PI 3.14159265359

const vec3 COLOR_AXIS_X = vec3(1.0, 0.1, 0.1);
const vec3 COLOR_AXIS_Y = vec3(0.1, 1.0, 0.1);
const vec3 COLOR_AXIS_Z = vec3(0.1, 0.4, 1.0);
const vec3 COLOR_STATE_VEC = vec3(0.9, 0.05, 1.0);
const vec3 COLOR_STATE_TIP = vec3(1.0, 0.35, 1.0);
const vec3 COLOR_SPHERE = vec3(0.3, 0.7, 1.0);
const vec3 COLOR_SPECULAR = vec3(0.5, 0.8, 1.0);
const vec3 COLOR_LINES = vec3(0.2, 0.5, 0.9);
const vec3 COLOR_DOTS_START = vec3(0.1, 0.8, 1.0);
const vec3 COLOR_DOTS_END = vec3(1.0, 0.1, 0.6);
const vec3 COLOR_SWEEP_AZIMUTH = vec3(0.1, 0.6, 1.0);
const vec3 COLOR_SWEEP_POLAR = vec3(1.0, 0.7, 0.1);

const float INTENSITY_AXIS = 0.0008;
const float INTENSITY_STATE_VEC = 0.0025;
const float INTENSITY_STATE_TIP = 0.0045;
const float INTENSITY_SPHERE = 0.0003;
const float INTENSITY_SPECULAR = 0.001;
const float INTENSITY_LINES = 0.0007;
const float INTENSITY_DOTS = 0.0015;
const float INTENSITY_SWEEP_AZIMUTH = 0.00015;
const float INTENSITY_SWEEP_POLAR = 0.00015;

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
    // ``vPsi`` may have any length, and it is zero for a fully entangled qubit.
    // The normalised direction is used for the sweeps, and the raw vector is
    // used for the arrow, so that the length r is shown and no NaN appears.
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
    
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = (ro + rd * d0) - vInstancePos;
        
        float xAx = sdCapsule(p, vec3(-LENGTH_AXIS, 0, 0), vec3(LENGTH_AXIS, 0, 0), THICKNESS_AXIS);
        float yAx = sdCapsule(p, vec3(0, -LENGTH_AXIS, 0), vec3(0, LENGTH_AXIS, 0), THICKNESS_AXIS);
        float zAx = sdCapsule(p, vec3(0, 0, -LENGTH_AXIS), vec3(0, 0, LENGTH_AXIS), THICKNESS_AXIS);
        
        float stateVec = psiLen > 1e-6
            ? sdCapsule(p, vec3(0), vPsi, RADIUS_STATE_VEC)
            : 1e9;
        float stateTip = psiLen > 1e-6
            ? length(p - vPsi) - RADIUS_STATE_TIP
            : 1e9;

        float d = min(min(xAx, yAx), min(zAx, min(stateVec, stateTip)));

        if(d < SURF_DIST) hitAxes = true;

        glow += COLOR_AXIS_X * (INTENSITY_AXIS / (xAx * xAx + 0.0001));
        glow += COLOR_AXIS_Y * (INTENSITY_AXIS / (yAx * yAx + 0.0001));
        glow += COLOR_AXIS_Z * (INTENSITY_AXIS / (zAx * zAx + 0.0001));
        glow += COLOR_STATE_VEC * (INTENSITY_STATE_VEC / (stateVec * stateVec + 0.0001));
        glow += COLOR_STATE_TIP * (INTENSITY_STATE_TIP / (stateTip * stateTip + 0.0001));

        d0 += d * RAY_ADVANCE;
        if(d0 > MAX_DIST) break;
    }

    d0 = 0.0;
    bool hitSweeps = false;

    for(int i = 0; i < MAX_STEPS; i++) {
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

        glow += COLOR_SWEEP_AZIMUTH * (INTENSITY_SWEEP_AZIMUTH / (max(sweepAzimuth, 0.0) * max(sweepAzimuth, 0.0) + 0.0001));
        glow += COLOR_SWEEP_POLAR * (INTENSITY_SWEEP_POLAR / (max(sweepPolar, 0.0) * max(sweepPolar, 0.0) + 0.0001));

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
        
        float bumps = sin(theta * BUMP_FREQ + iTime * BUMP_SPEED) * cos(phi * BUMP_FREQ + iTime * BUMP_SPEED) * BUMP_AMP;
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

        glow += COLOR_SPHERE * (INTENSITY_SPHERE / (sphere * sphere + 0.0001)) * edgeOpacity * volumetricNoise;
        glow += COLOR_SPECULAR * (INTENSITY_SPECULAR / (sphere * sphere + 0.00005)) * specularEdge;
        
        d0 += sphere * RAY_ADVANCE;
        if(d0 > MAX_DIST) break;
    }

    d0 = 0.0;
    bool hitLines = false;

    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = (ro + rd * d0) - vInstancePos;
        
        float baseSphere = abs(length(p) - RADIUS_SPHERE) - THICKNESS_SPHERE;
        float equator = max(baseSphere, abs(p.y) - THICKNESS_LINES);
        float meridianX = max(baseSphere, abs(p.x) - THICKNESS_LINES);
        float meridianZ = max(baseSphere, abs(p.z) - THICKNESS_LINES);
        
        vec3 pDots = fract(p * DOTS_SPACING) - 0.5;
        float dotsGrid = (length(pDots) - DOTS_THICKNESS) / DOTS_SPACING;
        float dots = max(baseSphere, dotsGrid);

        float d = min(min(equator, min(meridianX, meridianZ)), dots);
        
        if(d < SURF_DIST) hitLines = true;

        vec3 normal = normalize(p);
        vec3 viewDir = -rd; 
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        float edgeOpacity = pow(fresnel, FRESNEL_EDGE_POWER);

        glow += COLOR_LINES * (INTENSITY_LINES / (equator * equator + 0.0001)) * (FRESNEL_LINES_BASE + edgeOpacity);
        glow += COLOR_LINES * (INTENSITY_LINES / (meridianX * meridianX + 0.0001)) * (FRESNEL_LINES_BASE + edgeOpacity);
        glow += COLOR_LINES * (INTENSITY_LINES / (meridianZ * meridianZ + 0.0001)) * (FRESNEL_LINES_BASE + edgeOpacity);
        
        float gradientFactor = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 colorDotsGradient = mix(COLOR_DOTS_START, COLOR_DOTS_END, gradientFactor);
        glow += colorDotsGradient * (INTENSITY_DOTS / (dots * dots + 0.0001)) * (FRESNEL_LINES_BASE + edgeOpacity);

        d0 += d * RAY_ADVANCE;
        if(d0 > MAX_DIST) break;
    }

    if(!hitAxes && !hitSweeps && !hitSphere && !hitLines) discard;

    vec3 rawCol = glow * 0.02;
    vec3 finalCol = 1.0 - exp(-rawCol * EXPOSURE);

    float glowMag = length(glow * 0.02);
    float alpha = clamp(glowMag * 15.0, 0.0, 1.0);

    gl_FragColor = vec4(finalCol, alpha);
}