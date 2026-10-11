uniform vec3 uLightPos;
uniform vec3 uLocalCenter;

varying vec3 vLocalPos;
varying mat3 vNormalMatrix;
varying vec3 vWorldPosition;


const vec3  LENS_BASE_COLOR     = vec3(0.01, 0.01, 0.015); 
const float LENS_OPACITY        = 0.70;                    

const float CHROMA_INTENSITY_R  = 0.10;
const float CHROMA_INTENSITY_G  = 0.08;
const float CHROMA_INTENSITY_B  = 0.05;

const vec2  CHROMA_RANGE_R      = vec2(0.7, 1.0);          
const vec4  CHROMA_RANGE_G      = vec4(0.4, 0.8, 0.8, 1.0);
const vec4  CHROMA_RANGE_B      = vec4(0.1, 0.5, 0.5, 0.9);

const float SPECULAR_POWER      = 100.0;                   
const float SPECULAR_INTENSITY  = 0.50;                    

void main() {
    
    vec3 diff = vLocalPos - uLocalCenter;
    vec3 localNormal = length(diff) > 0.0001 ? normalize(diff) : vec3(0.0, 1.0, 0.0);
    vec3 worldNormal = normalize(vNormalMatrix * localNormal);
    
    vec3 viewDir  = normalize(cameraPosition - vWorldPosition);
    vec3 lightDir = normalize(uLightPos - vWorldPosition);
    
    float f = max(0.0, dot(worldNormal, viewDir));
    
    float rChannel = smoothstep(CHROMA_RANGE_R.x, CHROMA_RANGE_R.y, f);
    float gChannel = smoothstep(CHROMA_RANGE_G.x, CHROMA_RANGE_G.y, f) - smoothstep(CHROMA_RANGE_G.z, CHROMA_RANGE_G.w, f);
    float bChannel = smoothstep(CHROMA_RANGE_B.x, CHROMA_RANGE_B.y, f) - smoothstep(CHROMA_RANGE_B.z, CHROMA_RANGE_B.w, f);
    
    vec3 chromatic = vec3(
        rChannel * CHROMA_INTENSITY_R,
        gChannel * CHROMA_INTENSITY_G,
        bChannel * CHROMA_INTENSITY_B
    );
    
    vec3 halfVector = normalize(lightDir + viewDir);
    float NdotH     = max(0.0, dot(worldNormal, halfVector));
    
    
    float specular  = pow(max(0.0001, NdotH), SPECULAR_POWER) * SPECULAR_INTENSITY;
    
    vec3 finalColor = LENS_BASE_COLOR + chromatic + vec3(specular);
    
    gl_FragColor = vec4(finalColor, LENS_OPACITY);
}