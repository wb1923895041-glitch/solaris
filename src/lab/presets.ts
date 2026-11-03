import type {Body,LabState,Vec} from './nbody';
/** Lab presets. `fromEphemeris` copies states once (read-only snapshot); after that the lab owns its numbers and the
 * scene must say it is no longer the real solar system. Modified masses are flagged as hypothetical. */
export interface PresetContext{state:(id:string,tdb:number)=>{positionKm:readonly number[];velocityKmPerSec:readonly number[]};moon:(tdb:number)=>{positionKm:readonly number[];velocityKmPerSec:readonly number[]};gm:Record<string,number>;radius:Record<string,number>;tdb:number}
export interface Preset{id:string;title:string;kind:'ideal'|'ephemeris-copy'|'hypothetical';description:string;durationDays:number;make:(c:PresetContext)=>LabState;compareAnalytic?:boolean}
const AU=149597870.7,v=(a:readonly number[]):Vec=>[a[0],a[1],a[2]];
function fromEphemeris(c:PresetContext,ids:string[],names:Record<string,string>,colors:Record<string,string>,scaleGm:Record<string,number>={}):Body[]{
 return ids.map(id=>{const s=c.state(id,c.tdb);return {name:names[id],gm:c.gm[id]*(scaleGm[id]??1),radius:c.radius[id],r:v(s.positionKm),v:v(s.velocityKmPerSec),color:colors[id]};});
}
/** Remove the barycentric drift so the system stays in frame; this is a Galilean change of frame, not a physics change. */
function centre(bodies:Body[]){const M=bodies.reduce((s,b)=>s+b.gm,0),R=[0,0,0],V=[0,0,0];for(const b of bodies)for(let k=0;k<3;k++){R[k]+=b.gm*b.r[k]/M;V[k]+=b.gm*b.v[k]/M;}for(const b of bodies)for(let k=0;k<3;k++){b.r[k]-=R[k];b.v[k]-=V[k];}return bodies;}
export const presets:Preset[]=[
 {id:'kepler-ellipse',title:'二体 · 偏心率 0.5 椭圆（与解析解对照）',kind:'ideal',durationDays:365.25*2,compareAnalytic:true,description:'理想二体：GM☉ 与无质量试验体，近日点 1 au。数值解与开普勒方程解析解逐步对照，可观察步长减半时误差约降为 1/4（二阶方法）。',
  make:c=>{const mu=c.gm['10'],rp=AU,e=.5,a=rp/(1-e),vp=Math.sqrt(mu*(2/rp-1/a));return {bodies:[{name:'中心天体（GM☉）',gm:mu,radius:c.radius['10'],r:[0,0,0],v:[0,0,0],color:'#f3ad57'},{name:'试验体',gm:0,radius:1,r:[rp,0,0],v:[0,vp,0],color:'#9fc3dd'}],t:0,integrator:'velocity-verlet',dt:3600*12,substeps:4,units:'km-s',softening:0};}},
 {id:'sun-earth-moon',title:'太阳–地球–月球（初值复制自 JPL 星历）',kind:'ephemeris-copy',durationDays:365.25,description:'当前 TDB 的太阳、地球、月球状态的只读副本作为初值，仅三体牛顿引力，忽略其他行星与非球形引力；之后的轨迹是数值实验，不是真实星历。',
  make:c=>{const b=fromEphemeris(c,['10','399'],{'10':'太阳','399':'地球'},{'10':'#f3ad57','399':'#72b6e6'}),m=c.moon(c.tdb),e=b[1];b.push({name:'月球',gm:c.gm['301'],radius:c.radius['301'],r:[e.r[0]+m.positionKm[0],e.r[1]+m.positionKm[1],e.r[2]+m.positionKm[2]],v:[e.v[0]+m.velocityKmPerSec[0],e.v[1]+m.velocityKmPerSec[1],e.v[2]+m.velocityKmPerSec[2]],color:'#d9d4c7'});return {bodies:centre(b),t:0,integrator:'velocity-verlet',dt:3600,substeps:4,units:'km-s',softening:0};}},
 {id:'jupiter-trojan',title:'限制性三体 · 木星 L4 特洛伊点',kind:'ephemeris-copy',durationDays:365.25*60,description:'太阳与木星状态复制自星历；精确的 L4（木星前方 60°）是严格的拉格朗日等边解，试验体会一直停在 60°；这里把它放在 L4 前方 4°（位置与速度同转 64°），在随木星旋转的坐标中可见围绕 L4 的有界摆动（蝌蚪形轨道），而不是逃逸。',
  make:c=>{const b=fromEphemeris(c,['10','599'],{'10':'太阳','599':'木星'},{'10':'#f3ad57','599':'#d6b392'}),s=b[0],j=b[1],rel=[j.r[0]-s.r[0],j.r[1]-s.r[1],j.r[2]-s.r[2]],vel=[j.v[0]-s.v[0],j.v[1]-s.v[1],j.v[2]-s.v[2]];
   const n=[rel[1]*vel[2]-rel[2]*vel[1],rel[2]*vel[0]-rel[0]*vel[2],rel[0]*vel[1]-rel[1]*vel[0]],ln=Math.hypot(...n),k=n.map(x=>x/ln),rot=(x:number[],ang:number)=>{const c0=Math.cos(ang),s0=Math.sin(ang),d=k[0]*x[0]+k[1]*x[1]+k[2]*x[2],cx=[k[1]*x[2]-k[2]*x[1],k[2]*x[0]-k[0]*x[2],k[0]*x[1]-k[1]*x[0]];return x.map((xi,i)=>xi*c0+cx[i]*s0+k[i]*d*(1-c0));};
   const offset=Math.PI/3+4*Math.PI/180,r4=rot(rel,offset),v4=rot(vel,offset);b.push({name:'L4 附近试验体（+4°）',gm:0,radius:1,r:[s.r[0]+r4[0],s.r[1]+r4[1],s.r[2]+r4[2]],v:[s.v[0]+v4[0],s.v[1]+v4[1],s.v[2]+v4[2]],color:'#e7a96a'});return {bodies:centre(b),t:0,integrator:'leapfrog-dkd',dt:86400*2,substeps:2,units:'km-s',softening:0};}},
 {id:'figure-eight',title:'三体 · 8 字形周期解（Chenciner–Montgomery）',kind:'ideal',durationDays:6.3259*4,description:'无量纲单位（G = 1，三质量均为 1）的已知周期解；初值取 Chenciner & Montgomery (2000) / Simó 数值解。周期约 6.3259。用于观察长期误差积累与步长影响。',
  make:()=>({bodies:[{name:'A',gm:1,radius:.01,r:[.97000436,-.24308753,0],v:[.466203685,.43236573,0],color:'#9fc3dd'},{name:'B',gm:1,radius:.01,r:[-.97000436,.24308753,0],v:[.466203685,.43236573,0],color:'#e7a96a'},{name:'C',gm:1,radius:.01,r:[0,0,0],v:[-.93240737,-.86473146,0],color:'#c9d6a3'}],t:0,integrator:'leapfrog-dkd',dt:.001,substeps:1,units:'normalized',softening:0})},
 {id:'hypothetical-jupiter',title:'假设实验 · 木星质量 ×10 对内太阳系',kind:'hypothetical',durationDays:365.25*30,description:'太阳、水星至火星与木星的当前状态副本，木星 GM 人为乘以 10。这是假设实验：结果不代表真实太阳系，也不会写回星历。',
  make:c=>({bodies:centre(fromEphemeris(c,['10','199','299','399','499','599'],{'10':'太阳','199':'水星','299':'金星','399':'地球','499':'火星','599':'木星（×10 质量）'},{'10':'#f3ad57','199':'#b2aba2','299':'#dfbf80','399':'#72b6e6','499':'#cc795b','599':'#d6b392'},{'599':10})),t:0,integrator:'velocity-verlet',dt:86400/2,substeps:2,units:'km-s',softening:0})}
];
