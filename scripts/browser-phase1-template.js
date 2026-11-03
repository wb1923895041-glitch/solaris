async (page) => {
 const golden=GOLDEN_PLACEHOLDER;
 const report={checks:[],dates:[],layouts:[],performance:[],environment:{}};
 const check=(name,ok)=>{if(!ok)throw new Error('FAIL '+name);report.checks.push(name);};
 const snap=()=>page.evaluate(()=>window.solarisQA.snapshot());
 await page.waitForFunction(()=>window.solarisQA);
 await page.setViewportSize({width:2560,height:1440});
 await page.reload();await page.waitForFunction(()=>window.solarisQA);
 report.environment=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{userAgent:navigator.userAgent,dpr:devicePixelRatio,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};});
 let s=await snap();check('nine body centers and deterministic paused default',s.scene.objects.length===9&&s.utcMs===Date.parse('2026-10-29T00:00:00Z')&&!s.playing);
 const before=JSON.stringify(s.states);await page.waitForTimeout(600);check('paused browser clock and state do not drift',JSON.stringify((await snap()).states)===before);
 await page.getByRole('searchbox',{name:'搜索天体'}).fill('Earth');check('search filters catalog',await page.locator('.catalog-item:visible').count()===1);
 await page.getByRole('button',{name:'选择地球',exact:true}).click();await page.getByRole('searchbox',{name:'搜索天体'}).fill('');
 for(const sample of golden){
  await page.getByRole('textbox',{name:'跳转日期 UTC',exact:true}).fill(sample.utc.slice(0,-1).replace(/:00$/,''));await page.getByRole('button',{name:'跳转 UTC',exact:true}).click();
  await page.waitForTimeout(150);s=await snap();check('UTC jump '+sample.utc,s.utcMs===Date.parse(sample.utc));
  const errors=s.states.map(state=>{const ref=sample.states.find(r=>r.id===state.id);return{id:state.id,positionKm:Math.hypot(...state.positionKm.map((v,i)=>v-ref.position[i])),velocityKmPerS:Math.hypot(...state.velocityKmPerSec.map((v,i)=>v-ref.velocity[i]))};});
  check('browser vs held-out Horizons '+sample.utc,errors.every(e=>e.positionKm<10&&e.velocityKmPerS<.001));report.dates.push({utc:sample.utc,errors});
  const same=JSON.stringify(s.states);await page.getByRole('button',{name:'跳转 UTC',exact:true}).click();await page.waitForTimeout(100);check('repeat jump '+sample.utc,JSON.stringify((await snap()).states)===same);
 }
 await page.getByRole('button',{name:'重置演示日期',exact:true}).click();await page.waitForTimeout(150);s=await snap();const original=JSON.stringify(s.states);
 await page.screenshot({path:'output/playwright/phase-1/chrome-01-overview-2560x1440.png'});
 await page.getByRole('button',{name:'科学比例',exact:true}).click();await page.waitForTimeout(1400);s=await snap();
 check('scientific switch preserves physical state',s.mode==='scientific'&&JSON.stringify(s.states)===original);
 const earth=s.scene.objects.find(o=>o.id==='399'),sun=s.states.find(o=>o.id==='10'),earthState=s.states.find(o=>o.id==='399');
 const physicalDistance=Math.hypot(...earthState.positionKm.map((x,i)=>x-sun.positionKm[i]));
 check('scientific size-distance mapping in actual scene',Math.abs(Math.hypot(...earth.position)/earth.radius-physicalDistance/6371.0084)<1e-7);
 await page.screenshot({path:'output/playwright/phase-1/chrome-03-scientific-2560x1440.png'});
 await page.getByRole('button',{name:'探索比例',exact:true}).click();await page.waitForTimeout(1400);check('exploration switch preserves physical state',(await snap()).mode==='exploration'&&JSON.stringify((await snap()).states)===original);
 await page.getByRole('button',{name:'聚焦选中天体',exact:true}).click();await page.waitForTimeout(1700);s=await snap();check('Earth focus',s.scene.focus==='399');
 await page.screenshot({path:'output/playwright/phase-1/chrome-02-earth-focus-2560x1440.png'});
 await page.getByRole('button',{name:'返回总览',exact:true}).click();await page.waitForTimeout(1400);check('overview restores camera',(await snap()).scene.focus===null);
 // Canvas drag and wheel must affect the navigation camera while preserving the science state.
 const canvas=page.locator('canvas'),box=await canvas.boundingBox();const cam=JSON.stringify((await snap()).scene.camera);
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.75);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.8,{steps:15});await page.mouse.up();await page.waitForTimeout(250);
 check('canvas drag rotates free camera',JSON.stringify((await snap()).scene.camera)!==cam);
 const cam2=JSON.stringify((await snap()).scene.camera);await page.mouse.wheel(0,250);await page.waitForTimeout(300);check('wheel zoom',JSON.stringify((await snap()).scene.camera)!==cam2);
 check('camera motion leaves physics unchanged',JSON.stringify((await snap()).states)===original);
 await page.getByRole('button',{name:'返回总览',exact:true}).click();await page.waitForTimeout(1300);
 await page.getByRole('button',{name:'数据来源与科学边界',exact:true}).click();check('source dialog shows provenance',await page.getByRole('dialog').isVisible());await page.getByRole('button',{name:'关闭来源面板',exact:true}).click();
 await page.getByRole('combobox',{name:'播放倍率',exact:true}).selectOption('0');await page.getByRole('button',{name:'播放',exact:true}).click();const zero=(await snap()).utcMs;await page.waitForTimeout(400);check('zero rate does not move',zero===(await snap()).utcMs);await page.getByRole('button',{name:'暂停',exact:true}).click();
 await page.getByRole('textbox',{name:'跳转日期 UTC',exact:true}).fill('2032-01-01T00:00');const valid=(await snap()).utcMs;await page.getByRole('button',{name:'跳转 UTC',exact:true}).click();check('out-of-range date rejected',(await snap()).utcMs===valid);
 await page.getByRole('button',{name:'重置演示日期',exact:true}).click();await page.getByRole('textbox',{name:'跳转日期 UTC',exact:true}).fill('2026-10-29T00:00');
 await page.getByRole('combobox',{name:'播放倍率',exact:true}).selectOption('86400');
 await page.getByRole('button',{name:'播放',exact:true}).click();const playing=(await snap()).utcMs;await page.waitForTimeout(1200);check('continuous playback advances UTC',(await snap()).utcMs>playing);
 await page.getByRole('button',{name:'暂停',exact:true}).click();const paused=(await snap()).utcMs;await page.waitForTimeout(300);check('pause stops UTC',(await snap()).utcMs===paused);
 await page.getByRole('button',{name:'重置演示日期',exact:true}).click();
 for(const [width,height] of [[1920,1080],[2560,1440],[3840,2160]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(900);
  const layout=await page.evaluate(()=>{const rect=e=>{const r=document.querySelector(e).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};const labels=[...document.querySelectorAll('.body-label:not([hidden])')].map(l=>{const r=l.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};});const overlap=labels.some((a,i)=>labels.slice(i+1).some(b=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y));return{width:innerWidth,height:innerHeight,noOverflow:document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight,footer:rect('footer'),canvas:rect('canvas'),details:rect('.details-panel'),labelsDoNotOverlap:!overlap};});
  check('desktop layout '+width,layout.noOverflow&&layout.canvas.right<=layout.details.x&&layout.canvas.bottom<=layout.footer.y&&layout.labelsDoNotOverlap);report.layouts.push(layout);
  await page.screenshot({path:`output/playwright/phase-1/chrome-overview-${width}x${height}.png`});
  await page.waitForTimeout(2400);s=await snap();const frames=s.frameTimes.slice(-250).sort((a,b)=>a-b),mean=frames.reduce((a,b)=>a+b,0)/frames.length;
  report.performance.push({width,height,samples:frames.length,meanFrameMs:mean,averageLoopFPS:1000/mean,p50Ms:frames[Math.floor(frames.length*.5)],p95Ms:frames[Math.floor(frames.length*.95)],method:'headless rAF render-loop intervals, last 250 frames; not display presentation or GPU timer'});
 }
 await page.setViewportSize({width:2560,height:1440});
 await page.reload();await page.waitForFunction(()=>window.solarisQA);check('refresh restores explicit default',(await snap()).utcMs===Date.parse('2026-10-29T00:00:00Z')&&!(await snap()).playing);
 return report;
}
