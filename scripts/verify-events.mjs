import fs from 'node:fs';import assert from 'node:assert/strict';
import {EphemerisProvider} from '../src/science/ephemeris.ts';
import {TimeSystem} from '../src/science/time.ts';
import {SatelliteEphemeris} from '../src/satellites/ephemeris.ts';
import {findEclipses,moonPhase,extrema} from '../src/education/events.ts';
// Phase 5: eclipses computed from our own Horizons states vs the archived NASA Five Millennium Canon (TD ≈ TDB).
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),load=m=>new Map(m.objects.map(o=>{const b=fs.readFileSync('public'+o.file);return [o.id,new Float64Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))]}));
const base=read('data/phase-1/manifest.json'),sm=read('data/phase-3a/manifest.json'),planets=new EphemerisProvider(base,load(base)),sats=new SatelliteEphemeris(sm,load(sm),planets),time=new TimeSystem(base.time.parameters,base.startUtc,base.endUtc);
const g={sun:t=>{const s=planets.state('10',t).positionKm,e=planets.state('399',t).positionKm;return [s[0]-e[0],s[1]-e[1],s[2]-e[2]];},moon:t=>sats.relativeState('301',t).positionKm};
const nasa=read('data/phase-5/nasa-eclipses.json');const start=sm.startTdb,end=Math.min(sm.endTdb,time.utcToTdb(time.parse('2031-01-01T00:00:00Z')));
const t0=performance.now(),found=findEclipses(g,start,end),ms=performance.now()-t0;
// NASA greatest-eclipse times are TD; TT and TDB differ by < 2 ms, so TD is compared directly with our TDB seconds.
const td=r=>{const [y,mo,d]=r.date.split('-').map(Number),[h,mi,s]=r.tdGreatest.split(':').map(Number);return (Date.UTC(y,mo-1,d,h,mi,s)-Date.UTC(2000,0,1,12))/1000;};
const kindOf=(type,solar)=>solar?({T:'solar-total',A:'solar-annular',H:'solar-hybrid',P:'solar-partial'})[type[0]]:({T:'lunar-total',P:'lunar-partial',N:'lunar-penumbral'})[type[0]];
const rows=[],fails=[];
for(const [list,solar] of [[nasa.solar,true],[nasa.lunar,false]])for(const r of list){const t=td(r);if(t<start||t>end)continue;
 const m=found.filter(f=>f.kind.startsWith(solar?'solar':'lunar')).sort((a,b)=>Math.abs(a.tdb-t)-Math.abs(b.tdb-t))[0];
 const dt=m?m.tdb-t:NaN,expected=kindOf(r.type,solar),row={nasa:`${r.date} ${r.tdGreatest} TD ${r.type}`,expected,computed:m?.kind,dtSeconds:dt,nasaGamma:r.gamma??null,computedGamma:m?.gamma};rows.push(row);
 if(!m||Math.abs(dt)>300||m.kind!==expected)fails.push(row);}
const extra=found.filter(f=>!rows.some(r=>Math.abs(r.dtSeconds+0)<1e9&&Math.abs(f.tdb-(td({date:r.nasa.slice(0,10),tdGreatest:r.nasa.slice(11,19)})))<86400));
const phase=moonPhase(g,time.utcToTdb(time.parse('2025-03-14T06:59:00Z')));
const report={method:'Geometric (no light-time/aberration) shadow cones; Earth shadow enlarged 1/85 (Danjon); scan of syzygies with ternary refinement',computeMs:ms,found:found.length,matched:rows.length-fails.length,rows,extraComputed:extra,fails,phaseAtLunarEclipse2025:phase,maxAbsTimingSeconds:Math.max(...rows.filter(r=>Number.isFinite(r.dtSeconds)).map(r=>Math.abs(r.dtSeconds)))};
fs.mkdirSync('docs/phase-5',{recursive:true});fs.writeFileSync('docs/phase-5/eclipse-validation.json',JSON.stringify(report,null,2));
for(const r of rows)console.log(r.computed===r.expected&&Math.abs(r.dtSeconds)<=300?'PASS':'FAIL',r.nasa.padEnd(32),(r.computed??'-').padEnd(16),`Δt ${r.dtSeconds?.toFixed(1)} s`,`γ ${r.nasaGamma} / ${r.computedGamma?.toFixed(4)}`);
console.log('extra computed (not in NASA list):',extra.length,'max |Δt|',report.maxAbsTimingSeconds.toFixed(1),'s');
assert.equal(fails.length,0,'eclipse mismatches');assert.equal(extra.length,0,'unlisted computed eclipses');assert.ok(phase.illuminatedFraction>.999);
console.log(`${rows.length} NASA eclipses 2024–2030 reproduced from the project ephemerides`);
