async (page) => {
 await page.waitForFunction(()=>window.solarisQA);
 const report=[];
 for(const [width,height] of [[1920,1080],[2560,1440],[3840,2160]]){
  await page.setViewportSize({width,height});
  await page.getByRole('button',{name:'重置演示日期',exact:true}).click();
  await page.getByRole('button',{name:'返回总览',exact:true}).click();
  await page.getByRole('combobox',{name:'播放倍率',exact:true}).selectOption('86400');
  await page.waitForTimeout(1500);
  const before=await page.evaluate(()=>window.solarisQA.snapshot().utcMs);
  await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(3500);
  const snapshot=await page.evaluate(()=>window.solarisQA.snapshot());
  if(!snapshot.playing||snapshot.utcMs<=before)throw new Error('Performance scene was not playing');
  const frames=snapshot.frameTimes.slice(-250).sort((a,b)=>a-b),mean=frames.reduce((a,b)=>a+b,0)/frames.length;
  report.push({width,height,playing:true,rate:snapshot.rate,samples:frames.length,meanFrameMs:mean,averageLoopFPS:1000/mean,p50Ms:frames[125],p95Ms:frames[237],method:'continuous-playback headless rAF intervals, last 250 frames; not GPU or monitor presentation timing'});
  await page.getByRole('button',{name:'暂停',exact:true}).click();
 }
 await page.setViewportSize({width:2560,height:1440});
 return report;
}
