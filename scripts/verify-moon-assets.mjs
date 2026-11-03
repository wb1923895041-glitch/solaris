import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';import * as THREE from 'three';
import {MoonVisuals} from '../src/satellites/moon-visual.ts';import {validateMoonAssets} from '../src/satellites/asset-contract.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),m=read('public/assets/moons/manifest.json'),catalog=read('data/phase-3a/manifest.json'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),fakeCatalog={meta:id=>{const b=catalog.objects.find(b=>b.id===id);if(!b)throw Error('unknown');return b;}};
validateMoonAssets(m,fakeCatalog);assert.equal(m.bodies.length,18);for(const field of ['parentPlanetId','meanRadiusKm','meshFrame','orientationModel']){const bad=structuredClone(m);bad.bodies[0][field]=field==='meanRadiusKm'?1:'invalid';assert.throws(()=>validateMoonAssets(bad,fakeCatalog));}
globalThis.fetch=async url=>new Response(fs.readFileSync('public'+url));
// Only texture decoding is omitted in this geometry test. The production
// geometry builder, mesh-axis convention and normals run without modification.
const geometryManifest=structuredClone(m);for(const a of geometryManifest.bodies){a.lods=[];delete a.relief;}
const visuals=new MoonVisuals(geometryManifest,{}),results=[];
for(const a of m.bodies){
 assert.deepEqual(a,read('public/assets/moons/'+a.naifId+'/config.json'));
 for(const l of a.lods)assert.equal(hash('public'+l.url),l.sha256);
 for(const [obj,pathKey,shaKey]of [[a.geometry,'file','sha256'],[a.geometry,'indexFile','indexSha256'],[a.geometry,'colorFile','colorSha256'],[a.relief,'file','sha256'],[a.coverage,'file','sha256']])if(obj?.[pathKey])assert.equal(hash('public'+obj[pathKey]),obj[shaKey]);
 for(const o of [a.albedo,a.geometry])if(o?.rawPath)assert.equal(hash(o.rawPath),o.rawSha256);
 const model=await visuals.load(a.naifId),geometry=model.surface.geometry,p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');let maxUvError=0;
 for(let i=0;i<p.count;i+=137){const point=new THREE.Vector3().fromBufferAttribute(p,i).applyQuaternion(model.surface.quaternion);assert.ok(Number.isFinite(point.length())&&point.length()>0);if(uv&&Math.abs(point.z/point.length())<.999){const longitude=Math.atan2(point.y,point.x),latitude=Math.asin(point.z/point.length()),du=Math.abs((uv.getX(i)-(.5+longitude/(2*Math.PI))+.5)%1-.5),dv=Math.abs(uv.getY(i)-(.5+latitude/Math.PI));maxUvError=Math.max(maxUvError,du,dv);assert.ok(maxUvError<1e-6,a.naifId+' incorrectly registered surface UV');}}
 if(a.naifId==='301'){const heights=new Float32Array(fs.readFileSync('public'+a.geometry.file).buffer);assert.ok(model.radius<1.01);}
 if(['401','402'].includes(a.naifId))assert.equal(geometry.index.count/3,196608);
 if(a.naifId==='606'){assert.equal(model.root.children.length,2);assert.equal(model.surface.material.transparent,false);assert.equal(model.surface.material.map,null);}
 assert.equal(model.surface.material.emissive.getHex(),0);results.push({id:a.naifId,vertices:p.count,triangles:geometry.index?geometry.index.count/3:p.count/3,normalisedBound:model.radius,maxUvError,maxSourceLod:a.lods.at(-1)?.width??0});console.log('PASS',a.naifId,'hashes, source, physical binding, geometry and UV',maxUvError);
}
fs.writeFileSync('docs/phase-3b/asset-runtime-validation.json',JSON.stringify({scope:'production geometry/UV path; browser separately tests actual image decoding and render',results},null,2));console.log('ALL PASS 18 independent asset configurations');
