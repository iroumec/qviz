// The phonon guide rail is a thin thread along the chain. The vertex passes the
// position along the rail (the local x, from -h/2 to h/2) so the fragment shader
// can light the active segment between the two ions of a two-qubit gate.

varying vec3 vLocalPos;

void main() {
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
