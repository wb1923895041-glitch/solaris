import * as THREE from 'three';
import data from '../../../data/phase-7/minor-rings.json' with {type:'json'};
import {catalog} from '../../science/catalog.ts';

/** Jupiter / Uranus / Neptune rings from the archived NASA NSSDCA fact sheets. Brightness ∝ normal optical depth ×
 * albedo (optically thin); bands narrower than a pixel are widened to the pixel footprint with their brightness scaled
 * down so the integrated brightness is conserved; the planet's shadow is computed in the planet frame.
 * `enhanced` applies one labelled gain per planet (brightest band → display opacity 0.18, so rings stay faint and never read as a solid disk); off = true relative brightness
 * against an albedo-0.5 surface, where Jupiter's rings are (correctly) practically invisible. */
type Band={name:string;centerKm:number;widthKm:number;normalOpticalDepth:number;albedo:number};
const MAX=12;
const vertex=`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vLocal;
void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`;
const fragment=`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uCenter[${MAX}];uniform float uHalf[${MAX}];uniform float uTauA[${MAX}];uniform float uSoft[${MAX}];uniform float uLine[${MAX}];uniform int uCount;uniform float uGain;uniform float uMinLine;uniform vec3 uSunLocal;uniform float uContext;
varying vec3 vLocal;
void main(){
 #include <logdepthbuf_fragment>
 float r=length(vLocal.xz),fw=max(fwidth(r),1e-6),I=0.;
 float L=0.;
 for(int i=0;i<${MAX};i++){if(i>=uCount)break;float h=max(uHalf[i],fw*.7),soft=max(fw*.5,uSoft[i]),edge=1.-smoothstep(h-soft,h+soft,abs(r-uCenter[i]));I+=uTauA[i]*(uHalf[i]/h)*edge;L=max(L,uLine[i]*edge);}
 vec3 s=normalize(uSunLocal);float along=dot(vLocal,s);if(along<0.&&length(vLocal-along*s)<1.)I*=.04;
 float a=clamp(max(I*uGain,L*uMinLine),0.,.85)*uContext;if(a<.002)discard;
 gl_FragColor=vec4(vec3(.86,.80,.71),a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const ringSystems=data.systems as Record<string,{equatorialRadiusKm:number;bands:Band[];notes:string;url:string;sha256:string}>;
/** Gains used when enhancement is on, per planet (reported in the UI and the report). */
export function ringGain(id:string,enhanced:boolean){const b=ringSystems[id].bands,max=Math.max(...b.map(x=>x.normalOpticalDepth*x.albedo));return enhanced?.12/max:2;}
/** Enhancement only: dense narrow rings (τ ≥ 0.01, width < 200 km) keep a minimum visible line instead of vanishing below a pixel. */
export const MIN_LINE=.07;
export function createMinorRings(id:string){
 const system=ringSystems[id];if(!system)return null;const R=catalog.find(b=>b.id===id)!.radiusKm,bands=system.bands.slice(0,MAX);
 const inner=Math.min(...bands.map(b=>b.centerKm-b.widthKm/2))/R*.98,outer=Math.max(...bands.map(b=>b.centerKm+b.widthKm/2))/R*1.02;
 const pad=(f:(b:Band)=>number)=>Array.from({length:MAX},(_,i)=>bands[i]?f(bands[i]):0);
 const uniforms={uCenter:{value:pad(b=>b.centerKm/R)},uHalf:{value:pad(b=>b.widthKm/2/R)},uTauA:{value:pad(b=>b.normalOpticalDepth*b.albedo)},uSoft:{value:pad(b=>b.widthKm>1000?b.widthKm/2/R*.08:0)},uLine:{value:pad(b=>b.normalOpticalDepth>=.01&&b.widthKm<200?1:0)},uMinLine:{value:MIN_LINE},uCount:{value:bands.length},uGain:{value:ringGain(id,true)},uSunLocal:{value:new THREE.Vector3(1,0,0)},uContext:{value:1}};
 const geometry=new THREE.RingGeometry(inner,outer,512,1);geometry.rotateX(-Math.PI/2);
 const mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
 mesh.name='nssdca-optical-depth-rings';mesh.renderOrder=4;mesh.userData.minorRings={id,bands:bands.map(b=>b.name),source:system.url};return mesh;
}
