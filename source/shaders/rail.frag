// The phonon guide rail: a faint blue thread along the whole chain. Between the
// two ions of a running two-qubit gate it glows amber and pulses, so the
// vibration is seen travelling along the confinement axis.

uniform float iTime;
uniform float uActiveCenter;
uniform float uActiveHalf;
uniform float uIntensity;
uniform vec3 uIdleColor;
uniform vec3 uActiveColor;

varying vec3 vLocalPos;

void main() {
    float inSegment = step(abs(vLocalPos.x - uActiveCenter), uActiveHalf);
    float pulse = 0.5 + 0.5 * sin(iTime * 8.0 - vLocalPos.x * 6.0);
    float lit = inSegment * uIntensity;
    vec3 color = mix(uIdleColor, uActiveColor * (0.6 + 0.4 * pulse), lit);
    float alpha = mix(0.15, 0.85 * (0.5 + 0.5 * pulse), lit);
    gl_FragColor = vec4(color, alpha);
}
