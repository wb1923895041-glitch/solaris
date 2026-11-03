import './style.css';
import {catalog,radiusSource} from './science/catalog';
import {EphemerisProvider,relative,type State} from './science/ephemeris';
import {TimeSystem,TimeController} from './science/time';
import {AU_KM,KM_PER_UNIT,type ScaleMode} from './science/coordinates';
import {SolarSystemScene} from './render/scene';
import manifest from '../data/phase-1/manifest.json';
import {BodyOrientation} from './render/celestial/orientation';
import type {VisualOptions} from './render/celestial/system';
import type {TrailMode} from './render/orbit-trails';
import {loadSatellites,type SatelliteEphemeris} from './satellites/ephemeris';
import type {SatelliteDiagnostic} from './satellites/diagnostic';
import type {MoonAssetInspector} from './satellites/asset-inspector';
import type {PlanetarySystemView} from './satellites/planetary-system';
import {moonIndex} from './satellites/moon-knowledge';
import {systemPlanets} from './satellites/local-mapping';
import {Vector3} from 'three';
import {QualityController,type QualityTier} from './render/quality';
import {ringSystems,ringGain} from './render/celestial/minor-rings';
import type {SmallBodyController} from './smallbodies/controller';
import type {SmallBodyEphemeris} from './smallbodies/ephemeris';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=$('runtime-status');
let selected='399',mode:ScaleMode='exploration',scene:SolarSystemScene,provider:EphemerisProvider,states:Map<string,State>;
const time=new TimeSystem(manifest.time.parameters,manifest.startUtc,manifest.endUtc);
const clock=new TimeController(time,time.parse('2026-10-29T00:00:00Z'));
let pathsVisible=true,lastUI=0,lastFrame=0;const frameTimes:number[]=[];
let satelliteEphemeris:SatelliteEphemeris|undefined,satelliteDiagnostic:SatelliteDiagnostic|undefined;
let moonInspector:MoonAssetInspector|undefined;
let localSystem:PlanetarySystemView|undefined,orientation:BodyOrientation,entering=false;
let smallBodies:SmallBodyController|undefined,smallEph:SmallBodyEphemeris|undefined,phase4:Promise<void>|undefined;
/** Phase 4 layers load after the first frame (layered loading); a failure leaves the planets untouched. */
function startPhase4(){phase4??=(async()=>{try{const {loadPhase4,SmallBodyController}=await import('./smallbodies/controller');const {eph,pop}=await loadPhase4(provider);smallEph=eph;
 smallBodies=new SmallBodyController(eph,pop,scene.world,$('labels'),$('app'),()=>scene.navigation.position);smallBodies.onFocus=id=>{selectSmallBody(id);scene.focusExternal(id,()=>smallBodies!.position(id),smallBodies!.focusRadius(id,mode));notify(`聚焦${eph.meta(id).zh} · JPL Horizons 星历位置；无全球影像的天体只显示定位标记`);};
 smallBodies.onEnter=id=>void enterSystem(id);smallBodies.onClose=()=>{if(scene.externalFocus)scene.overview();renderSelection();};
 notify(`小天体图层已加载 · ${eph.manifest.objects.length} 个命名天体（Horizons）· ${Object.values(pop.info).reduce((a,p)=>a+p.count,0).toLocaleString()} 个 SBDB 统计样本`);}catch(e){notify('小天体图层未启用：'+(e as Error).message+'；行星与卫星照常运行');}})();return phase4;}
function selectSmallBody(id:string){smallBodies?.select(id);}
let quality:QualityController|undefined;
let workbench:import('./education/workbench').Workbench|undefined,lab:import('./lab/lab-view').LabView|undefined,reference:any;
async function ensureSatellites(){if(!satelliteEphemeris)satelliteEphemeris=await loadSatellites(provider);return satelliteEphemeris;}
function closeOverlays(except?:string){if(except!=='workbench')closeWorkbench();if(except!=='lab')closeLab();closeMoonAssets();closeSatelliteDiagnostics();exitSystem(false);}
function closeWorkbench(){const h=document.getElementById('workbench');if(!h||h.hidden)return;h.hidden=true;document.body.classList.remove('workbench-open');$('workbench-button').setAttribute('aria-pressed','false');}
function closeLab(){const h=document.getElementById('physics-lab');if(!h||h.hidden)return;h.hidden=true;document.body.classList.remove('lab-open');$('lab-button').setAttribute('aria-pressed','false');}
/** Eclipse scan in a Web Worker with copies of the Sun, Earth and Moon buffers (the main thread keeps rendering). */
async function computeEclipses(start:number,end:number){
 const sats=await ensureSatellites(),meta=(id:string)=>provider.manifest.objects.find(o=>o.id===id)!;
 const worker=new Worker(new URL('./education/eclipse-worker.ts',import.meta.url),{type:'module'});
 return await new Promise<{eclipses:any[];ms:number;worker:boolean}>((resolve,reject)=>{worker.onmessage=e=>{worker.terminate();e.data.error?reject(Error(e.data.error)):resolve({eclipses:e.data.eclipses,ms:e.data.ms,worker:true});};worker.onerror=e=>{worker.terminate();reject(Error(e.message));};
  worker.postMessage({planets:{manifest:{...provider.manifest,objects:[]},sun:meta('10'),earth:meta('399'),sunBuffer:provider.buffers.get('10')!.slice(),earthBuffer:provider.buffers.get('399')!.slice()},moon:{meta:sats.meta('301'),buffer:sats.buffers.get('301')!.slice(),startTdb:sats.manifest.startTdb,endTdb:sats.manifest.endTdb},start,end});});
}
async function openWorkbench(tab?:string){
 const host=$('workbench');if(!host.hidden&&!tab){closeWorkbench();return;}closeOverlays('workbench');
 try{if(!workbench){const {Workbench}=await import('./education/workbench');void startPhase4();
   workbench=new Workbench(host,{time,provider,nowUtcMs:()=>clock.utcMs,satellites:ensureSatellites,small:()=>smallEph,jump,
    selectPlanet:id=>{closeWorkbench();select(id,true);},enterSystem:(p,m)=>{closeWorkbench();void enterSystem(p,m);},selectSmall:id=>{closeWorkbench();selectSmallBody(id);smallBodies?.onFocus(id);},
    view:()=>{const v=scene.snapshot();return {utcMs:clock.utcMs,mode,selected,camera:v.camera,target:v.target};},
    restore:b=>{closeWorkbench();jump(b.utcMs);mode=b.mode as ScaleMode;select(b.selected);updateUI();requestAnimationFrame(()=>requestAnimationFrame(()=>scene.restoreCamera(b.camera,b.target)));},notify,computeEclipses});
   $('wb-close').onclick=closeWorkbench;}
  host.hidden=false;document.body.classList.add('workbench-open');$('workbench-button').setAttribute('aria-pressed','true');await workbench.open(tab);notify('科普工作台 · 数值来自同一星历与附出处的参考数据');
 }catch(e){notify('科普工作台未启用：'+(e as Error).message);}
}
async function openLab(){
 const host=$('physics-lab');if(!host.hidden){closeLab();return;}closeOverlays('lab');
 try{if(!lab){const [{LabView},sats]=await Promise.all([import('./lab/lab-view'),ensureSatellites()]);if(!reference){const r=await fetch('/education/reference.json');if(!r.ok)throw Error('参考数据缺失');reference=await r.json();}
   const gm:Record<string,number>=Object.fromEntries(Object.entries(reference.planets).map(([k,v]:[string,any])=>[k,v.gm]));gm['301']=(sats.meta('301').physical as any).gmKm3PerSec2;
   const radius:Record<string,number>=Object.fromEntries(catalog.map(b=>[b.id,b.radiusKm]));radius['301']=sats.meta('301').physical.radiusKm;
   lab=new LabView(host,()=>{const t=time.utcToTdb(clock.utcMs);return {state:(id,tdb)=>provider.state(id,tdb),moon:tdb=>sats.relativeState('301',tdb),gm,radius,tdb:t};});$('lab-close').onclick=closeLab;}
  host.hidden=false;document.body.classList.add('lab-open');$('lab-button').setAttribute('aria-pressed','true');lab.resize();lab.reset();notify('独立物理实验室 · 与真实星历隔离；初值为只读副本');
 }catch(e){notify('物理实验室未启用：'+(e as Error).message);}
}
const hasSystem=(id:string)=>(systemPlanets as readonly string[]).includes(id);
/** 3C: smooth main-scene focus on the planet, then hand the same view side to the local system. */
async function enterSystem(planet:string,moon?:string){
 if(entering)return;entering=true;const button=$<HTMLButtonElement>('enter-system');button.disabled=true;notify('加载卫星星历、资产与姿态…');
 try{
  if(!satelliteEphemeris)satelliteEphemeris=await loadSatellites(provider);
  if(!hasSystem(planet)||!localSystem)await startPhase4();
  if(!localSystem){const [{PlanetarySystemView,planetParent},{loadMoonResources},{MoonOrientation},parents]=await Promise.all([import('./satellites/planetary-system'),import('./satellites/asset-contract'),import('./satellites/moon-visual'),import('./smallbodies/local-parents')]);
   const moons=await loadMoonResources(satelliteEphemeris);let source:any=satelliteEphemeris,registry=moons.registry,poses=moons.orientation,pluto:any=null;
   if(smallEph){try{const [a,b,c]=await Promise.all(['/assets/smallbodies/manifest.json','/assets/smallbodies/orientation/manifest.json','/smallbodies/pluto-system.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error('小天体资产清单缺失');return r.json();})));
    pluto=c;source=new parents.CombinedMoonSource(satelliteEphemeris,smallEph,pluto);registry={...registry,bodies:[...registry.bodies,...a.bodies]};poses={...poses,objects:[...poses.objects,...b.objects]};}catch(e){notify('冥王星/谷神星局部视图未启用：'+(e as Error).message+'；行星卫星系统照常');}}
   const small=smallEph;localSystem=new PlanetarySystemView($('planetary-system'),source,provider,async(id,renderer,visuals,poseCache)=>{if(hasSystem(id))return planetParent(id,renderer,provider,orientation);const asset=registry.bodies.find((x:any)=>x.naifId===id);if(!asset||!small)throw Error('该小天体没有经核验的全球影像');return parents.smallBodyParent(id,asset,small,visuals,poseCache);},{registry,orientation:poses});
   if(small&&pluto){for(const id of ['999','2000001'])localSystem.allowEmpty.add(id);localSystem.noteProvider=parents.smallBodyNotes(small,pluto,new MoonOrientation(poses));}
   localSystem.onExit=exitSystem;}
  closeMoonAssets();closeSatelliteDiagnostics();if(hasSystem(planet)&&selected!==planet){selected=planet;renderSelection();}
  if(localSystem.open){await localSystem.enter(planet,new Vector3(0,.4,1),time.utcToTdb(clock.utcMs),moon);return;}
  if(hasSystem(planet)){if(scene.focusedId!==planet){scene.focus(planet);await new Promise(r=>setTimeout(r,1150));}}else if(smallBodies&&scene.externalFocus!==planet){scene.focusExternal(planet,()=>smallBodies!.position(planet),smallBodies.focusRadius(planet,mode));await new Promise(r=>setTimeout(r,1150));}
  const view=scene.snapshot(),host=$('planetary-system');host.classList.add('entering');host.hidden=false;document.body.classList.add('system-open');localSystem.resize();
  await localSystem.enter(planet,new Vector3(...view.camera).sub(new Vector3(...view.target)),time.utcToTdb(clock.utcMs),moon);
  requestAnimationFrame(()=>requestAnimationFrame(()=>host.classList.remove('entering')));
  notify(`${catalog.find(b=>b.id===planet)?.zh??smallEph?.meta(planet).zh}局部系统 · 卫星与轨道来自同一 JPL 星历状态函数 · 时间轴仍为全局唯一`);
 }catch(e){notify('局部系统未启用：'+(e as Error).message+'；原太阳系继续运行');}finally{entering=false;button.disabled=false;}
}
function exitSystem(toOverview:boolean){
 if(!localSystem?.open)return;const host=$('planetary-system');host.classList.add('entering');
 setTimeout(()=>{localSystem!.close();host.classList.remove('entering');document.body.classList.remove('system-open');},450);
 if(toOverview)scene.overview();notify(toOverview?'返回太阳系总览':'返回行星聚焦视图');
}
function closeMoonAssets(){$('moon-assets').hidden=true;document.body.classList.remove('moon-assets-open');$('moon-bench-button').setAttribute('aria-pressed','false');}
async function openMoonAssets(){
 const host=$('moon-assets'),button=$<HTMLButtonElement>('moon-bench-button');if(!host.hidden){closeMoonAssets();return;}exitSystem(false);button.disabled=true;notify('加载卫星独立资产与姿态…');
 try{if(!satelliteEphemeris)satelliteEphemeris=await loadSatellites(provider);if(!moonInspector){const {createMoonInspector}=await import('./satellites/asset-inspector');moonInspector=await createMoonInspector(host,satelliteEphemeris,provider);$('moon-close').onclick=closeMoonAssets;}closeSatelliteDiagnostics();host.hidden=false;document.body.classList.add('moon-assets-open');button.setAttribute('aria-pressed','true');moonInspector.resize();notify('3B 独立资产验收 · 历史影像与 IAU 近似姿态 · 参考中心仍使用原星历');}catch(e){notify('卫星资产未启用：'+(e as Error).message);}finally{button.disabled=false;}
}
function closeSatelliteDiagnostics(){document.getElementById('satellite-diagnostics')!.hidden=true;document.body.classList.remove('satellite-open');$('sat-data').setAttribute('aria-pressed','false');}
async function openSatelliteDiagnostics(){
 const host=$('satellite-diagnostics'),button=$<HTMLButtonElement>('sat-data');
 if(!host.hidden){closeSatelliteDiagnostics();return;}
 button.disabled=true;closeMoonAssets();exitSystem(false);notify('加载并校验 18 颗卫星数据…');
 try{
  if(!satelliteEphemeris)satelliteEphemeris=await loadSatellites(provider);
  if(!satelliteDiagnostic){const {SatelliteDiagnostic}=await import('./satellites/diagnostic');satelliteDiagnostic=new SatelliteDiagnostic(host,satelliteEphemeris);$('sat-close').onclick=closeSatelliteDiagnostics;}
  host.hidden=false;document.body.classList.add('satellite-open');button.setAttribute('aria-pressed','true');satelliteDiagnostic.resize();notify('3A 只读数据核验 · 无卫星形状、材质或局部探索');
 }catch(e){notify(`卫星数据层未启用：${(e as Error).message}；原太阳系继续运行`);}finally{button.disabled=false;}
}
function notify(message:string){status.textContent=message;}
function select(id:string,focus=false){smallBodies?.select(null);if(focus&&scene.focusedId===id&&hasSystem(id)){void enterSystem(id);return;}selected=id;renderSelection();if(focus||scene.focusedId)scene.focus(id);}
function renderSelection(){
 const b=catalog.find(b=>b.id===selected)!;
 $('body-name').textContent=b.zh;$('body-en').textContent=b.en;$('body-kind').textContent=b.type;
 $('body-description').textContent=b.description;$('body-order').textContent=selected==='10'?'00 / 08':`${String(catalog.indexOf(b)).padStart(2,'0')} / 08`;
 $('radius').textContent=`${b.radiusKm.toLocaleString('en-US',{maximumFractionDigits:4})} km`;
 $('period').textContent=b.periodYears===null?'不适用':`${b.periodYears.toFixed(4)} 年`;$('target-id').textContent=`${b.id} · 本体中心`;
 $('hero-orb').style.backgroundImage=`url("${scene.thumbnails.get(b.id)}")`;
 $('hero-orb').style.boxShadow=selected==='10'?'0 0 30px #d4a14f33, inset 0 0 4px #ffdca333':'';
 const asset=scene.visuals.info(selected);
 if(asset)$('body-description').textContent=asset.description;
 $('material-note').textContent=asset?`${asset.albedo.provider} · ${asset.albedo.observationEpoch}；${asset.hasVerifiedOrientation?'IAU轴向 / 纹理经度已核验':'IAU轴向已核验 / 纹理经度未完全核验'}。重建与增强可在观察设置中查看。`:'第1期基础材质；本资产尚在逐项精修。';
 $('visual-controls').hidden=!asset;
 ($('visual-controls') as HTMLDetailsElement).open=false;document.querySelector('.details-panel')!.scrollTop=0;
 const relevant:Record<string,boolean>={enhancements:selected==='10'||asset?.photometry==='gas',activity:selected==='10',atmosphere:!!asset?.atmosphere,clouds:selected==='399',cloudMotion:selected==='399',night:selected==='399',terrain:!!asset?.heightLods,radar:selected==='299',axis:true,fill:['199','299','399','499'].includes(selected)};
 for(const input of document.querySelectorAll<HTMLInputElement>('[data-visual-option]'))(input.parentElement as HTMLElement).hidden=!relevant[input.dataset.visualOption!];
 for(const button of document.querySelectorAll<HTMLElement>('[data-observe]'))button.hidden=button.dataset.observe==='feature'?selected!=='599':button.dataset.observe!.startsWith('ring')?selected!=='699':false;
 $('enter-system').hidden=!hasSystem(selected);$('enter-system').querySelector('span')!.textContent=`进入${b.zh}卫星系统`;
 document.querySelectorAll<HTMLElement>('.catalog-item').forEach(el=>{el.classList.toggle('active',el.dataset.id===selected);el.setAttribute('aria-pressed',String(el.dataset.id===selected));});
 updateUI();
}
function updateUI(){
 if(!states)return;const r=relative(states.get(selected)!,states.get('10')!);
 $('distance').textContent=`${(Math.hypot(...r.positionKm)/AU_KM).toFixed(6)} AU`;
 $('velocity').textContent=`${Math.hypot(...r.velocityKmPerSec).toFixed(4)} km/s`;
 $('solution').textContent=`JPL · ${states.get(selected)!.source.solution}`;
 $('utc-label').textContent=time.format(clock.utcMs).replace(/\.\d{3}Z$/,' UTC');
 $('play').textContent=clock.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',clock.playing?'暂停':'播放');
 $<HTMLInputElement>('timeline').value=String((clock.utcMs-time.startMs)/(time.endMs-time.startMs));
 for(const [id,preset]of [['overview','overview'],['inner','depth']]){$(id).classList.toggle('nav-active',scene?.viewPreset===preset);$(id).setAttribute('aria-pressed',String(scene?.viewPreset===preset));}
 document.body.classList.toggle('earth-hero',scene?.focusedId==='399');document.body.classList.toggle('overview-mode',!scene?.focusedId);document.body.classList.toggle('sun-hero',scene?.focusedId==='10');
 $('view-caption').textContent=scene?.focusedId==='399'?'地球探索 · 真实空间参照保留 · 日照来自同一时刻的太阳':scene?.focusedId?'聚焦视图 · 其他天体与轨迹暂隐'+(hasSystem(scene.focusedId)?' · 再次双击或点「进入卫星系统」进入局部系统':''):mode==='exploration'?'真实日心方向 · 距离压缩 · 邻近模型尺寸自适应':'尺寸与距离统一映射 · 远处小天体以标签定位';
 if(selected==='299'&&scene.visuals.options.radar)$('view-caption').textContent+=' · 雷达示意 / 非可见光';
 $('mode-badge').textContent=mode==='exploration'?'探索比例 · 非真实比例':'科学比例 · 统一长度映射';
 $('mapping-note').textContent=mode==='exploration'?'距离压缩 · 显示尺寸自适应防穿插 · 不用于量测':`1 场景单位 = ${(KM_PER_UNIT/1e6).toFixed(3)} 百万 km`;
 $('exploration').setAttribute('aria-pressed',String(mode==='exploration'));$('scientific').setAttribute('aria-pressed',String(mode==='scientific'));
 $('boundary-status').textContent=(clock.utcMs===time.startMs||clock.utcMs===time.endMs)?'已到数据窗边界 · 禁止外推':'数据窗 2024-01-01 — 2031-01-01 UTC';
}
function showSources(){
 const b=catalog.find(b=>b.id===selected)!,meta=manifest.objects.find(o=>o.id===selected)!;
 const gain=scene.meshes.get(b.id)!.scale.x/(b.radiusKm/KM_PER_UNIT);
 $('source-content').innerHTML=`<p><strong>${b.zh} / ${b.en} · 本体中心 ${b.id}</strong></p><p>原始状态：太阳系质心 0；ICRF / FRAME；几何状态 NONE；km、km/s；TDB 自 J2000 秒。显示时同时减去太阳的位置与速度。解版本：<code>${meta.solution}</code>。</p><p><a href="https://ssd-api.jpl.nasa.gov/doc/horizons.html" target="_blank" rel="noreferrer">JPL Horizons 官方接口 ↗</a> · <a href="${radiusSource}" target="_blank" rel="noreferrer">JPL 行星物理参数 ↗</a></p><p>平均半径：${b.radiusKm} km${b.radiusUncertaintyKm===null?'（太阳采用回包标注的 IAU2015 半径）':` ± ${b.radiusUncertaintyKm} km`}。完整原始回包、查询参数与逐项误差报告随验收包提供。</p><p>本地状态文件 SHA-256：<code>${meta.sha256}</code><br>原始回包 SHA-256：<code>${meta.rawSha256}</code></p><p>探索映射：r′=52·ln(1+r/(0.35 AU))，方向保持；邻近模型会按显示包络自适应收小以避免穿插，真实半径与位置不变；当前模式下该天体的显示半径增益约 ${gain.toFixed(0)}×。科学模式对所有长度采用同一 km/单位映射；切换不会改动物理状态。</p><p>轨迹来自 2024–2031 年数据窗，未闭合的外行星轨迹保持为弧段。可切换近期邻域与历史全窗；均为历表路径，不是所选日期的瞬时轨道根数。</p><p>时间：naif0012.tls / ${manifest.time.toolkit}；未来闰秒未知，当前沿用最后已知 TAI−UTC，不能用于精确事件预测。数据窗之外明确拒绝查询。</p><p>地球影像：<a href="https://svs.gsfc.nasa.gov/2915" target="_blank" rel="noreferrer">NASA SVS Blue Marble ↗</a>，NASA/GSFC、Reto Stockli / Earth Observatory。其余是本期基础程序示意材质，不是实时观测。所有天体表面朝向尚未接入姿态历表；星空为静态装饰。本期不含卫星、小行星带或环系。</p>`;
 const asset=scene.visuals.info(selected);
 if(asset){$('source-content').innerHTML=$('source-content').innerHTML.split('<p>地球影像：')[0]+`<p><strong>视觉资产 ${asset.version}</strong><br>${asset.albedo.title}<br>观测：${asset.albedo.observationEpoch}<br>来源：<a href="${asset.albedo.sourceUrl}" target="_blank" rel="noreferrer">${asset.albedo.provider} ↗</a><br>${asset.albedo.credit}<br>${asset.albedo.rights}</p><p>处理：${asset.albedo.processing} / ${asset.albedo.primeMeridianOrOrientationNotes}</p><p>${asset.limitations.join('<br>')}</p><p>${asset.visualEnhancements.join('<br>')}</p><p>全清单：<a href="/assets/celestial/manifest.json" target="_blank">资产来源、哈希与投影</a>。姿态来自NAIF pck00011；IAU_EARTH是通用模型，非高精度EOP。视觉图层、曝光与补光不修改星历、半径或时间。</p>`;}
 $('source-content').innerHTML+='<p>星空：<a href="https://svs.gsfc.nasa.gov/4851/" target="_blank">NASA SVS Deep Star Maps 2020</a>，NASA/GSFC SVS / Ernie Wright；来自恒星目录的天球图。HDR 压缩与显示亮度为观察增强，不用于导航。近期轨迹显示当前时间前后约半个平均公转周期，受星历窗截断；历史全窗显示 2024–2031 年全部路径，均不强行闭合。<a href="/assets/sky/source.json" target="_blank">星空处理与哈希</a></p>';
 if(asset){const extra=[...(asset.additionalSources??[]),...(asset.radarSource?[asset.radarSource]:[])];$('source-content').innerHTML+=extra.map(s=>`<p><strong>${s.title}</strong><br><a href="${s.sourceUrl}" target="_blank" rel="noreferrer">${s.provider} ↗</a><br>${s.observationEpoch}<br>${s.credit}<br>${s.rights}<br>${s.processing}</p>`).join('');}
 const rings=ringSystems[selected];if(rings)$('source-content').innerHTML+=`<p><strong>环系（${rings.bands.length} 条）</strong><br><a href="${rings.url}" target="_blank" rel="noreferrer">NASA NSSDCA 行星环资料表 ↗</a>：半径、宽度、法向光学厚度、反照率。亮度 ∝ 光学厚度 × 反照率；比像素窄的环按像素宽度绘制并等比降低亮度。${scene.visuals.options.enhancements?`当前为增强显示：亮度 ×${ringGain(selected,true).toPrecision(3)}，最暗淡的窄环保留最小可见线（真实亮度远低于此）。`:'当前为真实相对亮度（以反照率 0.5 表面为参照）。'}${rings.notes}</p>`;
 $<HTMLDialogElement>('source-dialog').showModal();
}
function jump(ms:number){try{clock.jump(ms,performance.now());states=provider.all(time.utcToTdb(clock.utcMs));$<HTMLInputElement>('date').value=new Date(ms).toISOString().slice(0,19);updateUI();notify('日期已更新 · 所有天体共用同一 TDB 时刻');}catch(e){notify((e as Error).message);}}
async function boot(){
 try{
  const buffers=new Map<string,Float64Array>();
  await Promise.all(manifest.objects.map(async meta=>{const response=await fetch(meta.file);if(!response.ok)throw new Error(`星历加载失败 ${meta.id}`);const bytes=await response.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==meta.sha256)throw new Error(`星历完整性检查失败 ${meta.id}`);buffers.set(meta.id,new Float64Array(bytes));}));
  provider=new EphemerisProvider(manifest,buffers);states=provider.all(time.utcToTdb(clock.utcMs));
  orientation=new BodyOrientation();await orientation.load();
  scene=new SolarSystemScene($('scene'),$('labels'),provider,orientation);scene.onSelect=select;
  // Phase 7: one quality tier for every WebGL view; only the drawing-buffer pixel ratio changes.
  quality=new QualityController(r=>{for(const x of [scene,localSystem,moonInspector,satelliteDiagnostic] as any[])if(x?.renderer){x.renderer.setPixelRatio(r);x.resize?.();}});
  $<HTMLSelectElement>('quality').onchange=()=>{quality!.setMode($<HTMLSelectElement>('quality').value as 'auto'|QualityTier);notify(`画质：${$<HTMLSelectElement>('quality').selectedOptions[0].textContent} · 仅改变渲染分辨率，不改变任何科学状态`);};
  scene.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();clock.play(false,performance.now());notify('图形上下文已丢失，请刷新重新加载');});
  $('scene').addEventListener('asset-error',()=>notify('地球地图加载失败 · 当前为明确标注的程序占位'));
  for(const b of catalog){const el=document.createElement('button');el.className='catalog-item';el.dataset.id=b.id;el.innerHTML=`<span class="planet-icon" style="background-image:url('${scene.thumbnails.get(b.id)}')"></span><span><strong>${b.zh}</strong><small>${b.en}</small></span><span class="id">${b.id}</span>`;el.setAttribute('aria-label',`选择${b.zh}`);el.onclick=()=>select(b.id);el.ondblclick=()=>select(b.id,true);$('catalog').append(el);}
  $('search').addEventListener('input',()=>{const q=$<HTMLInputElement>('search').value.trim().toLowerCase();let count=0;document.querySelectorAll<HTMLElement>('#catalog .catalog-item').forEach(el=>{const b=catalog.find(b=>b.id===el.dataset.id)!;el.hidden=!`${b.id}${b.zh}${b.en.toLowerCase()}`.includes(q);if(!el.hidden)count++;});
   const moons=q?moonIndex.filter(m=>`${m.id}${m.zh}${m.en.toLowerCase()}`.includes(q)):[];$('moon-results').replaceChildren(...moons.map(m=>{const b=document.createElement('button');b.className='catalog-item moon-result';b.dataset.moonId=m.id;b.innerHTML=`<span><strong>${m.zh}</strong><small>${m.en} · ${catalog.find(p=>p.id===m.parent)!.zh}的卫星</small></span><span class="id">${m.id}</span>`;b.setAttribute('aria-label',`进入${m.zh}所在卫星系统并聚焦`);b.onclick=()=>void enterSystem(m.parent,m.id);return b;}));
   const smalls=q&&smallBodies?smallBodies.searchIndex().filter(m=>`${m.id}${m.zh}${m.en.toLowerCase()}`.includes(q)):[];
   $('moon-results').append(...smalls.map(m=>{const b=document.createElement('button');b.className='catalog-item small-result';b.dataset.smallBody=m.id;b.innerHTML=`<span><strong>${m.zh}</strong><small>${m.en} · ${m.kind}</small></span><span class="id">${m.id}</span>`;b.setAttribute('aria-label',`选择${m.zh}`);b.onclick=()=>selectSmallBody(m.id);b.ondblclick=()=>smallBodies!.onFocus(m.id);return b;}));
   $('no-results').hidden=count+moons.length+smalls.length>0;});
  for(const id of ['home','overview'])$(id).onclick=()=>{scene.overview();notify('返回太阳系总览');};
  $('inner').onclick=()=>{scene.inner();notify('纵深视角 · 真实位置不变，视野外天体不强行入镜');};
  $('sat-data').onclick=openSatelliteDiagnostics;
  $('workbench-button').onclick=()=>void openWorkbench();$('lab-button').onclick=()=>void openLab();
  $('enter-system').onclick=()=>void enterSystem(selected);
  $('moon-bench-button').onclick=openMoonAssets;
  for(const id of ['focus','enter-body'])$(id).onclick=()=>{scene.focus(selected);notify(`聚焦${catalog.find(b=>b.id===selected)!.zh}`);};
  $('trail-mode').onchange=()=>{scene.trails.mode=$<HTMLSelectElement>('trail-mode').value as TrailMode;$('trail-caption').textContent=scene.trails.mode==='history'?'历史全窗轨迹 · 2024–2031':scene.trails.mode==='off'?'轨迹已关闭':'近期星历轨迹 · 单周期邻域';notify('轨迹仅为已保存星历路径，显示选择不改变天体状态');};
  $('paths').onclick=()=>{pathsVisible=!pathsVisible;$('paths').setAttribute('aria-pressed',String(pathsVisible));$('paths').innerHTML=`◌ <span>轨迹${pathsVisible?'已显示':'已隐藏'}</span>`;};
  $('play').onclick=()=>{clock.play(!clock.playing,performance.now());updateUI();};
  $('reset').onclick=()=>{clock.reset(performance.now());jump(clock.utcMs);};
  $('previous').onclick=()=>jump(Math.max(time.startMs,clock.utcMs-86400000));$('next').onclick=()=>jump(Math.min(time.endMs,clock.utcMs+86400000));
  $<HTMLSelectElement>('rate').onchange=()=>{clock.setRate(Number($<HTMLSelectElement>('rate').value),performance.now());notify('倍率已更新 · 指定日期的科学状态不变');};
  $<HTMLInputElement>('timeline').oninput=()=>jump(time.startMs+Number($<HTMLInputElement>('timeline').value)*(time.endMs-time.startMs));
  $<HTMLInputElement>('date').value='2026-10-29T00:00:00';
  $('jump').onclick=()=>{try{let value=$<HTMLInputElement>('date').value;if(value.length===16)value+=':00';jump(time.parse(value+'Z'));}catch(e){notify((e as Error).message);}};
  $('scientific').onclick=()=>{mode='scientific';updateUI();notify('科学比例 · 尺寸与距离统一，使用标签寻找远处行星');};
  $('exploration').onclick=()=>{mode='exploration';updateUI();notify('探索比例 · 尺寸放大、距离压缩，不用于几何量测');};
  $('about').onclick=$('source').onclick=showSources;$('close-dialog').onclick=()=>$<HTMLDialogElement>('source-dialog').close();
  for(const input of document.querySelectorAll<HTMLInputElement>('[data-visual-option]')){const key=input.dataset.visualOption as keyof VisualOptions;input.checked=scene.visuals.options[key];input.onchange=()=>{scene.visuals.options[key]=input.checked;notify('观察图层已更新 · 科学状态保持不变');};}
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-observe]'))button.onclick=()=>{if(!scene.focusedId)scene.focus(selected);scene.observe(button.dataset.observe!);notify('观察视角 · 光源方向仍由真实太阳向量决定');};
  window.addEventListener('resize',()=>{lab?.resize();scene.resize();satelliteDiagnostic?.resize();moonInspector?.resize();localSystem?.resize();});
  window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('workbench').hidden){closeWorkbench();return;}if(e.code==='Escape'&&!$('physics-lab').hidden){closeLab();return;}if((!$('workbench').hidden||!$('physics-lab').hidden)&&!(e.target as HTMLElement).matches('input,select,textarea')&&e.code!=='Space')return;if(localSystem?.open&&!(e.target as HTMLElement).matches('input,select,textarea')){if(e.code==='Escape'){localSystem.focus!=='planet'?localSystem.focusPlanet():exitSystem(false);return;}if(e.code==='KeyF'){if(localSystem.selected)localSystem.focusMoon(localSystem.selected);return;}}if(e.code==='Escape'&&!$('moon-assets').hidden){closeMoonAssets();return;}if(e.code==='KeyF'&&!$('moon-assets').hidden)return;if(e.code==='Escape'&&!$('satellite-diagnostics').hidden){closeSatelliteDiagnostics();return;}if((e.target as HTMLElement).matches('input,select,textarea')||$<HTMLDialogElement>('source-dialog').open)return;if(e.code==='Space'){e.preventDefault();clock.play(!clock.playing,performance.now());}else if(e.code==='KeyF')scene.focus(selected);else if(e.code==='Escape')scene.overview();});
  renderSelection();notify('9 个本体中心 · 本地星历 SHA-256 校验通过');requestAnimationFrame(frame);setTimeout(()=>void startPhase4(),600);
  Object.assign(window,{solarisQA:{quality:()=>quality?.snapshot()??null,workbench:()=>workbench?.snapshot()??null,lab:()=>lab?.snapshot()??null,smallBodies:()=>smallBodies?.snapshot()??null,smallBodyState:(id:string)=>smallEph?{helio:smallEph.heliocentric(id,time.utcToTdb(clock.utcMs)),tdb:time.utcToTdb(clock.utcMs)}:null,localSystem:()=>localSystem?.snapshot()??null,localProfile:()=>localSystem?.profiler.reset(),moonProfile:()=>moonInspector?.profile(),moonAsset:()=>moonInspector?.snapshot()??null,satellites:()=>satelliteEphemeris?{states:satelliteEphemeris.all(time.utcToTdb(clock.utcMs)),absolute:satelliteEphemeris.manifest.objects.map(o=>satelliteEphemeris!.absoluteState(o.id,time.utcToTdb(clock.utcMs))),diagnostic:satelliteDiagnostic?.snapshot()}:null,profile:()=>{scene.profiler.reset();satelliteDiagnostic?.profiler.reset();},performance:()=>({render:scene.profiler.snapshot(),loading:scene.visuals.loadingStats()}),restoreCamera:(camera:number[],target:number[])=>scene.restoreCamera(camera,target),observe:(view:string)=>scene.observe(view),snapshot:()=>({utcMs:clock.utcMs,tdb:time.utcToTdb(clock.utcMs),playing:clock.playing,rate:clock.rate,selected,mode,states:[...states].map(([id,s])=>({id,positionKm:s.positionKm,velocityKmPerSec:s.velocityKmPerSec})),scene:scene.snapshot(),frameTimes:frameTimes.slice(),renderer:scene.renderer.getContext().getParameter(scene.renderer.getContext().RENDERER)})}});
 }catch(e){notify(`初始化失败：${(e as Error).message}；未使用替代轨道`);document.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select').forEach(el=>el.disabled=true);}
}
function frame(now:number){
 if(lastFrame&&document.visibilityState==='visible'){quality?.sample(now-lastFrame);frameTimes.push(now-lastFrame);if(frameTimes.length>600)frameTimes.shift();}lastFrame=now;
 clock.tick(now);states=provider.all(time.utcToTdb(clock.utcMs));smallBodies?.beforeDraw(time.utcToTdb(clock.utcMs),mode,$('scene').clientHeight,scene.externalFocus??scene.focusedId);const localCovering=(localSystem?.open&&!$('planetary-system').classList.contains('entering'))||!$('workbench').hidden||!$('physics-lab').hidden;if($('moon-assets').hidden&&!localCovering)scene.draw(states,mode,selected,now,pathsVisible);
 localSystem?.draw(time.utcToTdb(clock.utcMs),time.format(clock.utcMs),now);lab?.frame();
 if(smallBodies&&!localCovering){const occupied=[...document.querySelectorAll<HTMLElement>('#labels .body-label:not(.small-body-label):not([hidden]),.scene-heading,.scene-tools,#smallbody-layers')].map(l=>{const r=l.getBoundingClientRect(),h=$('scene').getBoundingClientRect();return {x:r.left-h.left,y:r.top-h.top,w:r.width,h:r.height};});smallBodies.afterDraw(time.utcToTdb(clock.utcMs),scene.camera,$('scene').clientWidth,$('scene').clientHeight,scene.externalFocus??scene.focusedId,occupied);}
 satelliteDiagnostic?.draw(time.utcToTdb(clock.utcMs),time.format(clock.utcMs));moonInspector?.draw(time.utcToTdb(clock.utcMs),time.format(clock.utcMs));
 if(now-lastUI>100){updateUI();lastUI=now;const avg=frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length;$('fps').textContent=Number.isFinite(avg)?`${(1000/avg).toFixed(0)} FPS · ${avg.toFixed(1)} ms`:'';}
 requestAnimationFrame(frame);
}
boot();
