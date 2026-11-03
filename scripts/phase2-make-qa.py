import json,sys
from pathlib import Path
r=Path(__file__).resolve().parent.parent
id=sys.argv[1];b=next(x for x in json.loads((r/'data/phase-2/baseline-cameras.json').read_text()) if x['id']==id)
code='async (page)=>{const base='+json.dumps(b)+''';
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.reload();await page.waitForFunction(()=>window.solarisQA);await page.setViewportSize({width:2560,height:1440});
await page.getByRole('button',{name:'选择'+base.name,exact:true}).click();await page.locator('#focus').click();await page.waitForTimeout(1450);
await page.waitForFunction(id=>window.solarisQA.snapshot().scene.visuals.find(v=>v.id===id)?.loadedWidth===4096,base.id);
await page.evaluate(b=>window.solarisQA.restoreCamera(b.standardCamera,b.standardTarget),base);await page.waitForTimeout(350);
const start=await page.evaluate(()=>window.solarisQA.snapshot());if(JSON.stringify(start.states)!==JSON.stringify(base.states))throw Error('Frozen physical states changed');
await page.screenshot({path:'output/playwright/phase-2/final/'+base.id+'-standard.png'});
await page.evaluate(b=>window.solarisQA.restoreCamera(b.detailCamera,b.detailTarget),base);await page.waitForTimeout(300);
await page.screenshot({path:'output/playwright/phase-2/final/'+base.id+'-detail.png'});
for(const view of ['standard','detail','terminator','backlight']){await page.evaluate(v=>window.solarisQA.observe(v),view);await page.waitForTimeout(1300);await page.screenshot({path:'output/playwright/phase-2/final/'+base.id+'-'+view+'-material.png'});}
const end=await page.evaluate(()=>window.solarisQA.snapshot()),f=end.frameTimes.slice(-250).sort((a,b)=>a-b),mean=f.reduce((a,b)=>a+b,0)/f.length;
if(errors.length||end.scene.visuals.some(v=>v.error))throw Error(JSON.stringify(errors));
return {bodyId:base.id,utcMs:end.utcMs,physicsUnchanged:true,matchedCamera:start.scene.camera,baselineCamera:base.standardCamera,visual:end.scene.visuals.find(v=>v.id===base.id),performance:{meanMs:mean,p50:f[Math.floor(f.length*.5)],p95:f[Math.floor(f.length*.95)],headlessRafFps:1000/mean},gpuMemory:end.scene.gpuMemory,errors};}
'''
(r/f'scripts/phase2-qa-{id}.js').write_text(code,encoding='utf-8')
