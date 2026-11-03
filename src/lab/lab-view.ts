import {Lab,keplerRelative,type LabState,type Integrator} from './nbody';
import {presets,type PresetContext} from './presets';
import './lab.css';

const DAY=86400,AU=149597870.7;
/** Phase 6 UI: independent from the real-ephemeris scene; only reads a copy of initial conditions on reset. */
export class LabView{
 private lab!:Lab;private preset=presets[0];private playing=false;private stepsPerFrame=4;private rotating=false;private trails:number[][][]=[];private convergence:string='';
 private canvas:HTMLCanvasElement;private chart:HTMLCanvasElement;
 constructor(readonly host:HTMLElement,readonly context:()=>PresetContext){
  host.innerHTML=`<div class="lab-head"><div><p class="kicker">PHYSICS LAB · 6</p><h2>独立物理实验室</h2></div>
   <label>实验 <select id="lab-preset">${presets.map(p=>`<option value="${p.id}">${p.title}</option>`).join('')}</select></label>
   <label>积分器 <select id="lab-integrator"><option value="velocity-verlet">Velocity Verlet</option><option value="leapfrog-dkd">Leapfrog（DKD）</option></select></label>
   <label>步长 <input id="lab-dt" type="number" min="0" step="any"><span id="lab-dt-unit"></span></label><label>子步 <input id="lab-sub" type="number" min="1" max="64" step="1"></label>
   <button id="lab-play">▶ 运行</button><button id="lab-step">单步</button><button id="lab-reset">重置</button><button id="lab-close" aria-label="关闭物理实验室">×</button></div>
   <p class="lab-banner" role="status"></p>
   <div class="lab-body"><div class="lab-stage"><canvas class="lab-canvas" aria-label="实验轨迹俯视图"></canvas><label class="lab-rot"><input id="lab-rotating" type="checkbox"> 随第二天体旋转的坐标系</label></div>
   <aside class="lab-side"><h3>守恒量与误差</h3><dl id="lab-diag"></dl><canvas class="lab-chart" aria-label="能量与角动量相对误差（对数）"></canvas><p class="lab-legend"><i class="e"></i>|ΔE/E₀| <i class="l"></i>|ΔL/L₀|（对数纵轴）</p><p class="lab-warning" role="alert" hidden></p>
   <h3>步长收敛测试</h3><button id="lab-converge">运行 dt、dt/2、dt/4 对照</button><p id="lab-converge-out" class="lab-note"></p><p class="lab-desc"></p></aside></div>`;
  this.canvas=host.querySelector('.lab-canvas')!;this.chart=host.querySelector('.lab-chart')!;
  const $=<T extends HTMLElement>(s:string)=>host.querySelector<T>(s)!;
  $('#lab-preset').onchange=()=>{this.preset=presets.find(p=>p.id===$<HTMLSelectElement>('#lab-preset').value)!;this.reset();};
  $('#lab-integrator').onchange=()=>this.reset(true);$('#lab-dt').onchange=()=>this.reset(true);$('#lab-sub').onchange=()=>this.reset(true);
  $('#lab-play').onclick=()=>{this.playing=!this.playing;this.sync();};$('#lab-step').onclick=()=>{this.lab.advance(1);this.record();this.drawAll();};$('#lab-reset').onclick=()=>this.reset(true);
  $('#lab-rotating').onchange=e=>{this.rotating=(e.target as HTMLInputElement).checked;this.trails=this.lab.state.bodies.map(()=>[]);};
  $('#lab-converge').onclick=()=>this.convergenceTest();
  this.reset();
 }
 private units(){return this.lab.state.units==='normalized';}
 reset(keepInputs=false){
  const s=this.preset.make(this.context()),$=<T extends HTMLElement>(q:string)=>this.host.querySelector<T>(q)!;
  if(keepInputs){const dt=Number($<HTMLInputElement>('#lab-dt').value),sub=Number($<HTMLInputElement>('#lab-sub').value);if(dt>0)s.dt=s.units==='normalized'?dt:dt*3600;if(sub>=1)s.substeps=Math.round(sub);}
  if(keepInputs)s.integrator=$<HTMLSelectElement>('#lab-integrator').value as Integrator;
  this.lab=new Lab(s);this.trails=s.bodies.map(()=>[]);this.playing=false;this.convergence='';
  $<HTMLInputElement>('#lab-dt').value=String(s.units==='normalized'?s.dt:s.dt/3600);$('#lab-dt-unit').textContent=s.units==='normalized'?'（无量纲）':' 小时';$<HTMLInputElement>('#lab-sub').value=String(s.substeps);$<HTMLSelectElement>('#lab-integrator').value=s.integrator;
  const banner=$('.lab-banner');banner.className='lab-banner '+this.preset.kind;banner.textContent=this.preset.kind==='hypothetical'?'假设实验：参数已人为修改，结果不代表真实太阳系，也不会写回星历。':this.preset.kind==='ephemeris-copy'?'初始条件为当前时刻 JPL 星历的只读副本；之后是牛顿引力数值积分（模型简化），不再是真实星历。':'理想模型：用于验证数值方法，与真实太阳系无关。';
  $('.lab-desc').textContent=this.preset.description;$('#lab-converge-out').textContent='';this.record();this.sync();this.drawAll();
 }
 private sync(){this.host.querySelector('#lab-play')!.textContent=this.playing?'Ⅱ 暂停':'▶ 运行';}
 private record(){const b=this.lab.state.bodies,ref=this.rotating?b[1]:null,ang=ref?-Math.atan2(ref.r[1]-b[0].r[1],ref.r[0]-b[0].r[0]):0;
  b.forEach((x,i)=>{let px=x.r[0]-b[0].r[0]*(ref?1:0),py=x.r[1]-b[0].r[1]*(ref?1:0);if(ref){const c=Math.cos(ang),s=Math.sin(ang);[px,py]=[px*c-py*s,px*s+py*c];}this.trails[i].push([px,py]);if(this.trails[i].length>3000)this.trails[i].shift();});}
 frame(){if(!this.playing||this.host.hidden)return;const d=this.lab.advance(this.stepsPerFrame);this.record();if(this.lab.paused){this.playing=false;this.sync();}this.drawAll();if(this.lab.state.t>=this.preset.durationDays*(this.units()?1:DAY)){this.playing=false;this.sync();}return d;}
 private drawAll(){
  const c=this.canvas,w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;c.width=w*devicePixelRatio;c.height=h*devicePixelRatio;const g=c.getContext('2d')!;g.scale(devicePixelRatio,devicePixelRatio);g.fillStyle='#03070d';g.fillRect(0,0,w,h);
  const all=this.trails.flat(),max=Math.max(1e-9,...all.map(p=>Math.max(Math.abs(p[0]),Math.abs(p[1]))))*1.1,k=Math.min(w,h)/2/max;
  g.strokeStyle='#1d3042';g.beginPath();g.moveTo(w/2,0);g.lineTo(w/2,h);g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
  this.lab.state.bodies.forEach((b,i)=>{const t=this.trails[i];g.strokeStyle=b.color??'#9fc3dd';g.globalAlpha=.75;g.beginPath();t.forEach((p,j)=>{const x=w/2+p[0]*k,y=h/2-p[1]*k;j?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();g.globalAlpha=1;const p=t.at(-1);if(p){g.fillStyle=b.color??'#fff';g.beginPath();g.arc(w/2+p[0]*k,h/2-p[1]*k,4,0,Math.PI*2);g.fill();g.fillStyle='#c9d6e0';g.font='12px sans-serif';g.fillText(b.name,w/2+p[0]*k+7,h/2-p[1]*k-6);}});
  const scaleLabel=this.units()?`${(max/k*100).toFixed(3)} 单位 / 100 px`:`${(100/k/AU).toFixed(4)} au / 100 px`;g.fillStyle='#7f98ab';g.fillText(`标尺 ${scaleLabel} · 俯视：x–y 平面（ICRF 赤道坐标）${this.rotating?'，随第二天体旋转':''}`,12,h-12);
  // Diagnostics
  const d=this.lab.diagnostics(),t=this.units()?`${d.t.toFixed(3)}（无量纲）`:`${(d.t/DAY).toFixed(2)} 天`;
  let analytic='';if(this.preset.compareAnalytic){const s0=this.lab.initial.bodies,b=this.lab.state.bodies,rel=[0,1,2].map(q=>b[1].r[q]-b[0].r[q]),ex=keplerRelative([s0[1].r[0]-s0[0].r[0],s0[1].r[1]-s0[0].r[1],s0[1].r[2]-s0[0].r[2]],[s0[1].v[0]-s0[0].v[0],s0[1].v[1]-s0[0].v[1],s0[1].v[2]-s0[0].v[2]],s0[0].gm+s0[1].gm,d.t);analytic=`<div><dt>与解析解位置差</dt><dd>${Math.hypot(...rel.map((x,q)=>x-ex[q])).toExponential(3)} km</dd></div>`;}
  this.host.querySelector('#lab-diag')!.innerHTML=`<div><dt>实验时间</dt><dd>${t}</dd></div><div><dt>|ΔE/E₀|</dt><dd>${d.relEnergyDrift.toExponential(3)}</dd></div><div><dt>|ΔL/L₀|</dt><dd>${d.relAngularMomentumDrift.toExponential(3)}</dd></div><div><dt>最近距离 / 半径和</dt><dd>${d.minSeparation.toFixed(2)}</dd></div>${analytic}<div><dt>积分</dt><dd>${this.lab.state.integrator} · dt=${this.units()?this.lab.state.dt:(this.lab.state.dt/3600)+' h'} · ${this.lab.state.substeps} 子步</dd></div>`;
  const warn=this.host.querySelector<HTMLElement>('.lab-warning')!;warn.hidden=!d.warning;warn.textContent=d.warning??'';
  const ch=this.chart,cw=ch.clientWidth,chh=ch.clientHeight;ch.width=cw*devicePixelRatio;ch.height=chh*devicePixelRatio;const q=ch.getContext('2d')!;q.scale(devicePixelRatio,devicePixelRatio);q.fillStyle='#050b13';q.fillRect(0,0,cw,chh);
  const hist=this.lab.history,lo=-16,hi=0,y=(v:number)=>chh-((Math.log10(Math.max(v,1e-16))-lo)/(hi-lo))*chh;q.strokeStyle='#1d3042';for(let e=lo;e<=hi;e+=4){q.beginPath();q.moveTo(0,y(10**e));q.lineTo(cw,y(10**e));q.stroke();q.fillStyle='#5f7a8e';q.font='10px sans-serif';q.fillText(`1e${e}`,2,y(10**e)-2);}
  for(const [key,color] of [['relEnergyDrift','#e7a96a'],['relAngularMomentumDrift','#8fc3e6']] as const){q.strokeStyle=color;q.beginPath();hist.forEach((p,i)=>{const x=i/Math.max(1,hist.length-1)*cw;i?q.lineTo(x,y(p[key])):q.moveTo(x,y(p[key]));});q.stroke();}
 }
 private convergenceTest(){
  const base=this.preset.make(this.context()),dt0=Number(this.host.querySelector<HTMLInputElement>('#lab-dt')!.value)*(base.units==='normalized'?1:3600),span=Math.min(this.preset.durationDays*(base.units==='normalized'?1:DAY),dt0*4000);
  const final=(dt:number)=>{const s:LabState=this.preset.make(this.context());s.dt=dt;s.substeps=1;s.integrator=this.host.querySelector<HTMLSelectElement>('#lab-integrator')!.value as Integrator;const lab=new Lab(s);lab.advance(Math.round(span/dt));return lab;};
  const runs=[dt0,dt0/2,dt0/4,dt0/8].map(final),ref=runs[3].state.bodies,errs=runs.slice(0,3).map(l=>Math.max(...l.state.bodies.map((b,i)=>Math.hypot(b.r[0]-ref[i].r[0],b.r[1]-ref[i].r[1],b.r[2]-ref[i].r[2]))));
  // Richardson-style: differences to the finest run; for a 2nd-order method successive ratios approach 4 (≈ (4−1)/(1−1/4)·… exact ratio 4).
  const r1=errs[0]/errs[1],r2=errs[1]/errs[2];this.host.querySelector('#lab-converge-out')!.textContent=`相对 dt/8 的最终位置差：dt ${errs[0].toExponential(2)}，dt/2 ${errs[1].toExponential(2)}，dt/4 ${errs[2].toExponential(2)}（${this.units()?'无量纲':'km'}）；相邻比值 ${r1.toFixed(2)}、${r2.toFixed(2)}。二阶方法期望约 4–5（以 dt/8 为参考时比值略高于 4）。${runs.some(l=>l.paused)?'注意：至少一次运行触发了发散/接触告警。':''}`;
 }
 snapshot(){const d=this.lab.diagnostics();return {preset:this.preset.id,kind:this.preset.kind,integrator:this.lab.state.integrator,dt:this.lab.state.dt,substeps:this.lab.state.substeps,t:d.t,relEnergyDrift:d.relEnergyDrift,relAngularMomentumDrift:d.relAngularMomentumDrift,warning:d.warning,paused:this.lab.paused,playing:this.playing,bodies:this.lab.state.bodies.map(b=>({name:b.name,gm:b.gm})),convergence:this.host.querySelector('#lab-converge-out')!.textContent};}
 resize(){this.drawAll();}
}
