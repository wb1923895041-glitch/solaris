import type { Vec3 } from './contracts';
import manifest from '../../data/phase-1/manifest.json' with {type:'json'};
export const AU_KM=149597870.7;
export const KM_PER_UNIT=AU_KM/52;
export type ScaleMode='scientific'|'exploration';
// ICRF -> J2000 ecliptic -> right-handed Three.js Y-up. Display axes only.
const m=manifest.displayFrame.icrfToEclipJ2000;
export function axes(p: Vec3): [number,number,number] { const r=m.map(row=>row.reduce((v,a,i)=>v+a*p[i],0));return [r[0],r[2],-r[1]]; }
export function displayPosition(p: Vec3,mode: ScaleMode): [number,number,number] {
  const v=axes(p),r=Math.hypot(...v);
  if(r===0) return [0,0,0];
  const scale=mode==='scientific'?1/KM_PER_UNIT:r===0?0:52*Math.log1p(r/(.35*AU_KM))/r;
  return v.map(x=>x*scale) as [number,number,number];
}
export function displayRadius(radiusKm: number,id: string,mode: ScaleMode) {
  return mode==='scientific'?radiusKm/KM_PER_UNIT:id==='10'?24:4.2+8.8*Math.sqrt(radiusKm/69911);
}
export function cameraRelative(position: Vec3,camera: Vec3): [number,number,number] { return position.map((x,i)=>x-camera[i]) as [number,number,number]; }
