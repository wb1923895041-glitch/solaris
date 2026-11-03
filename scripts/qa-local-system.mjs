import {chromium} from 'playwright';import fs from 'node:fs/promises';import fsSync from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
import {EphemerisProvider} from '../src/science/ephemeris.ts';
import {SatelliteEphemeris} from '../src/satellites/ephemeris.ts';
import {localPosition,localRadius} from '../src/satellites/local-mapping.ts';
// 3C real-browser acceptance: node evaluates the same 3A ephemeris independently and compares every rendered state.
const channel=process.argv[2]||'chrome',full=channel==='chrome',dir='output/playwright/phase-3c',docs='docs/phase-3c';await fs.mkdir(dir,{recursive:true});await fs.mkdir(docs,{recursive:true});
const read=p=>JSON.parse(fsSync.readFileSync(p,'utf8')),load=m=>new Map(m.objects.map(o=>{const b=fsSync.readFileSync('public'+o.file);return [o.id,new Float64Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))]}));
const base=read('data/phase-1/manifest.json'),sm=read('data/phase-3a/manifest.json'),planets=new EphemerisProvider(base,load(base)),sats=new SatelliteEphemeris(sm,load(sm),planets);
const allSystems=[['399',['301']],['499',['401','402']],['599',['501','502','503','504']],['699',['601','602','605','606','608']],['799',['705','701','702','703','704']],['899',['801']]],systems=process.env.QA_SYSTEMS?allSystems.filter(([p])=>process.env.QA_SYSTEMS.split(',').includes(p)):allSystems,key=new Set(['301','401','501','502','503','606','602','801']);
const browser=await chromium.launch({channel,headless:false,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-features=CalculateNativeWinOcclusion','--enable-precise-memory-info']});
const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1}),errors=[],checks=[],shots=[],perf=[];let title='';
page.on('pageerror',e=>errors.push(e.message+' @ '+(e.stack||'').split(String.fromCharCode(10)).slice(1,4).join(' | ')));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const check=(name,pass,detail)=>{if(!pass)throw Error(name+(detail?' '+JSON.stringify(detail):''));checks.push(name);};
const nextFrame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const synced=()=>page.waitForFunction(()=>window.solarisQA.localSystem()?.tdb===window.solarisQA.snapshot().tdb,{},{timeout:5000});
const local=()=>page.evaluate(()=>window.solarisQA.localSystem()),main=()=>page.evaluate(()=>window.solarisQA.snapshot());
const foreground=()=>JSON.parse(execFileSync('powershell.exe',['-NoProfile','-File','scripts/activate-solaris-browser.ps1','-WindowTitle',title],{encoding:'utf8',windowsHide:true}));
const activationFailures=[];const refocus=()=>{try{return foreground();}catch(e){activationFailures.push(String(e).slice(0,160));return null;}};
const settled=async(timeout=30000)=>{await page.waitForFunction(()=>{const s=window.solarisQA.localSystem();return s?.open&&!s.transitioning&&s.moons.every(m=>m.loaded||m.error);},{},{timeout});await page.waitForTimeout(350);};
const shot=async(name,caption)=>{const path=`${dir}/${channel}-${name}-2560.png`;await page.screenshot({path});shots.push({path,caption});};
/** Every rendered moon must equal the independent node evaluation of the same 3A function at the same TDB, then the declared map. */
const verifyTruth=async label=>{const s=await local();check(label+' no moon asset errors',s.moons.every(m=>!m.error),s.moons.map(m=>m.error));let worst=0;
 for(const m of s.moons){const t=sats.relativeState(m.id,s.tdb);check(`${label} ${m.id} truth equals node evaluation`,t.positionKm.every((v,i)=>v===m.truthKm[i])&&t.velocityKmPerSec.every((v,i)=>v===m.truthVelocity[i]));
  const p=localPosition(t.positionKm,s.parentRadiusKm,s.scale);worst=Math.max(worst,...p.map((v,i)=>Math.abs(v-m.displayPosition[i])/Math.max(1,Math.hypot(...p))));check(`${label} ${m.id} display radius follows declared map`,Math.abs(m.displayRadius-localRadius(sm.objects.find(o=>o.id===m.id).physical.radiusKm,s.parentRadiusKm,s.scale))<1e-15);}
 check(label+' rendered positions follow the declared map of the truth',worst<1e-12,{worst});return s;};
const sample=async count=>{const run=()=>page.evaluate(async count=>{window.solarisQA.localProfile();const a=[];let hidden=0,last=await new Promise(r=>requestAnimationFrame(r));for(let i=0;i<count;i++){const t=await new Promise(r=>requestAnimationFrame(r));if(document.visibilityState!=='visible'||!document.hasFocus())hidden++;a.push(t-last);last=t;}return {a,hidden,memory:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null};},count);
 const rejected=[];let r=await run();for(let i=0;i<2&&(r.hidden>0||Math.max(...r.a)>500);i++){rejected.push({hidden:r.hidden,maxMs:Math.max(...r.a)});refocus();await page.waitForTimeout(800);r=await run();}const sorted=[...r.a].sort((a,b)=>a-b);return {rafP50Ms:sorted[Math.floor(sorted.length*.5)],rafP95Ms:sorted[Math.floor(sorted.length*.95)],rafMaxMs:sorted.at(-1),hiddenSamples:r.hidden,rejectedAttempts:rejected,memory:r.memory};};
try{
 await page.goto('http://127.0.0.1:4175');await page.waitForFunction(()=>window.solarisQA?.snapshot().scene.sky==='ready');title=`SOLARIS QA 3C ${channel} ${process.pid}`;await page.evaluate(t=>{document.title=t},title);const fg=foreground();check('Actual Windows foreground test window',fg.ExpectedWindow===fg.ActualForeground);await page.waitForTimeout(1000);
 const original=await main();await shot('overview','进入局部系统前的太阳系总览');
 await page.locator('.catalog-item[data-id="10"]').click();check('Entry button hidden for the Sun',await page.locator('#enter-system').isHidden());
 for(const [planet,moons] of systems){
  refocus();await page.waitForTimeout(300);
  // Real UI path: catalog click → enter button → main-scene focus transition → local system.
  if((await local())?.open){await page.locator('#ps-exit').click();await page.waitForFunction(()=>!window.solarisQA.localSystem()?.open,{},{timeout:5000});await page.waitForTimeout(900);}
  await page.locator(`.catalog-item[data-id="${planet}"]`).click();check(planet+' entry offered',await page.locator('#enter-system').isVisible());
  await page.locator('#enter-system').click();await page.waitForTimeout(500);check(planet+' main scene focuses first (smooth hand-over)',(await main()).scene.focus===planet);await settled();
  let s=await verifyTruth(planet+' exploration');check(planet+' breadcrumb',(await page.locator('.ps-crumbs').textContent()).replace(/\s/g,'').startsWith('太阳系/'));
  check(planet+' list sorted by real distance',JSON.stringify(await page.locator('.ps-item').evaluateAll(e=>e.map(x=>x.dataset.moonId)))===JSON.stringify(moons));
  check(planet+' same TDB as global clock',s.tdb===(await main()).tdb);await shot(`system-${planet}-exploration`,`${planet} 局部系统 · 探索比例`);
  // Scale switches never touch truth; orbit toggle neither.
  const truthBefore=JSON.stringify(s.moons.map(m=>m.truthKm));await page.locator('[data-scale=scientific]').click();await settled();s=await verifyTruth(planet+' scientific');check(planet+' scale switch leaves truth unchanged',JSON.stringify(s.moons.map(m=>m.truthKm))===truthBefore);
  check(planet+' scientific labels or locator rings for sub-pixel moons',s.moons.every(m=>!m.onScreen||m.label||m.marker));await shot(`system-${planet}-scientific`,`${planet} 局部系统 · 科学比例（同一线性映射）`);
  await page.locator('#ps-orbits').click();await nextFrame();s=await local();check(planet+' orbit toggle hides tracks only',s.moons.every(m=>!m.trackVisible)&&JSON.stringify(s.moons.map(m=>m.truthKm))===truthBefore);await page.locator('#ps-orbits').click();
  await page.locator('[data-scale=exploration]').click();await settled();
  for(const id of moons){
   await page.bringToFront();await page.locator(`.ps-item[data-moon-id="${id}"]`).hover();check(id+' hover thumbnail or source note',await page.locator('.ps-hover').isVisible()||((await page.locator(`.ps-item[data-moon-id="${id}"]`).getAttribute('title'))||'').length>0);
   await page.locator(`.ps-item[data-moon-id="${id}"]`).click();await settled();s=await local();
   check(id+' selected, focused and followed',s.selected===id&&s.focus===id&&s.follow);check(id+' breadcrumb shows moon',(await page.locator('.ps-crumbs').textContent()).includes(sm.objects.find(o=>o.id===id).name));
   check(id+' camera outside every body',s.minClearance>0);check(id+' panel has five science cards',(await page.locator('.ps-card').count())>=5);
   await shot(`moon-${id}`,`${sm.objects.find(o=>o.id===id).zh} · 局部系统聚焦`);
   if(key.has(id)){await page.locator('[data-scale=closeup]').click();await settled();await page.waitForFunction(id=>{const m=window.solarisQA.localSystem().moons.find(m=>m.id===id);return m.loadedWidth>=2048||m.loadedWidth===0;},id,{timeout:20000});await page.waitForTimeout(800);s=await verifyTruth(id+' closeup');check(id+' closeup uses linear truth scale',s.scale==='closeup');await shot(`moon-${id}-closeup`,`${sm.objects.find(o=>o.id===id).zh} · 近景（科学线性比例）`);await page.locator('[data-scale=exploration]').click();await settled();}
  }
  // Follow under real playback: the target stays on the moving moon; switching follow off freezes it.
  const followId=moons.at(-1),offsetOf=x=>{const m=x.moons.find(m=>m.id===followId);return {target:x.target.map((v,i)=>v-m.displayPosition[i]),camera:x.camera.map((v,i)=>v-m.displayPosition[i]),moved:m.displayPosition};};
  const l0=await local(),f0=offsetOf(l0);await page.locator('#rate').selectOption('3600');await page.locator('#play').click();await page.waitForFunction(t=>window.solarisQA.localSystem().tdb>t+1800,l0.tdb,{timeout:10000});s=await local();const f1=offsetOf(s);
  // Follow = the camera and target keep a constant offset from the moving moon (the moon itself must have moved).
  check(planet+' follow keeps a constant camera/target offset from the moving moon',Math.hypot(...f1.moved.map((v,i)=>v-f0.moved[i]))>1e-6&&Math.hypot(...f1.target.map((v,i)=>v-f0.target[i]))<1e-6*Math.max(1,Math.hypot(...f1.moved))&&Math.hypot(...f1.camera.map((v,i)=>v-f0.camera[i]))<1e-3*Math.max(1,Math.hypot(...f1.camera)),{f0,f1});
  await page.locator('#ps-follow').click();await nextFrame();const frozen=(await local()).target;await page.waitForTimeout(500);const after=await local();check(planet+' follow off freezes camera target (≤1e-12 relative; only float round-off)',Math.hypot(...after.target.map((v,i)=>v-frozen[i]))<=1e-12*Math.max(1,Math.hypot(...frozen)),{frozen,now:after.target,follow:after.follow,focus:after.focus,transitioning:after.transitioning,last:after.transitions.slice(-2)});await page.locator('#ps-follow').click();
  await page.locator('#play').click();await synced();const p1=await local(),m1=await main();check(planet+' pause: every moon on the global TDB',p1.tdb===m1.tdb&&!m1.playing);await page.waitForTimeout(400);check(planet+' paused state stays fixed',(await local()).tdb===p1.tdb);
  await page.locator('#reset').click();await page.waitForTimeout(300);
  perf.push({planet,...await sample(planet==='699'?240:180),render:(await local()).render,gpuMemory:(await local()).gpuMemory,loading:(await local()).loading,resources:(await local()).resources});
  await page.locator('#ps-planet').click();await settled();check(planet+' return to planet',(await local()).focus==='planet');
 }
 // Cross-system search, main-catalog moon search, breadcrumbs, keyboard, real drag, date jump.
 await page.locator('#ps-search').fill('Triton');await page.locator('.ps-item[data-moon-id="801"]').click();await settled();check('Local search jumps across systems',(await local()).planet==='899'&&(await local()).selected==='801');await page.locator('#ps-search').fill('');
 const before=await local(),box=await page.locator('.ps-canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.62,box.y+box.height*.56,{steps:14});await page.mouse.up();await page.waitForTimeout(400);const after=await local();
 check('Real mouse drag orbits the camera',Math.hypot(...after.camera.map((v,i)=>v-before.camera[i]))>1e-4);check('Drag leaves moon truth unchanged',JSON.stringify(after.moons.map(m=>m.truthKm))===JSON.stringify(before.moons.map(m=>m.truthKm)));
 for(const date of ['2024-01-01T00:00','2027-03-15T06:30','2031-01-01T00:00']){await page.locator('#date').fill(date);await page.locator('#jump').click();await synced();await verifyTruth('jump '+date);check('Jump '+date+' shared TDB',(await local()).tdb===(await main()).tdb);}
 await page.locator('#reset').click();await page.waitForTimeout(300);
 await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Escape');await settled();check('Esc returns from moon to planet',(await local()).focus==='planet');await page.keyboard.press('Escape');await page.waitForTimeout(900);check('Esc again leaves the local system',!(await local()).open);
 await page.locator('#search').fill('europa');await page.locator('.moon-result[data-moon-id="502"]').click();await settled();check('Main catalog search reaches moons',(await local()).planet==='599'&&(await local()).selected==='502');
 await page.locator('.ps-crumbs button',{hasText:'木星'}).click();await settled();check('Planet breadcrumb returns to system',(await local()).focus==='planet'&&!(await local()).selected);
 await page.locator('.ps-crumbs button',{hasText:'太阳系'}).click();await page.waitForTimeout(1600);const back=await main();check('Solar-system breadcrumb returns to overview',!(await local()).open&&back.scene.focus===null);
 check('Main-scene physical states untouched by local exploration',JSON.stringify(back.states)===JSON.stringify(original.states));await page.locator('#search').fill('');
 // Regression: 3A data layer and 3B bench still work and close each other cleanly.
 await page.locator('#sat-data').click();await page.waitForFunction(()=>window.solarisQA.satellites()?.diagnostic?.visible);check('3A data layer retained',(await page.evaluate(()=>window.solarisQA.satellites().states.length))===18);await page.locator('#sat-close').click();
 await page.locator('#moon-bench-button').click();await page.waitForFunction(()=>{const s=window.solarisQA.moonAsset();return s&&!s.loading&&s.visible;},{},{timeout:30000});check('3B asset bench retained',!(await page.evaluate(()=>window.solarisQA.moonAsset().error)));await page.keyboard.press('Escape');
 // Soak: repeated system switches must not grow GPU objects without bound.
 let soak=null;if(full){const counts=[];const t0=Date.now();for(let round=0;round<3;round++)for(const [planet] of systems){if((await local())?.open){await page.locator('#ps-exit').click();await page.waitForTimeout(700);}await page.locator(`.catalog-item[data-id="${planet}"]`).click();await page.locator('#enter-system').click();await settled();const s=await local();counts.push({round,planet,geometries:s.gpuMemory.geometries,textures:s.gpuMemory.textures,models:s.resources.models});}
  const heap=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);soak={elapsedSeconds:(Date.now()-t0)/1000,switches:counts.length,counts,heapAfter:heap};const last=counts.filter(c=>c.round===2),first=counts.filter(c=>c.round===1);check('Soak: GPU objects stable across rounds',last.every((c,i)=>c.geometries<=first[i].geometries+2&&c.textures<=first[i].textures+2),{first,last});check('Soak: moon model cache bounded',counts.every(c=>c.models<=7));
  await page.locator('#ps-exit').click();await page.waitForTimeout(900);}
 // Desktop resolutions: no page overflow, the 3D stage keeps ≥ 55% of the viewport width.
 const layouts=[];for(const [w,h] of [[1920,1080],[3840,2160],[2560,1440]]){await page.setViewportSize({width:w,height:h});await page.locator('.catalog-item[data-id="599"]').click();await page.locator('#enter-system').click();await settled();const l=await page.evaluate(()=>({scrollW:document.documentElement.scrollWidth,clientW:document.documentElement.clientWidth,stage:document.querySelector('.ps-stage').getBoundingClientRect().width,panel:document.querySelector('.ps-panel').getBoundingClientRect().width}));layouts.push({w,h,...l});check(`Layout ${w}×${h} no overflow and stage dominant`,l.scrollW<=l.clientW&&l.stage/w>.55,l);if(w!==2560)await shot(`layout-${w}`,`${w}×${h} 局部系统布局`);await page.locator('#ps-exit').click();await page.waitForTimeout(900);}
 const tr=(await local()).transitions,measurable=tr.filter(t=>t.maxFrameMs<50&&!t.cancelled),throttled=tr.length-measurable.length;
 // A transition run while Windows throttled the window (frame gaps ≥ 50 ms) cannot show smoothness; it is reported, never counted as a pass.
 check('No transition cancelled except by deliberate user input',tr.filter(t=>t.cancelled&&t.cancelled!=='user').length===0);check('Camera never inside a body in any transition',tr.every(t=>t.minClearance>0),tr.filter(t=>t.minClearance<=0));
 check('Measurable transitions animated (≥ 20 frames) with no flip (< 12°/frame)',measurable.length>=tr.length*.7&&measurable.every(t=>t.frames>=20&&t.maxStepDegrees<12),{count:tr.length,throttled,bad:measurable.filter(t=>!(t.frames>=20&&t.maxStepDegrees<12))});
 check('Steady-state pacing (rAF P95 < 25 ms) in every system without hidden samples',perf.every(p=>p.rafP95Ms<25&&p.hiddenSamples===0),perf.map(p=>[p.planet,p.rafP95Ms,p.hiddenSamples]));
 check('No console or runtime errors',errors.length===0,errors);
 await fs.writeFile(`${docs}/${channel}-report.json`,JSON.stringify({browser:await browser.version(),foreground:fg,viewport:{width:2560,height:1440},checks,errors,shots,performance:perf,transitions:tr,throttledTransitions:tr.filter(t=>t.maxFrameMs>=50).length,cancelledTransitions:tr.filter(t=>t.cancelled).length,activationFailures,soak,layouts},null,2));console.log(channel,'ALL PASS',checks.length,'checks',shots.length,'screenshots');
}catch(e){await fs.writeFile(`${docs}/${channel}-failure.json`,JSON.stringify({message:String(e),errors,local:await local().catch(()=>null)},null,2));throw e;}finally{await browser.close();}
