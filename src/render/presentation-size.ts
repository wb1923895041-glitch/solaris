export interface PresentationBody {
 readonly id:string;
 readonly position:readonly number[];
 readonly radius:number;
 /** Encloses the surface, atmosphere/cloud shell and, when present, rings. */
 readonly extent:number;
 readonly visible:boolean;
}
export interface PresentationSize {
 readonly baseRadius:number;
 readonly radius:number;
 readonly extent:number;
 readonly factor:number;
}

/** Exploration-only display sizing. Never changes a centre, physical radius or state.
 * Pairwise reductions use the original envelopes and only decrease each factor;
 * consequently satisfying one pair cannot invalidate an earlier pair.
 */
export function presentationSizes(bodies:readonly PresentationBody[],exploration:boolean,protectedIds:ReadonlySet<string>=new Set(['10'])):Map<string,PresentationSize>{
 const factors=bodies.map(()=>1);
 if(exploration){
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const a=bodies[i],b=bodies[j];if(!a.visible||!b.visible)continue;
   const distance=Math.hypot(...a.position.map((v,k)=>v-b.position[k]));
   const ra=a.radius*a.extent,rb=b.radius*b.extent,pa=protectedIds.has(a.id),pb=protectedIds.has(b.id);
   // Leave a readable gap in the overview. Preserve the Sun and active Hero
   // whenever possible; their neighbours still have a strict non-contact margin.
   const budget=distance*(pa||pb ? .94 : .70);
   if(ra+rb<=budget)continue;
   if(pa&&!pb&&budget>ra){factors[j]=Math.min(factors[j],(budget-ra)/rb);}
   else if(pb&&!pa&&budget>rb){factors[i]=Math.min(factors[i],(budget-rb)/ra);}
   else{const q=budget/(ra+rb);factors[i]=Math.min(factors[i],q);factors[j]=Math.min(factors[j],q);}
  }
 }
 return new Map(bodies.map((b,i)=>[b.id,{baseRadius:b.radius,radius:b.radius*factors[i],extent:b.extent,factor:factors[i]}]));
}
