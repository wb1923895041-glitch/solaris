import {EphemerisProvider,type Manifest,type ObjectMeta,type State} from '../science/ephemeris.ts';
import type {Vec3} from '../science/contracts';

/** Phase 4 named small bodies. Same contract and the unchanged phase-1 Hermite evaluator; no orbit fitting,
 * no Kepler fallback, no extrapolation. Pluto is the body centre (999), Charon is stored relative to it. */
export const smallBodyIds=['2000001','2000002','2000004','2000010','2000016','2000433','2101955','2099942','999','2136199','2136108','2136472','2486958','901'] as const;
export interface SmallBodyPhysical{fullName:string;orbitClass:string|null;source:string;diameter?:{value:string;sigma?:string|null;units?:string|null;reference?:string|null};GM?:{value:string;units?:string|null};albedo?:{value:string};rot_per?:{value:string;units?:string|null};extent?:{value:string;units?:string|null};orbitEpochJd?:number}
export interface SmallBodyMeta extends ObjectMeta{zh:string;kind:'dwarf-planet'|'asteroid'|'near-earth'|'kuiper-belt'|'satellite';centerId:string;physical:SmallBodyPhysical|null;targetHeader:string}
export interface SmallBodyManifest{version:string;frame:string;referencePlane:string;correction:string;positionUnit:string;velocityUnit:string;timeScale:string;startTdb:number;endTdb:number;objects:SmallBodyMeta[]}
export class SmallBodyEphemeris{
 private core:Pick<EphemerisProvider,'manifest'|'buffers'|'state'>;
 constructor(readonly manifest:SmallBodyManifest,buffers:ReadonlyMap<string,Float64Array>,readonly planets:EphemerisProvider){
  const m=manifest;
  if(m.frame!=='ICRF'||m.referencePlane!=='FRAME'||m.correction!=='NONE'||m.positionUnit!=='km'||m.velocityUnit!=='km/s'||m.timeScale!=='TDB')throw Error('小天体坐标、时标或单位契约错误');
  if(m.startTdb<planets.manifest.startTdb||m.endTdb>planets.manifest.endTdb)throw Error('小天体覆盖区间不在既有星历内');
  if(m.objects.length!==smallBodyIds.length||!smallBodyIds.every(id=>m.objects.some(o=>o.id===id)))throw Error('小天体目录不完整');
  for(const o of m.objects){
   if(o.id==='901'?o.centerId!=='999':o.centerId!=='0')throw Error('小天体参考中心错误');
   const a=buffers.get(o.id);if(!a||a.length!==o.count*7||o.count<2)throw Error('小天体缓存损坏 '+o.id);
   for(const x of a)if(!Number.isFinite(x))throw Error('小天体缓存含非有限值');
   for(let i=7;i<a.length;i+=7)if(Math.abs(a[i]-a[i-7]-o.stepSeconds)>1e-3)throw Error('小天体时间网格不连续');
   if(a[0]>m.startTdb||a[a.length-7]<m.endTdb)throw Error('小天体覆盖不足 '+o.id);
  }
  const samplingManifest:Manifest={...m,centerId:'PER_OBJECT'};
  this.core={manifest:samplingManifest,buffers,state:EphemerisProvider.prototype.state} as any;
 }
 meta(id:string){const o=this.manifest.objects.find(o=>o.id===id);if(!o)throw Error('未知小天体');return o;}
 /** Solar-system-barycentric state; Charon composes Pluto(999) SSB + Charon relative to 999 at the same TDB. */
 absoluteState(id:string,tdb:number):State{
  const s=this.core.state(id,tdb);if(id!=='901')return s;
  const pluto=this.core.state('999',tdb);return {...s,positionKm:s.positionKm.map((v,i)=>v+pluto.positionKm[i]) as unknown as Vec3,velocityKmPerSec:s.velocityKmPerSec.map((v,i)=>v+pluto.velocityKmPerSec[i]) as unknown as Vec3};
 }
 relativeState(id:string,tdb:number){return this.core.state(id,tdb);}
 /** Heliocentric state (body − Sun at one TDB), matching how the main scene places planets. */
 heliocentric(id:string,tdb:number){const s=this.absoluteState(id,tdb),sun=this.planets.state('10',tdb);return {positionKm:s.positionKm.map((v,i)=>v-sun.positionKm[i]) as unknown as Vec3,velocityKmPerSec:s.velocityKmPerSec.map((v,i)=>v-sun.velocityKmPerSec[i]) as unknown as Vec3,timeTdb:tdb};}
}
export async function verifiedBuffer(url:string,sha:string){const r=await fetch(url);if(!r.ok)throw Error('小天体数据加载失败 '+url);const bytes=await r.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==sha)throw Error('小天体数据哈希不符 '+url);return bytes;}
export async function loadSmallBodies(planets:EphemerisProvider){
 const r=await fetch('/smallbodies/manifest.json');if(!r.ok)throw Error('小天体清单加载失败');const manifest=await r.json() as SmallBodyManifest;
 const buffers=new Map<string,Float64Array>();await Promise.all(manifest.objects.map(async o=>{if(!/^\/smallbodies\/\d+\.f64$/.test(o.file))throw Error('非法小天体路径');buffers.set(o.id,new Float64Array(await verifiedBuffer(o.file,o.sha256)));}));
 return new SmallBodyEphemeris(manifest,buffers,planets);
}
