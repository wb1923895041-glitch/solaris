import {chromium} from 'playwright';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
// Phase 8 engineering audit: leak test across repeated view cycles (forced GC via CDP) and corrupted-data loading.
const docs='docs/phase-8';await fs.mkdir(docs,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-features=CalculateNativeWinOcclusion','--enable-precise-memory-info']});
const report={leak:null,corrupt:[]};const checks=[];const check=(n,p,d)=>{if(!p)throw Error(n+' '+JSON.stringify(d??''));checks.push(n);};
try{
 // ---- Leak test ----
 {const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4175');await page.waitForFunction(()=>window.solarisQA?.snapshot().scene.sky==='ready');await page.waitForFunction(()=>window.solarisQA.smallBodies()!==null,{},{timeout:60000});
  const title=`SOLARIS AUDIT ${process.pid}`;await page.evaluate(t=>{document.title=t},title);try{execFileSync('powershell.exe',['-NoProfile','-File','scripts/activate-solaris-browser.ps1','-WindowTitle',title],{windowsHide:true});}catch{}
  const cdp=await page.context().newCDPSession(page);const measure=async()=>{await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(300);return page.evaluate(()=>({heap:performance.memory.usedJSHeapSize,main:window.solarisQA.snapshot().scene.gpuMemory,local:window.solarisQA.localSystem()?.gpuMemory??null}));};
  const settled=()=>page.waitForFunction(()=>{const s=window.solarisQA.localSystem();return s?.open&&!s.transitioning&&s.moons.every(m=>m.loaded||m.error);},{},{timeout:60000});
  const cycle=async k=>{
   await page.locator('#sat-data').click();await page.waitForFunction(()=>window.solarisQA.satellites()?.diagnostic?.visible);await page.locator('#sat-close').click();
   await page.locator('#moon-bench-button').click();await page.waitForFunction(()=>{const s=window.solarisQA.moonAsset();return s&&!s.loading&&s.visible;},{},{timeout:30000});await page.locator('#moon-asset').selectOption(['502','606','401'][k%3]);await page.waitForFunction(()=>!window.solarisQA.moonAsset().loading,{},{timeout:30000});await page.keyboard.press('Escape');
   for(const p of ['599','699','999']){await page.locator(p==='999'?'#search':'#search').fill(p==='999'?'pluto':'');if(p==='999'){await page.locator('.small-result[data-small-body="999"]').click();await page.locator('[data-sb-action=enter]').click();}else{await page.locator(`.catalog-item[data-id="${p}"]`).click();await page.locator('#enter-system').click();}await settled();await page.locator('#ps-exit').click();await page.waitForTimeout(700);}
   await page.locator('#search').fill('');await page.locator('#workbench-button').click();await page.locator('[data-wb-tab=atlas]').click();await page.waitForSelector('.wb-card');await page.locator('[data-wb-tab=kepler]').click();await page.waitForSelector('.wb-orbit');await page.locator('#wb-close').click();
   await page.locator('#lab-button').click();await page.locator('#lab-play').click();await page.waitForTimeout(400);await page.locator('#lab-play').click();await page.locator('#lab-close').click();};
  const rows=[];for(let k=0;k<12;k++){await cycle(k);rows.push({cycle:k+1,...await measure()});console.log('cycle',k+1,(rows.at(-1).heap/1048576).toFixed(1),'MB',JSON.stringify(rows.at(-1).main),JSON.stringify(rows.at(-1).local));}
  const a=rows[3],b=rows.at(-1),growth=(b.heap-a.heap)/a.heap;report.leak={rows,heapGrowthCycle4to12:growth,errors};
  check('Leak: JS heap growth between cycle 4 and 12 < 10 % after forced GC',growth<.10,{growth});
  check('Leak: main-scene GPU objects stable',b.main.geometries<=a.main.geometries+3&&b.main.textures<=a.main.textures+3,{a:a.main,b:b.main});
  check('Leak: local-system GPU objects bounded',!b.local||(b.local.geometries<=a.local.geometries+6&&b.local.textures<=a.local.textures+6),{a:a.local,b:b.local});
  check('Leak run without runtime errors',errors.length===0,errors);await page.close();}
 // ---- Corrupted / missing data ----
 const cases=[
  {name:'主星历 599 字节损坏 → 拒绝初始化，不用替代轨道',route:'**/data/599.f64',expect:/初始化失败.*完整性|星历完整性/,action:async()=>{}},
  {name:'月球星历字节损坏 → 卫星层停用，行星照常',route:'**/satellites/301.f64',expect:/卫星|局部系统未启用/,action:async p=>{await p.locator('.catalog-item[data-id="399"]').click();await p.locator('#enter-system').click();await p.waitForTimeout(4000);},planetsAlive:true},
  {name:'小天体清单缺失 → 小天体图层停用',route:'**/smallbodies/manifest.json',status:404,expect:/小天体图层未启用/,action:async p=>{await p.waitForTimeout(4000);},planetsAlive:true},
  {name:'木卫二纹理字节损坏 → 仅该资产报错',route:'**/assets/moons/502/albedo-1024.jpg',expect:/哈希/,action:async p=>{await p.locator('#moon-bench-button').click();await p.waitForTimeout(3000);await p.locator('#moon-asset').selectOption('502');await p.waitForTimeout(3000);},probe:()=>window.solarisQA.moonAsset()?.error??'',planetsAlive:true}];
 for(const c of cases){const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(c.route,async route=>{if(c.status){await route.fulfill({status:c.status,body:'missing'});return;}const r=await route.fetch(),body=Buffer.from(await r.body());body[Math.floor(body.length/2)]^=0xff;await route.fulfill({response:r,body});});
  await page.goto('http://127.0.0.1:4175');await page.waitForTimeout(4000);await c.action(page).catch(()=>{});
  const status=await page.locator('#runtime-status').textContent(),probe=c.probe?await page.evaluate(c.probe):'',text=status+' '+probe;
  let alive=null;if(c.planetsAlive){const t1=await page.evaluate(()=>window.solarisQA?.snapshot().frameTimes.length??0);await page.waitForTimeout(800);alive=(await page.evaluate(()=>window.solarisQA?.snapshot().frameTimes.length??0))>t1;}
  report.corrupt.push({name:c.name,status,probe,alive,errors});check(c.name,c.expect.test(text)&&(alive===null||alive),{text,alive});console.log('PASS',c.name,'|',text.slice(0,90));await page.close();}
 await fs.writeFile(`${docs}/engineering-audit.json`,JSON.stringify({checks,...report},null,2));console.log('ALL PASS',checks.length,'audit checks');
}catch(e){await fs.writeFile(`${docs}/engineering-audit-failure.json`,JSON.stringify({message:String(e),...report},null,2));throw e;}finally{await browser.close();}
