import * as THREE from 'three';
import {axes} from '../science/coordinates.ts';
import {titanHaze} from './titan-haze.ts';
import {enceladusPlume} from './enceladus-plume.ts';

export interface MoonAsset{
 naifId:string;displayNameZh:string;displayNameEn:string;parentPlanetId:string;version:string;kind:string;shapeType:string;meanRadiusKm:number;meshFrame:string;
 albedo:{title:string;provider:string;uri:string;observationEpoch:string;rights:string;colorProcessing:string;projection:string;processingCategory:string};
 lods:{width:number;height:number;url:string;sha256:string}[];
 geometry?:{file:string;sha256:string;width?:number;height?:number;indexFile?:string;indexSha256?:string;vertexCount?:number;indexCount?:number;axesKm?:number[];colorFile?:string;colorSha256?:string;units?:string};
 relief?:{file:string;sha256:string;residualHalfRangeKm:number};material:{roughness:number;metalness:number;tint:string};
 orientationModel:string;surfaceRegistration:string;reconstructionNotes:string;visualEnhancements:string[];limitations:string[];verifiedAt:string;
}
type PoseMeta={startTdb:number;endTdb:number;objects:{bodyId:string;frame:string;quality:string;file:string;stepSeconds:number;count:number;sha256:string}[]};
const a=axes([1,0,0]),b=axes([0,1,0]),c=axes([0,0,1]);
export const icrfToDisplay=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...a),new THREE.Vector3(...b),new THREE.Vector3(...c)));
export async function verifiedBytes(url:string,sha256:string){const response=await fetch(url);if(!response.ok)throw Error('资产文件加载失败');const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==sha256)throw Error('资产哈希核验失败');return bytes;}
export class MoonOrientation{
 private arrays=new Map<string,Float32Array>();
 constructor(readonly metadata:PoseMeta){
  const m=metadata;if(!Number.isFinite(m.startTdb)||!Number.isFinite(m.endTdb)||m.startTdb>=m.endTdb||new Set(m.objects.map(o=>o.bodyId)).size!==m.objects.length)throw Error('姿态清单区间或 ID 错误');
  for(const o of m.objects)if(!/^IAU_[A-Z]+$/.test(o.frame)||o.quality!=='IAU_GENERIC_APPROX'||!Number.isFinite(o.stepSeconds)||o.stepSeconds<=0||!Number.isInteger(o.count)||o.count<2||m.startTdb+(o.count-1)*o.stepSeconds<m.endTdb||!/^\/assets\/(moons|smallbodies)\/orientation\/\d+\.f32$/.test(o.file)||!/^[a-f0-9]{64}$/.test(o.sha256))throw Error('姿态来源或采样契约错误');
 }
 async load(id:string){if(this.arrays.has(id))return;const o=this.metadata.objects.find(o=>o.bodyId===id);if(!o)throw Error('缺少该卫星 IAU 姿态');const bytes=await verifiedBytes(o.file,o.sha256),array=new Float32Array(bytes);if(array.length!==o.count*4)throw Error('姿态缓存长度错误');for(let i=0;i<array.length;i+=4){const n=Math.hypot(array[i],array[i+1],array[i+2],array[i+3]);if(!Number.isFinite(n)||Math.abs(n-1)>1e-5)throw Error('姿态缓存非有限或非单位四元数');}this.arrays.set(id,array);}
 at(id:string,tdb:number){const m=this.metadata,o=m.objects.find(o=>o.bodyId===id),q=this.arrays.get(id);if(!o||!q)throw Error('姿态尚未就绪');if(!Number.isFinite(tdb)||tdb<m.startTdb||tdb>m.endTdb)throw Error('姿态覆盖区间外');const index=Math.min(o.count-2,Math.floor((tdb-m.startTdb)/o.stepSeconds)),u=(tdb-m.startTdb-index*o.stepSeconds)/o.stepSeconds;return new THREE.Quaternion().fromArray(q,index*4).normalize().slerp(new THREE.Quaternion().fromArray(q,index*4+4).normalize(),u);}
}
export interface MoonModel{asset:MoonAsset;root:THREE.Group;surface:THREE.Mesh;radius:number;loadedWidth:number;status:string;error:string|null}
export class MoonVisuals{
 private models=new Map<string,Promise<MoonModel>>();private created=0;private disposed=0;private textures=new Map<string,Promise<THREE.Texture>>();
 constructor(readonly manifest:{bodies:MoonAsset[]},readonly renderer:THREE.WebGLRenderer,readonly capacity=2){}
 private async texture(url:string,hash:string,color:boolean){if(!this.textures.has(url))this.textures.set(url,(async()=>{// Decode off the main thread and upload once, so LOD swaps do not stall a frame.
 const bytes=await verifiedBytes(url,hash),bitmap=await createImageBitmap(new Blob([bytes]),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:color?'default':'none'}),t=new THREE.Texture(bitmap);t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;this.created++;t.addEventListener('dispose',()=>{bitmap.close();this.disposed++;});this.renderer.initTexture(t);return t;})());return this.textures.get(url)!;}
 async load(id:string){let pending=this.models.get(id);if(pending)this.models.delete(id);else pending=this.create(id);this.models.set(id,pending);while(this.models.size>this.capacity){const key=this.models.keys().next().value!,retired=this.models.get(key)!;this.models.delete(key);
  // Detach the retired model's textures from the cache *now*: if the same body is requested again before the
  // asynchronous disposal runs, it must get fresh textures instead of one that is about to be disposed (which
  // three.js would silently re-upload, leaking a GPU texture per cycle).
  const asset=this.manifest.bodies.find(a=>a.naifId===key),urls=asset?[...asset.lods.map(l=>l.url),...(asset.relief?[asset.relief.file]:[])]:[],owned=urls.map(url=>{const t=this.textures.get(url);this.textures.delete(url);return t;});
  void retired.then(model=>{model.status='disposed';model.root.removeFromParent();model.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){o.geometry.dispose();for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();}});for(const texture of owned)void texture?.then(t=>t.dispose()).catch(()=>{});}).catch(()=>{});}return pending;}
 private async create(id:string):Promise<MoonModel>{
  const asset=this.manifest.bodies.find(a=>a.naifId===id);if(!asset)throw Error('该卫星尚无已核验资产');const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({roughness:asset.material.roughness,metalness:asset.material.metalness,color:asset.material.tint});let geometry:THREE.BufferGeometry;
  if(asset.kind==='lro-terrain'){
   const g=asset.geometry!,heights=new Float32Array(await verifiedBytes(g.file,g.sha256)),w=g.width!,h=g.height!;geometry=new THREE.SphereGeometry(1,w-1,h-1);const position=geometry.getAttribute('position');
   const north=heights.slice(0,w).reduce((s,v)=>s+v,0)/w,south=heights.slice((h-1)*w).reduce((s,v)=>s+v,0)/w;
   for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=j*w+i,elevation=j===0?north:j===h-1?south:heights[j*w+(i===w-1?0:i)],v=new THREE.Vector3().fromBufferAttribute(position,k).normalize().multiplyScalar(1+elevation/asset.meanRadiusKm);position.setXYZ(k,v.x,v.y,v.z);}geometry.computeVertexNormals();
   const normals=geometry.getAttribute('normal');for(let j=1;j<h-1;j++){const first=j*w,last=first+w-1,n=new THREE.Vector3().fromBufferAttribute(normals,first).add(new THREE.Vector3().fromBufferAttribute(normals,last)).normalize();normals.setXYZ(first,n.x,n.y,n.z);normals.setXYZ(last,n.x,n.y,n.z);}
  }else if(asset.shapeType==='irregular-mesh'){
   const g=asset.geometry!,vertices=new Float32Array(await verifiedBytes(g.file,g.sha256)),indices=new Uint32Array(await verifiedBytes(g.indexFile!,g.indexSha256!));geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices.map(v=>v/asset.meanRadiusKm),3));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeVertexNormals();
   if(g.colorFile){const colors=new Float32Array(await verifiedBytes(g.colorFile,g.colorSha256!));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));material.vertexColors=true;}
   if(asset.lods.length){const p=geometry.getAttribute('position'),uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);uv[i*2]=.5+Math.atan2(v.y,v.x)/(Math.PI*2);uv[i*2+1]=.5+Math.asin(v.z/v.length())/Math.PI;}geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));const non=geometry.toNonIndexed();geometry.dispose();geometry=non;const coords=geometry.getAttribute('uv');for(let i=0;i<coords.count;i+=3){const us=[coords.getX(i),coords.getX(i+1),coords.getX(i+2)];if(Math.max(...us)-Math.min(...us)>.5)for(let j=0;j<3;j++)if(us[j]<.5)coords.setX(i+j,us[j]+1);}}
  }else{
   geometry=new THREE.SphereGeometry(1,192,128);const dims=asset.geometry?.axesKm;if(dims){geometry.scale(dims[0]/asset.meanRadiusKm,dims[2]/asset.meanRadiusKm,dims[1]/asset.meanRadiusKm);geometry.computeVertexNormals();const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i),old=uv.getX(i);let u=.5+Math.atan2(-p.z,p.x)/(2*Math.PI);if(old<.05&&u>.95)u-=1;if(old>.95&&u<.05)u+=1;uv.setXY(i,Math.abs(p.y/p.length())>.999999?old:u,.5+Math.asin(THREE.MathUtils.clamp(p.y/p.length(),-1,1))/Math.PI);}}
  }
  if(asset.kind==='titan-opaque-haze')geometry.scale(1+200/asset.meanRadiusKm,1+200/asset.meanRadiusKm,1+200/asset.meanRadiusKm);
  const surface=new THREE.Mesh(geometry,material);surface.name=asset.kind==='titan-opaque-haze'?'titan-opaque-visible-haze':'observed-surface-'+id;if(asset.meshFrame==='sphere-y-up')surface.rotation.x=Math.PI/2;root.add(surface);geometry.computeBoundingSphere();const model:MoonModel={asset,root,surface,radius:geometry.boundingSphere!.radius,loadedWidth:0,status:'loading',error:null};
  if(asset.kind==='titan-opaque-haze'){root.add(titanHaze(asset.meanRadiusKm));model.radius=1+500/asset.meanRadiusKm;}
  if(asset.naifId==='602')root.add(enceladusPlume((asset.geometry?.axesKm?.[2]??asset.meanRadiusKm)/asset.meanRadiusKm));
  if(asset.relief){material.bumpMap=await this.texture(asset.relief.file,asset.relief.sha256,false);material.bumpScale=asset.relief.residualHalfRangeKm*2/asset.meanRadiusKm;}
  await this.upgrade(model,1024);model.status='ready';return model;
 }
 async upgrade(model:MoonModel,width:number){if(model.status==='disposed')return;const lod=model.asset.lods.find(l=>l.width>=width)||model.asset.lods.at(-1);if(!lod||model.loadedWidth>=lod.width)return;const texture=await this.texture(lod.url,lod.sha256,true);if(model.status==='disposed'||model.loadedWidth>=lod.width)return;(model.surface.material as THREE.MeshStandardMaterial).map=texture;(model.surface.material as THREE.MeshStandardMaterial).needsUpdate=true;model.loadedWidth=lod.width;}
 stats(){return {models:this.models.size,textureRequests:this.textures.size,texturesCreated:this.created,texturesDisposed:this.disposed,geometryCount:this.renderer.info.memory.geometries,textureCount:this.renderer.info.memory.textures};}
}
