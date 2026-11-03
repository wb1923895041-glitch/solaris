import fs from 'node:fs';import assert from 'node:assert/strict';
import {EphemerisProvider,relative} from '../src/science/ephemeris.ts';
import {TimeSystem} from '../src/science/time.ts';
import {catalog} from '../src/science/catalog.ts';
import {displayPosition,displayRadius} from '../src/science/coordinates.ts';
import {presentationSizes} from '../src/render/presentation-size.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),m=read('data/phase-1/manifest.json'),assets=read('data/phase-2/visual-manifest.json'),time=new TimeSystem(m.time.parameters,m.startUtc,m.endUtc);
const provider=new EphemerisProvider(m,new Map(m.objects.map(o=>{const b=fs.readFileSync('public'+o.file);return [o.id,new Float64Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))]})));
const extent=id=>{const a=assets.bodies.find(a=>a.bodyId===id),shape=Math.max(1,...(a.shapeRatios??[1]));return Math.max(shape,shape*(a.atmosphere?.radius??1),a.ringProfile?.outerRatio??1,id==='399'?1.0015:1)};
function bodies(utc,mode){const t=time.utcToTdb(utc),sun=provider.state('10',t);return catalog.map(b=>({id:b.id,position:displayPosition(relative(provider.state(b.id,t),sun).positionKm,mode),radius:displayRadius(b.radiusKm,b.id,mode),extent:extent(b.id),visible:true}));}
let pairChecks=0,heroChecks=0,days=0;let defaultCase;
for(let utc=time.startMs;utc<=time.endMs;utc+=86400000){
 const a=bodies(utc,'exploration'),saved=JSON.stringify(a),normal=presentationSizes(a,true),hero=presentationSizes(a,true,new Set(['10','399']));
 for(const sizes of [normal,hero])for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const x=a[i],y=a[j],rx=sizes.get(x.id),ry=sizes.get(y.id),distance=Math.hypot(...x.position.map((v,k)=>v-y.position[k]));assert.ok(rx.radius*rx.extent+ry.radius*ry.extent<distance,`${new Date(utc).toISOString()} ${x.id}/${y.id}`);assert.ok(rx.radius<=x.radius&&ry.radius<=y.radius);pairChecks++;}
 assert.equal(normal.get('10').radius,a[0].radius);assert.equal(hero.get('399').radius,a.find(b=>b.id==='399').radius);heroChecks++;
 const sci=bodies(utc,'scientific'),scientific=presentationSizes(sci,false);for(const b of sci)assert.equal(scientific.get(b.id).radius,b.radius);
 assert.equal(JSON.stringify(a),saved,'No input position or radius may be mutated');days++;
 if(utc===Date.parse('2026-10-29T00:00:00Z')){const earth=a.find(b=>b.id==='399'),venus=a.find(b=>b.id==='299'),distance=Math.hypot(...earth.position.map((v,k)=>v-venus.position[k]));defaultCase={utc:new Date(utc).toISOString(),distance,previousRadiusSum:earth.radius+venus.radius,previousIntersection:earth.radius+venus.radius-distance,earth:normal.get('399'),venus:normal.get('299'),newEnvelopeGap:distance-normal.get('399').radius*earth.extent-normal.get('299').radius*venus.extent};assert.ok(defaultCase.previousIntersection>0,'Reproduce reported intersecting surfaces');}
}
// Synthetic stress cases exercise the fallback when fixed centres cannot fit
// a protected exaggerated model. They are never astronomical source data.
const synthetic=[{id:'a',position:[0,0,0],radius:10,extent:1,visible:true},{id:'b',position:[1,0,0],radius:4,extent:2,visible:true}];const stress=presentationSizes(synthetic,true,new Set(['a']));assert.ok(stress.get('a').radius+stress.get('b').radius*2<1);
const report={days,pairChecks,heroChecks,scientificScaleUnchanged:true,positionsAndInputsUnchanged:true,defaultCase};fs.writeFileSync('docs/planet-overlap/geometry-validation.json',JSON.stringify(report,null,2));console.log('PASS',report);
