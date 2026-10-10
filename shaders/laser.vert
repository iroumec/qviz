// The laser beam is drawn as one instanced box per ion. Each box is the
// bounding volume that the fragment shader marches through. The instance
// matrix places the box above its ion, and the instance position is sent to
// the fragment shader, so that the beam is centred on its own ion and not on
// the origin of the chain.
//
// `instanceActive` is the intensity of each beam (0 = off). It is written from
// JavaScript only while the gate of the step fires the laser on that ion.

attribute float instanceActive;

varying vec3 vWorldPosition;
varying vec3 vInstancePos;
varying float vInstanceActive;

void main() {
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vInstancePos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vInstanceActive = instanceActive;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
