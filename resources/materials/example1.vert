varying vec3 viewPos, worldPos;
uniform mat4 ModelMatrix;

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
    gl_TexCoord[0] = gl_MultiTexCoord0;
    vec3 pos = vec3(gl_Vertex);
 
    worldPos = vec3(gl_MultiTexCoord0);
    viewPos = pos - m3(ModelMatrix)*gl_ModelViewMatrixInverse[3].xyz;

    gl_Position = ftransform();
}