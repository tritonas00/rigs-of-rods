float fresnel_dielectric(float3 Incoming, float3 Normal, float eta)
{
    /* compute fresnel reflectance without explicitly computing
       the refracted direction */
    float c = abs(dot(Incoming, Normal));
    float g = eta * eta - 1.0 + c * c;
    float result;

    if(g > 0.0) {
        g = sqrt(g);
        float A =(g - c)/(g + c);
        float B =(c *(g + c)- 1.0)/(c *(g - c)+ 1.0);
        result = 0.5 * A * A *(1.0 + B * B);
    }
    else
        result = 1.0;  /* TIR (no refracted component) */

    return result;
}

float4 mainFP(
    float3 viewPos : TEXCOORD0,
    float3 worldPos : TEXCOORD1,
    float4 projectionCoord : TEXCOORD2,
    float4 ppos : TEXCOORD3,
    uniform sampler2D normalMap : register(s0),
    uniform sampler2D reflectMap : register(s1),
    uniform sampler2D refractMap : register(s2),
    uniform float timer,
    uniform float3 cameraPos,
    uniform float4 lightPos,

    // UI options
    uniform float color_density,
    uniform float water_opacity,
    uniform float light_scattering,
    uniform float water_distortion,
    uniform float water_reflection,
    uniform float water_refraction,
    uniform float water_scale,

    // Caelum sun color
    uniform float3 sun_color
) : COLOR 
{
    //tweakables
    float2 windDir = float2(0.5, -0.8); //wind direction XY
    float windSpeed = 0.2; //wind speed
    float visibility = 28.0;
    float scale = water_scale; //overall wave scale
    float2 bigWaves = float2(4.3, 4.3); //strength of big waves
    float2 midWaves = float2(0.3, 0.15); //strength of middle sized waves
    float2 smallWaves = float2(0.15, 0.1); //strength of small waves
    float3 waterColor = float3(0.2,0.4,0.5); //color of the water
    float waterDensity = 0.0; //water density (0.0-1.0)
    float choppy = 0.15; //wave choppyness
    float aberration = 0.002; //chromatic aberration amount
    float bump = 2.6; //overall water surface bumpyness
    float reflBump = 0.04; //reflection distortion amount
    float refrBump = 0.03; //refraction distortion amount

    float3 sunPos = float3(lightPos.xyz);
    float sunSpec = 1000.0; //Sun specular hardness
    float scatterAmount = 3.5; //amount of sunlight scattering of waves
    float3 scatterColor = float3(0.0,1.0,0.95);// color of the sunlight scattering

    float2 nCoord = float2(0.0, 0.0); //normal coords

    float depth = 0.1;
    float coast = smoothstep(0.3,0.7,depth);
    float coast1 = smoothstep(0.49,0.5,depth);

    choppy = choppy * (coast)+0.05;
    bump = -bump*clamp(1.0-coast+0.0,0.0,1.0);
    bump = bump*clamp(1.0-coast1+0.0,0.0,1.0);
    
    float time = timer - (coast)*80.0; //hmmm

    // Normal
    nCoord = worldPos.xy *  (scale * 0.04) + windDir * time * (windSpeed*0.04);
    float3 normal0 = 2.0 * tex2D(normalMap, nCoord + float2(-time*0.015,-time*0.005)).rgb - 1.0;
    nCoord = worldPos.xy * (scale * 0.1) + windDir * time * (windSpeed*0.08)-(normal0.xy/normal0.zz)*choppy;
    float3 normal1 = 2.0 * tex2D(normalMap, nCoord + float2(+time*0.020,+time*0.015)).rgb - 1.0;
 
    nCoord = worldPos.xy * (scale * 0.25) + windDir * time * (windSpeed*0.07)-(normal1.xy/normal1.zz)*choppy;
    float3 normal2 = 2.0 * tex2D(normalMap, nCoord + float2(-time*0.04,-time*0.03)).rgb - 1.0;
    nCoord = worldPos.xy * (scale * 0.5) + windDir * time * (windSpeed*0.09)-(normal2.xy/normal2.z)*choppy;
    float3 normal3 = 2.0 * tex2D(normalMap, nCoord + float2(+time*0.03,+time*0.04)).rgb - 1.0;
  
    nCoord = worldPos.xy * (scale* 1.0) + windDir * time * (windSpeed*0.4)-(normal3.xy/normal3.zz)*choppy;
    float3 normal4 = 2.0 * tex2D(normalMap, nCoord + float2(-time*0.02,+time*0.1)).rgb - 1.0;  
    nCoord = worldPos.xy * (scale * 2.0) + windDir * time * (windSpeed*0.7)-(normal4.xy/normal4.zz)*choppy;
    float3 normal5 = 2.0 * tex2D(normalMap, nCoord + float2(+time*0.1,-time*0.06)).rgb - 1.0;

    float3 normal = normalize(normal0 * bigWaves.x + normal1 * bigWaves.y +
                            normal2 * midWaves.x + normal3 * midWaves.y +
						    normal4 * smallWaves.x + normal5 * smallWaves.y);

    float normalFade = 1.0 - min(exp(-projectionCoord.w / 1000.0), 1.0);    

    float3 nVec = lerp(normal.xzy, float3(0, 1, 0), normalFade-water_distortion); // converting normals to tangent space
    float3 vVec = normalize(viewPos);
    float3 lVec = normalize(sunPos);

    // Normal for light scattering
    float3 lNormal = normalize(normal0 * bigWaves.x*0.5 + normal1 * bigWaves.y*0.5 +
                            normal2 * midWaves.x*0.1 + normal3 * midWaves.y*0.1 +
						    normal4 * smallWaves.x*0.1 + normal5 * smallWaves.y*0.1);

    lNormal = lerp(lNormal.xzy, float3(0, 1, 0), normalFade-water_distortion);
    float3 lR = reflect(lVec, lNormal);

    float sunFade = clamp((sunPos.y+10.0)/20.0,0.0,1.0);
    float scatterFade = clamp((sunPos.y+50.0)/200.0,0.0,1.0);
    float3 sunext = float3(0.45, 0.55, 0.68);//sunlight extinction

    float s = clamp((dot(lR, vVec)*2.0-1.2), 0.0,1.0);
    float lightScatter = clamp((clamp(dot(-lVec,lNormal)*0.7+0.3,0.0,1.0)*s)*scatterAmount,0.0,1.0)*sunFade *clamp(1.0-exp(-(sunPos.y)),0.0,1.0);
    scatterColor = lerp(float3(scatterColor)*float3(1.0,0.4,0.0), scatterColor, clamp(1.0-exp(-(sunPos.y)*sunext),0.0,1.0));

    // Fresnel term
    float ior = 1.33;
    //ior = (cameraPos.y>0.0)?(1.333/1.0):(1.0/1.333); //air to water; water to air
    ior = 1.333/1.0;
    float eta = max(ior, 0.00001);
    float fresnel = fresnel_dielectric(-vVec,nVec,eta);
    fresnel = clamp(fresnel,0.0,1.0);

    // Reflection
    float2 fragCoord = projectionCoord.xy / projectionCoord.w;
    fragCoord = clamp(fragCoord,0.002,0.998);

    //texture edge bleed removal
    float fade = 12.0;
    float2 distortFade = float2(0.0, 0.0);
    distortFade.x = clamp(fragCoord.x*fade,0.0,1.0);
    distortFade.x -= clamp(1.0-(1.0-fragCoord.x)*fade,0.0,1.0);
    distortFade.y = clamp(fragCoord.y*fade,0.0,1.0);
    distortFade.y -= clamp(1.0-(1.0-fragCoord.y)*fade,0.0,1.0); 

    float3 reflection = tex2D(reflectMap, fragCoord + (nVec.xz * float2(reflBump,reflBump*6.0))*distortFade).rgb;

    // Refraction
    float2 rcoord = reflect(vVec,nVec).xz;
    float3 refraction = float3(0.0, 0.0, 0.0);
    
    refraction.r = tex2D(refractMap, (fragCoord-(nVec.xz*refrBump*distortFade))*1.0).r;
    refraction.g = tex2D(refractMap, (fragCoord-(nVec.xz*refrBump*distortFade))*1.0-(rcoord*aberration)).g;
    refraction.b = tex2D(refractMap, (fragCoord-(nVec.xz*refrBump*distortFade))*1.0-(rcoord*aberration*2.0)).b;

    // Finalize
    float3 luminosity = float3(1.30, 0.59, 0.11);
    float reflectivity = pow(dot(luminosity, reflection*2.0),light_scattering);
    float reflectivity1 = pow(dot(luminosity, reflection),3.0);
    float3 R = reflect(vVec, nVec);

    float specular = clamp(pow(atan(max(dot(R, lVec),0.0)*1.55),1000.0)*reflectivity*8.0,0.0,1.0);
    float3 specColor = lerp(sun_color, float3(1.0,1.0,1.0), clamp(1.0-exp(-(sunPos.y)*sunext),0.0,1.0));

    float waterSunGradient = dot(normalize(worldPos), -normalize(sunPos));
    waterSunGradient = clamp(pow(waterSunGradient*0.7+0.3,2.0),0.0,1.0);  
    float3 waterSunColor = float3(0.0,1.0,0.85)*waterSunGradient;
    waterSunColor = (cameraPos.y<0.0)?waterSunColor*0.5:waterSunColor*0.25;//below or above water?

    float waterGradient = dot(normalize(worldPos), float3(0.0,0.0,-1.0));
    waterGradient = clamp((waterGradient*0.5+0.5),0.2,1.0);
    float3 watercolor = (float3(0.0078, 0.5176, 0.700)+waterSunColor)*waterGradient*1.5;
    float3 waterext = float3(0.6, 0.8, 1.0);//water extinction
    watercolor = lerp(watercolor*0.3*sunFade, watercolor, clamp(1.0-exp(-(sunPos.y*10.0)*sunext),0.0,1.0));

    reflection = lerp(reflection, float3(1,1,1), water_reflection);
    refraction = lerp(refraction, float3(0,0,0), water_refraction);
    refraction = lerp(lerp(refraction, watercolor, color_density), scatterColor, lightScatter);
    float4 color = lerp(float4(refraction, water_opacity), float4(reflection, 1.0), fresnel * 0.6);

    // Smooth plane edge
    if (cameraPos.y < 2.0)
    {
        color.a = clamp((projectionCoord.z), 0.0, water_opacity);
    }

    // Underwater
    if (cameraPos.y < 0.0)
    {
        float a = clamp((-cameraPos.y), 0.0, water_opacity - 0.2);
        color = lerp(float4(refraction, a), float4(reflection, a), 0.0);
    }

    float4 col = color+(float4(specColor, 1.0)*specular);

    // Fog
    float3 alteredPixelPosition = float3(ppos.x, 0.0, ppos.z);
    const float alphaStart = 1500.0;
    const float alphaEnd = 5000.0;
    float distanceFromCamera = length(alteredPixelPosition);

    if (cameraPos.y >= 2.0)
    {
        col.a = clamp((alphaEnd - distanceFromCamera) / (alphaEnd - alphaStart), 0.0, water_opacity);
    }

    return col;
}