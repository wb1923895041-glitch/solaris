async (page) => {
 await page.waitForFunction(()=>window.solarisQA);
 await page.getByRole('button',{name:'重置演示日期',exact:true}).click();
 await page.getByRole('button',{name:'返回总览',exact:true}).click();await page.waitForTimeout(1400);
 const snap=()=>page.evaluate(()=>window.solarisQA.snapshot());
 const box=await page.locator('canvas').boundingBox(),s=await snap();
 const norm=a=>{const r=Math.hypot(...a);return a.map(x=>x/r);};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
 const camera=s.scene.camera,target=s.scene.target,forward=norm(target.map((x,i)=>x-camera[i])),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),d=camera.map(x=>-x),z=dot(d,forward),f=box.height/(2*Math.tan(20*Math.PI/180));
 const x=box.x+box.width/2+dot(d,right)*f/z,y=box.y+box.height/2-dot(d,up)*f/z;
 await page.mouse.click(x,y);if((await snap()).selected!=='10')throw new Error('Canvas single click did not select Sun');
 await page.mouse.dblclick(x,y);await page.waitForTimeout(1300);if((await snap()).scene.focus!=='10')throw new Error('Canvas double click did not focus Sun');
 await page.keyboard.press('Escape');await page.waitForTimeout(1300);
 await page.getByRole('button',{name:'返回总览',exact:true}).focus();await page.keyboard.press('Space');await page.waitForTimeout(600);
 if(!(await snap()).playing)throw new Error('Space did not start playback');
 await page.keyboard.press('Space');if((await snap()).playing)throw new Error('Space did not pause');
 await page.getByRole('searchbox',{name:'搜索天体'}).fill('f');if((await snap()).scene.focus!==null)throw new Error('Input keyboard conflicts with shortcuts');
 await page.getByRole('searchbox',{name:'搜索天体'}).fill('');await page.getByRole('button',{name:'选择地球',exact:true}).click();
 const urls=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));
 if(urls.some(u=>!u.startsWith('http://127.0.0.1:4173/')))throw new Error('Runtime has nonlocal resource requests');
 return{canvasSingleClick:true,canvasDoubleClick:true,escape:true,spacePlayPause:true,inputShortcutIsolation:true,allRuntimeRequestsLocal:true,urls};
}
