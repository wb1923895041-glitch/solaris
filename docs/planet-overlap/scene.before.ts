import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog } from '../science/catalog';
import type { EphemerisProvider, State } from '../science/ephemeris';
import { relative } from '../science/ephemeris';
import {displayPosition,displayRadius,cameraRelative,type ScaleMode} from '../science/coordinates';
import {glowTexture} from './textures';
import {CelestialVisualSystem} from './celestial/system';
import {BodyOrientation} from './celestial/orientation';
import {axes} from '../science/coordinates';
import {RenderProfiler} from './celestial/profiling';
import {OrbitTrails} from './orbit-trails';
import {CelestialSky} from './sky';

export class SolarSystemScene {
 readonly renderer:THREE.WebGLRenderer;readonly world=new THREE.Scene();
 readonly camera=new THREE.PerspectiveCamera(40,1,.001,20000);
 readonly navigation=new THREE.PerspectiveCamera(40,1,.001,20000);
 readonly controls:OrbitControls;
 viewPreset:string="overview";
 readonly meshes=new Map<string,THREE.Mesh>();readonly labels=new Map<string,HTMLButtonElement>();
 readonly thumbnails=new Map<string,string>();readonly positions=new Map<string,THREE.Vector3>();
 readonly visuals:CelestialVisualSystem;
 readonly profiler:RenderProfiler;
 private fillLight:THREE.AmbientLight;
 readonly trails:OrbitTrails;readonly sky=new CelestialSky();
 private glow:THREE.Sprite;private light:THREE.PointLight;private focused:string|null=null;
 private transition:{from:THREE.Vector3;targetFrom:THREE.Vector3;to:THREE.Vector3;target:THREE.Vector3;start:number}|null=null;
 private previousFocus:THREE.Vector3|null=null;private lastMode:ScaleMode='exploration';
 private leaderLines=new Map<string,SVGLineElement>();
 private lastPick:{bodyId:string;hitObject:string;child:boolean}|null=null;
 onSelect:(id:string,focus:boolean)=>void=()=>{};
 constructor(readonly host:HTMLElement,readonly labelHost:HTMLElement,readonly provider:EphemerisProvider,readonly orientation:BodyOrientation){
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',logarithmicDepthBuffer:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.profiler=new RenderProfiler(this.renderer);
  host.append(this.renderer.domElement);this.renderer.setClearColor('#03070d');this.renderer.autoClear=false;this.trails=new OrbitTrails(this.world,provider);
  this.controls=new OrbitControls(this.navigation,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.08;
  this.controls.minDistance=.005;this.controls.maxDistance=20000;
  this.controls.addEventListener('start',()=>{this.transition=null;});
  this.fillLight=new THREE.AmbientLight('#b7d8ff',0);this.world.add(this.fillLight);
  this.visuals=new CelestialVisualSystem(this.renderer);
  this.light=new THREE.PointLight('#fff4df',3.8,0,0);this.world.add(this.light);
  const leaderSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');leaderSvg.classList.add('label-leaders');labelHost.append(leaderSvg);
  const geometry=new THREE.SphereGeometry(1,64,40);
  for(const body of catalog){
   let mesh=this.visuals.create(body.id,geometry);
   if(mesh){this.thumbnails.set(body.id,this.visuals.info(body.id)!.lods[0].url);}
   else{throw new Error('缺少已登记视觉资产 '+body.id);}
   mesh.userData.id=body.id;this.meshes.set(body.id,mesh);this.world.add(mesh);
   this.positions.set(body.id,new THREE.Vector3());
   const label=document.createElement('button');label.className='body-label';label.innerHTML=`<i style="--body:${body.color}"></i>${body.zh}<small>${body.en}</small>`;
   label.setAttribute('aria-label',`选中${body.zh}`);label.onclick=()=>this.onSelect(body.id,false);label.ondblclick=()=>this.onSelect(body.id,true);this.labels.set(body.id,label);labelHost.append(label);const leader=document.createElementNS('http://www.w3.org/2000/svg','line');leaderSvg.append(leader);this.leaderLines.set(body.id,leader);
  }
  this.glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));this.world.add(this.glow);
  const canvas=this.renderer.domElement;let down={x:0,y:0};
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  const pick=(e:MouseEvent,focus:boolean)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5&&!focus)return;const rect=canvas.getBoundingClientRect();const p=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(p,this.camera);const hit=ray.intersectObjects([...this.meshes.values()].filter(m=>m.visible))[0];let object:THREE.Object3D|null=hit?.object??null;while(object&&!object.userData.id)object=object.parent;if(object){this.lastPick={bodyId:object.userData.id,hitObject:hit!.object.name||hit!.object.type,child:hit!.object!==object};this.onSelect(object.userData.id,focus);}};
  canvas.addEventListener('click',e=>pick(e,false));canvas.addEventListener('dblclick',e=>pick(e,true));
  this.overview(false);this.resize();
 }
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=this.navigation.aspect=w/h;this.camera.updateProjectionMatrix();this.navigation.updateProjectionMatrix();}
 overview(animate=true){this.viewPreset='overview';this.navigation.up.set(this.lastMode==='scientific'?0:.12,1,0).normalize();this.focused=null;this.previousFocus=null;const scientific=this.lastMode==='scientific',to=scientific?new THREE.Vector3(1500,3000,3600):new THREE.Vector3(-100,200,340),target=scientific?new THREE.Vector3():new THREE.Vector3(40,0,-35);if(animate)this.move(to,target);else{this.navigation.position.copy(to);this.controls.target.copy(target);this.navigation.lookAt(target);}}
 inner(){this.viewPreset='depth';this.focused=null;this.previousFocus=null;this.move(new THREE.Vector3(-55,45,145),new THREE.Vector3(45,0,-20));}
 get focusedId(){return this.focused;}
 restoreCamera(camera:number[],target:number[]){this.transition=null;this.navigation.position.fromArray(camera);this.controls.target.fromArray(target);this.controls.update();}
 observe(view:string){
  if(!this.focused)return;const id=this.focused,p=this.positions.get(id)!,mesh=this.meshes.get(id)!,r=mesh.scale.x;
  let direction=this.positions.get('10')!.clone().sub(p).normalize();if(id==='10')direction=this.navigation.position.clone().sub(this.controls.target).normalize();
  const tangent=new THREE.Vector3(0,1,0).cross(direction).normalize();if(tangent.lengthSq()<.01)tangent.set(1,0,0);
  const target=p.clone();let distance=r*5.8;
  if(view==='terminator')direction.addScaledVector(tangent,2).normalize();
  if(view==='backlight')direction.negate().addScaledVector(tangent,.15).normalize();
  if(view==='detail'||view==='limb'){direction=this.navigation.position.clone().sub(this.controls.target).normalize();distance=r*(view==='limb'?2.6:3.2);}
  if(view==='limb')target.addScaledVector(tangent,r*.9);
  const pole=new THREE.Vector3(0,1,0).applyQuaternion(mesh.quaternion);
  if(view==='pole')direction.copy(pole).multiplyScalar(direction.dot(pole)>=0?1:-1);
  if(view.startsWith('ring')){const side=direction.dot(pole)>=0?1:-1;direction.addScaledVector(pole,-direction.dot(pole)).normalize().addScaledVector(pole,side*(view==='ring-edge'?.012:.7)).normalize();distance=r*(view==='ring-detail'?4.2:9);if(view==='ring-detail'){const radial=direction.clone().addScaledVector(pole,-direction.dot(pole)).normalize();target.addScaledVector(radial,1.65*r);}}
  if(view==='feature'&&id==='599'){const lat=THREE.MathUtils.degToRad(-20),lon=THREE.MathUtils.degToRad(-48);direction.set(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon)).applyQuaternion(mesh.quaternion);distance=r*3.2;}
  this.move(p.clone().addScaledVector(direction,distance),target);
 }
 focus(id:string){this.viewPreset='focus';this.navigation.up.set(0,1,0);this.focused=id;const target=this.positions.get(id)!.clone(),r=this.meshes.get(id)!.scale.x;this.previousFocus=target.clone();const direction=id==='10'?this.navigation.position.clone().sub(this.controls.target).normalize():this.positions.get('10')!.clone().sub(target).normalize().add(new THREE.Vector3(0,.6,.2)).normalize();if(id==='399'){const tangent=new THREE.Vector3(0,1,0).cross(direction).normalize();direction.addScaledVector(tangent,.65).normalize();}this.move(target.clone().addScaledVector(direction,Math.max(r*(id==='399'?4.5:5.8),.015)),target);}
 private move(to:THREE.Vector3,target:THREE.Vector3){this.transition={from:this.navigation.position.clone(),targetFrom:this.controls.target.clone(),to,target,start:performance.now()};}
 draw(states:Map<string,State>,mode:ScaleMode,selected:string,now:number,pathsVisible=true){
  if(this.lastMode!==mode){this.lastMode=mode;this.overview();}
  const sun=states.get('10')!;
  for(const body of catalog){const p=relative(states.get(body.id)!,sun).positionKm;this.positions.get(body.id)!.fromArray(displayPosition(p,mode));this.meshes.get(body.id)!.scale.setScalar(displayRadius(body.radiusKm,body.id,mode));}
  if(this.focused&&this.previousFocus){const p=this.positions.get(this.focused)!;const delta=p.clone().sub(this.previousFocus);if(this.transition){this.transition.to.add(delta);this.transition.target.add(delta);}else{this.navigation.position.add(delta);this.controls.target.add(delta);}this.previousFocus.copy(p);}
  if(this.transition){const tr=this.transition;const u=Math.min(1,(now-tr.start)/1100),s=u*u*(3-2*u);this.navigation.position.lerpVectors(tr.from,tr.to,s);this.controls.target.lerpVectors(tr.targetFrom,tr.target,s);if(u===1){this.transition=null;if(this.focused)this.previousFocus=this.positions.get(this.focused)!.clone();}}
  this.controls.minDistance=this.focused?this.meshes.get(this.focused)!.scale.x*1.13:.005;
  this.controls.update();this.navigation.updateMatrixWorld();this.camera.quaternion.copy(this.navigation.quaternion);this.camera.position.set(0,0,0);this.camera.updateMatrixWorld();
  const origin=this.navigation.position.toArray() as [number,number,number];
  for(const [id,mesh] of this.meshes){mesh.position.fromArray(cameraRelative(this.positions.get(id)!.toArray() as [number,number,number],origin));mesh.visible=this.focused==='399'||!this.focused||this.focused===id;}
  // Exploration radii are exaggerated: retain nearby background bodies as faint context,
  // so they cannot obscure the Earth Hero. Only opacity changes; positions/radii stay canonical.
  const earthMesh=this.meshes.get('399')!;
  const earthAngular=earthMesh.scale.x/Math.max(earthMesh.position.length(),.001);
  for(const [id,bodyMesh] of this.meshes){const ghost=this.focused==='399'&&id!=='399'&&bodyMesh.scale.x/Math.max(bodyMesh.position.length(),.001)>earthAngular*.22;this.visuals.contextOpacity(id,ghost?.003:1);}
  this.fillLight.intensity=this.visuals.options.fill?.035:0;
  for(const [id,mesh] of this.meshes){if(this.visuals.has(id)){mesh.quaternion.copy(this.orientation.at(id,sun.timeTdb));const physicalSun=relative(sun,states.get(id)!).positionKm;const sunLocal=new THREE.Vector3(...axes(physicalSun)).normalize().applyQuaternion(mesh.quaternion.clone().invert());const diameter=mesh.scale.x/mesh.position.length()*this.host.clientHeight/Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));this.visuals.update(id,diameter,sunLocal,sun.timeTdb);}}
  this.light.position.copy(this.meshes.get('10')!.position);this.glow.position.copy(this.light.position);this.glow.scale.setScalar(this.meshes.get('10')!.scale.x*11);this.glow.visible=!this.visuals.has('10')&&((!this.focused&&mode==='exploration')||this.focused==='10');
  this.trails.draw(mode,selected,sun.timeTdb,origin,this.focused,pathsVisible);
  this.profiler.begin();this.renderer.clear();this.renderer.render(this.sky.scene,this.camera);this.profiler.additionalDrawCalls=this.renderer.info.render.calls;this.renderer.clearDepth();this.renderer.render(this.world,this.camera);this.profiler.end();
  const occupied:{x:number;y:number;w:number;h:number}[]=[],w=this.host.clientWidth,h=this.host.clientHeight;
  const ordered=[selected,...catalog.filter(b=>b.id!==selected).map(b=>b.id)];
  for(const id of ordered){
   const mesh=this.meshes.get(id)!,projected=mesh.position.clone().project(this.camera),label=this.labels.get(id)!;
   const px=(projected.x*.5+.5)*w,py=(-projected.y*.5+.5)*h;
   const offset=Math.min(90,mesh.scale.x/mesh.position.length()*h/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))));
   const candidates=[0,-55,55,-110,110,-165,165].map(dy=>({x:px+offset+14,y:py-16+dy,w:128,h:56}));
   const box=candidates.find(box=>box.x>0&&box.x+box.w<w&&box.y>0&&box.y+box.h<h&&!occupied.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y))??candidates[0];
   const visible=!this.focused&&mesh.visible&&projected.z>-1&&projected.z<1&&box.x>0&&box.x+128<w&&box.y>0&&box.y+56<h&&!occupied.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
   label.hidden=!visible;label.classList.toggle('selected',id===selected);label.style.transform=`translate(${box.x}px,${box.y}px)`;
   const leader=this.leaderLines.get(id)!;leader.style.display=visible?'':'none';leader.setAttribute('x1',String(px+offset*.65));leader.setAttribute('y1',String(py));leader.setAttribute('x2',String(box.x));leader.setAttribute('y2',String(box.y+18));
   if(visible)occupied.push(box);
  }
 }
 snapshot(){return {mode:this.lastMode,focus:this.focused,lastPick:this.lastPick,visiblePaths:this.trails.snapshot().visible,trails:this.trails.snapshot(),sky:this.sky.status,sunInFrontOfCamera:this.camera.getWorldDirection(new THREE.Vector3()).dot(this.meshes.get('10')!.position)>0,camera:this.navigation.position.toArray(),target:this.controls.target.toArray(),objects:[...this.meshes].map(([id,m])=>({id,radius:m.scale.x,visible:m.visible,position:this.positions.get(id)!.toArray(),quaternion:m.quaternion.toArray(),pole:new THREE.Vector3(0,1,0).applyQuaternion(m.quaternion).toArray()})),labels:[...this.labels].filter(([,l])=>!l.hidden).map(([id])=>id),visuals:this.visuals.snapshot(),visualOptions:this.visuals.options,gpuMemory:this.renderer.info.memory};}
}
