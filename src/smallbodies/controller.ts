import * as THREE from 'three';
import {KM_PER_UNIT,type ScaleMode} from '../science/coordinates';
import type {EphemerisProvider} from '../science/ephemeris';
import {loadSmallBodies,type SmallBodyEphemeris} from './ephemeris';
import {loadPopulations,PopulationLayer,groupNames} from './population-layer';
import {NamedSmallBodies,kindName} from './named-layer';
import './smallbodies.css';

const AU=149597870.7;const fmt=(v:number,d=0)=>v.toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d});
/** Bodies that open a local view: real global mosaics exist (phase-4 asset registry). */
export const localViewBodies=new Set(['999','2000001']);
/** Phase 4 on the main scene: named Horizons bodies + anonymous SBDB populations, layered and loaded after boot. */
export class SmallBodyController{
 selected:string|null=null;readonly named:NamedSmallBodies;readonly populations:PopulationLayer;private panel:HTMLElement;private layers:HTMLElement;private lastPanel=0;
 onFocus:(id:string)=>void=()=>{};onEnter:(id:string)=>void=()=>{};onClose:()=>void=()=>{};
 constructor(readonly eph:SmallBodyEphemeris,pop:Awaited<ReturnType<typeof loadPopulations>>,world:THREE.Object3D,labelHost:HTMLElement,app:HTMLElement,readonly origin:()=>THREE.Vector3){
  this.populations=new PopulationLayer(pop.info,pop.data,origin);this.named=new NamedSmallBodies(eph,labelHost,origin,(id,focus)=>{this.select(id);if(focus)this.onFocus(id);});
  world.add(this.populations.group,this.named.group);
  this.layers=document.createElement('details');this.layers.id='smallbody-layers';this.layers.className='sb-layers';
  const total=Object.values(this.populations.counts).reduce((a,b)=>a+b,0);
  this.layers.innerHTML=`<summary>☄ 小天体图层 <small>${fmt(total)} 个统计样本 · ${this.named.ids.length} 个命名天体</small></summary>
   <label><input type="checkbox" data-sb-layer="named" checked> 命名小天体（JPL Horizons 星历）</label>
   <label><input type="checkbox" data-sb-layer="mainbelt" checked> 主带 / Hilda / 特洛伊（${fmt(this.populations.counts.mainbelt)}）</label>
   <label><input type="checkbox" data-sb-layer="tno" checked> 海王星外天体（${fmt(this.populations.counts.tno)}）</label>
   <div class="sb-legend">${groupNames.map((g,i)=>`<button data-sb-group="${i}"><i class="g${i}"></i>${g}<span>${fmt(this.populations.groupCounts[i])}</span></button>`).join('')}</div>
   <p>统计层：JPL SBDB 已编号小行星（H&lt;15、a&lt;5.5 au）与已登记 TNO 的真实密切根数，二体开普勒传播；不显示个体身份，不作定位用途（与 Horizons 偏差典型 10⁵–10⁶ km）。缺口与簇团来自真实分布，未人为绘制。</p>`;
  app.append(this.layers);
  for(const input of this.layers.querySelectorAll<HTMLInputElement>('[data-sb-layer]'))input.onchange=()=>this.applyLayers();
  for(const b of this.layers.querySelectorAll<HTMLButtonElement>('[data-sb-group]'))b.onclick=()=>{const g=Number(b.dataset.sbGroup);this.populations.uniforms.uHighlight.value=this.populations.uniforms.uHighlight.value===g?-1:g;for(const x of this.layers.querySelectorAll('[data-sb-group]'))x.classList.toggle('active',Number((x as HTMLElement).dataset.sbGroup)===this.populations.uniforms.uHighlight.value);};
  this.panel=document.createElement('aside');this.panel.id='smallbody-panel';this.panel.hidden=true;this.panel.setAttribute('aria-label','小天体详情');app.append(this.panel);
 }
 private applyLayers(){const on=(k:string)=>this.layers.querySelector<HTMLInputElement>(`[data-sb-layer=${k}]`)!.checked;this.named.group.visible=on('named');this.populations.visible=on('mainbelt')||on('tno');this.populations.group.children.forEach(c=>{c.visible=on(c.name.endsWith('tno')?'tno':'mainbelt');});}
 select(id:string|null){this.selected=id;delete this.panel.dataset.body;this.panel.hidden=!id;document.body.classList.toggle('smallbody-selected',!!id);this.lastPanel=0;}
 position(id:string){return this.named.positions.get(id)!;}
 /** Display radius used only for camera stand-off when focusing a marker-only body. */
 focusRadius(id:string,mode:ScaleMode){const d=Number(this.eph.meta(id).physical?.diameter?.value??1000);return mode==='scientific'?d/2/KM_PER_UNIT:.25;}
 beforeDraw(tdb:number,mode:ScaleMode,heightPx:number,focused:string|null){
  const namedOn=this.layers.querySelector<HTMLInputElement>('[data-sb-layer=named]')!.checked;this.named.updatePositions(tdb,mode,namedOn||focused===this.selected,this.selected,focused);
  // Statistical layer hidden while a single body is in focus, as the planets' paths are.
  this.populations.update(tdb,mode==='exploration',!focused,heightPx);
 }
 afterDraw(tdb:number,camera:THREE.Camera,width:number,height:number,focused:string|null,occupied:{x:number;y:number;w:number;h:number}[]){
  this.named.placeLabels({visible:this.named.group.visible,selected:this.selected,focused,camera,width,height,occupied});
  // Build the panel once per selection; afterwards only the live numbers change, so buttons are never replaced under the pointer.
  if(this.selected&&this.panel.dataset.body!==this.selected){this.renderPanel(tdb);this.panel.dataset.body=this.selected;}
  else if(this.selected&&performance.now()-this.lastPanel>400){this.lastPanel=performance.now();const h=this.eph.heliocentric(this.selected,tdb);
   this.panel.querySelector('[data-sb-live=r]')!.textContent=`${(Math.hypot(...h.positionKm)/AU).toFixed(6)} au`;this.panel.querySelector('[data-sb-live=v]')!.textContent=`${Math.hypot(...h.velocityKmPerSec).toFixed(4)} km/s`;}
 }
 private renderPanel(tdb:number){
  const id=this.selected!,m=this.eph.meta(id),p=m.physical,h=this.eph.heliocentric(id,tdb),r=Math.hypot(...h.positionKm),v=Math.hypot(...h.velocityKmPerSec);
  const row=(k:string,val:string)=>`<div><dt>${k}</dt><dd>${val}</dd></div>`,unc=(x?:{value:string;sigma?:string|null;units?:string|null})=>x?`${x.value}${x.sigma?' ± '+x.sigma:''}${x.units?' '+x.units:''}`:'未登记';
  const local=localViewBodies.has(id);
  this.panel.innerHTML=`<div class="sb-top"><p class="kicker">SMALL BODY · ${id}</p><button class="sb-close" aria-label="关闭小天体详情">×</button></div><h2>${m.zh}</h2><p class="sb-en">${p?.fullName??m.name} · ${kindName[m.kind]}</p>
   <div class="sb-tags"><span>位置：JPL Horizons ${m.solution}</span><span>${local?'表面：观测影像':'表面：无全球影像'}</span></div>
   <dl>${row('日心距离',`<span data-sb-live="r">${(r/AU).toFixed(6)} au</span>`)}${row('日心速度',`<span data-sb-live="v">${v.toFixed(4)} km/s</span>`)}${row('直径',unc(p?.diameter))}${row('几何反照率',p?.albedo?.value??'未登记')}${row('自转周期',unc(p?.rot_per))}${row('GM',unc(p?.GM))}${p?.extent?row('三轴尺寸',unc(p.extent)):''}${row('轨道类型',p?.orbitClass??'—')}</dl>
   <p class="sb-note">${local?'有经核验的全球影像：可进入局部视图查看真实太阳光照与 IAU 姿态。':'该天体没有可用的全球表面影像或形状模型纳入本期：主场景仅显示定位标记与星历轨迹，不以虚构表面冒充。'}</p>
   <div class="sb-actions"><button class="primary" data-sb-action="focus">聚焦天体 <span>↗</span></button>${local?`<button class="primary" data-sb-action="enter">${id==='999'?'进入冥王星–卡戎系统':'进入局部视图'} <span>◎</span></button>`:''}</div>
   <p class="sb-source">星历：JPL Horizons ${m.solution} · 网格 ${m.stepSeconds/3600} h · 留出样本插值验证见第 4 期报告。物理参数：${p?.source??'JPL'}。主场景位置与行星共用同一显示映射。</p>`;
  this.panel.querySelector<HTMLButtonElement>('.sb-close')!.onclick=()=>{this.select(null);this.onClose();};
  this.panel.querySelector<HTMLButtonElement>('[data-sb-action=focus]')!.onclick=()=>this.onFocus(id);
  this.panel.querySelector<HTMLButtonElement>('[data-sb-action=enter]')?.addEventListener('click',()=>this.onEnter(id));
 }
 searchIndex(){return this.eph.manifest.objects.filter(o=>o.centerId==='0').map(o=>({id:o.id,zh:o.zh,en:o.name,kind:kindName[o.kind]}));}
 snapshot(){return {selected:this.selected,named:this.named.snapshot(),populations:{counts:this.populations.counts,groups:this.populations.groupCounts,visible:this.populations.group.visible,highlight:this.populations.uniforms.uHighlight.value,days:this.populations.uniforms.uDays.value}};}
}
export async function loadPhase4(planets:EphemerisProvider){const [eph,pop]=await Promise.all([loadSmallBodies(planets),loadPopulations()]);return {eph,pop};}
