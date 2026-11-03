import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve('output/playwright/overview-b/验收预览.html')).href);
 await page.evaluate(()=>{for(const el of document.querySelectorAll('details'))el.open=true;for(const im of document.images)im.loading='eager'});
 await page.waitForFunction(()=>[...document.images].every(im=>im.complete&&im.naturalWidth>0));
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 const result=await page.evaluate(()=>({images:document.images.length,allImagesDecoded:[...document.images].every(im=>im.naturalWidth>0),videoDuration:document.querySelector('video').duration,overflow:document.documentElement.scrollWidth>innerWidth}));
 if(errors.length||result.overflow||result.videoDuration<30)throw Error(JSON.stringify({result,errors}));
 await page.evaluate(()=>{for(const el of document.querySelectorAll('details'))el.open=false});
 await page.screenshot({path:'output/playwright/overview-b/gallery-preview.png'});
 await fs.writeFile('docs/overview-b/gallery-smoke.json',JSON.stringify({...result,errors},null,2));
 console.log('Gallery reopened; images and video metadata PASS:',result);
}finally{await browser.close();}
