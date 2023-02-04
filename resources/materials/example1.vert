attribute vec4 vertex;
attribute vec4 uv0;
uniform mat4 ModelMatrix;
uniform mat4 WorldMatrix;
varying vec3 viewPos, worldPos;
varying vec4 projectionCoord;

mat3 m3( mat4 m )
{
    mat3 result;
 
    result[0][0] = m[0][0];
    result[0][1] = m[0][1];
    result[0][2] = m[0][2];
 
    result[1][0] = m[1][0];
    result[1][1] = m[1][1];
    result[1][2] = m[1][2];
 
    result[2][0] = m[2][0];
    result[2][1] = m[2][1];
    result[2][2] = m[2][2];
 
    return result;
}
 
void main()
{
    projectionCoord = vec4(WorldMatrix * vertex);

    worldPos = vec3(uv0);

    vec3 pos = vec3(vertex);
    viewPos = pos - m3(ModelMatrix)*gl_ModelViewMatrixInverse[3].xyz;

    gl_Position = WorldMatrix * vertex;
}