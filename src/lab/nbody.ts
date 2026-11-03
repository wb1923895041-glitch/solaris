/** Phase 6 physics laboratory core. Completely separate from the ephemeris store: it only ever receives *copies* of
 * initial conditions. Newtonian gravity, fixed step with sub-steps, velocity-Verlet or leapfrog (drift–kick–drift),
 * energy and angular-momentum monitoring, close-encounter detection that pauses instead of smoothing over divergence. */
export type Vec=[number,number,number];
export interface Body{name:string;gm:number;radius:number;r:Vec;v:Vec;color?:string}
export type Integrator='velocity-verlet'|'leapfrog-dkd';
export interface LabState{bodies:Body[];t:number;integrator:Integrator;dt:number;substeps:number;units:'km-s'|'normalized';softening:number}
export interface Diagnostics{t:number;energy:number;angularMomentum:Vec;relEnergyDrift:number;relAngularMomentumDrift:number;minSeparation:number;warning:string|null}
const add=(a:Vec,b:Vec,k=1):Vec=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k],sub=(a:Vec,b:Vec):Vec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],norm=(a:Vec)=>Math.hypot(a[0],a[1],a[2]),cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function clone(s:LabState):LabState{return {...s,bodies:s.bodies.map(b=>({...b,r:[...b.r] as Vec,v:[...b.v] as Vec}))};}
export function accelerations(bodies:Body[],soft=0):Vec[]{
 const a=bodies.map(()=>[0,0,0] as Vec);
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const d=sub(bodies[j].r,bodies[i].r),r2=d[0]**2+d[1]**2+d[2]**2+soft*soft,inv=1/(r2*Math.sqrt(r2));a[i]=add(a[i],d,bodies[j].gm*inv);a[j]=add(a[j],d,-bodies[i].gm*inv);}
 return a;
}
export function energy(bodies:Body[],soft=0){
 // Specific-energy form scaled by GM (G cancels): E·G = Σ ½ GMᵢ vᵢ² − Σ GMᵢ GMⱼ / rᵢⱼ.
 let e=0;for(const b of bodies)e+=.5*b.gm*(b.v[0]**2+b.v[1]**2+b.v[2]**2);
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const d=norm(sub(bodies[j].r,bodies[i].r));e-=bodies[i].gm*bodies[j].gm/Math.sqrt(d*d+soft*soft);}
 return e;
}
export function angularMomentum(bodies:Body[]):Vec{let L:Vec=[0,0,0];for(const b of bodies)L=add(L,cross(b.r,b.v),b.gm);return L;}
/** Massless test particles carry no weight in E or L; track their own specific energy ½v² − Σ GMⱼ/rᵢⱼ and specific r×v. */
export function testInvariants(bodies:Body[],soft=0){
 // Only meaningful around a single massive body (pure two-body); with several massive bodies a test particle's energy
 // is exchanged physically (only the Jacobi constant is conserved in the rotating frame), so it is not an error measure.
 if(bodies.filter(b=>b.gm>0).length!==1)return [];
 return bodies.filter(b=>b.gm===0).map(t=>{let e=.5*(t.v[0]**2+t.v[1]**2+t.v[2]**2);for(const m of bodies)if(m.gm>0){const d=norm(sub(m.r,t.r));e-=m.gm/Math.sqrt(d*d+soft*soft);}return {e,h:norm(cross(t.r,t.v))};});}
/** One fixed step of size dt (both schemes are second order and symplectic). */
export function step(bodies:Body[],dt:number,scheme:Integrator,soft=0){
 if(scheme==='velocity-verlet'){const a0=accelerations(bodies,soft);for(let i=0;i<bodies.length;i++)bodies[i].r=add(add(bodies[i].r,bodies[i].v,dt),a0[i],.5*dt*dt);const a1=accelerations(bodies,soft);for(let i=0;i<bodies.length;i++)bodies[i].v=add(bodies[i].v,add(a0[i],a1[i]),.5*dt);}
 else{for(const b of bodies)b.r=add(b.r,b.v,.5*dt);const a=accelerations(bodies,soft);for(let i=0;i<bodies.length;i++)bodies[i].v=add(bodies[i].v,a[i],dt);for(const b of bodies)b.r=add(b.r,b.v,.5*dt);}
}
export class Lab{
 state:LabState;readonly initial:LabState;private e0:number;private l0:number;private t0:{e:number;h:number}[];history:Diagnostics[]=[];paused=false;warning:string|null=null;
 constructor(s:LabState){this.initial=clone(s);this.state=clone(s);this.e0=energy(s.bodies,s.softening);this.l0=norm(angularMomentum(s.bodies));this.t0=testInvariants(s.bodies,s.softening);}
 reset(){this.state=clone(this.initial);this.history=[];this.paused=false;this.warning=null;}
 diagnostics():Diagnostics{const b=this.state.bodies,e=energy(b,this.state.softening),L=angularMomentum(b);let minSep=Infinity;for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++)minSep=Math.min(minSep,norm(sub(b[i].r,b[j].r))/(b[i].radius+b[j].radius));
  const tests=testInvariants(b,this.state.softening),te=tests.map((x,i)=>Math.abs((x.e-this.t0[i].e)/this.t0[i].e)),th=tests.map((x,i)=>this.t0[i].h?Math.abs(x.h-this.t0[i].h)/this.t0[i].h:0);
  // Worst of the massive-system invariant (when it is non-zero) and every test particle's own invariant.
  const eDrift=Math.max(this.e0?Math.abs((e-this.e0)/this.e0):0,...te,0),lDrift=Math.max(this.l0?Math.abs(norm(L)-this.l0)/this.l0:0,...th,0);
  return {t:this.state.t,energy:e,angularMomentum:L,relEnergyDrift:eDrift,relAngularMomentumDrift:lDrift,minSeparation:minSep,warning:this.warning};}
 /** Advance by n outer steps of dt, each split into `substeps`; stop and warn on contact or runaway energy error. */
 advance(n:number){
  if(this.paused)return this.diagnostics();const s=this.state,h=s.dt/s.substeps;
  for(let k=0;k<n;k++){for(let j=0;j<s.substeps;j++)step(s.bodies,h,s.integrator,s.softening);s.t+=s.dt;
   const d=this.diagnostics();
   if(!s.bodies.every(b=>b.r.every(Number.isFinite)&&b.v.every(Number.isFinite))){this.warning='数值溢出：状态出现非有限值，已暂停。请减小步长。';this.paused=true;}
   else if(d.minSeparation<1){this.warning='近距离接触：两天体半径之和内相遇（模型不含碰撞），已暂停。';this.paused=true;}
   else if(d.relEnergyDrift>1e-2){this.warning=`能量相对误差 ${(d.relEnergyDrift*100).toFixed(2)}% 超过 1%：数值可能发散，已暂停。请减小步长或增加子步。`;this.paused=true;}
   if(k%Math.max(1,Math.floor(n/20))===0||this.paused)this.history.push(this.diagnostics());if(this.history.length>4000)this.history.splice(0,this.history.length-4000);
   if(this.paused)break;}
  return this.diagnostics();
 }
}
/** Analytic two-body reference (relative orbit) by Kepler's equation, for convergence tests. */
export function keplerRelative(r0:Vec,v0:Vec,mu:number,t:number):Vec{
 const r=norm(r0),v2=v0[0]**2+v0[1]**2+v0[2]**2,a=1/(2/r-v2/mu),h=cross(r0,v0),evec=sub(cross(v0,h).map(x=>x/mu) as Vec,r0.map(x=>x/r) as Vec),e=norm(evec);
 const p=evec.map(x=>x/e) as Vec,q=cross(h,p).map(x=>x/norm(h)) as Vec;
 const cosE0=(1-r/a)/e,sinE0=(r0[0]*v0[0]+r0[1]*v0[1]+r0[2]*v0[2])/(e*Math.sqrt(mu*a)),E0=Math.atan2(sinE0,cosE0),M=E0-e*Math.sin(E0)+Math.sqrt(mu/a**3)*t;
 let E=M;for(let k=0;k<50;k++)E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
 const x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E);return [p[0]*x+q[0]*y,p[1]*x+q[1]*y,p[2]*x+q[2]*y];
}
