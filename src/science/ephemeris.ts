import type { Vec3 } from './contracts';
export interface ObjectMeta {
  id: string; name: string; file: string; sha256: string; rawSha256: string; rawPath: string;
  count: number; stepSeconds: number; coverageTdb: number[]; solution: string;
}
export interface Manifest {
  centerId: string; frame: string; referencePlane: string; correction: string; positionUnit: string;
  velocityUnit: string; timeScale: string; startTdb: number; endTdb: number; objects: ObjectMeta[];
}
export interface State { positionKm: Vec3; velocityKmPerSec: Vec3; timeTdb: number; source: ObjectMeta }
export class EphemerisProvider {
  constructor(readonly manifest: Manifest, readonly buffers: ReadonlyMap<string,Float64Array>) {
    const m=manifest;
    if(m.centerId!=='0'||m.frame!=='ICRF'||m.referencePlane!=='FRAME'||m.correction!=='NONE'||m.positionUnit!=='km'||m.velocityUnit!=='km/s'||m.timeScale!=='TDB') throw new Error('星历来源、坐标或单位不一致');
    if(m.objects.length!==9||new Set(m.objects.map(o=>o.id)).size!==9||!['10','199','299','399','499','599','699','799','899'].every(id=>m.objects.some(o=>o.id===id))) throw new Error('天体目录不完整或本体中心 ID 不一致');
    for(const meta of m.objects) {
      const a=buffers.get(meta.id);
      if(!a||a.length!==meta.count*7||a.length<14) throw new Error('星历数据缺失或损坏');
      for(let i=0;i<a.length;i++) if(!Number.isFinite(a[i])) throw new Error('星历含非有限值');
      for(let i=7;i<a.length;i+=7) if(Math.abs(a[i]-a[i-7]-meta.stepSeconds)>1e-4) throw new Error('星历时间序列不连续');
      if(a[0]>m.startTdb||a[a.length-7]<m.endTdb) throw new Error('数据覆盖不完整');
    }
  }
  state(id: string, t: number): State {
    if(!Number.isFinite(t)||t<this.manifest.startTdb||t>this.manifest.endTdb) throw new Error('禁止星历外推');
    const meta=this.manifest.objects.find(o=>o.id===id); if(!meta) throw new Error('未知天体');
    const a=this.buffers.get(id)!;
    const i=Math.min(meta.count-2,Math.max(0,Math.floor((t-a[0])/meta.stepSeconds)))*7;
    const h=a[i+7]-a[i],u=(t-a[i])/h,u2=u*u,u3=u2*u;
    const p:number[]=[],v:number[]=[];
    for(let j=0;j<3;j++) {
      const p0=a[i+1+j],v0=a[i+4+j],p1=a[i+8+j],v1=a[i+11+j];
      p.push((2*u3-3*u2+1)*p0+(u3-2*u2+u)*h*v0+(-2*u3+3*u2)*p1+(u3-u2)*h*v1);
      v.push((6*u2-6*u)/h*p0+(3*u2-4*u+1)*v0+(-6*u2+6*u)/h*p1+(3*u2-2*u)*v1);
    }
    return {positionKm:p as unknown as Vec3,velocityKmPerSec:v as unknown as Vec3,timeTdb:t,source:meta};
  }
  all(t: number) { return new Map(this.manifest.objects.map(o=>[o.id,this.state(o.id,t)])); }
}
export function relative(body: State,sun: State) {
  if(body.timeTdb!==sun.timeTdb) throw new Error('不能组合不同历元');
  return {positionKm:body.positionKm.map((x,i)=>x-sun.positionKm[i]) as unknown as Vec3,velocityKmPerSec:body.velocityKmPerSec.map((x,i)=>x-sun.velocityKmPerSec[i]) as unknown as Vec3};
}
