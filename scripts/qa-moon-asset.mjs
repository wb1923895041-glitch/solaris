import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import * as THREE from 'three';
const id=process.argv[2]||'301',channel=process.argv[3]||'chrome';
const dir='output/playwright/phase-3b';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel,headless:false,args:['--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion']});
const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1}),errors=[],checks=[],captures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const check=(name,pass)=>{console.log(channel,id,pass?'PASS':'FAIL',name);if(!pass)throw Error(name);checks.push(name);};
try{
 await page.goto('http://127.0.0.1:4175/');await page.waitForFunction(()=>window.solarisQA?.snapshot().scene.sky==='ready');await page.waitForTimeout(1300);
 const before=await page.evaluate(()=>window.solarisQA.snapshot());
 await page.locator('#moon-bench-button').click();await page.waitForFunction(()=>window.solarisQA.moonAsset()?.loading===false,{},{timeout:60000});
 if(id!=='301'){await page.locator('#moon-asset').selectOption(id);await page.waitForFunction(id=>{const s=window.solarisQA.moonAsset();return s?.id===id&&!s.loading},id,{timeout:60000});}
 let s=await page.evaluate(()=>window.solarisQA.moonAsset());check('Asset loaded with no fallback',!s.error&&s.source.naifId===id);check('Solar-only illumination and non-emissive material',s.fillIntensity===0&&s.materialEmissive===0);
 check('Same original TDB instant',s.tdb===before.tdb);
 check('Body orientation is a unit quaternion',Math.abs(Math.hypot(...s.bodyToIcrfQuaternion)-1)<1e-12);
 const bodyQ=new THREE.Quaternion(...s.bodyToIcrfQuaternion),displayQ=new THREE.Quaternion(...s.bodyToDisplayQuaternion),basis=displayQ.clone().multiply(bodyQ.clone().invert());
 const raw=await page.evaluate(()=>({sat:window.solarisQA.satellites(),main:window.solarisQA.snapshot()}));
 const sun=raw.main.states.find(b=>b.id==='10').positionKm,moon=raw.sat.absolute.find(b=>b.source.id===id)?.positionKm;
 check('Satellite absolute position available',!!moon);
 const ray=new THREE.Vector3(...sun.map((v,i)=>v-moon[i])).normalize().applyQuaternion(basis);
 check('Light points to Sun from the actual satellite centre',ray.distanceTo(new THREE.Vector3(...s.sunDirection))<1e-12);
 for(const view of ['standard','side','detail','parent']){
  await page.locator(`[data-moon-view="${view}"]`).click();await page.waitForTimeout(1300);s=await page.evaluate(()=>window.solarisQA.moonAsset());
  check(view+' camera rendered without error',s.view===view&&!s.error&&s.render.triangles>0);
  check(view+' camera framing matches asset envelope',Math.abs(Math.hypot(...s.camera)/s.modelRadius-(view==='detail'?2.9:5.1))<1e-5);
  const file=`${dir}/${channel}-${id}-${view}-2560.png`;await page.screenshot({path:file});captures.push({view,file,snapshot:s});
 }
 const stage=await page.locator('.moon-bench-canvas').boundingBox(),cam=s.camera;
 await page.mouse.move(stage.x+stage.width*.5,stage.y+stage.height*.5);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.62,stage.y+stage.height*.55,{steps:12});await page.mouse.up();await page.waitForTimeout(700);
 s=await page.evaluate(()=>window.solarisQA.moonAsset());check('Actual mouse drag rotates inspection camera',Math.hypot(...s.camera.map((v,i)=>v-cam[i]))>.1);
 check('Camera does not alter physical orientation',bodyQ.angleTo(new THREE.Quaternion(...s.bodyToIcrfQuaternion))<1e-7);
 await page.locator('#moon-fill').check();check('Optional fill is explicit and reversible',(await page.evaluate(()=>window.solarisQA.moonAsset())).fillIntensity===.12);await page.locator('#moon-fill').uncheck();
 await page.keyboard.press('Escape');const after=await page.evaluate(()=>window.solarisQA.snapshot());
 check('Close restores unchanged main scene and camera',JSON.stringify(before.states)===JSON.stringify(after.states)&&JSON.stringify(before.scene.camera)===JSON.stringify(after.scene.camera)&&before.selected===after.selected&&before.mode===after.mode);
 check('No browser console/runtime errors',errors.length===0);
 await fs.writeFile(`docs/phase-3b/${channel}-${id}-report.json`,JSON.stringify({browser:await browser.version(),viewport:{width:2560,height:1440},checks,errors,captures},null,2));console.log('ALL PASS',checks.length);
}finally{await browser.close();}
