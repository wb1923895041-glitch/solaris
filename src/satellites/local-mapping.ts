import * as THREE from 'three';
import {axes} from '../science/coordinates.ts';
import type {Vec3} from '../science/contracts';

/** Local planetary-system display mapping. Pure functions: truth in, display out; never the reverse. */
export type LocalScale='scientific'|'exploration'|'closeup';
export const systemPlanets=['399','499','599','699','799','899'] as const;
// Exploration: r' = 1 + K·ln(r) in parent radii, direction unchanged; minimum visible moon sphere.
export const EXPLORATION_LOG_GAIN=2.2,EXPLORATION_MIN_RADIUS=.09;
/** Closeup keeps the scientific (linear) mapping: only the camera moves closer. */
export const isLinear=(scale:LocalScale)=>scale!=='exploration';
export function localPosition(relativeKm:Vec3,parentRadiusKm:number,scale:LocalScale):[number,number,number]{
 const v=axes(relativeKm).map(x=>x/parentRadiusKm) as [number,number,number],r=Math.hypot(...v);
 // Inside one parent radius (e.g. the Earth–Moon barycentre) stay linear; the map is continuous at r = 1.
 if(isLinear(scale)||r<=1)return v;
 const mapped=1+EXPLORATION_LOG_GAIN*Math.log(r);return v.map(x=>x*mapped/r) as [number,number,number];
}
/** Inverse of the exploration radial map, used only by tests to prove truth is recoverable. */
export function explorationInverse(mappedRadius:number){return mappedRadius<=1?mappedRadius:Math.exp((mappedRadius-1)/EXPLORATION_LOG_GAIN);}
export function localRadius(moonRadiusKm:number,parentRadiusKm:number,scale:LocalScale){const r=moonRadiusKm/parentRadiusKm;return isLinear(scale)?r:Math.max(r,EXPLORATION_MIN_RADIUS);}
/** Rotation sense from two attitude samples: the actual spin vector, not the IAU "north" label. */
export function spinAxis(before:THREE.Quaternion,after:THREE.Quaternion){
 const delta=after.clone().multiply(before.clone().invert()).normalize();if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
 return new THREE.Vector3(delta.x,delta.y,delta.z).normalize();
}
/** Instantaneous orbit plane from the state vector r×v (display axes; ecliptic north is +Y). */
export function orbitGeometry(positionKm:Vec3,velocityKmPerSec:Vec3,spin:THREE.Vector3){
 const h=new THREE.Vector3(...axes(positionKm)).cross(new THREE.Vector3(...axes(velocityKmPerSec))).normalize();
 const degrees=(a:THREE.Vector3,b:THREE.Vector3)=>THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1)));
 const toEquator=degrees(h,spin);return {normal:h.toArray(),inclinationToParentEquatorDegrees:toEquator,inclinationToEclipticDegrees:degrees(h,new THREE.Vector3(0,1,0)),prograde:toEquator<90};
}
