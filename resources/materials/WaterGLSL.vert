attribute vec4 uv0;
attribute vec4 position;

uniform mat4 worldViewProjMatrix;
uniform vec3 cameraPos;

varying vec3 viewPos, worldPos;
varying vec4 projectionCoord;
varying vec4 ppos;

void main()
{
    gl_Position = worldViewProjMatrix * position;

    // Underwater - full screen projection
    if (cameraPos.y < 0.0)
    {
        gl_Position = vec4(position.xzy, 1.0);
    }

    // Projective texture coordinates, adjust for mapping
    mat4 scalemat = mat4(0.5, 0.0, 0.0, 0.0, 
                     0.0, -0.5, 0.0, 0.0,
                     0.0, 0.0, 0.5, 0.0,
                     0.5, 0.5, 0.5, 1.0);

    projectionCoord = scalemat * gl_Position;

    worldPos = vec3(uv0);
    viewPos = position.xyz - cameraPos;
    ppos = position;
}
