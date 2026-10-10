attribute vec3 instancePsi;

varying vec3 vWorldPos;
varying vec3 vInstancePos;
varying vec3 vPsi;

void main() {
    vPsi = instancePsi;

    vec3 transformed = position;
    vec4 mvPosition = vec4(transformed, 1.0);
    
    #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
    #endif
    
    vec4 worldPosition = modelMatrix * mvPosition;
    vWorldPos = worldPosition.xyz;

    vec4 centerPosition = vec4(0.0, 0.0, 0.0, 1.0);
    #ifdef USE_INSTANCING
        centerPosition = instanceMatrix * centerPosition;
    #endif
    
    centerPosition = modelMatrix * centerPosition;
    vInstancePos = centerPosition.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}