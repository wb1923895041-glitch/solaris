import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const reports=[];
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:false,args:['--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion']});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:4175');await page.waitForFunction(()=>window.solarisQA?.snapshot().scene.sky==='ready');await page.waitForTimeout(1400);
  for(const [width,height] of (channel==='chrome'?[[1920,1080],[2560,1440],[3840,2160]]:[[2560,1440]])){
   await page.setViewportSize({width,height});await page.waitForTimeout(500);await page.screenshot({path:`output/playwright/overview-b/${channel}-final-overview-${width}.png`});
  }
  await page.setViewportSize({width:2560,height:1440});await page.locator('#inner').click();await page.waitForTimeout(1400);
  if(await page.locator('#inner').getAttribute('aria-pressed')!=='true')throw Error('depth state');
  await page.screenshot({path:`output/playwright/overview-b/${channel}-final-depth.png`});
  await page.locator('#home').click();await page.waitForTimeout(1400);
  if(await page.locator('#overview').getAttribute('aria-pressed')!=='true')throw Error('overview state');
  await page.getByRole('button',{name:'选择太阳',exact:true}).click();await page.locator('#focus').click();
  await page.waitForFunction(()=>window.solarisQA.snapshot().scene.visuals.find(v=>v.id==='10').actualAlbedoWidth===4096);await page.waitForTimeout(1400);
  await page.screenshot({path:`output/playwright/overview-b/${channel}-final-sun.png`});
  const snapshot=await page.evaluate(()=>window.solarisQA.snapshot());
  if(errors.length)throw Error(errors.join('; '));reports.push({channel,browser:await browser.version(),errors,snapshot,passed:['final overview captures','depth navigation selected','home navigation selected','sun 4096 texture','no console or runtime errors']});
 }finally{await browser.close();}
}
await fs.writeFile('docs/overview-b/final-smoke.json',JSON.stringify(reports,null,2));console.log('Final B build Chrome / Edge smoke PASS');
