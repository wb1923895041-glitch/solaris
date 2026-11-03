import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const channel=process.argv[2]??'chrome',out='output/playwright/phase-2';
await fs.mkdir(out+'/regression',{recursive:true});await fs.mkdir(out+'/video-work',{recursive:true});
const browser=await chromium.launch({channel,headless:false});
const context=await browser.newContext({viewport:{width:2560,height:1440},deviceScaleFactor:1});const page=await context.newPage();
const errors=[],responses=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)responses.push({status:r.status(),url:r.url()});});
try{
await page.goto('http://127.0.0.1:4173/');await page.waitForFunction(()=>window.solarisQA);
const oldQA=await fs.readFile('scripts/browser-phase1-qa.js','utf8');const regression=await (0,eval)('('+oldQA.replaceAll('output/playwright/phase-1/','output/playwright/phase-2/regression/').replaceAll('chrome-',channel+'-')+')')(page);
await fs.writeFile(`docs/phase-2/${channel}-science-ui-regression.json`,JSON.stringify(regression,null,2));console.log(channel,'phase-1 UI/science regression',regression.checks.length,'checks');
const rows=JSON.parse(await fs.readFile('data/phase-2/baseline-cameras.json','utf8'));const performance=[];const snapshots=[];
for(const b of rows){
 if(channel==='chrome'){
  if(b.id==='10'){const action=await fs.readFile('scripts/phase2-sun-qa.js','utf8');await (0,eval)('('+action+')')(page);}
  else{const action=await fs.readFile('scripts/phase2-qa-'+b.id+'.js','utf8');const result=await (0,eval)('('+action+')')(page);await fs.writeFile(`${out}/${b.id}-release.json`,JSON.stringify(result,null,2));}
 }else{await page.getByRole('button',{name:'选择'+b.name,exact:true}).click();await page.locator('#focus').click();await page.waitForTimeout(1400);await page.waitForFunction(id=>window.solarisQA.snapshot().scene.visuals.find(v=>v.id===id)?.loadedWidth===4096,b.id);}
 await page.evaluate(v=>window.solarisQA.observe(v),b.id==='699'?'ring-front':'standard');await page.waitForTimeout(1250);
 if(b.id!=='699'){await page.evaluate(()=>window.solarisQA.observe('detail'));await page.waitForTimeout(1250);}
 await page.evaluate(()=>window.solarisQA.profile());await page.waitForTimeout(4200);
 const snap=await page.evaluate(()=>window.solarisQA.snapshot());const metrics=await page.evaluate(()=>window.solarisQA.performance());const f=snap.frameTimes.slice(-200).sort((a,b)=>a-b);const mean=f.reduce((a,b)=>a+b,0)/f.length;
 performance.push({id:b.id,viewport:[2560,1440],frameSamples:f.length,frameP50Ms:f[Math.floor(f.length*.5)],frameP95Ms:f[Math.floor(f.length*.95)],renderLoopFps:1000/mean,...metrics});snapshots.push(snap);
 if(snap.scene.visuals.find(v=>v.id===b.id).actualAlbedoWidth!==4096)throw Error('Incorrect actual texture LOD '+b.id);
 await page.screenshot({path:`${out}/final/${channel}-${b.id}-preview.png`});console.log(channel,b.id,'measured',metrics.render.gpuRenderer,metrics.render.gpuRender);
}
const memory=[];for(let cycle=0;cycle<3;cycle++){for(const b of rows){await page.getByRole('button',{name:'选择'+b.name,exact:true}).click();await page.waitForTimeout(180);}await page.waitForTimeout(1400);memory.push(await page.evaluate(()=>window.solarisQA.performance()));}
if(memory[2].loading.cachedRequests!==memory[0].loading.cachedRequests||memory[2].render.gpuMemoryObjectCounts.textures!==memory[0].render.gpuMemoryObjectCounts.textures)throw Error('Texture allocation keeps growing after warmup');
await fs.writeFile(`docs/phase-2/${channel}-performance.json`,JSON.stringify({browser:await browser.version(),headless:false,performance,memory,errors,resourceFailures:responses},null,2));await fs.writeFile(`data/phase-2/${channel}-release-snapshots.json`,JSON.stringify(snapshots,null,2));
if(errors.length||responses.length)throw Error(JSON.stringify({errors,responses}));
console.log(channel,'release QA PASS; nine bodies, stable cache, no errors');
}finally{await context.close();await browser.close();}
