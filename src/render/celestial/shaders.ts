export const bodyVertex=`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;varying vec3 vNormalView;varying vec3 vPositionView;varying vec3 vLocalNormal;varying vec3 vLocalPosition;
void main(){vUv=uv;vLocalNormal=normal;vLocalPosition=position;vNormalView=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vPositionView=p.xyz;gl_Position=projectionMatrix*p;
#include <logdepthbuf_vertex>
}`;
export const solarFragment=`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;uniform float uEnhancement;varying vec2 vUv;varying vec3 vNormalView;varying vec3 vPositionView;
void main(){
#include <logdepthbuf_fragment>
vec3 observed=texture2D(uMap,vUv).rgb;float intensity=dot(observed,vec3(.2126,.7152,.0722));
float mu=max(0.,dot(normalize(vNormalView),normalize(-vPositionView)));float limb=.38+.62*pow(mu,.55);
vec3 whiteLight=vec3(1.,.96,.86)*pow(intensity,1.15)*1.7;
vec3 displayLight=observed*1.45;gl_FragColor=vec4(mix(whiteLight,displayLight,uEnhancement)*limb,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export const atmosphereFragment=`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSunLocal;uniform vec3 uTint;uniform float uStrength;uniform float uRadius;
varying vec3 vLocalNormal;varying vec3 vNormalView;varying vec3 vPositionView;
void main(){
#include <logdepthbuf_fragment>
vec3 n=normalize(vLocalNormal);float view=abs(dot(normalize(vNormalView),normalize(-vPositionView)));float light=dot(n,uSunLocal);float impact=uRadius*sqrt(max(0.,1.-view*view));float q=clamp((impact-1.)/(uRadius-1.),0.,1.);float rim=exp(-q*2.)*(1.-smoothstep(.4,1.,q));float day=smoothstep(-.18,.22,light);gl_FragColor=vec4(uTint,rim*day*uStrength);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
// Cloud-top photometry, independent of solid-surface microfacet materials.
export const cloudTopFragment=`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;uniform vec3 uSunLocal;uniform float uMinnaert;uniform float uEnhancement;
varying vec2 vUv;varying vec3 vLocalNormal;varying vec3 vNormalView;varying vec3 vPositionView;
void main(){
#include <logdepthbuf_fragment>
float mu0=max(0.,dot(normalize(vLocalNormal),uSunLocal));float mu=max(.035,abs(dot(normalize(vNormalView),normalize(-vPositionView))));float k=mix(1.,uMinnaert,uEnhancement);float cloudLight=pow(mu0,k)*pow(mu,k-1.);vec3 c=texture2D(uMap,vUv).rgb;gl_FragColor=vec4(c*cloudLight*1.22,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
