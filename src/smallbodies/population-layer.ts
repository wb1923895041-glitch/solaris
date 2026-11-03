import * as THREE from 'three';
import {verifiedBuffer} from './ephemeris';

/** Anonymous SBDB osculating-element populations (phase-0 `illustrative-population` rule).
 * Positions: two-body Kepler from each object's epoch, solved per vertex on the GPU for the shared TDB.
 * Real (a, e, i, Ω, ω, M) — so Kirkwood gaps, Hildas, Trojans and Plutinos appear as observed — but no
 * identities and no claim of precise positions (typ. 10⁵–10⁶ km drift vs Horizons over 2024–2031). */
export type PopulationInfo={file:string;sha256:string;count:number;columns:string[];label:string;frame:string;propagation:string;epochRangeJd:number[];droppedIncomplete:number};
const vertex=`
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec4 aShape;attribute vec4 aPhase;attribute float aGroup;
uniform float uDays;uniform float uExploration;uniform vec3 uOrigin;uniform float uPointSize;uniform float uHighlight;
varying vec3 vColor;varying float vAlpha;
const float AU_UNITS=52.0;
void main(){
 float a=aShape.x,e=aShape.y,inc=aShape.z,node=aShape.w,peri=aPhase.x;
 float M=mod(aPhase.y+aPhase.z*(uDays-aPhase.w),6.28318530718);
 float E=M+e*sin(M);
 for(int k=0;k<12;k++){E=E-(E-e*sin(E)-M)/(1.0-e*cos(E));}
 float x=a*(cos(E)-e),y=a*sqrt(max(1.0-e*e,0.0))*sin(E);
 float co=cos(node),so=sin(node),ci=cos(inc),si=sin(inc),cw=cos(peri),sw=sin(peri);
 vec3 ecl=vec3((co*cw-so*sw*ci)*x+(-co*sw-so*cw*ci)*y,(so*cw+co*sw*ci)*x+(-so*sw+co*cw*ci)*y,(sw*si)*x+(cw*si)*y);
 vec3 v=vec3(ecl.x,ecl.z,-ecl.y);float r=length(v);
 // Same maps as displayPosition(): scientific 52 units/au; exploration 52·ln(1+r/0.35 au) along the same direction.
 vec3 p=uExploration>0.5?v*(AU_UNITS*log(1.0+r/0.35)/max(r,1e-6)):v*AU_UNITS;
 vec4 mv=viewMatrix*vec4(p-uOrigin,1.0);gl_Position=projectionMatrix*mv;
 gl_PointSize=uPointSize;
 vColor=aGroup<0.5?vec3(.62,.58,.52):aGroup<1.5?vec3(.80,.66,.44):aGroup<2.5?vec3(.86,.62,.42):aGroup<3.5?vec3(.55,.60,.66):aGroup<4.5?vec3(.52,.66,.82):vec3(.70,.62,.80);
 vAlpha=uHighlight<0.0||abs(aGroup-uHighlight)<0.5?1.0:0.18;
 #include <logdepthbuf_vertex>
}`;
const fragment=`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uOpacity;varying vec3 vColor;varying float vAlpha;
void main(){
 #include <logdepthbuf_fragment>
 vec2 c=gl_PointCoord-.5;if(dot(c,c)>.25)discard;gl_FragColor=vec4(vColor,uOpacity*vAlpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
/** Dynamical groups from the real elements only (for colour and the legend), never from identities. */
export const groupNames=['主带','Hilda 群（木星 3:2）','木星特洛伊（1:1）','匈牙利族 / 内侧','海王星外：经典与散射','冥族小天体（海王星 3:2）'];
function group(a:number,e:number,tno:boolean){if(tno)return a>39.2&&a<39.8?5:4;if(a>5.05&&a<5.35)return 2;if(a>3.7&&a<4.2&&e<.3)return 1;if(a<2.0)return 3;return 0;}
export class PopulationLayer{
 readonly group=new THREE.Group();readonly uniforms={uDays:{value:0},uExploration:{value:1},uOrigin:{value:new THREE.Vector3()},uPointSize:{value:1.6},uOpacity:{value:.55},uHighlight:{value:-1}};
 readonly counts:Record<string,number>={};readonly groupCounts=new Array(groupNames.length).fill(0);visible=true;
 constructor(readonly info:Record<string,PopulationInfo>,data:Record<string,Float32Array>,readonly originSource:()=>THREE.Vector3){
  for(const [name,array] of Object.entries(data)){
   const n=array.length/8,shape=new Float32Array(n*4),phase=new Float32Array(n*4),groups=new Float32Array(n),tno=name==='tno';
   for(let k=0;k<n;k++){const o=k*8;shape.set([array[o],array[o+1],array[o+2],array[o+3]],k*4);phase.set([array[o+4],array[o+5],array[o+6],array[o+7]],k*4);groups[k]=group(array[o],array[o+1],tno);this.groupCounts[groups[k]]++;}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));geometry.setAttribute('aShape',new THREE.BufferAttribute(shape,4));geometry.setAttribute('aPhase',new THREE.BufferAttribute(phase,4));geometry.setAttribute('aGroup',new THREE.BufferAttribute(groups,1));
   const material=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false});
   const points=new THREE.Points(geometry,material);points.name='illustrative-population-'+name;points.frustumCulled=false;points.renderOrder=1;
   // Camera-relative origin read at render time, after the scene has updated its navigation camera this frame.
   points.onBeforeRender=()=>{this.uniforms.uOrigin.value.copy(this.originSource());};
   this.group.add(points);this.counts[name]=n;
  }
 }
 update(tdb:number,exploration:boolean,visible:boolean,heightPx:number){this.uniforms.uDays.value=tdb/86400;this.uniforms.uExploration.value=exploration?1:0;this.group.visible=visible&&this.visible;this.uniforms.uPointSize.value=Math.max(1.2,Math.min(2.4,heightPx/900))*Math.min(devicePixelRatio,1.5);}
}
export async function loadPopulations(){
 const r=await fetch('/smallbodies/populations.json');if(!r.ok)throw Error('小天体统计层清单加载失败');const info=await r.json() as Record<string,PopulationInfo>;const data:Record<string,Float32Array>={};
 await Promise.all(Object.entries(info).map(async([name,p])=>{if(!/^\/smallbodies\/[a-z]+\.f32$/.test(p.file)||p.columns.length!==8)throw Error('统计层契约错误');const array=new Float32Array(await verifiedBuffer(p.file,p.sha256));if(array.length!==p.count*8)throw Error('统计层长度错误');for(const v of array)if(!Number.isFinite(v))throw Error('统计层含非有限值');data[name]=array;}));
 return {info,data};
}
