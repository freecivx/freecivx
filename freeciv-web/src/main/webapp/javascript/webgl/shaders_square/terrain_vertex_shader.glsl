#version 300 es

// Output to the fragment shader
out vec2 vUv;
out vec3 vNormal;
out vec3 vPosition;
out vec3 vPosition_camera;
out vec3 vColor;

// Input from the vertex buffer and context
in vec3 position;
in vec3 normal;
in vec2 uv;
in vec3 vertColor;

// Built-in uniforms for the transformation matrices
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
    // Pass attributes to the fragment shader
    vUv = uv;
    vNormal = normal;
    vPosition = position;
    vColor = vertColor;

    // Compute the model-view position
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Pass the position in camera space
    vPosition_camera = mvPosition.xyz;
}
