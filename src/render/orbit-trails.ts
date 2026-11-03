import * as THREE from 'three';
import {catalog} from '../science/catalog';
import {relative,type EphemerisProvider} from '../science/ephemeris';
import {displayPosition,type ScaleMode} from '../science/coordinates';
export type TrailMode='recent'|'history'|'off';
/** Display-only paths sampled from the frozen provider; no orbit fitting or closed circles. */
export class OrbitTrails{
 mode:TrailMode='recent';private scale:ScaleMode|null=null;
 private rows:{id:string;line:THREE.Line;start:number;step:number;count:number;period:number}[]=[];
 constructor(private world:THREE.Scene,private provider:EphemerisProvider){}
 private build(scale:ScaleMode){
  for(const r of this.rows){this.world.remove(r.line);r.line.geometry.dispose();(r.line.material as THREE.Material).dispose();}this.rows=[];
  const m=this.provider.manifest,duration=m.endTdb-m.startTdb;
  for(const b of catalog.slice(1)){
   const step=b.id==='199'?86400:b.id==='299'||b.id==='399'?172800:345600,count=Math.ceil(duration/step)+1;
   const high=new Float32Array(count*3),low=new Float32Array(count*3),times=new Float32Array(count);
   for(let i=0;i<count;i++){const t=Math.min(m.endTdb,m.startTdb+i*step),point=displayPosition(relative(this.provider.state(b.id,t),this.provider.state('10',t)).positionKm,scale);for(let k=0;k<3;k++){high[i*3+k]=point[k];low[i*3+k]=point[k]-high[i*3+k];}times[i]=(t-m.startTdb)/duration;}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(high,3));geometry.setAttribute('aLow',new THREE.BufferAttribute(low,3));geometry.setAttribute('aTime',new THREE.BufferAttribute(times,1));
   const material=new THREE.ShaderMaterial({uniforms:{uHigh:{value:new THREE.Vector3()},uLow:{value:new THREE.Vector3()},uNow:{value:0},uWindow:{value:1},uAlpha:{value:.2},uColor:{value:new THREE.Color(b.id==='399'?'#9cbcd1':'#66859c')}},vertexShader:`
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec3 aLow;attribute float aTime;uniform vec3 uHigh;uniform vec3 uLow;uniform float uNow;uniform float uWindow;varying float vFade;
    void main(){vec3 local=(position-uHigh)+(aLow-uLow);vFade=.22+.78*pow(max(0.,1.-abs(aTime-uNow)/max(.0001,uWindow)),.7);gl_Position=projectionMatrix*modelViewMatrix*vec4(local,1.);
    #include <logdepthbuf_vertex>
    }`,fragmentShader:`
    #include <common>
    #include <logdepthbuf_pars_fragment>
    uniform float uAlpha;uniform vec3 uColor;varying float vFade;
    void main(){
    #include <logdepthbuf_fragment>
    gl_FragColor=vec4(uColor,uAlpha*vFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,transparent:true,depthWrite:false});
   const line=new THREE.Line(geometry,material);line.frustumCulled=false;this.world.add(line);this.rows.push({id:b.id,line,start:m.startTdb,step,count,period:(b.periodYears??1)*365.25*86400});
  }this.scale=scale;
 }
 draw(scale:ScaleMode,selected:string,tdb:number,origin:number[],focus:string|null,enabled:boolean){
  if(this.scale!==scale)this.build(scale);const m=this.provider.manifest,duration=m.endTdb-m.startTdb;
  const high=origin.map(Math.fround),low=origin.map((v,i)=>v-high[i]);
  for(const r of this.rows){r.line.visible=enabled&&this.mode!=='off'&&(!focus||focus==='399');const material=r.line.material as THREE.ShaderMaterial;material.uniforms.uHigh.value.fromArray(high);material.uniforms.uLow.value.fromArray(low);material.uniforms.uNow.value=(tdb-m.startTdb)/duration;
   const window=this.mode==='history'?duration:r.period/2;
   const first=this.mode==='history'?0:Math.max(0,Math.floor((tdb-window-r.start)/r.step));const last=this.mode==='history'?r.count-1:Math.min(r.count-1,Math.ceil((tdb+window-r.start)/r.step));r.line.geometry.setDrawRange(first,Math.max(2,last-first+1));material.uniforms.uWindow.value=window/duration;
   material.uniforms.uAlpha.value=focus==='399'?(r.id==='399'?.18:.035):(r.id===selected?.5:this.mode==='history'?.13:.29);
  }
 }
 snapshot(){return {scale:this.scale,mode:this.mode,visible:this.rows.filter(r=>r.line.visible).length,paths:this.rows.map(r=>({id:r.id,count:r.count,samples:[0,1,Math.floor(r.count/2),r.count-1].map(i=>{const hi=r.line.geometry.getAttribute('position'),lo=r.line.geometry.getAttribute('aLow');return {tdb:Math.min(this.provider.manifest.endTdb,r.start+i*r.step),point:[hi.getX(i)+lo.getX(i),hi.getY(i)+lo.getY(i),hi.getZ(i)+lo.getZ(i)]};}),range:r.line.geometry.drawRange,positionBufferVersion:(r.line.geometry.attributes.position as THREE.BufferAttribute).version}))};}
}
