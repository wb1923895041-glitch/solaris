async (page) => {
 await page.waitForFunction(()=>window.solarisQA);
 await page.setViewportSize({width:2560,height:1440});
 await page.getByRole('button',{name:'重置演示日期',exact:true}).click();
 await page.getByRole('button',{name:'返回总览',exact:true}).click();
 await page.getByRole('combobox',{name:'播放倍率',exact:true}).selectOption('86400');
 const start=Date.now();await page.getByRole('button',{name:'播放',exact:true}).click();
 await page.waitForTimeout(12000);
 await page.getByRole('textbox',{name:'跳转日期 UTC',exact:true}).fill('2030-01-01T00:00');await page.getByRole('button',{name:'跳转 UTC',exact:true}).click();
 await page.waitForTimeout(5000);
 await page.getByRole('button',{name:'选择地球',exact:true}).click();await page.keyboard.press('f');
 await page.waitForTimeout(8000);await page.keyboard.press('Escape');
 await page.waitForTimeout(8000);await page.getByRole('button',{name:'暂停',exact:true}).click();
 const snapshot=await page.evaluate(()=>window.solarisQA.snapshot());
 await page.screenshot({path:'output/playwright/phase-1/chrome-04-playing-2030-2560x1440.png'});
 return{elapsedWallSeconds:(Date.now()-start)/1000,utcMs:snapshot.utcMs,playing:snapshot.playing,focused:snapshot.scene.focus,frameSamples:snapshot.frameTimes.length};
}
