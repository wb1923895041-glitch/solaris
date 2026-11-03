import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {EphemerisProvider,relative} from '../src/science/ephemeris.ts';
import {TimeSystem,TimeController} from '../src/science/time.ts';
import {displayPosition,displayRadius,AU_KM,KM_PER_UNIT,cameraRelative} from '../src/science/coordinates.ts';
import {catalog} from '../src/science/catalog.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read('public/data/manifest.json'),v=read('data/phase-1/validation.json');
assert.deepEqual(manifest,read('data/phase-1/manifest.json'),'Bundled and public provenance manifests diverged');
const buffers=new Map();
for(const o of manifest.objects){
 const b=fs.readFileSync('public'+o.file);
 assert.equal(crypto.createHash('sha256').update(b).digest('hex'),o.sha256);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(o.rawPath)).digest('hex'),o.rawSha256);
 buffers.set(o.id,new Float64Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)));
}
const provider=new EphemerisProvider(manifest,buffers),time=new TimeSystem(manifest.time.parameters,manifest.startUtc,manifest.endUtc);
const report=[];
for(const o of v.objects){
 const errors=[];
 for(const row of o.rows){
  const s=provider.state(o.id,row[0]),a=buffers.get(o.id);
  assert.ok((row[0]-a[0])%s.source.stepSeconds>1); // held out, not a grid epoch
  const pos=Math.hypot(...s.positionKm.map((x,i)=>x-row[i+1]));
  const vel=Math.hypot(...s.velocityKmPerSec.map((x,i)=>x-row[i+4]));
  const nearest=v.requestedTdb.reduce((best,t,i)=>Math.abs(t-row[0])<Math.abs(v.requestedTdb[best]-row[0])?i:best,0);
  errors.push({utc:v.utc[nearest]+'Z',tdbSeconds:row[0],positionKm:pos,positionAU:pos/AU_KM,velocityKmPerS:vel});
 }
 const max=Math.max(...errors.map(e=>e.positionKm)),maxVel=Math.max(...errors.map(e=>e.velocityKmPerS));
 report.push({id:o.id,name:o.name,solution:o.solution,samples:errors.length,maxPositionKm:max,maxPositionAU:max/AU_KM,rmsPositionKm:Math.sqrt(errors.reduce((s,e)=>s+e.positionKm**2,0)/errors.length),maxVelocityKmPerS:maxVel,errors});
 assert.ok(max<10,`${o.name} exceeds 10km: ${max}`);
 assert.ok(maxVel<.001,`${o.name} exceeds .001 km/s: ${maxVel}`);
}
const timeErrors=v.timeFixtures.map(f=>Math.abs(time.utcToTdb(time.parse(f.utc))-f.tdbSeconds));
assert.ok(Math.max(...timeErrors)<.001);
let checks=0;const check=(name,fn)=>{fn();console.log('PASS '+name);checks++};
check('catalog values match unit-bearing provenance and archived official values',()=>{const records=read('data/phase-1/catalog-provenance.json');const html=fs.readFileSync('data/phase-1/raw/planetary-physical-parameters.html','utf8');for(const body of catalog){const record=records.find(r=>r.id===body.id);assert.equal(record.meanRadius.unit,'km');assert.equal(body.radiusKm,record.meanRadius.value);assert.equal(body.radiusUncertaintyKm,record.meanRadius.uncertaintyKm);assert.equal(body.periodYears,record.siderealOrbitalPeriod?.value??null);if(body.id!=='10'){assert.ok(html.includes(String(body.periodYears)),body.en+' period not in original source');}}});
check('all nine exact target center IDs',()=>assert.deepEqual(manifest.objects.map(o=>o.id),['10','199','299','399','499','599','699','799','899']));
check('UTC repeat gives identical states',()=>assert.deepEqual(provider.all(time.utcToTdb(time.parse('2026-10-29T00:00:00Z'))),provider.all(time.utcToTdb(time.parse('2026-10-29T00:00:00Z')))));
check('reject UTC leap second, invalid day, timezone ambiguity and outside window',()=>{for(const utc of ['2026-10-29T00:00:60Z','2024-02-30T00:00:00Z','2024-01-01T00:00:00','2016-12-31T23:59:60Z','2032-01-01T00:00:00Z'])assert.throws(()=>time.parse(utc));});
check('leap day is a real 86400-second UTC day',()=>assert.equal(time.parse('2024-03-01T00:00:00Z')-time.parse('2024-02-29T00:00:00Z'),86400000));
check('data boundary accepted, outside rejected, unknown body rejected',()=>{provider.state('399',manifest.startTdb);provider.state('399',manifest.endTdb);assert.throws(()=>provider.state('399',manifest.startTdb-1));assert.throws(()=>provider.state('399',manifest.endTdb+1));assert.throws(()=>provider.state('3',manifest.startTdb));});
check('reject wrong center/frame/units and corrupt samples',()=>{for(const key of ['centerId','frame','positionUnit','timeScale'])assert.throws(()=>new EphemerisProvider({...manifest,[key]:'invalid'},buffers));const broken=new Map(buffers);broken.set('10',new Float64Array([NaN]));assert.throws(()=>new EphemerisProvider(manifest,broken));});
check('heliocentric position and velocity both subtract Sun at same epoch',()=>{const t=manifest.startTdb,b=provider.state('399',t),s=provider.state('10',t),r=relative(b,s);assert.equal(r.positionKm[1],b.positionKm[1]-s.positionKm[1]);assert.equal(r.velocityKmPerSec[1],b.velocityKmPerSec[1]-s.velocityKmPerSec[1]);assert.throws(()=>relative(b,{...s,timeTdb:t+1}));});
check('scientific radii and distances use one linear mapping',()=>{assert.equal(displayRadius(6371,'399','scientific'),6371/KM_PER_UNIT);assert.ok(Math.abs(Math.hypot(...displayPosition([AU_KM,0,0],'scientific'))-AU_KM/KM_PER_UNIT)<1e-10);assert.equal(displayRadius(10,'a','scientific')/displayRadius(20,'b','scientific'),.5);});
check('exploration mapping preserves state, direction and finite origin',()=>{const s=provider.state('399',manifest.startTdb),before=JSON.stringify(s);displayPosition(s.positionKm,'exploration');assert.equal(JSON.stringify(s),before);assert.deepEqual(displayPosition([0,0,0],'exploration'),[0,0,0]);});
check('CPU camera-relative subtraction retains small offsets',()=>assert.deepEqual(cameraRelative([1e10+.125,1e10+.25,1e10+.5],[1e10,1e10,1e10]),[.125,.25,.5]));
check('paused clock does not drift with frames',()=>{const c=new TimeController(time,time.startMs);for(let i=0;i<10000;i++)c.tick(i);assert.equal(c.utcMs,time.startMs);});
check('clock is independent of frame partition; rate changes are continuous',()=>{const a=new TimeController(time,time.startMs),b=new TimeController(time,time.startMs);a.play(true,0);b.play(true,0);for(let i=1;i<=1000;i++)a.tick(i);b.tick(1000);assert.equal(a.utcMs,b.utcMs);const prev=a.utcMs;a.setRate(3600,1000);assert.equal(a.utcMs,prev);a.tick(2000);assert.equal(a.utcMs,prev+3600000);});
check('zero/reverse rate, limits and reset are deterministic',()=>{const c=new TimeController(time,time.startMs+100000);c.setRate(0,0);c.play(true,0);c.tick(10000);assert.equal(c.utcMs,time.startMs+100000);c.setRate(-86400,10000);c.tick(20000);assert.equal(c.utcMs,time.startMs);assert.equal(c.playing,false);c.reset(21000);assert.equal(c.utcMs,c.defaultUtcMs);});
fs.writeFileSync('docs/phase-1/scientific-error-report.json',JSON.stringify({frame:'ICRF',centerId:'0',correction:'NONE',comparison:'Local cubic Hermite vs separate Horizons TLIST requests, all samples held out; not independent astronomical truth',timeMaxErrorSeconds:Math.max(...timeErrors),checks,report},null,2)+'\n');
console.table(report.map(({id,name,samples,maxPositionKm,maxPositionAU,maxVelocityKmPerS})=>({id,name,samples,maxPositionKm,maxPositionAU,maxVelocityKmPerS})));
console.log(`${checks} behavior checks; ${report.reduce((n,r)=>n+r.samples,0)} held-out states; max UTC/TDB error ${Math.max(...timeErrors)} s`);
