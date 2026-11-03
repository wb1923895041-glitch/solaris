import * as THREE from 'three';
import metadata from '../../../data/phase-2/orientation-manifest.json';
import {axes} from '../../science/coordinates';
const a=axes([1,0,0]),b=axes([0,1,0]),c=axes([0,0,1]);
const axisMatrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(...a),new THREE.Vector3(...b),new THREE.Vector3(...c));
const displayRotation=new THREE.Quaternion().setFromRotationMatrix(axisMatrix);
// Three sphere +Y north -> IAU +Z north; center UV 0.5 -> prime meridian +X.
const sphereToIau=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
export class BodyOrientation {
 private arrays=new Map<string,Float32Array>();
 async load(){await Promise.all(metadata.objects.map(async o=>{const response=await fetch(o.file);if(!response.ok)throw new Error('姿态数据加载失败 '+o.bodyId);const buffer=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==o.sha256)throw new Error('姿态数据完整性错误 '+o.bodyId);this.arrays.set(o.bodyId,new Float32Array(buffer));}));}
 at(id:string,tdb:number){
  if(tdb<metadata.startTdb||tdb>metadata.endTdb)throw new Error('姿态覆盖外');const values=this.arrays.get(id);if(!values)throw new Error('缺少姿态 '+id);
  const index=Math.min(values.length/4-2,Math.floor((tdb-metadata.startTdb)/metadata.stepSeconds));const u=(tdb-metadata.startTdb-index*metadata.stepSeconds)/metadata.stepSeconds;
  const q=new THREE.Quaternion().fromArray(values,index*4).normalize().slerp(new THREE.Quaternion().fromArray(values,index*4+4).normalize(),u);
  return displayRotation.clone().multiply(q).multiply(sphereToIau);
 }
}
