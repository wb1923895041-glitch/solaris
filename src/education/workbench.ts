import {catalog} from '../science/catalog';
import type {EphemerisProvider} from '../science/ephemeris';
import type {TimeSystem} from '../science/time';
import type {SatelliteEphemeris} from '../satellites/ephemeris';
import type {SmallBodyEphemeris} from '../smallbodies/ephemeris';
import {moonPhase,extrema,type Eclipse,type GeoInputs} from './events';
import {moonIndex} from '../satellites/moon-knowledge';
import './workbench.css';

/** Phase 5 science workbench. Every value is computed from the project ephemerides at the global TDB or read from a
 * sourced JSON; demonstrations state their model limits. No event list is hard-coded. */
export interface Bookmark{name:string;utcMs:number;mode:string;selected:string;camera:number[];target:number[];createdUtc:string}
export interface WorkbenchContext{time:TimeSystem;provider:EphemerisProvider;nowUtcMs:()=>number;satellites:()=>Promise<SatelliteEphemeris>;small:()=>SmallBodyEphemeris|undefined;
 jump:(utcMs:number)=>void;selectPlanet:(id:string)=>void;enterSystem:(planet:string,moon?:string)=>void;selectSmall:(id:string)=>void;view:()=>Omit<Bookmark,'name'|'createdUtc'>;restore:(b:Bookmark)=>void;notify:(m:string)=>void;
 computeEclipses:(start:number,end:number)=>Promise<{eclipses:Eclipse[];ms:number;worker:boolean}>}
type Physical={planets:Record<string,{gm:number;gmSigma:number|null;meanRadiusKm:number;densityGcm3:number|null;source:string}>;nasaEclipses:{solar:any[];lunar:any[];source:string}};
const AU=149597870.7,DAY=86400,fmt=(v:number,d=0)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
const kindZh:Record<string,string>={'solar-total':'日全食','solar-annular':'日环食','solar-hybrid':'全环食','solar-partial':'日偏食','lunar-total':'月全食','lunar-partial':'月偏食','lunar-penumbral':'半影月食'};
export class Workbench{
 private tab='atlas';private eclipses:Eclipse[]|null=null;private eclipseMs=0;private eclipseWorker=false;private timeline:{tdb:number;title:string;detail:string;kind:string}[]|null=null;private physical:Physical|null=null;
 constructor(readonly host:HTMLElement,readonly ctx:WorkbenchContext){
  host.innerHTML=`<div class="wb-head"><div><p class="kicker">SCIENCE WORKBENCH · 5</p><h2>科学交互与科普讲解</h2></div><nav class="wb-tabs" role="tablist">${[['atlas','天体图鉴'],['eclipse','日月食与月相'],['kepler','开普勒定律'],['timeline','时间线'],['compare','双天体比较'],['bookmarks','镜头书签']].map(([k,v])=>`<button role="tab" data-wb-tab="${k}">${v}</button>`).join('')}</nav><button id="wb-close" aria-label="关闭科普工作台">×</button></div><div class="wb-body" aria-live="polite"></div><p class="wb-foot">所有数值来自本项目的 JPL 星历（同一 TDB 时刻）或附出处的 JSON；演示模型的局限在各页说明。</p>`;
  for(const b of host.querySelectorAll<HTMLButtonElement>('[data-wb-tab]'))b.onclick=()=>{this.tab=b.dataset.wbTab!;void this.render();};
 }
 private get body(){return this.host.querySelector<HTMLElement>('.wb-body')!;}
 async open(tab?:string){if(tab)this.tab=tab;if(!this.physical){const r=await fetch('/education/reference.json');if(!r.ok)throw Error('科普参考数据缺失');this.physical=await r.json();}await this.render();}
 private tdb(){return this.ctx.time.utcToTdb(this.ctx.nowUtcMs());}
 async render(){
  for(const b of this.host.querySelectorAll<HTMLButtonElement>('[data-wb-tab]'))b.setAttribute('aria-selected',String(b.dataset.wbTab===this.tab));
  const fn={atlas:()=>this.atlas(),eclipse:()=>this.eclipse(),kepler:()=>this.kepler(),timeline:()=>this.timelineTab(),compare:()=>this.compare(),bookmarks:()=>this.bookmarks()}[this.tab as 'atlas'];
  try{await fn();}catch(e){this.body.innerHTML=`<p class="wb-error">无法计算：${(e as Error).message}</p>`;}
 }
 // ---------------- atlas ----------------
 private async atlas(){
  const sats=await this.ctx.satellites(),small=this.ctx.small(),t=this.tdb(),phys=this.physical!.planets;
  type Card={id:string;zh:string;en:string;group:string;radius:number;line:string;go:()=>void;source:string};const cards:Card[]=[];
  for(const b of catalog){const p=phys[b.id];const s=b.id==='10'?null:this.ctx.provider.state(b.id,t),sun=this.ctx.provider.state('10',t),r=s?Math.hypot(...s.positionKm.map((v,i)=>v-sun.positionKm[i]))/AU:0;
   cards.push({id:b.id,zh:b.zh,en:b.en,group:b.id==='10'?'恒星':'行星',radius:b.radiusKm,line:b.id==='10'?`GM ${fmt(p?.gm??NaN)} km³/s²`:`日心距离 ${r.toFixed(4)} au · 公转 ${b.periodYears?.toFixed(4)} 年${p?` · 平均密度 ${p.densityGcm3??'—'} g/cm³`:''}`,go:()=>this.ctx.selectPlanet(b.id),source:p?.source??'JPL'});}
  for(const m of moonIndex){const meta=sats.meta(m.id),s=sats.relativeState(m.id,t);cards.push({id:m.id,zh:m.zh,en:m.en,group:'卫星',radius:meta.physical.radiusKm,line:`距${catalog.find(b=>b.id===m.parent)!.zh}中心 ${fmt(Math.hypot(...s.positionKm))} km · 周期 ${meta.sampledMeanPeriodDays.toFixed(3)} 天`,go:()=>this.ctx.enterSystem(m.parent,m.id),source:`JPL ${meta.solution}`});}
  if(small)for(const o of small.manifest.objects.filter(o=>o.centerId==='0')){const h=small.heliocentric(o.id,t),d=Number(o.physical?.diameter?.value);cards.push({id:o.id,zh:o.zh,en:o.name,group:o.kind==='dwarf-planet'?'矮行星':'小天体',radius:d/2,line:`日心距离 ${(Math.hypot(...h.positionKm)/AU).toFixed(4)} au${o.physical?.diameter?` · 直径 ${o.physical.diameter.value} km`:''}`,go:()=>this.ctx.selectSmall(o.id),source:`JPL Horizons ${o.solution} · SBDB`});}
  const groups=['全部','恒星','行星','卫星','矮行星','小天体'];
  this.body.innerHTML=`<div class="wb-atlas-tools"><input type="search" id="wb-atlas-q" placeholder="搜索名称 / 英文 / NAIF ID" aria-label="搜索图鉴"><div class="wb-chips">${groups.map(g=>`<button data-wb-group="${g}" aria-pressed="${g==='全部'}">${g}</button>`).join('')}</div></div><div class="wb-cards"></div>`;
  let group='全部';const draw=()=>{const q=(this.body.querySelector<HTMLInputElement>('#wb-atlas-q')!.value||'').trim().toLowerCase(),list=cards.filter(c=>(group==='全部'||c.group===group)&&`${c.id}${c.zh}${c.en.toLowerCase()}`.includes(q));
   const grid=this.body.querySelector('.wb-cards')!;grid.replaceChildren(...list.map(c=>{const el=document.createElement('article');el.className='wb-card';el.innerHTML=`<p class="kicker">${c.group} · ${c.id}</p><h3>${c.zh}<small>${c.en}</small></h3><p>平均半径 ${fmt(c.radius,1)} km</p><p>${c.line}</p><p class="wb-src">${c.source}</p><button>定位 ↗</button>`;el.querySelector('button')!.onclick=c.go;return el;}));};
  this.body.querySelector<HTMLInputElement>('#wb-atlas-q')!.oninput=draw;for(const b of this.body.querySelectorAll<HTMLButtonElement>('[data-wb-group]'))b.onclick=()=>{group=b.dataset.wbGroup!;for(const x of this.body.querySelectorAll('[data-wb-group]'))x.setAttribute('aria-pressed',String(x===b));draw();};draw();
 }
 // ---------------- eclipses & phase ----------------
 private async geo():Promise<GeoInputs>{const sats=await this.ctx.satellites(),p=this.ctx.provider;return {sun:t=>{const s=p.state('10',t).positionKm,e=p.state('399',t).positionKm;return [s[0]-e[0],s[1]-e[1],s[2]-e[2]];},moon:t=>sats.relativeState('301',t).positionKm};}
 private async ensureEclipses(){if(this.eclipses)return this.eclipses;const sats=await this.ctx.satellites(),r=await this.ctx.computeEclipses(sats.manifest.startTdb,sats.manifest.endTdb);this.eclipses=r.eclipses;this.eclipseMs=r.ms;this.eclipseWorker=r.worker;return this.eclipses;}
 private nasaFor(e:Eclipse){const list=e.kind.startsWith('solar')?this.physical!.nasaEclipses.solar:this.physical!.nasaEclipses.lunar;let best:any=null,dt=Infinity;for(const r of list){const [y,mo,d]=r.date.split('-').map(Number),[h,mi,s]=r.tdGreatest.split(':').map(Number),t=(Date.UTC(y,mo-1,d,h,mi,s)-Date.UTC(2000,0,1,12))/1000;if(Math.abs(t-e.tdb)<Math.abs(dt)){dt=e.tdb-t;best=r;}}return Math.abs(dt)<86400?{row:best,dt}:null;}
 private async eclipse(){
  this.body.innerHTML='<p class="wb-loading">正在由星历扫描 2024–2031 的朔望与影锥几何…</p>';
  const g=await this.geo(),t=this.tdb(),ph=moonPhase(g,t),list=await this.ensureEclipses(),utc=(tdb:number)=>this.ctx.time.format(tdbToUtcApprox(this.ctx.time,tdb));
  const lit=ph.illuminatedFraction,phaseSvg=`<svg viewBox="-60 -60 120 120" class="wb-moon" role="img" aria-label="当前月相示意"><circle r="50" fill="#1b2430"/><path d="${moonPath(lit,ph.waxing)}" fill="#d9d4c7"/><circle r="50" fill="none" stroke="#5d7488"/></svg>`;
  this.body.innerHTML=`<div class="wb-split"><section><h3>此刻的月相</h3>${phaseSvg}<dl class="wb-dl"><div><dt>照亮比例</dt><dd>${(lit*100).toFixed(2)} %</dd></div><div><dt>相位角（太阳–月球–地球）</dt><dd>${ph.phaseAngleDeg.toFixed(2)}°</dd></div><div><dt>趋势</dt><dd>${ph.waxing?'渐盈':'渐亏'}</dd></div></dl><p class="wb-note">由同一 TDB 时刻的太阳、地球与月球（地心 3A 星历）几何计算；未计光行时与地形，月相图为照亮比例示意。</p></section>
   <section><h3>2024–2031 日月食（由星历计算）</h3><p class="wb-note">方法：几何影锥（不计光行时/光行差），地影按 Danjon 1/85 放大；朔望扫描 + 三分法求最近点。计算 ${fmt(this.eclipseMs)} ms${this.eclipseWorker?'（Web Worker）':''}。与 NASA Five Millennium Canon 逐项核对（TD≈TDB）。</p>
   <table class="wb-table"><thead><tr><th>类型</th><th>食甚（UTC）</th><th>|γ|</th><th>NASA 核对</th><th></th></tr></thead><tbody>${list.map((e,i)=>{const n=this.nasaFor(e);return `<tr><td>${kindZh[e.kind]}</td><td>${utc(e.tdb).replace(/\.\d+Z$/,'')}</td><td>${e.gamma.toFixed(4)}</td><td>${n?`${n.row.type} · Δt ${n.dt.toFixed(0)} s`:'—'}</td><td><button data-wb-eclipse="${i}">跳转</button></td></tr>`;}).join('')}</tbody></table></section></div>`;
  for(const b of this.body.querySelectorAll<HTMLButtonElement>('[data-wb-eclipse]'))b.onclick=()=>{const e=list[Number(b.dataset.wbEclipse)];this.ctx.jump(tdbToUtcApprox(this.ctx.time,e.tdb));this.ctx.notify(`跳转到${kindZh[e.kind]}食甚 · 由星历影锥几何计算`);void this.render();};
 }
 // ---------------- Kepler ----------------
 private async kepler(){
  const p=this.ctx.provider,phys=this.physical!.planets,gmSun=phys['10'].gm,start=p.manifest.startTdb,end=p.manifest.endTdb;const id=(this.body.querySelector<HTMLSelectElement>('#wb-kepler-body')?.value)||'499';
  // Second law: equal areas — sweep 8 equal time slices of one orbit (or the data window) from real heliocentric states.
  const helio=(b:string,t:number)=>{const s=p.state(b,t),sun=p.state('10',t);return {r:s.positionKm.map((v,i)=>v-sun.positionKm[i]),v:s.velocityKmPerSec.map((v,i)=>v-sun.velocityKmPerSec[i])};};
  const body=catalog.find(b=>b.id===id)!,period=Math.min(body.periodYears!*365.25*DAY,end-start),n=8,slices:number[]=[],pts:number[][]=[];
  for(let k=0;k<n;k++){let area=0;const steps=200;for(let j=0;j<steps;j++){const a=helio(id,start+period*(k+j/steps)/n),b=helio(id,start+period*(k+(j+1)/steps)/n);const cx=a.r[1]*b.r[2]-a.r[2]*b.r[1],cy=a.r[2]*b.r[0]-a.r[0]*b.r[2],cz=a.r[0]*b.r[1]-a.r[1]*b.r[0];area+=Math.hypot(cx,cy,cz)/2;}slices.push(area);}
  for(let j=0;j<=240;j++)pts.push(helio(id,start+period*j/240).r);
  const mean=slices.reduce((a,b)=>a+b,0)/n,spread=(Math.max(...slices)-Math.min(...slices))/mean;
  // Third law: osculating a (vis-viva) at the current TDB vs sidereal period.
  const t=this.tdb(),rows=catalog.filter(b=>b.periodYears).map(b=>{const h=helio(b.id,t),r=Math.hypot(...h.r),v=Math.hypot(...h.v),a=1/(2/r-v*v/gmSun);return {b,a:a/AU,T:b.periodYears!,ratio:b.periodYears!**2/(a/AU)**3};});
  const max=Math.max(...pts.flat().map(Math.abs)),proj=(r:number[])=>[r[0]/max*140,-r[1]/max*140];
  const sector=(k:number)=>{const a=proj(helio(id,start+period*k/n).r),b=proj(helio(id,start+period*(k+1)/n).r);return `<path d="M0 0 L${a[0]} ${a[1]} L${b[0]} ${b[1]} Z" fill="${k%2?'#2a4a62':'#5f7f97'}" opacity=".55"/>`;};
  this.body.innerHTML=`<div class="wb-split"><section><h3>第二定律：相等时间扫过相等面积</h3><label>天体 <select id="wb-kepler-body">${catalog.filter(b=>b.periodYears&&b.periodYears<7).map(b=>`<option value="${b.id}" ${b.id===id?'selected':''}>${b.zh}</option>`).join('')}</select></label>
   <svg viewBox="-160 -160 320 320" class="wb-orbit" role="img" aria-label="真实日心轨道与等时扇区"><polyline fill="none" stroke="#9fb6c8" stroke-width="1" points="${pts.map(r=>proj(r).join(',')).join(' ')}"/>${Array.from({length:n},(_,k)=>sector(k)).join('')}<circle r="4" fill="#f3ad57"/></svg>
   <p class="wb-note">${body.zh}日心轨道（J2000 赤道坐标投影，JPL 星历）分为 ${n} 段等时间隔；扇区面积由相邻状态矢量叉积积分。面积相对极差 <b>${(spread*100).toFixed(4)} %</b>（来自其他行星的摄动与数值积分误差，非二体理想值）。</p></section>
   <section><h3>第三定律：T² ∝ a³</h3><table class="wb-table"><thead><tr><th>行星</th><th>a（au，瞬时）</th><th>T（年）</th><th>T²/a³</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.b.zh}</td><td>${r.a.toFixed(5)}</td><td>${r.T.toFixed(5)}</td><td>${r.ratio.toFixed(5)}</td></tr>`).join('')}</tbody></table>
   <p class="wb-note">a 由当前日心状态的活力公式（GM☉ ${fmt(gmSun)} km³/s²，${phys['10'].source}）计算的密切半长轴；T 为 JPL 恒星周期。偏离 1 来自行星质量（T² = 4π²a³/G(M☉+m)）与摄动导致的密切根数振荡，木星约千分之一。</p></section></div>`;
  this.body.querySelector<HTMLSelectElement>('#wb-kepler-body')!.onchange=()=>void this.kepler();
 }
 // ---------------- timeline ----------------
 private async timelineTab(){
  if(!this.timeline){this.body.innerHTML='<p class="wb-loading">正在由星历计算 2024–2031 的事件…</p>';const p=this.ctx.provider,start=p.manifest.startTdb,end=p.manifest.endTdb,ev:{tdb:number;title:string;detail:string;kind:string}[]=[];
   const dist=(a:string,b:string,t:number)=>{const x=p.state(a,t).positionKm,y=p.state(b,t).positionKm;return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);};
   for(const e of extrema(t=>dist('399','10',t),start,end,5*DAY,'min'))ev.push({tdb:e.tdb,title:'地球过近日点',detail:`日地距离 ${(e.value/AU).toFixed(6)} au`,kind:'orbit'});
   for(const e of extrema(t=>dist('399','10',t),start,end,5*DAY,'max'))ev.push({tdb:e.tdb,title:'地球过远日点',detail:`日地距离 ${(e.value/AU).toFixed(6)} au`,kind:'orbit'});
   // Opposition: the planet is closest to the Sun–Earth anti-solar direction (elongation 180°); frame-independent.
   for(const id of ['499','599','699']){const el=(t:number)=>{const s=p.state('10',t).positionKm,e=p.state('399',t).positionKm,q=p.state(id,t).positionKm,a=[s[0]-e[0],s[1]-e[1],s[2]-e[2]],b=[q[0]-e[0],q[1]-e[1],q[2]-e[2]];return (a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(Math.hypot(...a)*Math.hypot(...b));};
    for(const e of extrema(el,start,end,2*DAY,'min'))if(e.value<-.98)ev.push({tdb:e.tdb,title:`${catalog.find(b=>b.id===id)!.zh}冲日`,detail:`地心距 ${(dist(id,'399',e.tdb)/AU).toFixed(4)} au · 距角 ${(Math.acos(e.value)*180/Math.PI).toFixed(2)}°`,kind:'opposition'});}
   const small=this.ctx.small();if(small){const f=(t:number)=>{const a=small.absoluteState('2099942',t).positionKm,e=p.state('399',t).positionKm;return Math.hypot(a[0]-e[0],a[1]-e[1],a[2]-e[2]);};for(const e of extrema(f,start,end,3600*3,'min'))if(e.value<1e6)ev.push({tdb:e.tdb,title:'阿波菲斯（99942）掠过地球',detail:`距地心 ${fmt(e.value)} km（JPL Horizons 星历；距地表约 ${fmt(e.value-6378)} km）`,kind:'close-approach'});}
   for(const e of await this.ensureEclipses())ev.push({tdb:e.tdb,title:kindZh[e.kind],detail:`γ = ${e.gamma.toFixed(4)}`,kind:'eclipse'});
   this.timeline=ev.sort((a,b)=>a.tdb-b.tdb);}
  const now=this.tdb();this.body.innerHTML=`<p class="wb-note">全部事件由本项目星历在 2024–2031 数据窗内计算（几何、无光行时）；近/远日点与冲日由距离与距角极值求得。点击跳转全局时间。</p><ol class="wb-timeline">${this.timeline.map((e,i)=>`<li class="${e.kind}${Math.abs(e.tdb-now)<DAY?' now':''}"><time>${this.ctx.time.format(tdbToUtcApprox(this.ctx.time,e.tdb)).slice(0,16).replace('T',' ')} UTC</time><b>${e.title}</b><span>${e.detail}</span><button data-wb-event="${i}">跳转</button></li>`).join('')}</ol>`;
  for(const b of this.body.querySelectorAll<HTMLButtonElement>('[data-wb-event]'))b.onclick=()=>{const e=this.timeline![Number(b.dataset.wbEvent)];this.ctx.jump(tdbToUtcApprox(this.ctx.time,e.tdb));this.ctx.notify(`跳转到：${e.title}`);};
 }
 // ---------------- compare ----------------
 private async compare(){
  const sats=await this.ctx.satellites(),small=this.ctx.small(),t=this.tdb(),phys=this.physical!.planets;
  const options=[...catalog.map(b=>({id:b.id,zh:b.zh})),...moonIndex.map(m=>({id:m.id,zh:m.zh})),...(small?small.manifest.objects.filter(o=>o.centerId==='0').map(o=>({id:o.id,zh:o.zh})):[])];
  const a=(this.body.querySelector<HTMLSelectElement>('#wb-a')?.value)||'399',b=(this.body.querySelector<HTMLSelectElement>('#wb-b')?.value)||'499';
  const info=(id:string)=>{const pl=catalog.find(x=>x.id===id);if(pl){const p=phys[id],s=id==='10'?null:this.ctx.provider.state(id,t),sun=this.ctx.provider.state('10',t);return {zh:pl.zh,radius:pl.radiusKm,gm:p?.gm,density:p?.densityGcm3,dist:s?Math.hypot(...s.positionKm.map((v,i)=>v-sun.positionKm[i]))/AU:0,period:pl.periodYears?pl.periodYears*365.25:null,src:p?.source??'JPL'};}
   if(moonIndex.some(m=>m.id===id)){const m=sats.meta(id);return {zh:m.zh,radius:m.physical.radiusKm,gm:(m.physical as any).gmKm3PerSec2,density:null,dist:Math.hypot(...sats.relativeState(id,t).positionKm)/AU,period:m.sampledMeanPeriodDays,src:'JPL 卫星物理参数'};}
   const o=small!.meta(id);return {zh:o.zh,radius:Number(o.physical?.diameter?.value)/2,gm:Number(o.physical?.GM?.value),density:null,dist:Math.hypot(...small!.heliocentric(id,t).positionKm)/AU,period:null,src:'JPL SBDB'};};
  const A=info(a),B=info(b),maxR=Math.max(A.radius,B.radius),row=(k:string,x:string,y:string)=>`<tr><th>${k}</th><td>${x}</td><td>${y}</td></tr>`;
  this.body.innerHTML=`<div class="wb-compare"><label>天体 A <select id="wb-a">${options.map(o=>`<option value="${o.id}" ${o.id===a?'selected':''}>${o.zh}</option>`).join('')}</select></label><label>天体 B <select id="wb-b">${options.map(o=>`<option value="${o.id}" ${o.id===b?'selected':''}>${o.zh}</option>`).join('')}</select></label></div>
   <svg viewBox="0 0 640 220" class="wb-sizes" role="img" aria-label="同一比例的尺寸对比"><circle cx="160" cy="110" r="${Math.max(1.5,A.radius/maxR*100)}" fill="#8aa6bd"/><circle cx="480" cy="110" r="${Math.max(1.5,B.radius/maxR*100)}" fill="#c7a77d"/><text x="160" y="214" text-anchor="middle">${A.zh}</text><text x="480" y="214" text-anchor="middle">${B.zh}</text></svg>
   <table class="wb-table"><thead><tr><th></th><th>${A.zh}</th><th>${B.zh}</th></tr></thead><tbody>${row('平均半径',`${fmt(A.radius,1)} km`,`${fmt(B.radius,1)} km`)}${row('半径比',`${(A.radius/B.radius).toFixed(4)}`,'1')}${row('GM',A.gm?`${fmt(A.gm,3)} km³/s²`:'未登记',B.gm?`${fmt(B.gm,3)} km³/s²`:'未登记')}${row('平均密度',A.density?`${A.density} g/cm³`:'—',B.density?`${B.density} g/cm³`:'—')}${row('当前距离（日心 / 行星心）',`${A.dist.toFixed(5)} au`,`${B.dist.toFixed(5)} au`)}${row('公转周期',A.period?`${fmt(A.period,2)} 天`:'—',B.period?`${fmt(B.period,2)} 天`:'—')}${row('来源',A.src,B.src)}</tbody></table>
   <p class="wb-note">尺寸图两圆使用同一比例（最小绘制半径 1.5 像素）；距离为当前 TDB 的星历值：行星与小天体为日心距离，卫星为距母行星中心。</p>`;
  for(const id of ['#wb-a','#wb-b'])this.body.querySelector<HTMLSelectElement>(id)!.onchange=()=>void this.compare();
 }
 // ---------------- bookmarks ----------------
 private load():Bookmark[]{try{return JSON.parse(localStorage.getItem('solaris-bookmarks')??'[]');}catch{return [];}}
 private save(list:Bookmark[]){try{localStorage.setItem('solaris-bookmarks',JSON.stringify(list));}catch{this.ctx.notify('浏览器存储不可用：书签仅保留到页面关闭');}}
 private bookmarks(){
  const list=this.load();this.body.innerHTML=`<div class="wb-bm-new"><input id="wb-bm-name" placeholder="书签名称" maxlength="40" aria-label="书签名称"><button id="wb-bm-add">保存当前视图</button></div><p class="wb-note">书签保存日期、比例模式、选中天体与镜头；恢复时只改变时间与镜头，不改动任何星历。仅存于本浏览器。</p>
   <ul class="wb-bm">${list.map((b,i)=>`<li><b>${escapeHtml(b.name)}</b><span>${new Date(b.utcMs).toISOString().slice(0,16).replace('T',' ')} UTC · ${b.mode==='scientific'?'科学比例':'探索比例'} · ${catalog.find(c=>c.id===b.selected)?.zh??b.selected}</span><button data-wb-bm="${i}">恢复</button><button data-wb-del="${i}" aria-label="删除书签">×</button></li>`).join('')||'<li class="wb-empty">还没有书签</li>'}</ul>`;
  this.body.querySelector<HTMLButtonElement>('#wb-bm-add')!.onclick=()=>{const name=(this.body.querySelector<HTMLInputElement>('#wb-bm-name')!.value||'').trim()||`视图 ${list.length+1}`;list.push({...this.ctx.view(),name,createdUtc:new Date().toISOString()});this.save(list);this.bookmarks();this.ctx.notify('书签已保存');};
  for(const b of this.body.querySelectorAll<HTMLButtonElement>('[data-wb-bm]'))b.onclick=()=>{this.ctx.restore(list[Number(b.dataset.wbBm)]);this.ctx.notify('已恢复书签视图');};
  for(const b of this.body.querySelectorAll<HTMLButtonElement>('[data-wb-del]'))b.onclick=()=>{list.splice(Number(b.dataset.wbDel),1);this.save(list);this.bookmarks();};
 }
 snapshot(){return {tab:this.tab,eclipses:this.eclipses?.map(e=>({...e})),eclipseMs:this.eclipseMs,worker:this.eclipseWorker,timeline:this.timeline?.length??0,bookmarks:this.load().length};}
}
function escapeHtml(s:string){return s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);}
/** UTC milliseconds for a TDB second via the project TimeSystem (Newton iteration on its own utcToTdb). */
export function tdbToUtcApprox(time:TimeSystem,tdb:number){let ms=Date.UTC(2000,0,1,12)+tdb*1000-69184;for(let k=0;k<4;k++)ms+=(tdb-time.utcToTdb(ms))*1000;return Math.round(ms);}
function moonPath(f:number,waxing:boolean){
 // Northern-hemisphere view: lit limb on the right while waxing. The terminator is a half-ellipse (rx = |1−2f|·R)
 // bulging toward the lit limb for a crescent and away from it for a gibbous phase.
 const rx=Math.abs(1-2*f)*50,crescent=f<.5,outer=waxing?1:0,terminator=waxing?(crescent?0:1):(crescent?1:0);
 return `M0 -50 A50 50 0 0 ${outer} 0 50 A${rx.toFixed(3)} 50 0 0 ${terminator} 0 -50 Z`;
}
