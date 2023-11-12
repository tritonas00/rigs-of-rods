float4 mainVP(
    float4 uv0 : TEXCOORD0,
    float4 position : POSITION,
    uniform float4x4 worldViewProjMatrix,
    uniform float3 cameraPos,
    out float3 viewPos : TEXCOORD0,
    out float3 worldPos : TEXCOORD1,
    out float4 projectionCoord : TEXCOORD2,
    out float4 ppos : TEXCOORD3

) : POSITION
{   
    float4 oPos = mul(worldViewProjMatrix, position);

    // Underwater - full screen projection
    if (cameraPos.y < 0.0)
    {
        oPos = float4(position.xzy, 1.0);
    }

    // Projective texture coordinates, adjust for mapping
    float4x4 scalemat = float4x4(0.5, 0.0, 0.0, 0.0, 
                     0.0, -0.5, 0.0, 0.0,
                     0.0, 0.0, 0.5, 0.0,
                     0.5, 0.5, 0.5, 1.0);

    projectionCoord = mul(oPos, scalemat);

    worldPos = uv0.xyz;
    viewPos = position.xyz - cameraPos;
    ppos = position;

    return oPos;
}