import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as THREE from 'three';
import {MoonOrientation,icrfToDisplay} from '../src/satellites/moon-visual.ts';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),meta=await read('public/assets/moons/orientation/manifest.json'),fixtures=(await read('docs/phase-3b/orientation-validation.json')).fixtures;
globalThis.fetch=async url=>{try{const b=await fs.readFile('public'+url);return new Response(b)}catch{return new Response('',{status:404})}};
const orientation=new MoonOrientation(meta),results=[];
for(const o of meta.objects){
 await orientation.load(o.bodyId);const errors=[];
 for(const f of fixtures.filter(f=>f.id===o.bodyId)){
  const m=f.bodyToIcrf,reference=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(m[0][0],m[0][1],m[0][2],0,m[1][0],m[1][1],m[1][2],0,m[2][0],m[2][1],m[2][2],0,0,0,0,1)),q=orientation.at(o.bodyId,f.tdb),error=q.angleTo(reference)*180/Math.PI;
  assert.ok(error<.005,o.bodyId+' angular error '+error);assert.ok(Math.abs(q.length()-1)<1e-12);errors.push(error);
 }
 for(const t of [meta.startTdb,meta.endTdb])assert.ok(Math.abs(orientation.at(o.bodyId,t).length()-1)<1e-12);
 for(const t of [NaN,Infinity,meta.startTdb-1,meta.endTdb+1])assert.throws(()=>orientation.at(o.bodyId,t));
 results.push({id:o.bodyId,samples:errors.length,maxAngleDegrees:Math.max(...errors)});console.log('PASS',o.bodyId,errors.length,Math.max(...errors));
}
assert.equal(results.length,18);assert.equal(results.reduce((s,r)=>s+r.samples,0),2304);assert.ok(Math.abs(icrfToDisplay.length()-1)<1e-12);assert.throws(()=>orientation.at('399',meta.startTdb));
for(const field of ['startTdb','endTdb']){const m=structuredClone(meta);m[field]=NaN;assert.throws(()=>new MoonOrientation(m));}
for(const field of ['frame','quality','stepSeconds','count']){const m=structuredClone(meta);m.objects[0][field]=field==='count'?1:field==='stepSeconds'?0:'invalid';assert.throws(()=>new MoonOrientation(m));}
await fs.writeFile('docs/phase-3b/orientation-runtime-validation.json',JSON.stringify({evaluator:'production MoonOrientation.at',reference:'CSPICE pxform at independently selected off-grid times',results},null,2));
console.log('ALL PASS: 2304 independent off-grid attitude samples, endpoint and contract checks');
