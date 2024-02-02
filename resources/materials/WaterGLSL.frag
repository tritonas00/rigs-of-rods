uniform sampler2D normalMap;
uniform sampler2D reflectMap;
uniform sampler2D refractMap;
uniform sampler2D depthMap;
uniform sampler2D foamMap;
uniform float timer;
uniform vec3 cameraPos;
uniform vec4 lightPos;

// UI options
uniform float color_density;
uniform float water_opacity;
uniform float water_specular;
uniform float water_distortion;
uniform float water_reflection;
uniform float water_refraction;
uniform float water_depth;
uniform float water_caustics;
uniform float water_foam;
uniform float water_scale;
uniform vec3 water_color;

// Caelum sun color
uniform vec3 sun_color;

varying vec4 projectionCoord;
varying vec3 viewPos, worldPos;
varying vec4 pixelPos;

//tweakables
vec2 windDir = vec2(0.5, -0.8); //wind direction XY
float windSpeed = 0.2; //wind speed
float visibility = 28.0;
float scale = water_scale; //overall wave scale
vec2 bigWaves = vec2(4.3, 4.3); //strength of big waves
vec2 midWaves = vec2(0.3, 0.15); //strength of middle sized waves
vec2 smallWaves = vec2(0.15, 0.1); //strength of small waves
vec3 waterColor = vec3(0.2,0.4,0.5); //color of the water
float waterDensity = 0.0; //water density (0.0-1.0)
float choppy = 0.15; //wave choppyness
float aberration = 0.002; //chromatic aberration amount
float bump = 2.6; //overall water surface bumpyness
float reflBump = 0.04; //reflection distortion amount
float refrBump = 0.03; //refraction distortion amount

vec3 sunPos = vec3(lightPos);
float sunSpec = 1000.0; //Sun specular hardness
float scatterAmount = 3.5; //amount of sunlight scattering of waves
vec3 scatterColor = vec3(0.0,1.0,0.95);// color of the sunlight scattering

float fresnel_dielectric(vec3 Incoming, vec3 Normal, float eta)
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

void main()
{
    vec2 nCoord = vec2(0.0); //normal coords
    float coast = smoothstep(0.3,0.7, 0.1);
    float coast1 = smoothstep(0.49,0.5, 0.1);

    choppy = choppy * (coast)+0.05;
    bump = -bump*clamp(1.0-coast+0.0,0.0,1.0);
    bump = bump*clamp(1.0-coast1+0.0,0.0,1.0);
    
    float time = timer - (coast)*80.0; //hmmm

    // Normal
    nCoord = worldPos.xy * (scale * 0.04) + windDir * time * (windSpeed*0.04);
    vec3 normal0 = 2.0 * texture2D(normalMap, nCoord + vec2(-time*0.015,-time*0.005)).rgb - 1.0;
    nCoord = worldPos.xy * (scale * 0.1) + windDir * time * (windSpeed*0.08)-(normal0.xy/normal0.zz)*choppy;
    vec3 normal1 = 2.0 * texture2D(normalMap, nCoord + vec2(+time*0.020,+time*0.015)).rgb - 1.0;
 
    nCoord = worldPos.xy * (scale * 0.25) + windDir * time * (windSpeed*0.07)-(normal1.xy/normal1.zz)*choppy;
    vec3 normal2 = 2.0 * texture2D(normalMap, nCoord + vec2(-time*0.04,-time*0.03)).rgb - 1.0;
    nCoord = worldPos.xy * (scale * 0.5) + windDir * time * (windSpeed*0.09)-(normal2.xy/normal2.z)*choppy;
    vec3 normal3 = 2.0 * texture2D(normalMap, nCoord + vec2(+time*0.03,+time*0.04)).rgb - 1.0;
  
    nCoord = worldPos.xy * (scale* 1.0) + windDir * time * (windSpeed*0.4)-(normal3.xy/normal3.zz)*choppy;
    vec3 normal4 = 2.0 * texture2D(normalMap, nCoord + vec2(-time*0.02,+time*0.1)).rgb - 1.0;  
    nCoord = worldPos.xy * (scale * 2.0) + windDir * time * (windSpeed*0.7)-(normal4.xy/normal4.zz)*choppy;
    vec3 normal5 = 2.0 * texture2D(normalMap, nCoord + vec2(+time*0.1,-time*0.06)).rgb - 1.0;

    vec3 normal = normalize(normal0 * bigWaves.x + normal1 * bigWaves.y +
                            normal2 * midWaves.x + normal3 * midWaves.y +
						    normal4 * smallWaves.x + normal5 * smallWaves.y);

    float normalFade = 1.0 - min(exp(-projectionCoord.w / 1000.0), 1.0);    

    vec3 nVec = mix(normal.xzy, vec3(0, 1, 0), normalFade-water_distortion); // converting normals to tangent space 
    vec3 vVec = normalize(viewPos);
    vec3 lVec = normalize(sunPos);

    // Normal for light scattering
    vec3 lNormal = normalize(normal0 * bigWaves.x*0.5 + normal1 * bigWaves.y*0.5 +
                            normal2 * midWaves.x*0.1 + normal3 * midWaves.y*0.1 +
						    normal4 * smallWaves.x*0.1 + normal5 * smallWaves.y*0.1);

    lNormal = mix(lNormal.xzy, vec3(0, 1, 0), normalFade-water_distortion);
    vec3 lR = reflect(lVec, lNormal);

    float sunFade = clamp((sunPos.y+10.0)/20.0,0.0,1.0);
    float scatterFade = clamp((sunPos.y+50.0)/200.0,0.0,1.0);
    vec3 sunext = vec3(0.45, 0.55, 0.68);//sunlight extinction

    float s = clamp((dot(lR, vVec)*2.0-1.2), 0.0,1.0);
    float lightScatter = clamp((clamp(dot(-lVec,lNormal)*0.7+0.3,0.0,1.0)*s)*scatterAmount,0.0,1.0)*sunFade *clamp(1.0-exp(-(sunPos.y)),0.0,1.0);
    scatterColor = mix(vec3(scatterColor)*vec3(1.0,0.4,0.0), scatterColor, clamp(1.0-exp(-(sunPos.y)*sunext),0.0,1.0));

    // Fresnel term
    float ior = 1.33;
    //ior = (cameraPos.y>0.0)?(1.333/1.0):(1.0/1.333); //air to water; water to air
    ior = 1.333/1.0;
    float eta = max(ior, 0.00001);
    float fresnel = fresnel_dielectric(-vVec,nVec,eta);
    fresnel = clamp(fresnel,0.0,1.0);

    // Reflection
    vec2 fragCoord = projectionCoord.xy / projectionCoord.w;
    // fragCoord = clamp(fragCoord,0.002,0.998);

    //texture edge bleed removal
    float fade = 12.0;
    vec2 distortFade = vec2(0.0);
    distortFade.s = clamp(fragCoord.s*fade,0.0,1.0);
    distortFade.s -= clamp(1.0-(1.0-fragCoord.s)*fade,0.0,1.0);
    distortFade.t = clamp(fragCoord.t*fade,0.0,1.0);
    distortFade.t -= clamp(1.0-(1.0-fragCoord.t)*fade,0.0,1.0); 

    vec3 reflection = texture2D(reflectMap, fragCoord + (nVec.xz * vec2(reflBump,reflBump*6.0))*distortFade).rgb;

    // Refraction
    vec2 rcoord = reflect(vVec,nVec).xz;
    vec3 refraction = vec3(0.0);

    //refraction.r = texture2D(refractMap, (fragCoord-(nVec.xz*refrBump*distortFade))*1.0).r;
    //refraction.g = texture2D(refractMap, (fragCoord-(nVec.xz*refrBump*distortFade))*1.0-(rcoord*aberration)).g;
    //refraction.b = texture2D(refractMap, (fragCoord-(nVec.xz*refrBump*distortFade))*1.0-(rcoord*aberration*2.0)).b;

    refraction = texture2D(refractMap, (fragCoord-(nVec.xz*refrBump*distortFade))*1.0).rgb;

    // Finalize
    vec3 luminosity = vec3(1.30, 0.59, 0.11);
    float reflectivity = pow(dot(luminosity, reflection*2.0), 0.5);
    vec3 R = reflect(vVec, nVec);

    float specular = clamp(pow(atan(max(dot(R, lVec),0.0)*1.55),1000.0)*reflectivity*8.0,0.0,1.0) * water_specular;
    vec3 specColor = mix(sun_color, vec3(1.0,1.0,1.0), clamp(1.0-exp(-(sunPos.y)*sunext),0.0,1.0));

    float waterSunGradient = dot(normalize(worldPos), -normalize(sunPos));
    waterSunGradient = clamp(pow(waterSunGradient*0.7+0.3,2.0),0.0,1.0);  
    vec3 waterSunColor = vec3(0.0,1.0,0.85)*waterSunGradient;
    waterSunColor = (cameraPos.y<0.0)?waterSunColor*0.5:waterSunColor*0.25;//below or above water?
   
    float waterGradient = dot(normalize(worldPos), vec3(0.0,0.0,-1.0));
    waterGradient = clamp((waterGradient*0.5+0.5),0.2,1.0);
    vec3 watercolor = (water_color+waterSunColor)*waterGradient*1.5;
    vec3 waterext = vec3(0.6, 0.8, 1.0);//water extinction
    watercolor = mix(watercolor*0.3*sunFade, watercolor, clamp(1.0-exp(-(sunPos.y*10.0)*sunext),0.0,1.0));

    reflection = mix(reflection, vec3(1,1,1), water_reflection);

    float depth = texture2D(depthMap, (fragCoord-(nVec.xz*refrBump*distortFade))*1.0).r;
    float wdepth = clamp(depth * (projectionCoord.z * water_depth), 0.0, 1.0);

    refraction = mix(refraction, vec3(0,0,0), min(wdepth, water_refraction));
    refraction = mix(mix(refraction, watercolor, min(wdepth, color_density)), scatterColor, lightScatter);
    vec4 color = mix(vec4(refraction, water_opacity), vec4(reflection, 1.0), fresnel * 0.6);

    // Caustics: https://www.shadertoy.com/view/XtKfRG
    vec3 k = vec3(worldPos.xy * scale*3.0 + nVec.xz, time*0.5);

    mat3 m = mat3(-2,-1,2, 3,-2,1, 1,2,2);
    vec3 a = k * m * 0.5;
    vec3 b = a * m * 0.4;
    vec3 c = b * m * 0.3;

    vec4 caustics = (vec4(pow(min(min(length(.5 - fract(a)), length(.5 - fract(b))), length(.5 - fract(c))), 7.) * 25.) * 0.3) * water_caustics;
    caustics *= 1.0 - clamp(depth * (projectionCoord.z * water_depth*4.0), 0.0, 1.0);

    // Foam: https://lettier.github.io/3d-game-shaders-for-beginners/foam.html
    vec4 foamPattern = texture2D(foamMap, worldPos.xy * scale*0.5 + nVec.xz*0.05 - time * 0.02);
    vec4 foamColor = vec4(0.8, 0.85, 0.92, 1.0);

    float amount  = clamp(foamPattern.r + 0.1, 0.0, 1.0);
    amount *= 1.0 - clamp(depth * (projectionCoord.z * water_depth*8.0), 0.0, 1.0);
    amount  = amount * amount / (2.0 * (amount * amount - amount) + 1.0);

    //vec4 foam = (mix(vec4(0.0), foamColor, amount*water_foam*clamp(sin(time), 0.0, 1.0))); // Fade
    vec4 foam = (mix(vec4(0.0), foamColor, amount*water_foam));

    gl_FragColor = color + vec4(specColor, 1.0)*specular + caustics + foam;

    // Smooth plane edge
    if (cameraPos.y < 2.0)
    {
        gl_FragColor.a = clamp((projectionCoord.z), 0.0, water_opacity);
    }

    // Underwater
    if (cameraPos.y < 0.0)
    {
        gl_FragColor = vec4(watercolor*color_density, clamp((-cameraPos.y), 0.0, water_opacity - 0.2));
    }

    // Fog
    vec3 alteredPixelPosition = vec3(pixelPos.x, 0.0, pixelPos.z);
    const float alphaStart = 1500.0;
    const float alphaEnd = 5000.0;
    float distanceFromCamera = length(alteredPixelPosition);

    if (cameraPos.y >= 2.0)
    {
        gl_FragColor.a = clamp((alphaEnd - distanceFromCamera) / (alphaEnd - alphaStart), 0.0, water_opacity);
    }
}