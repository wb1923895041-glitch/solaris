import {chromium} from 'playwright';import fs from 'node:fs/promises';
const m=JSON.parse(await fs.readFile('data/phase-3a/manifest.json','utf8')),v=JSON.parse(await fs.readFile('data/phase-3a/validation.json','utf8')),checks=[],cases=[];
const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);console.log('PASS',name)};
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion']});
try{
 const p=await browser.newPage({viewport:{width:2560,height:1440}});await p.goto('http://127.0.0.1:4175');await p.waitForFunction(()=>window.solarisQA?.snapshot().scene.sky==='ready');const baseline=JSON.stringify((await p.evaluate(()=>window.solarisQA.snapshot())).states);
 await p.route('**/satellites/401.f64',async route=>{const response=await route.fetch(),body=Buffer.from(await response.body());body[12]^=1;await route.fulfill({response,body});});
 await p.locator('#sat-data').click();await p.waitForFunction(()=>document.querySelector('#runtime-status').textContent.includes('哈希不符'));
 check('Corrupt satellite cache is rejected explicitly',await p.locator('#satellite-diagnostics').isHidden());
 check('Corrupt optional layer preserves nine-body science and controls',JSON.stringify((await p.evaluate(()=>window.solarisQA.snapshot())).states)===baseline&&await p.locator('#play').isEnabled()&&await p.locator('#sat-data').isEnabled());
 await p.unroute('**/satellites/401.f64');await p.locator('#sat-data').click();await p.waitForFunction(()=>window.solarisQA.satellites()?.diagnostic?.markers.length===4);check('Retry recovers from data error',true);
 for(let i=0;i<v.fixedUtc.length;i++){
  await p.locator('#date').fill(v.fixedUtc[i].slice(0,16));await p.locator('#jump').click();await p.waitForTimeout(200);const states=(await p.evaluate(()=>window.solarisQA.satellites())).states;
  for(const o of m.objects){const state=states.find(x=>x.source.id===o.id),fixture=v.objects.find(x=>x.id===o.id),reference=fixture.rows.reduce((a,b)=>Math.abs(a[0]-v.fixedTdb[i])<Math.abs(b[0]-v.fixedTdb[i])?a:b),positionErrorKm=Math.hypot(...state.positionKm.map((x,j)=>x-reference[j+1])),velocityErrorKmPerSec=Math.hypot(...state.velocityKmPerSec.map((x,j)=>x-reference[j+4]));check(`${o.name} browser / JPL ${v.fixedUtc[i]}`,positionErrorKm<o.characteristicRadiusKm*1e-4&&velocityErrorKmPerSec<.001);cases.push({id:o.id,utc:v.fixedUtc[i],runtimeTdb:state.timeTdb,jplPrintedTdb:reference[0],positionErrorKm,velocityErrorKmPerSec});}
 }
 await fs.writeFile('docs/phase-3a/browser-science.json',JSON.stringify({browser:await browser.version(),checks,cases,failureInjection:'One response byte flipped in the browser route only; no source file modified'},null,2));
}finally{await browser.close();}
