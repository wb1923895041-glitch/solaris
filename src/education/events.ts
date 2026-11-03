/** Phase 5 computed events. Pure geometry on the project's own Horizons-backed states (geometric, no light-time):
 * eclipses from shadow cones, Moon phase from the phase angle, oppositions and close approaches from distances.
 * Nothing here is hard-coded; validation against the NASA Five Millennium Canon lives in scripts/verify-events.mjs. */
export type V3=readonly [number,number,number];
const sub=(a:V3,b:V3):[number,number,number]=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=(a:V3)=>Math.hypot(a[0],a[1],a[2]),scale=(a:V3,k:number):[number,number,number]=>[a[0]*k,a[1]*k,a[2]*k];
/** Radii (km): Sun IAU 2015 nominal; Earth equatorial (WGS-84 / IERS); Moon mean (JPL). Earth's umbra/penumbra are
 * enlarged by 1/85 for the atmosphere (Danjon), the convention used by the NASA Five Millennium Canon. */
export const RADII={sun:695700,earth:6378.137,moon:1737.4},ATMOSPHERE=1+1/85;
export interface GeoInputs{sun:(tdb:number)=>V3;moon:(tdb:number)=>V3} // both relative to Earth's centre, km
export type EclipseKind='solar-partial'|'solar-annular'|'solar-total'|'solar-hybrid'|'lunar-penumbral'|'lunar-partial'|'lunar-total';
export interface Eclipse{kind:EclipseKind;tdb:number;gamma:number;magnitude:number;distanceKm:number}
/** Lunar: distance of the Moon's centre from the anti-solar shadow axis vs umbra/penumbra radii at the Moon. */
export function lunarGeometry(g:GeoInputs,t:number){
 const S=g.sun(t),M=g.moon(t),ds=norm(S),axis=scale(S,-1/ds),d=dot(M,axis),rho=norm(sub(M,scale(axis,d)));
 const umbra=(RADII.earth-d*(RADII.sun-RADII.earth)/ds)*ATMOSPHERE,pen=(RADII.earth+d*(RADII.sun+RADII.earth)/ds)*ATMOSPHERE;
 return {rho,umbra,pen,behind:d>0,gamma:rho/RADII.earth,umbralMag:(umbra+RADII.moon-rho)/(2*RADII.moon),penumbralMag:(pen+RADII.moon-rho)/(2*RADII.moon)};
}
/** Solar: distance of Earth's centre from the Sun→Moon shadow axis vs the Moon's umbra/penumbra at Earth. */
export function solarGeometry(g:GeoInputs,t:number){
 const S=g.sun(t),M=g.moon(t),SM=sub(M,S),dsm=norm(SM),u=scale(SM,1/dsm),L=dot(scale(M,-1),u),rho=norm(sub(scale(M,-1),scale(u,L)));
 const umbra=RADII.moon-L*(RADII.sun-RADII.moon)/dsm,pen=RADII.moon+L*(RADII.sun+RADII.moon)/dsm;
 return {rho,umbra,pen,front:L>0,gamma:rho/RADII.earth};
}
function minimize(f:(t:number)=>number,a:number,b:number){let lo=a,hi=b;for(let k=0;k<80;k++){const m1=lo+(hi-lo)/3,m2=hi-(hi-lo)/3;if(f(m1)<f(m2))hi=m2;else lo=m1;}return (lo+hi)/2;}
/** Scan new/full moons (elongation extrema) and classify by the shadow geometry at the closest approach to the axis. */
export function findEclipses(g:GeoInputs,start:number,end:number,stepSeconds=3*3600):Eclipse[]{
 const out:Eclipse[]=[];const elong=(t:number)=>{const S=g.sun(t),M=g.moon(t);return dot(S,M)/(norm(S)*norm(M));};
 let prev=elong(start),t=start+stepSeconds,prevT=start;
 const pushLunar=(t0:number)=>{const tm=minimize(x=>lunarGeometry(g,x).rho,t0-2*86400,t0+2*86400),l=lunarGeometry(g,tm);if(!l.behind||l.penumbralMag<=0)return;
  out.push({kind:l.umbralMag>=1?'lunar-total':l.umbralMag>0?'lunar-partial':'lunar-penumbral',tdb:tm,gamma:l.gamma,magnitude:l.umbralMag>0?l.umbralMag:l.penumbralMag,distanceKm:l.rho});};
 const pushSolar=(t0:number)=>{const tm=minimize(x=>solarGeometry(g,x).rho,t0-2*86400,t0+2*86400),s=solarGeometry(g,tm);if(!s.front||s.rho>=s.pen+RADII.earth)return;
  let kind:EclipseKind='solar-partial';
  if(s.rho<RADII.earth){
   // Central: compare the umbral radius at the sub-axis surface point (nearer than Earth's centre by the axis–sphere intersection depth).
   const depth=Math.sqrt(RADII.earth**2-s.rho**2),uSurface=s.umbra+depth*(RADII.sun-RADII.moon)/norm(sub(g.moon(tm),g.sun(tm)));
   kind=s.umbra>0?'solar-total':uSurface>0?'solar-hybrid':'solar-annular';
  }
  out.push({kind,tdb:tm,gamma:s.gamma,magnitude:(s.pen-s.rho+RADII.earth)/(s.pen-s.umbra),distanceKm:s.rho});};
 for(;t<=end;t+=stepSeconds){const e=elong(t);
  // Full moon: elongation cosine reaches its minimum (≈ −1); new moon: maximum (≈ +1).
  if(e>prev&&prev<-.9&&elong(prevT-stepSeconds)>prev)pushLunar(prevT);
  if(e<prev&&prev>.9&&elong(prevT-stepSeconds)<prev)pushSolar(prevT);
  prev=e;prevT=t;}
 const seen=new Set<string>();return out.filter(x=>{const k=x.kind.split('-')[0]+Math.round(x.tdb/86400);if(seen.has(k))return false;seen.add(k);return x.tdb>=start&&x.tdb<=end;}).sort((a,b)=>a.tdb-b.tdb);
}
/** Moon phase from the Sun–Moon–Earth phase angle: illuminated fraction and waxing/waning from the elongation trend. */
export function moonPhase(g:GeoInputs,t:number){
 const S=g.sun(t),M=g.moon(t),toSun=sub(S,M),toEarth=scale(M,-1),cos=dot(toSun,toEarth)/(norm(toSun)*norm(toEarth)),phaseAngle=Math.acos(Math.max(-1,Math.min(1,cos)));
 const next=g.moon(t+3600),S2=g.sun(t+3600),e1=dot(S,M)/(norm(S)*norm(M)),e2=dot(S2,next)/(norm(S2)*norm(next));
 return {illuminatedFraction:(1+Math.cos(phaseAngle))/2,phaseAngleDeg:phaseAngle*180/Math.PI,waxing:e2<e1};
}
/** Local extrema of a distance-like function on a coarse scan refined by ternary search (oppositions, close approaches). */
export function extrema(f:(t:number)=>number,start:number,end:number,step:number,kind:'min'|'max'){
 const sign=kind==='min'?1:-1,res:{tdb:number;value:number}[]=[];let a=f(start),b=f(start+step);
 for(let t=start+2*step;t<=end;t+=step){const c=f(t);if(sign*(b-a)<0&&sign*(c-b)>0){const tm=minimize(x=>sign*f(x),t-2*step,t);res.push({tdb:tm,value:f(tm)});}a=b;b=c;}
 return res;
}
