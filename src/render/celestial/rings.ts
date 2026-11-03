import * as THREE from 'three';
import {bodyVertex,cloudTopFragment} from './shaders';
const declarations=`uniform sampler2D uRingProfile;uniform vec2 uRingRange;
float ringTau(float radius){if(radius<uRingRange.x||radius>uRingRange.y)return 0.;return texture2D(uRingProfile,vec2((radius-uRingRange.x)/(uRingRange.y-uRingRange.x),.5)).r*6.;}`;
export const saturnFragment=cloudTopFragment.replace('varying vec2 vUv;',declarations+'\nvarying vec3 vLocalPosition;varying vec2 vUv;').replace('vec3 c=texture2D(uMap,vUv).rgb;',`vec3 point=vLocalPosition;float sy=uSunLocal.y;if(abs(sy)>.0001){float t=-point.y/sy;if(t>0.){vec3 hit=point+t*uSunLocal;cloudLight*=exp(-ringTau(length(hit.xz))/abs(sy));}}vec3 c=texture2D(uMap,vUv).rgb;`);
export function createSaturnRings(config:any,uniforms:Record<string,THREE.IUniform>,shape=[1,1,1]){
 uniforms.uRingProfile={value:new THREE.Texture()};uniforms.uRingRange={value:new THREE.Vector2(config.innerRatio,config.outerRatio)};
 uniforms.uPlanetAxes={value:new THREE.Vector3(...shape)};
 const geometry=new THREE.RingGeometry(config.innerRatio,config.outerRatio,768);geometry.rotateX(Math.PI/2);
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:bodyVertex,fragmentShader:`
 #include <common>
 #include <logdepthbuf_pars_fragment>
 uniform vec3 uSunLocal;uniform vec3 uPlanetAxes;uniform float uEnhancement;varying vec3 vLocalPosition;varying vec3 vNormalView;varying vec3 vPositionView;
 ${declarations}
 void main(){
 #include <logdepthbuf_fragment>
 float tau=ringTau(length(vLocalPosition.xz));float mu=max(.015,abs(dot(normalize(vNormalView),normalize(-vPositionView))));float mu0=max(.01,abs(uSunLocal.y));float opacity=1.-exp(-tau/mu);
 vec3 pp=vLocalPosition/uPlanetAxes;vec3 ll=uSunLocal/uPlanetAxes;float t=-dot(pp,ll)/dot(ll,ll);float shadow=1.;if(t>0.)shadow=smoothstep(.985,1.015,length(pp+t*ll));
 float signedView=dot(normalize(vNormalView),normalize(-vPositionView));bool litSide=(-uSunLocal.y)*signedView>0.;float reflection=mu0/(mu+mu0)*(1.-exp(-tau*(1./mu+1./mu0)));float transmission=abs(mu0-mu)<.001?(tau/mu)*exp(-tau/mu):mu0/(mu0-mu)*(exp(-tau/mu0)-exp(-tau/mu));float scatter=litSide?reflection:max(0.,transmission);float gain=mix(1.,2.2,uEnhancement);vec3 ice=vec3(.64,.58,.47);gl_FragColor=vec4(ice*scatter*gain*shadow/max(opacity,.001),opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`,side:THREE.DoubleSide,transparent:true,depthWrite:false});
 const ring=new THREE.Mesh(geometry,material);ring.renderOrder=1;return ring;
}
