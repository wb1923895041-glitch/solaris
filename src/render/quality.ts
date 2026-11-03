/** Phase 7 quality tiers. Only the WebGL drawing-buffer pixel ratio changes; geometry, textures already chosen by LOD,
 * ephemerides and camera are untouched. Auto mode steps down when the 90th-percentile frame time stays above 22 ms
 * and back up when it stays below 12 ms; every change is logged for the performance report. */
export type QualityTier='high'|'standard'|'eco';
export const tierRatio:Record<QualityTier,number>={high:1.5,standard:1,eco:.75};
const order:QualityTier[]=['eco','standard','high'];
export class QualityController{
 mode:'auto'|QualityTier='auto';tier:QualityTier='high';readonly changes:{atMs:number;from:QualityTier;to:QualityTier;reason:string;p90Ms?:number}[]=[];private samples:number[]=[];
 constructor(readonly apply:(pixelRatio:number)=>void){}
 ratio(){return Math.min(devicePixelRatio,tierRatio[this.tier]);}
 setMode(mode:'auto'|QualityTier){this.mode=mode;this.samples=[];if(mode!=='auto')this.setTier(mode,'manual');}
 private setTier(tier:QualityTier,reason:string,p90Ms?:number){if(tier===this.tier)return;this.changes.push({atMs:performance.now(),from:this.tier,to:tier,reason,p90Ms});this.tier=tier;this.samples=[];this.apply(this.ratio());}
 sample(frameMs:number){
  if(this.mode!=='auto'||document.visibilityState!=='visible'||!Number.isFinite(frameMs)||frameMs>250)return;
  this.samples.push(frameMs);if(this.samples.length>600)this.samples.shift();if(this.samples.length<180)return;
  const s=[...this.samples].sort((a,b)=>a-b),p90=s[Math.floor(s.length*.9)],i=order.indexOf(this.tier);
  if(p90>22&&i>0)this.setTier(order[i-1],'auto: P90 frame time above 22 ms',p90);
  else if(p90<12&&this.samples.length>=600&&i<order.length-1)this.setTier(order[i+1],'auto: P90 frame time below 12 ms',p90);
 }
 snapshot(){return {mode:this.mode,tier:this.tier,pixelRatio:this.ratio(),changes:this.changes.slice()};}
}
