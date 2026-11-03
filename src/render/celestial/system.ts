import * as THREE from 'three';
import manifest from '../../../data/phase-2/visual-manifest.json';
import {bodyVertex,solarFragment,atmosphereFragment,cloudTopFragment} from './shaders';
import {createSaturnRings,saturnFragment} from './rings';
import {createMinorRings,ringGain,MIN_LINE} from './minor-rings';
export interface VisualOptions {enhancements:boolean;atmosphere:boolean;clouds:boolean;cloudMotion:boolean;night:boolean;terrain:boolean;radar:boolean;axis:boolean;fill:boolean;activity:boolean}
export const defaultVisualOptions:VisualOptions={enhancements:true,atmosphere:true,clouds:true,cloudMotion:true,night:true,terrain:true,radar:false,axis:false,fill:false,activity:false};
type Entry={mesh:THREE.Mesh;material:THREE.Material;loadedWidth:number;requestedWidth:number;status:string;error:string|null;config:any;layers:Map<string,THREE.Object3D>;uniforms:Record<string,THREE.IUniform>};
export class CelestialVisualSystem {
 readonly entries=new Map<string,Entry>();private cache=new Map<string,Promise<THREE.Texture>>();
 private textureRecords=new Map<string,{width:number;height:number;loadMs:number;decodedMipBudgetMiB:number}>();
 private contextBindings=new Map<string,{material:THREE.Material;opacity:number;transparent:boolean;depthWrite:boolean}[]>();
 readonly options={...defaultVisualOptions};
 private highGeometry=new THREE.SphereGeometry(1,192,128);
 private lowGeometry=new THREE.SphereGeometry(1,64,40);
 private shapeGeometries=new Map<string,THREE.SphereGeometry>();
 constructor(readonly renderer:THREE.WebGLRenderer){}
 has(id:string){return manifest.bodies.some(b=>b.bodyId===id);}
 info(id:string):any{return manifest.bodies.find(b=>b.bodyId===id);}
 private geometryFor(id:string,high:boolean){
  const shape=this.info(id)?.shapeRatios;if(!shape)return high?this.highGeometry:this.lowGeometry;
  const key=id+'|'+high;const cached=this.shapeGeometries.get(key);if(cached)return cached;
  const geometry=(high?this.highGeometry:this.lowGeometry).clone(),p=geometry.attributes.position,n=geometry.attributes.normal;
  // Preserve planetocentric map latitude: intersect each UV sphere ray with the PCK ellipsoid.
  for(let i=0;i<p.count;i++){const ray=new THREE.Vector3().fromBufferAttribute(p,i).normalize();const radius=1/Math.sqrt((ray.x/shape[0])**2+(ray.y/shape[1])**2+(ray.z/shape[2])**2);ray.multiplyScalar(radius);p.setXYZ(i,ray.x,ray.y,ray.z);const normal=new THREE.Vector3(ray.x/shape[0]**2,ray.y/shape[1]**2,ray.z/shape[2]**2).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);}
  geometry.computeBoundingSphere();geometry.computeBoundingBox();this.shapeGeometries.set(key,geometry);return geometry;
 }
 create(id:string,geometry:THREE.BufferGeometry):THREE.Mesh|null{
  const config=this.info(id);if(!config)return null;
  const uniforms={uMap:{value:new THREE.Texture()},uEnhancement:{value:1},uSunLocal:{value:new THREE.Vector3()},uMinnaert:{value:config.minnaert??1}};
  const material:THREE.Material=id==='10'?new THREE.ShaderMaterial({uniforms,vertexShader:bodyVertex,fragmentShader:solarFragment}):config.photometry==='gas'?new THREE.ShaderMaterial({uniforms,vertexShader:bodyVertex,fragmentShader:id==='699'?saturnFragment:cloudTopFragment}):new THREE.MeshStandardMaterial({roughness:config.roughness??.98,metalness:0,color:config.tint??'#ffffff'});
  const mesh=new THREE.Mesh(config.shapeRatios?this.geometryFor(id,false):geometry,material);mesh.userData.id=id;
  this.entries.set(id,{mesh,material,loadedWidth:0,requestedWidth:0,status:'loading',error:null,config,layers:new Map(),uniforms});
  const axis=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1.4,0),3,0x8faec6,.16,.08);axis.visible=false;mesh.add(axis);this.entries.get(id)!.layers.set('IAU-pole',axis);
  if(id==='399')this.createEarth(this.entries.get(id)!);
  if(config.ringProfile){const ring=createSaturnRings(config.ringProfile,uniforms,config.shapeRatios);mesh.add(ring);this.entries.get(id)!.layers.set('measured-ABC-rings',ring);}
  {const minor=createMinorRings(id);if(minor){mesh.add(minor);this.entries.get(id)!.layers.set('nssdca-rings',minor);}}
  if(config.atmosphere){const a=config.atmosphere;const shell=new THREE.Mesh(this.geometryFor(id,true),new THREE.ShaderMaterial({uniforms:{uSunLocal:{value:new THREE.Vector3()},uTint:{value:new THREE.Color(a.tint)},uStrength:{value:a.strength},uRadius:{value:a.radius}},vertexShader:bodyVertex,fragmentShader:atmosphereFragment,transparent:true,side:THREE.BackSide,depthWrite:false}));shell.scale.setScalar(a.radius);shell.renderOrder=3;mesh.add(shell);this.entries.get(id)!.layers.set('atmosphere',shell);}
  if(id==='10'){
   const rimMaterial=new THREE.ShaderMaterial({vertexShader:bodyVertex,fragmentShader:`
    #include <common>
    #include <logdepthbuf_pars_fragment>
    varying vec3 vNormalView;varying vec3 vPositionView;
    void main(){
    #include <logdepthbuf_fragment>
    float mu=abs(dot(normalize(vNormalView),normalize(-vPositionView)));float impact=1.18*sqrt(max(0.,1.-mu*mu));float q=clamp((impact-1.)/.18,0.,1.);float a=.14*exp(-q*5.)*(1.-smoothstep(.65,1.,q));gl_FragColor=vec4(vec3(2.,.9,.24),a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
   const rim=new THREE.Mesh(this.highGeometry,rimMaterial);rim.scale.setScalar(1.18);rim.renderOrder=2;mesh.add(rim);this.entries.get(id)!.layers.set('corona',rim);
   const activity=new THREE.Group();
   for(const angle of [.5,2.6,4.1]){const points=[];for(let i=0;i<=80;i++){const t=i/80*Math.PI,r=1.004+.16*Math.sin(t);points.push(new THREE.Vector3(Math.cos(angle+t*.09)*r,Math.sin(angle+t*.09)*r,Math.sin(t)*.08));}const g=new THREE.BufferGeometry().setFromPoints(points),arc=new THREE.Line(g,new THREE.LineBasicMaterial({color:'#ec793d',transparent:true,opacity:.65,depthWrite:false}));activity.add(arc);}
   activity.visible=false;mesh.add(activity);this.entries.get(id)!.layers.set('illustrative-prominences',activity);
  }
  for(const [name,object]of this.entries.get(id)!.layers)object.name=name;
  const bindings:{material:THREE.Material;opacity:number;transparent:boolean;depthWrite:boolean}[]=[];
  const contextAlpha={value:1};mesh.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){const materials=Array.isArray(object.material)?object.material:[object.material];for(const mat of materials){bindings.push({material:mat,opacity:mat.opacity,transparent:mat.transparent,depthWrite:mat.depthWrite});if(mat instanceof THREE.ShaderMaterial){mat.uniforms.uHeroContextOpacity=contextAlpha;mat.onBeforeCompile=shader=>{shader.uniforms.uHeroContextOpacity=contextAlpha;const index=shader.fragmentShader.lastIndexOf('}');shader.fragmentShader='uniform float uHeroContextOpacity;\n'+shader.fragmentShader.slice(0,index)+'gl_FragColor.a*=uHeroContextOpacity;\n'+shader.fragmentShader.slice(index);};}}}});this.contextBindings.set(id,bindings);this.entries.get(id)!.uniforms.uHeroContextOpacity=contextAlpha;
  this.requestLod(id,1024);return mesh;
 }
 private createEarth(e:Entry){
  Object.assign(e.uniforms,{uSunLocal:{value:new THREE.Vector3()},uNight:{value:new THREE.Texture()},uCloudMap:{value:new THREE.Texture()},uNightOn:{value:1},uCloudOn:{value:1},uCloudShift:{value:0}});
  const mat=e.material as THREE.MeshStandardMaterial;
  mat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,e.uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSurfaceN;varying vec2 vSurfaceUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceN=normal;vSurfaceUv=uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vSurfaceN;varying vec2 vSurfaceUv;uniform vec3 uSunLocal;uniform sampler2D uNight;uniform sampler2D uCloudMap;uniform float uNightOn;uniform float uCloudOn;uniform float uCloudShift;`)
   .replace('#include <map_fragment>',`#include <map_fragment>
   vec3 sn=normalize(vSurfaceN);float nl=dot(sn,uSunLocal);float travel=-nl+sqrt(nl*nl+1.0015*1.0015-1.);vec3 hit=normalize(sn+travel*uSunLocal);vec2 cuv=vec2(atan(-hit.z,hit.x)/(2.*PI)+.5-uCloudShift,asin(hit.y)/PI+.5);float cloudCover=texture2D(uCloudMap,cuv).r;diffuseColor.rgb*=1.-cloudCover*.34*uCloudOn*smoothstep(0.,.12,nl);`)
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float nightSide=1.-smoothstep(-.13,.01,dot(normalize(vSurfaceN),uSunLocal));float lights=pow(texture2D(uNight,vSurfaceUv).r,1.45);totalEmissiveRadiance+=vec3(1.,.64,.29)*lights*.85*nightSide*uNightOn;`);
  };
  const clouds=new THREE.Mesh(this.highGeometry,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,transparent:true,opacity:.86,depthWrite:false,alphaTest:.005}));clouds.scale.setScalar(1.0015);clouds.renderOrder=2;e.mesh.add(clouds);e.layers.set('clouds',clouds);
 }
 private load(url:string,color=true){
  const key=url+'|'+color;let promise=this.cache.get(key);if(promise)return promise;
  const started=performance.now();promise=new Promise<THREE.Texture>((resolve,reject)=>new THREE.TextureLoader().load(url,t=>{t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textureRecords.set(key,{width:t.image.width,height:t.image.height,loadMs:performance.now()-started,decodedMipBudgetMiB:t.image.width*t.image.height*4*4/3/1048576});resolve(t);},undefined,()=>reject(new Error('纹理加载失败 '+url))));this.cache.set(key,promise);return promise;
 }
 requestLod(id:string,width:number){
  const e=this.entries.get(id);if(!e)return;
  const lod=e.config.lods.find((l:any)=>l.width>=width)||e.config.lods.at(-1);if(e.requestedWidth>=lod.width)return;e.requestedWidth=lod.width;
  this.load(lod.url).then(async t=>{if(lod.width<e.requestedWidth)return;e.uniforms.uMap.value=t;if(e.material instanceof THREE.MeshStandardMaterial){const first=!e.material.map;e.material.map=t;if(first)e.material.needsUpdate=true;}
   for(const [role,color] of [['radar',true],['cloud',false],['night',false],['roughness',false],['height',false]] as const){const list=e.config[role+'Lods'];if(!list)continue;const source=list.find((l:any)=>l.width===lod.width)||list.at(-1);const tx=await this.load(source.url,color);if(lod.width<e.requestedWidth)return;
    if(role==='radar')e.uniforms.uRadar={value:tx};
    if(role==='cloud'){e.uniforms.uCloudMap.value=tx;const cm=(e.layers.get('clouds') as THREE.Mesh).material as THREE.MeshStandardMaterial;cm.alphaMap=tx;cm.needsUpdate=true;}
    if(role==='night')e.uniforms.uNight.value=tx;
    if(role==='roughness'){(e.material as THREE.MeshStandardMaterial).roughnessMap=tx;e.material.needsUpdate=true;}
    if(role==='height'){const m=e.material as THREE.MeshStandardMaterial;m.bumpMap=tx;m.bumpScale=e.config.bumpScale??.001;m.needsUpdate=true;}
   }
   if(e.config.ringProfile)e.uniforms.uRingProfile.value=await this.load(e.config.ringProfile.url,false);
   if(lod.width<e.requestedWidth)return;e.loadedWidth=lod.width;e.status='ready';e.error=null;}).catch(error=>{e.status='error';e.error=String(error);});
 }
 update(id:string,pixelDiameter:number,sunLocal:THREE.Vector3,tdb:number){
  const e=this.entries.get(id);if(!e)return;
  this.requestLod(id,pixelDiameter>400?4096:pixelDiameter>120?2048:1024);
  e.mesh.geometry=this.geometryFor(id,pixelDiameter>180);
  e.uniforms.uEnhancement.value=this.options.enhancements?1:0;
  e.layers.get('IAU-pole')!.visible=this.options.axis;
  if(e.uniforms.uSunLocal)e.uniforms.uSunLocal.value.copy(sunLocal);
  if(e.uniforms.uNightOn)e.uniforms.uNightOn.value=this.options.night?1:0;
  if(e.uniforms.uCloudOn)e.uniforms.uCloudOn.value=this.options.clouds?1:0;
  if(e.layers.has('clouds'))e.layers.get('clouds')!.visible=this.options.clouds;
  if(id==='399'){const turns=this.options.cloudMotion?((tdb-(e.config.cloudEpochTdb??tdb))/86400*(e.config.cloudDriftDegreesPerDay??3)/360)%1:0;e.layers.get('clouds')!.rotation.y=turns*Math.PI*2;e.uniforms.uCloudShift.value=turns;}
  if(e.config.heightLods)(e.material as THREE.MeshStandardMaterial).bumpScale=this.options.terrain?(e.config.bumpScale??.001)*e.mesh.scale.x:0;
  const atmosphere=e.layers.get('atmosphere') as THREE.Mesh|undefined;if(atmosphere){atmosphere.visible=this.options.atmosphere&&!(id==='299'&&this.options.radar);(atmosphere.material as THREE.ShaderMaterial).uniforms.uSunLocal.value.copy(sunLocal);}
  if(id==='299'&&e.material instanceof THREE.MeshStandardMaterial)e.material.map=this.options.radar&&e.uniforms.uRadar?e.uniforms.uRadar.value:e.uniforms.uMap.value;
  if(e.layers.has('corona'))e.layers.get('corona')!.visible=this.options.enhancements;
  const minor=e.layers.get('nssdca-rings') as THREE.Mesh|undefined;if(minor){const u=(minor.material as THREE.ShaderMaterial).uniforms;u.uSunLocal.value.copy(sunLocal);u.uGain.value=ringGain(id,this.options.enhancements);u.uMinLine.value=this.options.enhancements?MIN_LINE:0;}
  if(e.layers.has('illustrative-prominences'))e.layers.get('illustrative-prominences')!.visible=this.options.activity;
 }
 snapshot(){return [...this.entries].map(([id,e])=>({id,status:e.status,error:e.error,loadedWidth:e.loadedWidth,actualAlbedoWidth:e.uniforms.uMap.value.image?.width??0,material:e.config.kind,layers:[...e.layers.keys()],sunLocal:e.uniforms.uSunLocal?.value.toArray(),cloudAngle:e.layers.get('clouds')?.rotation.y??null}));}
 contextOpacity(id:string,alpha:number){const e=this.entries.get(id);if(!e)return;e.uniforms.uHeroContextOpacity.value=alpha;for(const b of this.contextBindings.get(id)??[]){const mat=b.material;const transparent=b.transparent||alpha<1;if(mat.transparent!==transparent){mat.transparent=transparent;mat.needsUpdate=true;}mat.depthWrite=b.depthWrite&&alpha===1;if(!(mat instanceof THREE.ShaderMaterial))mat.opacity=b.opacity*alpha;}}
 loadingStats(){return {cachedRequests:this.cache.size,completed:this.textureRecords.size,decodedMipBudgetMiB:[...this.textureRecords.values()].reduce((s,t)=>s+t.decodedMipBudgetMiB,0),textures:Object.fromEntries(this.textureRecords)};}
}
