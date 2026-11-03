import * as THREE from 'three';
import {displayPosition,type ScaleMode} from '../science/coordinates';
import type {SmallBodyEphemeris} from './ephemeris';

const kindColor:Record<string,string>={'dwarf-planet':'#e8c999','asteroid':'#b9b2a6','near-earth':'#e39a7a','kuiper-belt':'#9db6d8','satellite':'#c9c0d8'};
export const kindName:Record<string,string>={'dwarf-planet':'矮行星','asteroid':'小行星','near-earth':'近地小行星','kuiper-belt':'柯伊伯带天体','satellite':'卫星'};
/** Named small bodies on the main scene: Horizons states only (same Hermite evaluator), mapped with the
 * planets' own displayPosition(); markers are screen-size locators, never physical sizes. */
export class NamedSmallBodies{
 readonly group=new THREE.Group();readonly ids:string[];
 private markers:THREE.Points;private trails=new Map<string,THREE.Line>();private trailMode:ScaleMode|null=null;
 private labels=new Map<string,HTMLButtonElement>();readonly positions=new Map<string,THREE.Vector3>();
 constructor(readonly eph:SmallBodyEphemeris,labelHost:HTMLElement,readonly originSource:()=>THREE.Vector3,readonly onSelect:(id:string,focus:boolean)=>void){
  this.ids=eph.manifest.objects.filter(o=>o.centerId==='0').map(o=>o.id);
  const geometry=new THREE.BufferGeometry(),colors=new Float32Array(this.ids.length*3);this.ids.forEach((id,i)=>new THREE.Color(kindColor[eph.meta(id).kind]).toArray(colors,i*3));
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.ids.length*3),3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const dot=document.createElement('canvas');dot.width=dot.height=32;const g=dot.getContext('2d')!;g.fillStyle='#fff';g.beginPath();g.arc(16,16,11,0,Math.PI*2);g.fill();
  this.markers=new THREE.Points(geometry,new THREE.PointsMaterial({size:7,sizeAttenuation:false,vertexColors:true,map:new THREE.CanvasTexture(dot),transparent:true,alphaTest:.3,depthWrite:false}));
  this.markers.frustumCulled=false;this.markers.name='named-small-body-locators';this.markers.renderOrder=2;this.group.add(this.markers);
  this.markers.onBeforeRender=()=>{const o=this.originSource(),p=this.markers.geometry.getAttribute('position') as THREE.BufferAttribute;this.ids.forEach((id,i)=>{const v=this.positions.get(id);if(v)p.setXYZ(i,v.x-o.x,v.y-o.y,v.z-o.z);});p.needsUpdate=true;};
  for(const id of this.ids){
   const m=eph.meta(id),line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:kindColor[m.kind],transparent:true,opacity:.28,depthWrite:false}));line.frustumCulled=false;line.name='horizons-path-'+id;
   line.onBeforeRender=()=>{line.position.copy(this.originSource()).negate();line.updateMatrixWorld();};this.trails.set(id,line);this.group.add(line);
   const label=document.createElement('button');label.className='body-label small-body-label';label.dataset.smallBody=id;label.innerHTML=`<i style="--body:${kindColor[m.kind]}"></i>${m.zh}<small>${m.name} · ${kindName[m.kind]}</small>`;label.setAttribute('aria-label','选中'+m.zh);
   label.onclick=()=>this.onSelect(id,false);label.ondblclick=()=>this.onSelect(id,true);labelHost.append(label);this.labels.set(id,label);this.positions.set(id,new THREE.Vector3());
  }
 }
 private buildTrails(mode:ScaleMode){
  // Paths sample the same Horizons-backed states over the whole 2024–2031 window (no fitted ellipses).
  const m=this.eph.manifest,steps=900;
  for(const [id,line] of this.trails){const a=new Float32Array((steps+1)*3);for(let k=0;k<=steps;k++){const t=m.startTdb+(m.endTdb-m.startTdb)*k/steps;a.set(displayPosition(this.eph.heliocentric(id,t).positionKm,mode),k*3);}line.geometry.setAttribute('position',new THREE.BufferAttribute(a,3));line.geometry.computeBoundingSphere();}
  this.trailMode=mode;
 }
 /** Positions before the scene draws (the focus follow reads them); same displayPosition() as the planets. */
 updatePositions(tdb:number,mode:ScaleMode,visible:boolean,selected:string|null,focused:string|null){
  this.group.visible=visible;if(this.trailMode!==mode)this.buildTrails(mode);
  for(const id of this.ids)this.positions.get(id)!.fromArray(displayPosition(this.eph.heliocentric(id,tdb).positionKm,mode));
  for(const [id,line] of this.trails){line.visible=visible&&(!focused||focused===id)&&(id===selected||this.eph.meta(id).kind==='dwarf-planet');(line.material as THREE.LineBasicMaterial).opacity=id===selected?.7:.24;}
 }
 /** Labels after the scene draws, using this frame's camera; avoids rectangles already taken by planet labels. */
 placeLabels(options:{visible:boolean;selected:string|null;focused:string|null;camera:THREE.Camera;width:number;height:number;occupied:{x:number;y:number;w:number;h:number}[]}){
  const origin=this.originSource();
  for(const [id,label] of this.labels){
   const p=this.positions.get(id)!.clone().sub(origin).project(options.camera),x=(p.x*.5+.5)*options.width,y=(-p.y*.5+.5)*options.height,box={x:x+10,y:y-16,w:150,h:46};
   const free=!options.occupied.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
   const own=options.focused===id;
   const show=options.visible&&(!options.focused||own)&&p.z>-1&&p.z<1&&box.x>0&&box.x+box.w<options.width&&box.y>0&&box.y+box.h<options.height&&(free||id===options.selected);
   label.hidden=!show;label.classList.toggle('selected',id===options.selected);label.style.transform=`translate(${box.x}px,${box.y}px)`;if(show)options.occupied.push(box);
  }
 }
 snapshot(){return this.ids.map(id=>({id,position:this.positions.get(id)!.toArray(),label:!this.labels.get(id)!.hidden,trailVisible:this.trails.get(id)!.visible,trailPoints:this.trails.get(id)!.geometry.getAttribute('position')?.count??0}));}
}
