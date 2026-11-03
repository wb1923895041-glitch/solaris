async(page)=>{
// Pick a real UTC for the historical feature to be sunlit; do not rotate the texture independently.
for(let hour=0;hour<12;hour++){
await page.locator('#date').fill('2026-10-29T'+String(hour).padStart(2,'0')+':00');await page.locator('#jump').click();await page.waitForTimeout(100);
const good=await page.evaluate(()=>{const s=window.solarisQA.snapshot(),o=s.scene.objects.find(x=>x.id==='599'),q=o.quaternion,lat=-20*Math.PI/180,lon=-48*Math.PI/180,v=[Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon)],u=q.slice(0,3),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],a=cross(u,v),b=cross(u,a),n=v.map((x,i)=>x+2*q[3]*a[i]+2*b[i]),sun=o.position.map(x=>-x),d=Math.hypot(...sun);return n.reduce((a,x,i)=>a+x*sun[i]/d,0)>.6;});
if(good){await page.evaluate(()=>window.solarisQA.observe('feature'));await page.waitForTimeout(1300);await page.screenshot({path:'output/playwright/phase-2/final/jupiter_GRS.png'});const selected=await page.evaluate(()=>window.solarisQA.snapshot());await page.locator('#date').fill('2026-10-29T00:00');await page.locator('#jump').click();return {featureEpoch:selected.utcMs,historicalCloudMap:'2000-12-11/12',physicalState:selected.states};}}
throw Error('No sunlit GRS view found');
}
