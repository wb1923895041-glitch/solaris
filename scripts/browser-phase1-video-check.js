async (page) => {
 await page.goto('http://127.0.0.1:5173/output/playwright/phase-1/phase1-continuous-demo.webm');
 await page.waitForSelector('video');
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 const metadata=await page.evaluate(()=>{const v=document.querySelector('video');return{durationSeconds:v.duration,width:v.videoWidth,height:v.videoHeight};});
 await page.evaluate(()=>document.querySelector('video').play());await page.waitForTimeout(1800);
 const position=await page.evaluate(()=>document.querySelector('video').currentTime);
 if(metadata.durationSeconds<30||position<1)throw new Error('Recording not playable or too short');
 return{...metadata,decodedPlaybackSeconds:position,playable:true};
}
