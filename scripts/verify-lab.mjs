import fs from 'node:fs';import assert from 'node:assert/strict';
import {Lab,keplerRelative,clone,energy} from '../src/lab/nbody.ts';
import {presets} from '../src/lab/presets.ts';
import {EphemerisProvider} from '../src/science/ephemeris.ts';
import {SatelliteEphemeris} from '../src/satellites/ephemeris.ts';
// Phase 6 acceptance: reproducibility, second-order convergence vs the analytic two-body solution, conservation,
// divergence warnings, and proof that the lab never writes to the ephemeris buffers it copies from.
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),load=m=>new Map(m.objects.map(o=>{const b=fs.readFileSync('public'+o.file);return [o.id,new Float64Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))]}));
const base=read('data/phase-1/manifest.json'),sm=read('data/phase-3a/manifest.json'),pb=load(base),planets=new EphemerisProvider(base,pb),sb=load(sm),sats=new SatelliteEphemeris(sm,sb,planets),ref=read('public/education/reference.json');
const gm=Object.fromEntries(Object.entries(ref.planets).map(([k,v])=>[k,v.gm]));gm['301']=sm.objects.find(o=>o.id==='301').physical.gmKm3PerSec2;
const radius={'10':695700,'199':2439.4,'299':6051.8,'399':6371.0084,'499':3389.5,'599':69911,'301':1737.4};
const tdb=sm.startTdb+86400*1000,ctx={state:(id,t)=>planets.state(id,t),moon:t=>sats.relativeState('301',t),gm,radius,tdb};
const hash=m=>{let h=0;for(const a of m.values())for(let i=0;i<a.length;i+=97)h=(h*31+a[i])%1e12;return h;},before=[hash(pb),hash(sb)];
const results=[];let count=0;const check=(name,fn)=>{const d=fn();count++;results.push({name,detail:d??null});console.log('PASS',name,d?JSON.stringify(d):'');};
const run=(state,days)=>{const lab=new Lab(state),steps=Math.round(days*86400/state.dt);lab.advance(steps);return lab;};
check('Second-order convergence against the analytic Kepler solution (error ratio ≈ 4 per dt halving)',()=>{
 const p=presets.find(p=>p.id==='kepler-ellipse'),errs=[];for(const dt of [3600*24,3600*12,3600*6,3600*3]){const s=p.make(ctx);s.dt=dt;s.substeps=1;const lab=run(s,365.25),b=lab.state.bodies,rel=[0,1,2].map(k=>b[1].r[k]-b[0].r[k]),exact=keplerRelative([149597870.7,0,0],s.bodies[1].v.map((x,k)=>x-s.bodies[0].v[k]),gm['10'],lab.state.t);errs.push(Math.hypot(...rel.map((x,k)=>x-exact[k])));}
 const ratios=errs.slice(1).map((e,i)=>errs[i]/e);assert.ok(ratios.every(r=>r>3.5&&r<4.5),JSON.stringify(ratios));return {errorsKm:errs,ratios};});
check('Symplectic energy behaviour: bounded over two orbits, error ∝ dt² (≈4× smaller per dt halving)',()=>{const out={};for(const scheme of ['velocity-verlet','leapfrog-dkd']){const rows=[];for(const dt of [21600,10800]){const s=presets[0].make(ctx);s.dt=dt;s.substeps=1;s.integrator=scheme;const lab=new Lab(s);let worst=0;for(let k=0;k<50;k++){lab.advance(Math.round(730.5*86400/dt/50));worst=Math.max(worst,lab.diagnostics().relEnergyDrift);}rows.push({dt,final:lab.diagnostics().relEnergyDrift,max:worst});}
  assert.ok(rows.every(r=>r.max<1e-5&&r.max<r.final*1.2));const ratio=rows[0].max/rows[1].max;assert.ok(ratio>3.5&&ratio<4.5,String(ratio));out[scheme]={rows,ratio};}return out;});
check('Reproducible: identical inputs give bit-identical states',()=>{const a=run(presets[1].make(ctx),30).state.bodies,b=run(presets[1].make(ctx),30).state.bodies;assert.deepEqual(a,b);});
check('Figure-eight returns close to its initial configuration after one period',()=>{const s=presets.find(p=>p.id==='figure-eight').make(ctx),lab=new Lab(s);lab.advance(Math.round(6.32591398/s.dt));const d=Math.max(...lab.state.bodies.map((b,i)=>Math.hypot(...b.r.map((x,k)=>x-s.bodies[i].r[k]))));assert.ok(d<5e-3);return {maxReturnDistance:d,energyDrift:lab.diagnostics().relEnergyDrift};});
check('Test body 4° from L4 librates (tadpole) around 60° for 60 years without escaping',()=>{const s=presets.find(p=>p.id==='jupiter-trojan').make(ctx),lab=new Lab(s);let lo=180,hi=0;for(let k=0;k<1095;k++){lab.advance(10);const [sun,j,t]=lab.state.bodies,a=[j.r[0]-sun.r[0],j.r[1]-sun.r[1],j.r[2]-sun.r[2]],b=[t.r[0]-sun.r[0],t.r[1]-sun.r[1],t.r[2]-sun.r[2]],ang=Math.acos((a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(Math.hypot(...a)*Math.hypot(...b)))*180/Math.PI;lo=Math.min(lo,ang);hi=Math.max(hi,ang);}assert.ok(lo>20&&hi<100&&hi-lo>2,`${lo} ${hi}`);return {minAngleDeg:lo,maxAngleDeg:hi};});
check('Divergence is detected and paused (huge step on a close orbit)',()=>{const s=presets[0].make(ctx);s.dt=86400*60;s.substeps=1;const lab=new Lab(s);lab.advance(40);assert.ok(lab.paused&&lab.warning);return {warning:lab.warning};});
check('Contact is detected and paused instead of passing through',()=>{const s=presets[0].make(ctx);s.bodies[1].r=[3*695700,0,0];s.bodies[1].v=[0,0,0];s.dt=600;s.substeps=4;const lab=new Lab(s);lab.advance(20000);assert.ok(lab.paused&&/接触/.test(lab.warning??''));return {warning:lab.warning};});
check('Ephemeris buffers are untouched by every preset (copy-only initial conditions)',()=>{for(const p of presets){const lab=new Lab(p.make(ctx));lab.advance(50);}assert.deepEqual([hash(pb),hash(sb)],before);});
check('Hypothetical preset is labelled and changes only the copied GM',()=>{const p=presets.find(p=>p.id==='hypothetical-jupiter'),s=p.make(ctx);assert.equal(p.kind,'hypothetical');assert.equal(s.bodies.find(b=>b.name.startsWith('木星')).gm,gm['599']*10);assert.equal(gm['599'],ref.planets['599'].gm);});
fs.mkdirSync('docs/phase-6',{recursive:true});fs.writeFileSync('docs/phase-6/lab-validation.json',JSON.stringify({checks:count,results},null,2));console.log(count,'lab checks passed');
