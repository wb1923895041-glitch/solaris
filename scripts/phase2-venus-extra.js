async(page)=>{
await page.evaluate(()=>window.solarisQA.observe('standard'));await page.waitForTimeout(1300);
await page.locator('#visual-controls summary').click();await page.locator('[data-visual-option=radar]').check();await page.waitForTimeout(600);
await page.screenshot({path:'output/playwright/phase-2/final/venus_radar.png'});
await page.locator('[data-visual-option=radar]').uncheck();await page.waitForTimeout(300);await page.screenshot({path:'output/playwright/phase-2/final/venus_visible.png'});
return {radarToggle:true,physicsStates:await page.evaluate(()=>window.solarisQA.snapshot().states)};
}
