async(page)=>{
const initial=await page.evaluate(()=>window.solarisQA.snapshot());const records=[];
await page.evaluate(()=>window.solarisQA.observe('standard'));await page.waitForTimeout(1300);
await page.locator('#visual-controls summary').click();await page.locator('[data-visual-option=clouds]').uncheck();await page.waitForTimeout(250);await page.screenshot({path:'output/playwright/phase-2/final/earth_surface_only.png'});
await page.locator('[data-visual-option=clouds]').check();await page.locator('[data-visual-option=atmosphere]').uncheck();await page.waitForTimeout(250);await page.screenshot({path:'output/playwright/phase-2/final/earth_no_atmosphere.png'});await page.locator('[data-visual-option=atmosphere]').check();
await page.evaluate(()=>window.solarisQA.observe('backlight'));await page.waitForTimeout(1300);await page.screenshot({path:'output/playwright/phase-2/final/earth_night_on.png'});await page.locator('[data-visual-option=night]').uncheck();await page.waitForTimeout(250);await page.screenshot({path:'output/playwright/phase-2/final/earth_night_off.png'});await page.locator('[data-visual-option=night]').check();
for(const value of ['2026-03-20T12:00','2026-06-21T12:00']){await page.locator('#date').fill(value);await page.locator('#jump').click();await page.waitForTimeout(250);await page.evaluate(()=>window.solarisQA.observe('terminator'));await page.waitForTimeout(1300);records.push(await page.evaluate(()=>window.solarisQA.snapshot()));await page.screenshot({path:'output/playwright/phase-2/final/earth_'+value.slice(0,10)+'.png'});}
await page.locator('#date').fill('2026-10-29T00:00');await page.locator('#jump').click();await page.waitForTimeout(250);
return {bodyId:'399',cloudLayerSwitch:true,nightSwitch:true,dates:records,initialStates:initial.states,restoredStates:await page.evaluate(()=>window.solarisQA.snapshot().states)};
}
