// A glowing energy tube, the phonon bus. Two waves of different frequency run
// along the tube (the local x) so the flow looks fast and a little chaotic, as
// if the vibration travelled from one ion to the other and back. The colour is
// the entangler colour (neon orange), the same as the MS and ZZ lasers.

uniform float iTime;
uniform vec3 uColor;
uniform float uOpacity;

varying vec3 vLocalPos;

void main() {
    float flow = sin(vLocalPos.x * 60.0 - iTime * 25.0)
        + 0.5 * sin(vLocalPos.x * 23.0 + iTime * 40.0);
    float wave = 0.5 + 0.5 * clamp(flow, -1.0, 1.0);
    float flicker = 0.6 + 0.4 * sin(iTime * 18.0);
    vec3 color = uColor * (0.35 + 0.65 * wave) * flicker;
    gl_FragColor = vec4(color, uOpacity * (0.45 + 0.55 * wave));
}
