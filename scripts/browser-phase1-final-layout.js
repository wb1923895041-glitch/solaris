async (page) => {
 await page.reload();await page.waitForFunction(()=>window.solarisQA);
 const prefix=(await page.evaluate(()=>navigator.userAgent)).includes('Edg/')?'edge':'chrome';
 const results=[];
 for(const [width,height] of [[1920,1080],[2560,1440],[3840,2160]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(500);
  const layout=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect(),note=r('.catalog-note'),stage=document.querySelector('.stage-label'),stageBox=stage.getBoundingClientRect(),panel=r('.details-panel'),focus=r('#enter-body');return{width:innerWidth,height:innerHeight,noPageOverflow:document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight,noCatalogNoteOverlap:getComputedStyle(stage).display==='none'||note.bottom<=stageBox.top,focusButtonFullyVisible:focus.top>=panel.top&&focus.bottom<=panel.bottom};});
  if(!layout.noPageOverflow||!layout.noCatalogNoteOverlap||!layout.focusButtonFullyVisible)throw new Error(JSON.stringify(layout));
  results.push(layout);await page.screenshot({path:`output/playwright/phase-1/${prefix}-overview-${width}x${height}.png`});
 }
 await page.setViewportSize({width:2560,height:1440});
 await page.screenshot({path:`output/playwright/phase-1/${prefix}-01-overview-2560x1440.png`});
 await page.getByRole('button',{name:'聚焦选中天体',exact:true}).click();await page.waitForTimeout(1400);
 await page.screenshot({path:`output/playwright/phase-1/${prefix}-02-earth-focus-2560x1440.png`});
 await page.getByRole('button',{name:'返回总览',exact:true}).click();await page.getByRole('button',{name:'科学比例',exact:true}).click();await page.waitForTimeout(1400);
 await page.screenshot({path:`output/playwright/phase-1/${prefix}-03-scientific-2560x1440.png`});
 return{prefix,layouts:results,resourceUrls:await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name))};
}
