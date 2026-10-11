// The phonon bus is a horizontal energy tube that joins the two ions of a
// two-qubit gate. The vertex passes the position along the tube (the local x
// runs from -0.5 to 0.5) so the fragment shader can animate a wave that flows
// from one ion to the other, through the ions that lie in between.

varying vec3 vLocalPos;

void main() {
    vLocalPos = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
