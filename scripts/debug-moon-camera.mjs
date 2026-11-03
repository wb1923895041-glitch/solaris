import {chromium} from 'playwright';
const b=await chromium.launch({channel:'chrome',headless:false}),p=await b.newPage({viewport:{width:2560,height:1440}});
try{
 await p.goto('http://127.0.0.1:4175');await p.waitForFunction(()=>window.solarisQA?.snapshot().scene.sky==='ready');await p.locator('#moon-bench-button').click();await p.waitForFunction(()=>window.solarisQA.moonAsset()?.loading===false);
 for(const id of ['301','602','605','602']){
  await p.locator('#moon-asset').selectOption(id);await p.waitForTimeout(1500);await p.locator('[data-moon-view=standard]').click();
  for(const ms of [0,100,1000]){await p.waitForTimeout(ms);console.log(id,ms,await p.evaluate(()=>{const s=window.solarisQA.moonAsset();return {radius:s.modelRadius,distance:Math.hypot(...s.camera),sunLength:Math.hypot(...s.sunDirection),camera:s.camera,view:s.view}}));}
 }
}finally{await b.close()}
