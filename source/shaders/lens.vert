varying vec3 vLocalPos;
varying mat3 vNormalMatrix;
varying vec3 vWorldPosition;

void main() {
    vLocalPos = position;
    vNormalMatrix = normalMatrix;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}