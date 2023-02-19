attribute vec4 vertex;
attribute vec4 uv0;
uniform mat4 ModelMatrix;
uniform mat4 WorldMatrix;
varying vec3 viewPos, worldPos;
varying vec4 projectionCoord;
uniform vec3 eyePosition;

void main()
{
    projectionCoord = vec4(WorldMatrix * vertex);

    worldPos = vec3(uv0);

    vec3 pos = vec3(vertex);
    viewPos = pos - eyePosition;

    gl_Position = WorldMatrix * vertex;
}