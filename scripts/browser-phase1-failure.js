async (page) => {
 await page.route('**/data/399.f64',route=>route.fulfill({status:200,contentType:'application/octet-stream',body:Buffer.alloc(56)}));
 await page.reload();await page.waitForFunction(()=>document.querySelector('#runtime-status').textContent.includes('初始化失败'));
 const result=await page.evaluate(()=>({status:document.querySelector('#runtime-status').textContent,canvasCount:document.querySelectorAll('canvas').length,playDisabled:document.querySelector('#play').disabled,qa:typeof window.solarisQA}));
 if(result.canvasCount!==0||!result.playDisabled||result.qa!=='undefined'||!result.status.includes('完整性'))throw new Error(JSON.stringify(result));
 await page.unroute('**/data/399.f64');await page.reload();await page.waitForFunction(()=>window.solarisQA);
 return{corruptCacheRejected:result,recoveryAfterRestoringFile:true};
}
