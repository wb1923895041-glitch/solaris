import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {axes} from '../science/coordinates';
import {catalog} from '../science/catalog';
import type {EphemerisProvider} from '../science/ephemeris';
import type {Vec3} from '../science/contracts';
import {CelestialVisualSystem} from '../render/celestial/system';
import {ringSystems,ringGain} from '../render/celestial/minor-rings';
import type {BodyOrientation} from '../render/celestial/orientation';
import {CelestialSky} from '../render/sky';
import {RenderProfiler} from '../render/celestial/profiling';
import type {SatelliteEphemeris,SatelliteMeta} from './ephemeris';
import {MoonOrientation,MoonVisuals,icrfToDisplay,type MoonAsset,type MoonModel} from './moon-visual';
import {loadMoonResources} from './asset-contract';
import {localPosition,localRadius,orbitGeometry,spinAxis,isLinear,systemPlanets,type LocalScale} from './local-mapping';
import {moonKnowledge} from './moon-knowledge';
import './planetary-system.css';

/** 3C local planetary systems. Truth comes only from the 3A ephemeris (one state function for bodies and tracks)
 * and the 3B attitude/asset manifests; display mapping, camera and labels never write back. */
export type MoonMeta=Pick<SatelliteMeta,'id'|'parentPlanetId'|'zh'|'name'|'characteristicRadiusKm'|'sampledMeanPeriodDays'|'physical'|'solution'|'stepSeconds'|'orientation'>;
type RelState={positionKm:Vec3;velocityKmPerSec:Vec3;timeTdb:number};
/** Structural subset of SatelliteEphemeris; phase 4 adds Charon through the same contract. */
export interface MoonSource{manifest:{startTdb:number;endTdb:number;objects:MoonMeta[]};meta(id:string):MoonMeta;relativeState(id:string,tdb:number):RelState;track(id:string,tdb:number,segments?:number):RelState[]}
/** The body at the centre of a local system: a phase-2 planet asset or an asset-backed small body. Unit radius = radiusKm. */
export interface SystemParent{id:string;zh:string;en:string;kindLabel:string;radiusKm:number;assetNote:string;object:THREE.Object3D;boundingRadius:number;
 attitude(tdb:number):THREE.Quaternion;positionSSB(tdb:number):Vec3;update(pixelDiameter:number,sunLocal:THREE.Vector3,sunDirection:THREE.Vector3,tdb:number):void;snapshot():unknown}
type Moon={id:string;meta:MoonMeta;asset:MoonAsset;model:MoonModel|null;error:string|null;track:THREE.Line;trackTdb:number;trackScale:LocalScale|null;
 position:THREE.Vector3;radius:number;label:HTMLButtonElement;marker:HTMLElement;item:HTMLButtonElement;pixelRadius:number;onScreen:boolean};
type Transition={fromTarget:THREE.Vector3;fromOffset:THREE.Vector3;toOffset:THREE.Vector3;target:()=>THREE.Vector3;start:number;duration:number;minClearance:number;maxStepDegrees:number;last:THREE.Quaternion|null;frames:number;fromCamera:THREE.Vector3;aroundPlanet:boolean;lastNow:number;maxFrameMs:number;q0:THREE.Quaternion;s:number};
const EMB_FRACTION=0.0121505830; // Earth→EMB along Earth→Moon, measured against JPL EMB states in 3A (fixed-date residual < 0.002 km).
const fmt=(v:number,d=0)=>v.toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d});

export class PlanetarySystemView{
 readonly renderer:THREE.WebGLRenderer;readonly profiler:RenderProfiler;
 private world=new THREE.Scene();private sky=new CelestialSky();
 private camera=new THREE.PerspectiveCamera(40,1,1e-6,1e4);private navigation=new THREE.PerspectiveCamera(40,1,1e-6,1e4);private controls:OrbitControls;
 private light=new THREE.DirectionalLight('#fff6e8',3.1);
 private parents=new Map<string,SystemParent>();private parentObject:SystemParent|null=null;
 private moonVisuals:MoonVisuals;private moonOrientation:MoonOrientation;private registry:{bodies:MoonAsset[]};
 private moons=new Map<string,Moon>();private emb:HTMLElement;
 planet:string|null=null;selected:string|null=null;focus:string='planet';follow=true;scale:LocalScale='exploration';orbitsVisible=true;
 private transition:Transition|null=null;private previousFocus=new THREE.Vector3();private lastTdb=NaN;private lastUtc='';private lastText=0;private lastPanel=0;
 private sunDirection=new THREE.Vector3(1,0,0);private spin=new THREE.Vector3(0,1,0);private minClearance=Infinity;private transitionLog:{planet:string|null;to:string;minClearance:number;maxStepDegrees:number;durationMs:number;frames:number;maxFrameMs:number;aroundPlanet:boolean;cancelled?:string}[]=[];
 private stage:HTMLElement;private labels:HTMLElement;private list:HTMLElement;private panel:HTMLElement;private search:HTMLInputElement;
 onExit:(toOverview:boolean)=>void=()=>{};
 constructor(readonly host:HTMLElement,readonly satellites:MoonSource,readonly provider:EphemerisProvider,readonly makeParent:(id:string,renderer:THREE.WebGLRenderer,visuals:MoonVisuals,orientation:MoonOrientation)=>Promise<SystemParent>,resources:{registry:any;orientation:any}){
  host.innerHTML=`<div class="ps-head"><nav class="ps-crumbs" aria-label="所在系统"></nav><div class="ps-scale" role="group" aria-label="局部比例模式"><button data-scale="scientific">科学比例</button><button data-scale="exploration">探索比例</button><button data-scale="closeup">近景</button></div><button id="ps-orbits" aria-pressed="true">◌ 轨道</button><button id="ps-follow" aria-pressed="true">⊙ 跟随</button><button id="ps-planet">返回行星</button><button id="ps-exit" aria-label="返回太阳系总览">返回总览 ×</button></div>
  <div class="ps-body"><aside class="ps-list"><label class="search"><span>⌕</span><input id="ps-search" type="search" placeholder="搜索卫星" aria-label="搜索卫星"></label><div class="ps-items"></div><img class="ps-hover" alt="" hidden><p class="ps-list-note">按当前星历距行星中心的典型距离排序 · 悬停查看真实影像缩略图</p></aside>
  <div class="ps-stage"><div class="ps-canvas"></div><div class="ps-labels"></div><p class="ps-badge"></p><p class="ps-epoch"></p></div><aside class="ps-panel" aria-live="polite"></aside></div>`;
  this.stage=host.querySelector('.ps-canvas')!;this.labels=host.querySelector('.ps-labels')!;this.list=host.querySelector('.ps-items')!;this.panel=host.querySelector('.ps-panel')!;this.search=host.querySelector('#ps-search')!;
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',logarithmicDepthBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;this.renderer.setClearColor('#03070d');this.renderer.autoClear=false;
  this.stage.append(this.renderer.domElement);this.profiler=new RenderProfiler(this.renderer);this.world.add(this.light,this.light.target);
  this.controls=new OrbitControls(this.navigation,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.enablePan=false;this.controls.maxDistance=600;this.controls.addEventListener('start',()=>this.cancelTransition('user'));
  this.registry=resources.registry;this.moonOrientation=new MoonOrientation(resources.orientation);this.moonVisuals=new MoonVisuals(resources.registry,this.renderer,7);
  this.emb=document.createElement('span');this.emb.className='ps-emb';this.emb.textContent='地月质心';this.labels.append(this.emb);
  for(const b of host.querySelectorAll<HTMLButtonElement>('[data-scale]'))b.onclick=()=>this.setScale(b.dataset.scale as LocalScale);
  host.querySelector<HTMLButtonElement>('#ps-orbits')!.onclick=()=>this.setOrbits(!this.orbitsVisible);host.querySelector<HTMLButtonElement>('#ps-follow')!.onclick=()=>this.setFollow(!this.follow);
  host.querySelector<HTMLButtonElement>('#ps-planet')!.onclick=()=>this.focusPlanet();host.querySelector<HTMLButtonElement>('#ps-exit')!.onclick=()=>this.onExit(true);
  this.search.oninput=()=>this.renderList();
  const canvas=this.renderer.domElement;let down={x:0,y:0};canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  const pick=(e:MouseEvent)=>{const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);const roots=[...this.moons.values()].flatMap(m=>m.model?[m.model.root]:[]);const hit=ray.intersectObjects(roots,true)[0];let o:THREE.Object3D|null=hit?.object??null;while(o&&!o.userData.moonId)o=o.parent;return o?.userData.moonId as string|undefined;};
  canvas.addEventListener('click',e=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const id=pick(e);if(id)this.selectMoon(id,false);});
  canvas.addEventListener('dblclick',e=>{const id=pick(e);if(id)this.selectMoon(id,true);});
 }
 get open(){return !this.host.hidden;}
 /** Enter a planet system. `entryOffset` is the main-scene camera offset direction, so the hand-over keeps the same view side. */
 async enter(planetId:string,entryOffset:THREE.Vector3,tdb:number,moonId?:string){
  if(!systemPlanets.includes(planetId as any)&&!this.makeParentAllowed(planetId))throw Error('该天体没有局部系统');
  let parent=this.parents.get(planetId);if(!parent){parent=await this.makeParent(planetId,this.renderer,this.moonVisuals,this.moonOrientation);this.parents.set(planetId,parent);}
  if(this.planet!==planetId){this.clearSystem();this.planet=planetId;this.parentObject=parent;this.buildSystem();}
  this.lastTdb=tdb;this.updateGeometry(tdb);
  this.selected=null;this.focus='planet';this.renderList();this.renderCrumbs();this.panelDirty();
  const dir=entryOffset.clone().normalize();this.navigation.position.copy(dir.multiplyScalar(4.6));this.controls.target.set(0,0,0);this.navigation.up.set(0,1,0);this.navigation.lookAt(0,0,0);this.controls.update();this.previousFocus.set(0,0,0);this.minClearance=Infinity;
  this.syncButtons();this.frameSystem(1500);if(moonId)this.selectMoon(moonId,true);
 }
 private buildSystem(){
  const planet=this.planet!;this.world.add(this.parentObject!.object);
  const ids=this.satellites.manifest.objects.filter(o=>o.parentPlanetId===planet).sort((a,b)=>a.characteristicRadiusKm-b.characteristicRadiusKm).map(o=>o.id);
  for(const id of ids){
   const meta=this.satellites.meta(id),asset=this.registry.bodies.find(a=>a.naifId===id)!;
   const track=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#7fa6c2',transparent:true,opacity:.42,depthWrite:false}));track.frustumCulled=false;track.name='ephemeris-track-'+id;this.world.add(track);
   const label=document.createElement('button');label.className='ps-label';label.innerHTML=`${meta.zh}<small>${meta.name}</small>`;label.onclick=()=>this.selectMoon(id,false);label.ondblclick=()=>this.selectMoon(id,true);
   const marker=document.createElement('span');marker.className='ps-marker';this.labels.append(marker,label);
   const item=document.createElement('button');
   const moon:Moon={id,meta,asset,model:null,error:null,track,trackTdb:NaN,trackScale:null,position:new THREE.Vector3(),radius:0,label,marker,item,pixelRadius:0,onScreen:false};this.moons.set(id,moon);
   void this.orientationAndModel(moon);
  }
 }
 private async orientationAndModel(moon:Moon){try{await this.moonOrientation.load(moon.id);const model=await this.moonVisuals.load(moon.id);if(this.moons.get(moon.id)!==moon)return;model.root.userData.moonId=moon.id;moon.model=model;this.world.add(model.root);}catch(e){moon.error=String(e);}}
 private clearSystem(){
  for(const m of this.moons.values()){m.track.geometry.dispose();(m.track.material as THREE.Material).dispose();m.track.removeFromParent();m.model?.root.removeFromParent();m.label.remove();m.marker.remove();}
  this.moons.clear();this.parentObject?.object.removeFromParent();this.transition=null;
 }
 close(){this.host.hidden=true;}
 // ---------- selection, camera and modes ----------
 selectMoon(id:string,focus:boolean){
  const parent=this.satellites.meta(id).parentPlanetId;if(parent!==this.planet){void this.enter(parent,this.navigation.position.clone().sub(this.controls.target),this.tdbOr(),id);return;}
  this.selected=id;this.renderList();this.renderCrumbs();this.panelDirty();if(focus||this.focus!=='planet')this.focusMoon(id);
 }
 focusMoon(id:string){
  const moon=this.moons.get(id);if(!moon)return;this.selected=id;this.focus=id;this.follow=true;this.syncButtons();this.renderCrumbs();this.renderList();this.panelDirty();
  const offset=this.navigation.position.clone().sub(this.controls.target).normalize(),side=new THREE.Vector3().crossVectors(this.sunDirection,this.spin).normalize();
  const dir=this.sunDirection.clone().multiplyScalar(.85).addScaledVector(offset,.45).addScaledVector(side,.25).normalize();
  const radius=this.displayRadius(moon);this.move(()=>this.moonTarget(id),dir.multiplyScalar(radius*(this.scale==='closeup'?2.5:6.5)),1500);
 }
 focusPlanet(){this.focus='planet';this.syncButtons();this.renderCrumbs();this.panelDirty();this.frameSystem(1500);}
 private frameSystem(duration:number){
  const maxR=Math.max(1.2,...[...this.moons.values()].map(m=>new THREE.Vector3(...localPosition(this.satellites.relativeState(m.id,this.tdbOr()).positionKm,this.parentRadius(),this.scale==='closeup'?'scientific':this.scale)).length()));
  const offset=this.navigation.position.clone().sub(this.controls.target).normalize(),side=offset.dot(this.spin)>=0?1:-1;
  // Oblique (~30–40° above the orbit plane) so real inclinations and eccentricities stay visible, not a pole-on bullseye.
  const inPlane=offset.clone().addScaledVector(this.spin,-offset.dot(this.spin));if(inPlane.lengthSq()<1e-6)inPlane.crossVectors(this.spin,new THREE.Vector3(1,0,0));const dir=inPlane.normalize().addScaledVector(this.spin,side*.62).normalize();this.move(()=>new THREE.Vector3(),dir.multiplyScalar(maxR*1.2/Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*(this.camera.aspect<1.4?1.25:1)),duration);
 }
 setScale(scale:LocalScale){
  if(scale==='closeup'&&this.focus==='planet'){const id=this.selected??[...this.moons.keys()][0];this.scale='closeup';this.focusMoon(id);}
  else{this.scale=scale;this.focus==='planet'?this.frameSystem(1100):this.focusMoon(this.focus);}
  this.syncButtons();this.panelDirty();
 }
 setOrbits(visible:boolean){this.orbitsVisible=visible;this.syncButtons();}
 setFollow(follow:boolean){this.follow=follow;if(follow&&this.focus!=='planet')this.previousFocus.copy(this.moonTarget(this.focus));this.syncButtons();}
 /** A user drag/wheel takes over: keep the camera where it is and re-anchor follow to the current focus, so no stale offset jumps in. */
 private cancelTransition(reason:string){const t=this.transition;if(!t)return;this.transition=null;this.previousFocus.copy(this.focus==='planet'?new THREE.Vector3():this.moonTarget(this.focus));this.transitionLog.push({planet:this.planet,to:this.focus,minClearance:t.minClearance,maxStepDegrees:t.maxStepDegrees,durationMs:t.duration,frames:t.frames,maxFrameMs:t.maxFrameMs,aroundPlanet:t.aroundPlanet,cancelled:reason});}
 private move(target:()=>THREE.Vector3,toOffset:THREE.Vector3,duration:number){
  // If the straight camera path would pass close to the planet, fly around it instead (radius never below the smaller endpoint).
  const from=this.navigation.position.clone(),to=target().add(toOffset),seg=to.clone().sub(from),u=THREE.MathUtils.clamp(-from.dot(seg)/Math.max(seg.lengthSq(),1e-12),0,1),closest=from.clone().addScaledVector(seg,u).length();
  this.transition={fromTarget:this.controls.target.clone(),fromOffset:from.clone().sub(this.controls.target),toOffset,target,start:performance.now(),duration,minClearance:Infinity,maxStepDegrees:0,last:null,frames:0,fromCamera:from,aroundPlanet:closest<1.6&&from.length()>1.2&&to.length()>1.2,lastNow:performance.now(),maxFrameMs:0,q0:this.navigation.quaternion.clone(),s:0};
 }
 private tdbOr(){return Number.isFinite(this.lastTdb)?this.lastTdb:this.satellites.manifest.startTdb;}
 private parentRadius(){return this.parentObject!.radiusKm;}
 private makeParentAllowed(id:string){return this.satellites.manifest.objects.some(o=>o.parentPlanetId===id)||this.allowEmpty.has(id);}
 /** Asset-backed bodies without moons (Ceres, Vesta) open as single-body local views. */
 readonly allowEmpty=new Set<string>();
 private displayRadius(m:Moon){return localRadius(m.meta.physical.radiusKm,this.parentRadius(),this.scale);}
 private moonTarget(id:string){return this.moons.get(id)?.position.clone()??new THREE.Vector3();}
 // ---------- per-frame ----------
 draw(tdb:number,utc:string,now:number){
  if(this.host.hidden||!this.planet)return;this.lastTdb=tdb;this.lastUtc=utc;const planet=this.planet,parentRadius=this.parentRadius(),mapping:LocalScale=this.scale;
  const parentBody=this.parentObject!,q=parentBody.attitude(tdb);this.updateGeometry(tdb);
  // Camera: transition, then follow; the camera never enters a body.
  const focusPoint=this.focus==='planet'?new THREE.Vector3():this.moonTarget(this.focus);
  if(this.transition){const t=this.transition,u=Math.min(1,(now-t.start)/t.duration),s=u*u*(3-2*u);t.s=s;const target=t.fromTarget.clone().lerp(t.target(),s);
   const a=t.fromOffset.clone().normalize(),b=t.toOffset.clone().normalize(),dir=new THREE.Vector3().copy(a).applyQuaternion(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(a,b),s)),dist=Math.exp(THREE.MathUtils.lerp(Math.log(t.fromOffset.length()),Math.log(t.toOffset.length()),s));
   this.controls.target.copy(target);this.navigation.position.copy(target).addScaledVector(dir,dist);
   if(t.aroundPlanet){const end=t.target().add(t.toOffset),a0=t.fromCamera.clone().normalize(),a1=end.clone().normalize(),turn=new THREE.Quaternion().setFromUnitVectors(a0,a1);this.navigation.position.copy(a0.applyQuaternion(new THREE.Quaternion().slerp(turn,s))).multiplyScalar(Math.exp(THREE.MathUtils.lerp(Math.log(t.fromCamera.length()),Math.log(end.length()),s)));
    // Arc out of the orbital plane (along the true spin axis) so the fly-around never grazes moons on near-equatorial orbits; zero at both ends.
    const side=t.fromCamera.dot(this.spin)>=0?1:-1;this.navigation.position.addScaledVector(this.spin,side*.45*Math.max(t.fromCamera.length(),end.length())*Math.sin(Math.PI*s));}if(u===1){this.transition=null;this.previousFocus.copy(focusPoint);this.transitionLog.push({planet:this.planet,to:this.focus,minClearance:t.minClearance,maxStepDegrees:t.maxStepDegrees,durationMs:t.duration,frames:t.frames,maxFrameMs:Math.max(t.maxFrameMs,now-t.lastNow),aroundPlanet:t.aroundPlanet});if(this.transitionLog.length>400)this.transitionLog.shift();}}
  else if(this.follow){const delta=focusPoint.clone().sub(this.previousFocus);this.navigation.position.add(delta);this.controls.target.add(delta);this.previousFocus.copy(focusPoint);}
  else this.previousFocus.copy(focusPoint);
  const focusRadius=this.focus==='planet'?parentBody.boundingRadius:this.moons.get(this.focus)?.radius??.01;this.controls.minDistance=focusRadius*1.15;this.controls.update();
  const clearance=this.clearBodies();
  // During a transition the view direction is slerped between the start and the final look-at pose (bounded angular rate,
  // no swing as the path passes near the target); afterwards it is the ordinary look-at of the orbit controls.
  if(this.transition){const t=this.transition,endTarget=t.target(),endCam=endTarget.clone().add(t.toOffset),qEnd=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(endCam,endTarget,this.navigation.up));this.navigation.quaternion.copy(t.q0).slerp(qEnd,t.s);}
  else this.navigation.lookAt(this.controls.target);if(this.transition){const t=this.transition;t.minClearance=Math.min(t.minClearance,clearance);t.frames++;const n=performance.now();t.maxFrameMs=Math.max(t.maxFrameMs,n-t.lastNow);t.lastNow=n;if(t.last)t.maxStepDegrees=Math.max(t.maxStepDegrees,THREE.MathUtils.radToDeg(t.last.angleTo(this.navigation.quaternion)));t.last=this.navigation.quaternion.clone();}this.minClearance=Math.min(this.minClearance,clearance);
  this.navigation.updateMatrixWorld();this.camera.quaternion.copy(this.navigation.quaternion);this.camera.position.set(0,0,0);this.camera.near=Math.max(1e-7,Math.min(.01,clearance*.2));this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  // Camera-relative placement (double precision subtraction before the Float32 upload).
  const cam=this.navigation.position,h=this.stage.clientHeight,tanHalf=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
  const mesh=parentBody.object;mesh.position.copy(cam).negate();mesh.quaternion.copy(q);mesh.scale.setScalar(1);
  const sunLocal=this.sunDirection.clone().applyQuaternion(q.clone().invert());parentBody.update(h/(cam.length()*tanHalf),sunLocal,this.sunDirection,tdb);
  this.light.position.copy(this.sunDirection);this.light.target.position.set(0,0,0);
  for(const m of this.moons.values()){
   const rel=m.position.clone().sub(cam);m.pixelRadius=m.radius/Math.max(rel.length(),1e-9)*h/(2*tanHalf);
   if(m.model&&m.model.status!=='disposed'){const root=m.model.root;root.position.copy(rel);root.scale.setScalar(m.radius);root.quaternion.copy(icrfToDisplay).multiply(this.moonOrientation.at(m.id,tdb));
    root.traverse(o=>{if((o instanceof THREE.Mesh||o instanceof THREE.Points)&&o.material instanceof THREE.ShaderMaterial){if(o.material.uniforms.sunDirection)o.material.uniforms.sunDirection.value.copy(this.sunDirection);if(o.material.uniforms.uPointScale)o.material.uniforms.uPointScale.value=m.radius;}});
    const px=m.pixelRadius*2;if(px>60)void this.moonVisuals.upgrade(m.model,px>850?4096:px>350?2048:1024).catch(e=>{m.error=String(e);});}
   if(m.trackTdb!==tdb&&(!Number.isFinite(m.trackTdb)||Math.abs(tdb-m.trackTdb)>m.meta.sampledMeanPeriodDays*86400/720)||m.trackScale!==mapping)this.updateTrack(m,tdb,parentRadius,mapping);
   m.track.position.copy(cam).negate();m.track.visible=this.orbitsVisible;(m.track.material as THREE.LineBasicMaterial).opacity=m.id===this.selected?.85:.38;(m.track.material as THREE.LineBasicMaterial).color.set(m.id===this.selected?'#d9bb8f':'#7fa6c2');
  }
  this.profiler.begin();this.renderer.clear();this.renderer.render(this.sky.scene,this.camera);this.renderer.clearDepth();this.renderer.render(this.world,this.camera);this.profiler.end();
  this.placeLabels(parentRadius);
  if(now-this.lastText>150){this.lastText=now;this.host.querySelector('.ps-epoch')!.textContent=`${utc} · 卫星位置：3A JPL 星历同一 TDB · 姿态：IAU 通用近似 · 光照：真实太阳方向`;this.host.querySelector('.ps-badge')!.textContent=this.scale==='exploration'?'探索比例 · 非真实比例：距离按 1+2.2·ln(r) 压缩，卫星最小显示半径 0.09 行星半径':this.scale==='closeup'?'近景 · 科学线性比例，相机靠近；显示观测 / 重建范围':`科学比例 · 1 单位 = 1 个${parentBody.zh}半径（${fmt(parentRadius,1)} km），距离与半径同一线性映射`;}
  if(now-this.lastPanel>500){this.lastPanel=now;this.renderPanel(tdb);}
 }
 /** Sun direction, true parent spin vector and every moon's display position at one TDB. */
 private updateGeometry(tdb:number){
  const body=this.parentObject!,parentRadius=this.parentRadius(),sun=this.provider.state('10',tdb),parent=body.positionSSB(tdb);
  this.sunDirection.set(...axes(sun.positionKm.map((v,i)=>v-parent[i]) as unknown as Vec3)).normalize();
  this.spin.copy(spinAxis(body.attitude(Math.max(tdb-300,this.satellites.manifest.startTdb)),body.attitude(Math.min(tdb+300,this.satellites.manifest.endTdb))));
  for(const m of this.moons.values()){const s=this.satellites.relativeState(m.id,tdb);m.position.fromArray(localPosition(s.positionKm,parentRadius,this.scale));m.radius=localRadius(m.meta.physical.radiusKm,parentRadius,this.scale);}
 }
 private updateTrack(m:Moon,tdb:number,parentRadius:number,mapping:LocalScale){
  // Track points come from the same relativeState function as the body (via SatelliteEphemeris.track).
  const states=this.satellites.track(m.id,tdb,384),array=new Float32Array(states.length*3);states.forEach((s,i)=>array.set(localPosition(s.positionKm,parentRadius,mapping),i*3));
  m.track.geometry.setAttribute('position',new THREE.BufferAttribute(array,3));m.track.geometry.computeBoundingSphere();m.trackTdb=tdb;m.trackScale=mapping;
 }
 /** Push the camera outside the planet and every moon; returns the smallest surface clearance (display units). */
 private clearBodies(){
  const cam=this.navigation.position,R=this.parentObject?.boundingRadius??1;let clearance=cam.length()-R;
  if(cam.length()<R*1.06){cam.setLength(R*1.06);clearance=R*.06;}
  for(const m of this.moons.values()){const d=cam.clone().sub(m.position),r=m.radius*(m.model?.radius??1);if(d.length()<r*1.06){d.setLength(r*1.06);cam.copy(m.position).add(d);}clearance=Math.min(clearance,cam.distanceTo(m.position)-r);}
  return clearance;
 }
 private placeLabels(parentRadius:number){
  const w=this.stage.clientWidth,h=this.stage.clientHeight,occupied:{x:number;y:number;w:number;h:number}[]=[],cam=this.navigation.position;
  const project=(p:THREE.Vector3)=>{const v=p.clone().sub(cam).project(this.camera);return {x:(v.x*.5+.5)*w,y:(-v.y*.5+.5)*h,front:v.z>-1&&v.z<1};};
  const ordered=[...this.moons.values()].sort((a,b)=>(a.id===this.selected?-1:0)-(b.id===this.selected?-1:0));
  for(const m of ordered){const p=project(m.position),r=Math.min(m.pixelRadius,80),box={x:p.x+r+10,y:p.y-14,w:112,h:38};
   const free=!occupied.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y),inside=p.front&&p.x>0&&p.x<w&&p.y>0&&p.y<h;m.onScreen=inside;
   const hideLabel=!inside||!free||m.pixelRadius>110;m.label.hidden=hideLabel;m.label.classList.toggle('selected',m.id===this.selected);m.label.style.transform=`translate(${box.x}px,${box.y}px)`;if(!hideLabel)occupied.push(box);
   // Screen marker only for sub-pixel bodies: a locator ring, never a size.
   m.marker.hidden=!inside||m.pixelRadius>3;m.marker.style.transform=`translate(${p.x}px,${p.y}px)`;m.marker.classList.toggle('selected',m.id===this.selected);
  }
  if(this.planet==='399'&&this.moons.has('301')){const moon=this.satellites.relativeState('301',this.lastTdb),embKm=moon.positionKm.map(v=>v*EMB_FRACTION) as unknown as Vec3,p=project(new THREE.Vector3(...localPosition(embKm,parentRadius,this.scale)));this.emb.hidden=!p.front||this.focus!=='planet';this.emb.style.transform=`translate(${p.x}px,${p.y}px)`;}else this.emb.hidden=true;
 }
 // ---------- UI ----------
 private syncButtons(){
  for(const b of this.host.querySelectorAll<HTMLButtonElement>('[data-scale]'))b.setAttribute('aria-pressed',String(b.dataset.scale===this.scale));
  const orbits=this.host.querySelector('#ps-orbits')!,follow=this.host.querySelector<HTMLButtonElement>('#ps-follow')!;orbits.setAttribute('aria-pressed',String(this.orbitsVisible));orbits.textContent=this.orbitsVisible?'◌ 轨道已显示':'◌ 轨道已隐藏';
  follow.setAttribute('aria-pressed',String(this.follow));follow.textContent=this.follow?'⊙ 跟随中':'⊙ 不跟随';follow.disabled=this.focus==='planet';this.host.querySelector<HTMLButtonElement>('#ps-planet')!.disabled=this.focus==='planet';
 }
 private renderCrumbs(){
  const nav=this.host.querySelector('.ps-crumbs')!,planet=this.parentObject!;nav.replaceChildren();
  const add=(text:string,onclick:(()=>void)|null)=>{const b=document.createElement('button');b.textContent=text;if(onclick)b.onclick=onclick;else b.setAttribute('aria-current','location');nav.append(b);};
  add('太阳系',()=>this.onExit(true));nav.append('/');add(planet.zh,this.focus==='planet'&&!this.selected?null:()=>{this.selected=null;this.focusPlanet();this.renderList();});
  if(this.selected){nav.append('/');add(this.satellites.meta(this.selected).name,null);}
 }
 private renderList(){
  const q=this.search.value.trim().toLowerCase();this.list.replaceChildren();
  const objects=q?this.satellites.manifest.objects.filter(o=>`${o.id}${o.zh}${o.name.toLowerCase()}`.includes(q)):this.satellites.manifest.objects.filter(o=>o.parentPlanetId===this.planet);
  for(const o of [...objects].sort((a,b)=>a.parentPlanetId===b.parentPlanetId?a.characteristicRadiusKm-b.characteristicRadiusKm:Number(a.parentPlanetId)-Number(b.parentPlanetId))){
   const asset=this.registry.bodies.find(a=>a.naifId===o.id)!,thumb=asset.lods[0]?.url,item=document.createElement('button');item.className='ps-item';item.dataset.moonId=o.id;item.classList.toggle('active',o.id===this.selected);
   const other=o.parentPlanetId!==this.planet?` · ${catalog.find(b=>b.id===o.parentPlanetId)?.zh??'冥王星'}`:'';
   item.innerHTML=`<span class="ps-thumb" ${thumb?`style="background-image:url('${thumb}')"`:''} data-kind="${asset.shapeType}"></span><span><strong>${o.zh}</strong><small>${o.name}${other}</small></span><span class="ps-dist">${fmt(o.characteristicRadiusKm/1e4,1)} 万 km</span>`;item.title=thumb?`${o.zh} · 悬停预览真实影像`:asset.shapeType==='irregular-mesh'?'实测不规则网格 · 无全球贴图':'可见光雾霾重建 · 无地表影像';
   const hover=this.host.querySelector<HTMLImageElement>('.ps-hover')!;item.onmouseenter=item.onfocus=()=>{if(!thumb){hover.hidden=true;return;}hover.src=thumb;hover.alt=o.zh+' 真实影像缩略图';hover.style.top=`${item.getBoundingClientRect().top-this.host.querySelector('.ps-body')!.getBoundingClientRect().top}px`;hover.hidden=false;};item.onmouseleave=item.onblur=()=>{hover.hidden=true;};
   item.onclick=()=>this.selectMoon(o.id,true);this.list.append(item);
  }
  if(!objects.length){const p=document.createElement('p');p.className='ps-empty';p.textContent='没有匹配的卫星';this.list.append(p);}
 }
 private panelDirty(){this.lastPanel=0;}
 private renderPanel(tdb:number){
  const card=(title:string,rows:[string,string][],text?:string)=>`<section class="ps-card"><h4>${title}</h4>${rows.length?`<dl>${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`:''}${text?`<p>${text}</p>`:''}</section>`;
  const planet=this.parentObject!;let html='';
  if(!this.selected){
   const rows=[...this.moons.values()].map(m=>{const s=this.satellites.relativeState(m.id,tdb),g=orbitGeometry(s.positionKm,s.velocityKmPerSec,this.spin);return [m.meta.zh,`${fmt(Math.hypot(...s.positionKm))} km · ${g.prograde?'顺行':'逆行'} · 赤道倾角 ${g.inclinationToParentEquatorDegrees.toFixed(2)}°`] as [string,string];});
   html+=`<p class="ps-kicker">LOCAL SYSTEM · ${planet.en.toUpperCase()}</p><h3>${planet.zh}${this.moons.size?'系统':''}</h3><p class="ps-lead">${planet.kindLabel} · ${this.moons.size?this.moons.size+' 颗重点卫星。位置均为同一 TDB 时刻、以'+planet.zh+'本体中心（'+planet.id+'）为原点的 JPL 星历状态；轨道线由同一状态函数在 ±半个平均周期内采样。':'单天体局部视图：真实太阳方向光照与 IAU 姿态。'}</p>`;
   if(rows.length)html+=card('当前卫星状态',rows);html+=card('系统要点',[],this.systemNotes(tdb));
   html+=card('数据来源',[['中心天体资产',planet.assetNote],['卫星星历',[...new Set([...this.moons.values()].map(m=>m.meta.solution))].join(' / ')||'—'],['参考系','ICRF · TDB · km · km/s'],['自转方向','由 IAU 姿态相邻样本求得的真实自转矢量']],'本期未计算日食、掩食、行星阴影或环影；不以示意代替当日现象。');
  }else{
   const m=this.moons.get(this.selected)!,s=this.satellites.relativeState(m.id,tdb),g=orbitGeometry(s.positionKm,s.velocityKmPerSec,this.spin),k=moonKnowledge[m.id],a=m.asset,meta=m.meta;
   let sub='';try{const bodyToIcrf=this.moonOrientation.at(m.id,tdb),toPlanet=new THREE.Vector3(...s.positionKm.map(v=>-v)).normalize().applyQuaternion(bodyToIcrf.clone().invert());sub=`经度 ${THREE.MathUtils.radToDeg(Math.atan2(toPlanet.y,toPlanet.x)).toFixed(2)}° · 纬度 ${THREE.MathUtils.radToDeg(Math.asin(toPlanet.z)).toFixed(2)}°`;}catch{sub='姿态加载中';}
   const shape=a.shapeType==='irregular-mesh'?'实测不规则网格':a.shapeType==='displaced-sphere'?'实测高程球面':a.kind==='titan-opaque-haze'?'可见光不透明大气重建':'PCK 三轴椭球 + 独立影像';
   html+=`<p class="ps-kicker">NATURAL SATELLITE · ${meta.id}</p><h3>${meta.zh}</h3><p class="ps-en">${meta.name} · ${planet.zh}的卫星</p><div class="ps-tags"><span>位置：JPL 星历</span><span>姿态：IAU 近似</span><span>${a.albedo.processingCategory.startsWith('OBSERVED')?'表面：观测':'表面：重建'}</span>${this.scale==='exploration'?'<span class="warn">探索比例</span>':''}</div>`;
   html+=card('参数',[['平均半径',`${fmt(meta.physical.radiusKm,2)} ± ${meta.physical.radiusUncertaintyKm} km`],['形状',shape],['NAIF ID',meta.id],['所属行星',`${planet.zh} ${planet.id}`]]);
   html+=card('轨道',[['距行星中心',`${fmt(Math.hypot(...s.positionKm))} km`],['相对速度',`${Math.hypot(...s.velocityKmPerSec).toFixed(4)} km/s`],['典型距离',`${fmt(meta.characteristicRadiusKm)} km`],['平均公转周期',`${meta.sampledMeanPeriodDays.toFixed(4)} 天`],['方向',g.prograde?'顺行（与行星自转同向）':'逆行（与行星自转反向）'],['相对行星赤道',`${g.inclinationToParentEquatorDegrees.toFixed(2)}°`],['相对黄道',`${g.inclinationToEclipticDegrees.toFixed(2)}°`]],'倾角为当前状态矢量 r×v 的瞬时轨道面；周期为 3A 缓存最小二乘采样平均值。');
   html+=card('表面',[['来源',a.albedo.provider],['处理',a.albedo.processingCategory]],`${k.surface}<br><small>${a.reconstructionNotes}</small>`);
   html+=card('自转与锁定',[['子行星点',sub]],k.rotation);
   html+=card('探索记录',[],k.missions);
   html+=card('数据来源',[['星历',`JPL ${meta.solution} · 以 ${planet.id} 为中心`],['覆盖','2024-01-01 — 2031-01-01 UTC'],['采样',`${meta.stepSeconds/60} 分钟 · 既有 Hermite 求值器`],['姿态',`pck00011 ${meta.orientation.frame} · 非导航级`],['影像',`<a href="${a.albedo.uri}" target="_blank" rel="noreferrer">${a.albedo.title} ↗</a>`]],`${a.albedo.rights}${k.note?'<br>'+k.note:''}${this.scale==='closeup'?'<br><b>近景观测范围：</b>'+a.limitations.join('；'):''}`);
  }
  // Rebuild only when the content changed, so links are not replaced under the pointer while time is paused.
  if(this.panel.dataset.html!==html){this.panel.innerHTML=html;this.panel.dataset.html=html;}
 }
 private systemNotes(tdb:number){
  if(this.noteProvider){const n=this.noteProvider(this.planet!,tdb,this.spin);if(n)return n;}
  const st=(id:string)=>this.satellites.relativeState(id,tdb),p=(id:string)=>this.satellites.meta(id).sampledMeanPeriodDays;
  switch(this.planet){
   case '399':{const d=Math.hypot(...st('301').positionKm);return `地月质心距地心约 ${fmt(d*EMB_FRACTION)} km（地球半径约 6,371 km，仍在地球内部）。图中「地月质心」标记按 3A 对照 JPL 地月质心回包得到的比例 ${EMB_FRACTION} 定位；原点始终是地球本体中心，不是质心。`;}
   case '499':return `火卫一周期 ${p('401').toFixed(3)} 天、距火星中心约 ${fmt(Math.hypot(...st('401').positionKm))} km；火卫二周期 ${p('402').toFixed(3)} 天、约 ${fmt(Math.hypot(...st('402').positionKm))} km。火卫一公转快于火星自转（约 1.026 天）。两者均为实测不规则网格。`;
   case '599':{const lon=(id:string)=>{const v=new THREE.Vector3(...axes(st(id).positionKm)),n=this.spin,e=new THREE.Vector3(1,0,0).sub(n.clone().multiplyScalar(n.x)).normalize(),f=n.clone().cross(e);return Math.atan2(v.dot(f),v.dot(e));};
    const phi=THREE.MathUtils.radToDeg(Math.atan2(Math.sin(lon('501')-3*lon('502')+2*lon('503')),Math.cos(lon('501')-3*lon('502')+2*lon('503'))));
    return `周期比 Europa/Io = ${(p('502')/p('501')).toFixed(4)}，Ganymede/Europa = ${(p('503')/p('502')).toFixed(4)}：近 4:2:1 平均运动共振。瞬时真经度组合 λIo − 3λEu + 2λGa = ${phi.toFixed(1)}°（拉普拉斯共振中心约 180°；真经度含偏心项摆动，这不是滤波后的平均根数）。Callisto/Ganymede = ${(p('504')/p('503')).toFixed(4)}，不属于该共振。`;}
   case '699':return '土星环直接复用第 2 期实测环结构资产。Mimas 与 Enceladus 在环外侧近处；Titan 默认显示可见光雾霾；Iapetus 轨道相对土星赤道明显倾斜。';
   case '799':{const rows=[...this.moons.values()].map(m=>{const s=st(m.id),g=orbitGeometry(s.positionKm,s.velocityKmPerSec,this.spin);return `${m.meta.zh} 相对黄道 ${g.inclinationToEclipticDegrees.toFixed(1)}°`;});return `天王星系统侧躺：卫星轨道面跟随天王星赤道，而不是黄道（${rows.join('、')}）。只有 Voyager 2 拍到的南半球有影像。`;}
   case '899':{const s=st('801'),g=orbitGeometry(s.positionKm,s.velocityKmPerSec,this.spin);return `海卫一轨道角动量与海王星真实自转矢量夹角 ${g.inclinationToParentEquatorDegrees.toFixed(2)}° > 90°：逆行轨道。自转方向由姿态样本求得，而非假定 IAU 北极即自转方向。`;}
  }
  return '';
 }
 /** Phase-4 system notes (Pluto–Charon, Ceres, Vesta) computed by the caller from its own sourced data. */
 noteProvider:((id:string,tdb:number,spin:THREE.Vector3)=>string)|null=null;
 resize(){const w=this.stage.clientWidth,h=this.stage.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=this.navigation.aspect=w/h;this.camera.updateProjectionMatrix();this.navigation.updateProjectionMatrix();}
 snapshot(){
  const tdb=this.lastTdb,R=this.planet?this.parentRadius():NaN;
  return {open:this.open,planet:this.planet,selected:this.selected,focus:this.focus,follow:this.follow,scale:this.scale,orbitsVisible:this.orbitsVisible,tdb,utc:this.lastUtc,transitioning:!!this.transition,
   camera:this.navigation.position.toArray(),target:this.controls.target.toArray(),cameraUp:this.navigation.up.toArray(),cameraQuaternion:this.navigation.quaternion.toArray(),minClearance:this.minClearance,transitions:this.transitionLog.slice(),
   viewport:{width:this.stage.clientWidth,height:this.stage.clientHeight},sunDirection:this.sunDirection.toArray(),parentSpin:this.spin.toArray(),parentRadiusKm:R,
   moons:[...this.moons.values()].map(m=>{const s=Number.isFinite(tdb)?this.satellites.relativeState(m.id,tdb):null;const track=m.track.geometry.getAttribute('position');
    return {id:m.id,truthKm:s?.positionKm,truthVelocity:s?.velocityKmPerSec,displayPosition:m.position.toArray(),displayRadius:m.radius,pixelRadius:m.pixelRadius,onScreen:m.onScreen,label:!m.label.hidden,marker:!m.marker.hidden,loaded:!!m.model&&m.model.status==='ready',loadedWidth:m.model?.loadedWidth??0,error:m.error,
     trackPoints:track?.count??0,trackTdb:m.trackTdb,trackVisible:m.track.visible,trackSample:track?[track.getX(0),track.getY(0),track.getZ(0)]:null,bodyToIcrf:m.model?this.moonOrientation.at(m.id,tdb).toArray():null};}),
   parentVisual:this.parentObject?.snapshot(),resources:this.moonVisuals.stats(),render:this.profiler.snapshot(),gpuMemory:this.renderer.info.memory};
 }
}

/** Phase-2 planet as a system parent: the accepted planet asset, BodyOrientation and the phase-1 ephemeris. */
export function planetParent(id:string,renderer:THREE.WebGLRenderer,provider:EphemerisProvider,orientation:BodyOrientation):SystemParent{
 const visuals=new CelestialVisualSystem(renderer),mesh=visuals.create(id,new THREE.SphereGeometry(1,64,40))!,body=catalog.find(b=>b.id===id)!;mesh.userData.id=id;
 return {id,zh:body.zh,en:body.en,kindLabel:body.type,radiusKm:body.radiusKm,assetNote:'第 2 期已验收资产（直接复用）'+(ringSystems[id]?`；环系来自 NASA NSSDCA 资料表（${ringSystems[id].bands.length} 条，显示亮度增强 ×${ringGain(id,true).toPrecision(3)}，可在主场景观察设置中关闭增强）`:''),object:mesh,boundingRadius:1,attitude:tdb=>orientation.at(id,tdb),positionSSB:tdb=>provider.state(id,tdb).positionKm,
  update:(px,sunLocal,_sun,tdb)=>visuals.update(id,px,sunLocal,tdb),snapshot:()=>({visual:visuals.snapshot(),loading:visuals.loadingStats()})};
}
export async function createPlanetarySystem(host:HTMLElement,satellites:SatelliteEphemeris,provider:EphemerisProvider,orientation:BodyOrientation){
 return new PlanetarySystemView(host,satellites,provider,async(id,renderer)=>planetParent(id,renderer,provider,orientation),await loadMoonResources(satellites));
}
