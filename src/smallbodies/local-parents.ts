import * as THREE from 'three';
import {axes} from '../science/coordinates';
import type {Vec3} from '../science/contracts';
import {icrfToDisplay,type MoonAsset,type MoonOrientation,type MoonVisuals,type MoonModel} from '../satellites/moon-visual';
import type {MoonMeta,MoonSource,SystemParent} from '../satellites/planetary-system';
import type {SatelliteEphemeris} from '../satellites/ephemeris';
import {spinAxis} from '../satellites/local-mapping';
import type {SmallBodyEphemeris} from './ephemeris';

/** Phase 4: Pluto–Charon and asset-backed small bodies in the existing local-system view, through the same
 * contracts (one Horizons state function, IAU pck00011 attitude, declared display map). */
export interface PlutoSystemData{charon:MoonMeta&{periodMethod:string};pluto:{radiusKm:number;gmKm3PerSec2:number;source:string};charonGm:{gmKm3PerSec2:number;source:string}}
/** SatelliteEphemeris (18 moons) plus Charon, dispatching by id; no second time base or evaluator. */
export class CombinedMoonSource implements MoonSource{
 readonly manifest:MoonSource['manifest'];
 constructor(readonly satellites:SatelliteEphemeris,readonly small:SmallBodyEphemeris,readonly pluto:PlutoSystemData){
  if(small.manifest.startTdb!==satellites.manifest.startTdb||small.manifest.endTdb!==satellites.manifest.endTdb)throw Error('卡戎与卫星星历窗口不一致');
  this.manifest={startTdb:satellites.manifest.startTdb,endTdb:satellites.manifest.endTdb,objects:[...satellites.manifest.objects,pluto.charon]};
 }
 meta(id:string){return id==='901'?this.pluto.charon:this.satellites.meta(id);}
 relativeState(id:string,tdb:number){if(id!=='901')return this.satellites.relativeState(id,tdb);const s=this.small.relativeState('901',tdb);return {positionKm:s.positionKm,velocityKmPerSec:s.velocityKmPerSec,timeTdb:tdb};}
 track(id:string,tdb:number,segments=256){
  if(id!=='901')return this.satellites.track(id,tdb,segments);
  const window=this.pluto.charon.sampledMeanPeriodDays*86400/2,start=Math.max(this.manifest.startTdb,tdb-window),end=Math.min(this.manifest.endTdb,tdb+window);
  return Array.from({length:segments+1},(_,i)=>this.relativeState('901',start+(end-start)*i/segments));
 }
}
const kindLabel:Record<string,string>={'999':'矮行星 · 冥王星–卡戎双天体系统','2000001':'矮行星 · 主带最大天体','2000004':'小行星 · 主带第二大天体'};
/** A small body with a 3B-format asset as a local-system parent. The model is reloaded if the LRU retired it. */
export async function smallBodyParent(id:string,asset:MoonAsset,small:SmallBodyEphemeris,visuals:MoonVisuals,orientation:MoonOrientation):Promise<SystemParent>{
 await orientation.load(id);const holder=new THREE.Group();holder.name='small-body-parent-'+id;let model:MoonModel=await visuals.load(id);holder.add(model.root);let reloading=false;
 const ensure=()=>{if(model.status==='disposed'&&!reloading){reloading=true;void visuals.load(id).then(m=>{model=m;holder.add(m.root);reloading=false;});}};
 return {id,zh:asset.displayNameZh,en:asset.displayNameEn,kindLabel:kindLabel[id]??'小天体',radiusKm:asset.meanRadiusKm,assetNote:`${asset.albedo.provider} · ${asset.albedo.title}`,object:holder,get boundingRadius(){return model.radius;},
  // Model root already carries the sphere→IAU mesh rotation; the holder takes body→display.
  attitude:tdb=>icrfToDisplay.clone().multiply(orientation.at(id,tdb)),positionSSB:tdb=>small.absoluteState(id,tdb).positionKm,
  update:(px,_local,sun)=>{ensure();model.root.position.set(0,0,0);model.root.quaternion.identity();model.root.scale.setScalar(1);model.root.traverse(o=>{if((o instanceof THREE.Mesh||o instanceof THREE.Points)&&o.material instanceof THREE.ShaderMaterial&&o.material.uniforms.sunDirection)o.material.uniforms.sunDirection.value.copy(sun);});if(px>60)void visuals.upgrade(model,px>850?4096:px>350?2048:1024);},
  snapshot:()=>({id,status:model.status,loadedWidth:model.loadedWidth,error:model.error})};
}
const fmt=(v:number,d=0)=>v.toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d});
/** Notes computed from sourced data only: Pluto–Charon barycentre (GM ratio) and mutual tidal locking (spin vs orbit). */
export function smallBodyNotes(small:SmallBodyEphemeris,pluto:PlutoSystemData,orientation:MoonOrientation){
 let ready=false;void orientation.load('999').then(()=>{ready=true;});
 return (id:string,tdb:number,spin:THREE.Vector3)=>{
  if(id==='999'){
   if(!ready)return '冥王星姿态缓存加载中…';
   const s=small.relativeState('901',tdb),d=Math.hypot(...s.positionKm),mu=pluto.charonGm.gmKm3PerSec2/(pluto.charonGm.gmKm3PerSec2+pluto.pluto.gmKm3PerSec2),bary=d*mu;
   const a=orientation.at('999',tdb-1800),b=orientation.at('999',tdb+1800),angle=2*Math.acos(Math.min(1,Math.abs(b.clone().multiply(a.clone().invert()).w))),spinDays=2*Math.PI/(angle/3600)/86400;
   const h=new THREE.Vector3(...axes(s.positionKm)).cross(new THREE.Vector3(...axes(s.velocityKmPerSec))).normalize(),tilt=THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(h.dot(spin),-1,1)));
   return `冥王星–卡戎质心距冥王星中心约 ${fmt(bary)} km（${(bary/pluto.pluto.radiusKm).toFixed(2)} 个冥王星半径），位于冥王星之外：二者绕共同质心运动，是双天体系统。质心由 GM 比 ${mu.toFixed(4)}（${pluto.charonGm.source} / ${pluto.pluto.source}）计算；本视图原点仍是冥王星本体中心 999。冥王星自转周期（由 IAU 姿态样本求得）${spinDays.toFixed(4)} 天，卡戎公转周期 ${pluto.charon.sampledMeanPeriodDays.toFixed(4)} 天：双向潮汐锁定。卡戎轨道法向与冥王星自转矢量夹角 ${tilt.toFixed(2)}°。`;
  }
  if(id==='2000001'){const h=small.heliocentric(id,tdb);return `谷神星是主带中唯一的矮行星，也是主带最大天体；当前日心距离 ${(Math.hypot(...h.positionKm)/149597870.7).toFixed(4)} au（JPL Horizons 状态）。Dawn 探测器 2015–2018 年环绕测绘；表面亮斑（Occator 撞击坑）为盐类沉积。`;}
  if(id==='2000004'){const h=small.heliocentric(id,tdb);return `灶神星为主带第二大天体，南极有巨大的 Rheasilvia 撞击盆地；当前日心距离 ${(Math.hypot(...h.positionKm)/149597870.7).toFixed(4)} au。Dawn 2011–2012 年环绕测绘。`;}
  return '';
 };
}
