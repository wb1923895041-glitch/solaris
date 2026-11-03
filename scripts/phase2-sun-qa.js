async (page) => {
 const base={"id": "10", "name": "\u592a\u9633", "utcMs": 1793232000000, "standardCamera": [31.818905726238977, 87.08332093496983, 103.83011342246401], "standardTarget": [0, 0, 0], "detailCamera": [28.1333787225207, 76.99661545110926, 91.80365688401481], "detailTarget": [0, 0, 0], "states": [{"id": "10", "positionKm": [-161123.7237936709, -700889.7584253926, -289028.72220659663], "velocityKmPerSec": [0.010325407378508877, 0.004434763951619257, 0.0016781825367836085]}, {"id": "199", "positionKm": [51488688.239742495, 5946233.09858955, -2090946.762860871], "velocityKmPerSec": [-14.449095106898858, 44.28126274579042, 25.15312190850162]}, {"id": "299", "positionKm": [84932320.21788178, 62167287.21236347, 22616679.716455463], "velocityKmPerSec": [-21.719457539194018, 24.49400758559299, 12.396146346926939]}, {"id": "399", "positionKm": [121269361.26619138, 77917422.39024983, 33789241.80688798], "velocityKmPerSec": [-17.636040634063793, 22.228938808250035, 9.63600180961912]}, {"id": "499", "positionKm": [-37338234.8959717, 212610135.07566607, 98554465.96457238], "velocityKmPerSec": [-23.003938465659278, -1.79102277117938, -0.20115718679925496]}, {"id": "599", "positionKm": [-546110458.9875596, 525850964.07272947, 238694920.8908576], "velocityKmPerSec": [-9.648659186595166, -7.7741254981578924, -3.0973214646959946]}, {"id": "699", "positionKm": [1379121455.3627825, 286585616.5385981, 58972136.91591096], "velocityKmPerSec": [-2.495047747412883, 8.683293942891533, 3.6943854308501587]}, {"id": "799", "positionKm": [1321056295.6482625, 2378644394.8835516, 1023096133.8946462], "velocityKmPerSec": [-6.116213992610299, 2.512674418432107, 1.1868511368121202]}, {"id": "899", "positionKm": [4462739361.121505, 243551227.86513066, -11419759.225402255], "velocityKmPerSec": [-0.30279732302008394, 5.051933635900218, 2.07577502701072]}], "performance": {"meanFrameMs": 3.6359999999999855, "fps": 275.02750275027614, "p50Ms": 3.6000000000058208, "p95Ms": 3.7000000000043656}};
 await page.reload();await page.waitForFunction(()=>window.solarisQA);
 await page.setViewportSize({width:2560,height:1440});
 await page.getByRole('button',{name:'选择太阳',exact:true}).click();await page.getByRole('button',{name:'聚焦选中天体',exact:true}).click();
 await page.waitForFunction(()=>window.solarisQA.snapshot().scene.visuals.find(v=>v.id==='10')?.loadedWidth===4096);
 await page.waitForTimeout(1400);
 await page.evaluate(b=>window.solarisQA.restoreCamera(b.standardCamera,b.standardTarget),base);await page.waitForTimeout(200);
 const s=await page.evaluate(()=>window.solarisQA.snapshot());
 if(JSON.stringify(s.states)!==JSON.stringify(base.states))throw new Error('Physics changed');
 if(s.scene.visuals.some(v=>v.error))throw new Error('Visual load failure');
 await page.screenshot({path:'output/playwright/phase-2/final/10-standard.png'});
 await page.evaluate(b=>window.solarisQA.restoreCamera(b.detailCamera,b.detailTarget),base);await page.waitForTimeout(150);
 await page.screenshot({path:'output/playwright/phase-2/final/10-detail.png'});
 await page.locator('#visual-controls summary').click();
 await page.getByLabel('显示增强 / 日冕',{exact:true}).uncheck();await page.waitForTimeout(150);
 await page.screenshot({path:'output/playwright/phase-2/final/sun-no-enhancement.png'});
 await page.getByLabel('显示增强 / 日冕',{exact:true}).check();
 await page.evaluate(()=>window.solarisQA.observe('limb'));await page.waitForTimeout(1300);
 await page.screenshot({path:'output/playwright/phase-2/final/sun_limb.png'});
 await page.evaluate(()=>window.solarisQA.observe('detail'));await page.waitForTimeout(1300);
 await page.screenshot({path:'output/playwright/phase-2/final/sun_surface.png'});
 const end=await page.evaluate(()=>window.solarisQA.snapshot()),frames=end.frameTimes.slice(-250).sort((a,b)=>a-b),mean=frames.reduce((a,b)=>a+b,0)/frames.length;
 return {bodyId:'10',utcMs:end.utcMs,physicsUnchanged:true,visuals:end.scene.visuals,performance:{meanMs:mean,fps:1000/mean,p50:frames[125],p95:frames[237]},camera:s.scene.camera,target:s.scene.target,baselineCamera:base.standardCamera};
}