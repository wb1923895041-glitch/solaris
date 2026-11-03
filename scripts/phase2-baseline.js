async (page) => {
 await page.waitForFunction(()=>window.solarisQA);
 await page.setViewportSize({width:2560,height:1440});
 await page.getByRole('button',{name:'重置演示日期',exact:true}).click();
 const results=[];
 for(const [id,name] of [['10','太阳'],['199','水星'],['299','金星'],['399','地球'],['499','火星'],['599','木星'],['699','土星'],['799','天王星'],['899','海王星']]){
  await page.getByRole('button',{name:`选择${name}`,exact:true}).click();
  await page.getByRole('button',{name:'聚焦选中天体',exact:true}).click();await page.waitForTimeout(1350);
  const snapshot=await page.evaluate(()=>window.solarisQA.snapshot());
  await page.screenshot({path:`output/playwright/phase-2/baseline/${id}-standard.png`});
  const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,-240);await page.waitForTimeout(350);
  const detail=await page.evaluate(()=>window.solarisQA.snapshot());
  await page.screenshot({path:`output/playwright/phase-2/baseline/${id}-detail.png`});
  const frames=snapshot.frameTimes.slice(-200).sort((a,b)=>a-b),mean=frames.reduce((a,b)=>a+b,0)/frames.length;
  results.push({id,name,utcMs:snapshot.utcMs,standardCamera:snapshot.scene.camera,standardTarget:snapshot.scene.target,detailCamera:detail.scene.camera,detailTarget:detail.scene.target,states:snapshot.states,performance:{meanFrameMs:mean,fps:1000/mean,p50Ms:frames[100],p95Ms:frames[190]}});
 }
 return results;
}
