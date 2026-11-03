import {EphemerisProvider,type Manifest,type ObjectMeta,type State} from '../science/ephemeris.ts';
import type {Vec3} from '../science/contracts';

export const satelliteParents:Readonly<Record<string,string>>={'301':'399','401':'499','402':'499','501':'599','502':'599','503':'599','504':'599','601':'699','602':'699','605':'699','606':'699','608':'699','705':'799','701':'799','702':'799','703':'799','704':'799','801':'899'};
export interface SatelliteMeta extends ObjectMeta{
 parentPlanetId:string;zh:string;centerId:string;centerKind:string;frame:string;referencePlane:string;correction:string;positionUnit:string;velocityUnit:string;timeScale:string;
 characteristicRadiusKm:number;sampledMeanPeriodDays:number;
 physical:{radiusKm:number;radiusUncertaintyKm:number;source:string};
 orientation:{modelAvailable:boolean;frame:string;status:string};asset:{status:string};
}
export interface SatelliteManifest{
 version:string;frame:string;referencePlane:string;correction:string;positionUnit:string;velocityUnit:string;timeScale:string;startTdb:number;endTdb:number;objects:SatelliteMeta[];
}
export type SatelliteState=State&{centerId:string;frame:'ICRF';positionUnit:'km';velocityUnit:'km/s';timeScale:'TDB';composition?:{operation:'parentSSB + moonRelative';parentId:string;parentSolution:string;parentRawSha256:string}};

/** Satellite contract adapter. Evaluation uses the unchanged phase-1 state method.
 * Its original constructor intentionally admits nine solar-system bodies only;
 * this adapter validates the separate 18-body, parent-centred contract first.
 * No copied interpolation formula, alternate clock, orbit fitting, or extrapolation.
 */
export class SatelliteEphemeris{
 private readonly core:EphemerisProvider;
 constructor(readonly manifest:SatelliteManifest,readonly buffers:ReadonlyMap<string,Float64Array>,readonly planets:EphemerisProvider){
  const m=manifest;
  if(m.frame!=='ICRF'||m.referencePlane!=='FRAME'||m.correction!=='NONE'||m.positionUnit!=='km'||m.velocityUnit!=='km/s'||m.timeScale!=='TDB')throw Error('卫星坐标、时标或单位契约错误');
  if(!Number.isFinite(m.startTdb)||!Number.isFinite(m.endTdb)||m.startTdb>=m.endTdb||m.startTdb<planets.manifest.startTdb||m.endTdb>planets.manifest.endTdb)throw Error('卫星覆盖区间不在既有太阳系星历内');
  if(m.objects.length!==18||new Set(m.objects.map(o=>o.id)).size!==18||Object.keys(satelliteParents).some(id=>!m.objects.some(o=>o.id===id)))throw Error('18 颗卫星目录不完整');
  for(const o of m.objects){
   if(o.parentPlanetId!==satelliteParents[o.id]||o.centerId!==o.parentPlanetId||o.centerKind!=='planetCenter')throw Error('卫星必须以指定行星本体为中心');
   for(const key of ['frame','referencePlane','correction','positionUnit','velocityUnit','timeScale'] as const)if(o[key]!==m[key])throw Error('卫星逐项契约不一致');
   const a=buffers.get(o.id);
   if(!a||a.length!==o.count*7||o.count<2||!Number.isFinite(o.stepSeconds)||o.stepSeconds<=0||!Number.isFinite(o.sampledMeanPeriodDays)||o.sampledMeanPeriodDays<=0||!Number.isFinite(o.physical.radiusKm)||o.physical.radiusKm<=0)throw Error('卫星缓存或元数据损坏');
   for(const x of a)if(!Number.isFinite(x))throw Error('卫星缓存存在非有限数');
   for(let i=7;i<a.length;i+=7)if(Math.abs(a[i]-a[i-7]-o.stepSeconds)>1e-4)throw Error('卫星时间网格不连续');
   if(a[0]>m.startTdb||a[a.length-7]<m.endTdb||o.coverageTdb[0]!==a[0]||o.coverageTdb[1]!==a[a.length-7])throw Error('卫星缓存覆盖不足');
  }
  // A structural instance binds the existing public evaluator to validated data.
  // The legacy 9-body constructor is not weakened or modified.
  const samplingManifest:Manifest={...m,centerId:'PER_OBJECT_PARENT'};
  this.core={manifest:samplingManifest,buffers,state:EphemerisProvider.prototype.state,all:EphemerisProvider.prototype.all};
 }
 meta(id:string){const o=this.manifest.objects.find(o=>o.id===id);if(!o)throw Error('未知卫星 ID');return o;}
 coverage(id:string){const o=this.meta(id);return {from:this.manifest.startTdb,to:this.manifest.endTdb,stored:o.coverageTdb,kernel:o.solution};}
 relativeState(id:string,tdb:number):SatelliteState{
  const o=this.meta(id),s=this.core.state(id,tdb);
  return {...s,centerId:o.parentPlanetId,frame:'ICRF',positionUnit:'km',velocityUnit:'km/s',timeScale:'TDB'};
 }
 absoluteState(id:string,tdb:number):SatelliteState{
  const local=this.relativeState(id,tdb),parent=this.planets.state(local.centerId,tdb);
  return {...local,centerId:'0',composition:{operation:'parentSSB + moonRelative',parentId:local.centerId,parentSolution:parent.source.solution,parentRawSha256:parent.source.rawSha256},positionKm:local.positionKm.map((v,i)=>v+parent.positionKm[i]) as unknown as Vec3,velocityKmPerSec:local.velocityKmPerSec.map((v,i)=>v+parent.velocityKmPerSec[i]) as unknown as Vec3};
 }
 track(id:string,tdb:number,segments=256){
  this.relativeState(id,tdb);if(!Number.isInteger(segments)||segments<8||segments>4096)throw Error('轨迹采样数不合法');
  const window=this.meta(id).sampledMeanPeriodDays*86400/2,start=Math.max(this.manifest.startTdb,tdb-window),end=Math.min(this.manifest.endTdb,tdb+window);
  return Array.from({length:segments+1},(_,i)=>this.relativeState(id,start+(end-start)*i/segments));
 }
 all(tdb:number){return this.manifest.objects.map(o=>this.relativeState(o.id,tdb));}
}

export async function loadSatellites(planets:EphemerisProvider){
 const response=await fetch('/satellites/manifest.json');if(!response.ok)throw Error('卫星来源清单加载失败');const manifest=await response.json() as SatelliteManifest;
 const buffers=new Map<string,Float64Array>();
 // A source failure disables this optional data layer, never the original planets.
 if(!Array.isArray(manifest.objects)||manifest.objects.length!==18)throw Error('卫星清单损坏');
 await Promise.all(manifest.objects.map(async o=>{if(!/^\/satellites\/\d+\.f64$/.test(o.file))throw Error('非法卫星数据路径');const r=await fetch(o.file);if(!r.ok)throw Error('卫星缓存加载失败 '+o.id);const bytes=await r.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==o.sha256)throw Error('卫星缓存哈希不符 '+o.id);buffers.set(o.id,new Float64Array(bytes));}));
 return new SatelliteEphemeris(manifest,buffers,planets);
}
