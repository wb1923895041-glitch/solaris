import './style.css';
import {catalog,radiusSource} from './science/catalog';
import {EphemerisProvider,relative,type State} from './science/ephemeris';
import {TimeSystem,TimeController} from './science/time';
import {AU_KM,displayRadius,KM_PER_UNIT,type ScaleMode} from './science/coordinates';
import {SolarSystemScene} from './render/scene';
import manifest from '../data/phase-1/manifest.json';
import {BodyOrientation} from './render/celestial/orientation';
import type {VisualOptions} from './render/celestial/system';
import type {TrailMode} from './render/orbit-trails';
import {loadSatellites,type SatelliteEphemeris} from './satellites/ephemeris';
import type {SatelliteDiagnostic} from './satellites/diagnostic';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=$('runtime-status');
let selected='399',mode:ScaleMode='exploration',scene:SolarSystemScene,provider:EphemerisProvider,states:Map<string,State>;
const time=new TimeSystem(manifest.time.parameters,manifest.startUtc,manifest.endUtc);
const clock=new TimeController(time,time.parse('2026-10-29T00:00:00Z'));
let pathsVisible=true,lastUI=0,lastFrame=0;const frameTimes:number[]=[];
let satelliteEphemeris:SatelliteEphemeris|undefined,satelliteDiagnostic:SatelliteDiagnostic|undefined;
function closeSatelliteDiagnostics(){document.getElementById('satellite-diagnostics')!.hidden=true;document.body.classList.remove('satellite-open');$('sat-data').setAttribute('aria-pressed','false');}
async function openSatelliteDiagnostics(){
 const host=$('satellite-diagnostics'),button=$<HTMLButtonElement>('sat-data');
 if(!host.hidden){closeSatelliteDiagnostics();return;}
 button.disabled=true;notify('加载并校验 18 颗卫星数据…');
 try{
  if(!satelliteEphemeris)satelliteEphemeris=await loadSatellites(provider);
  if(!satelliteDiagnostic){const {SatelliteDiagnostic}=await import('./satellites/diagnostic');satelliteDiagnostic=new SatelliteDiagnostic(host,satelliteEphemeris);$('sat-close').onclick=closeSatelliteDiagnostics;}
  host.hidden=false;document.body.classList.add('satellite-open');button.setAttribute('aria-pressed','true');satelliteDiagnostic.resize();notify('3A 只读数据核验 · 无卫星形状、材质或局部探索');
 }catch(e){notify(`卫星数据层未启用：${(e as Error).message}；原太阳系继续运行`);}finally{button.disabled=false;}
}
function notify(message:string){status.textContent=message;}
function select(id:string,focus=false){selected=id;renderSelection();if(focus||scene.focusedId)scene.focus(id);}
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
 $('view-caption').textContent=scene?.focusedId==='399'?'地球探索 · 真实空间参照保留 · 日照来自同一时刻的太阳':scene?.focusedId?'聚焦视图 · 其他天体与轨迹暂隐':mode==='exploration'?'真实日心方向 · 非线性距离 · 尺寸放大':'尺寸与距离统一映射 · 远处小天体以标签定位';
 if(selected==='299'&&scene.visuals.options.radar)$('view-caption').textContent+=' · 雷达示意 / 非可见光';
 $('mode-badge').textContent=mode==='exploration'?'探索比例 · 非真实比例':'科学比例 · 统一长度映射';
 $('mapping-note').textContent=mode==='exploration'?'距离非线性压缩 · 各天体尺寸放大 · 不用于量测':`1 场景单位 = ${(KM_PER_UNIT/1e6).toFixed(3)} 百万 km`;
 $('exploration').setAttribute('aria-pressed',String(mode==='exploration'));$('scientific').setAttribute('aria-pressed',String(mode==='scientific'));
 $('boundary-status').textContent=(clock.utcMs===time.startMs||clock.utcMs===time.endMs)?'已到数据窗边界 · 禁止外推':'数据窗 2024-01-01 — 2031-01-01 UTC';
}
function showSources(){
 const b=catalog.find(b=>b.id===selected)!,meta=manifest.objects.find(o=>o.id===selected)!;
 const gain=displayRadius(b.radiusKm,b.id,'exploration')/(b.radiusKm/KM_PER_UNIT);
 $('source-content').innerHTML=`<p><strong>${b.zh} / ${b.en} · 本体中心 ${b.id}</strong></p><p>原始状态：太阳系质心 0；ICRF / FRAME；几何状态 NONE；km、km/s；TDB 自 J2000 秒。显示时同时减去太阳的位置与速度。解版本：<code>${meta.solution}</code>。</p><p><a href="https://ssd-api.jpl.nasa.gov/doc/horizons.html" target="_blank" rel="noreferrer">JPL Horizons 官方接口 ↗</a> · <a href="${radiusSource}" target="_blank" rel="noreferrer">JPL 行星物理参数 ↗</a></p><p>平均半径：${b.radiusKm} km${b.radiusUncertaintyKm===null?'（太阳采用回包标注的 IAU2015 半径）':` ± ${b.radiusUncertaintyKm} km`}。完整原始回包、查询参数与逐项误差报告随验收包提供。</p><p>本地状态文件 SHA-256：<code>${meta.sha256}</code><br>原始回包 SHA-256：<code>${meta.rawSha256}</code></p><p>探索映射：r′=52·ln(1+r/(0.35 AU))，方向保持；当前天体半径显示增益约 ${gain.toFixed(0)}×。科学模式对所有长度采用同一 km/单位映射；切换不会改动物理状态。</p><p>轨迹来自 2024–2031 年数据窗，未闭合的外行星轨迹保持为弧段。可切换近期邻域与历史全窗；均为历表路径，不是所选日期的瞬时轨道根数。</p><p>时间：naif0012.tls / ${manifest.time.toolkit}；未来闰秒未知，当前沿用最后已知 TAI−UTC，不能用于精确事件预测。数据窗之外明确拒绝查询。</p><p>地球影像：<a href="https://svs.gsfc.nasa.gov/2915" target="_blank" rel="noreferrer">NASA SVS Blue Marble ↗</a>，NASA/GSFC、Reto Stockli / Earth Observatory。其余是本期基础程序示意材质，不是实时观测。所有天体表面朝向尚未接入姿态历表；星空为静态装饰。本期不含卫星、小行星带或环系。</p>`;
 const asset=scene.visuals.info(selected);
 if(asset){$('source-content').innerHTML=$('source-content').innerHTML.split('<p>地球影像：')[0]+`<p><strong>视觉资产 ${asset.version}</strong><br>${asset.albedo.title}<br>观测：${asset.albedo.observationEpoch}<br>来源：<a href="${asset.albedo.sourceUrl}" target="_blank" rel="noreferrer">${asset.albedo.provider} ↗</a><br>${asset.albedo.credit}<br>${asset.albedo.rights}</p><p>处理：${asset.albedo.processing} / ${asset.albedo.primeMeridianOrOrientationNotes}</p><p>${asset.limitations.join('<br>')}</p><p>${asset.visualEnhancements.join('<br>')}</p><p>全清单：<a href="/assets/celestial/manifest.json" target="_blank">资产来源、哈希与投影</a>。姿态来自NAIF pck00011；IAU_EARTH是通用模型，非高精度EOP。视觉图层、曝光与补光不修改星历、半径或时间。</p>`;}
 $('source-content').innerHTML+='<p>星空：<a href="https://svs.gsfc.nasa.gov/4851/" target="_blank">NASA SVS Deep Star Maps 2020</a>，NASA/GSFC SVS / Ernie Wright；来自恒星目录的天球图。HDR 压缩与显示亮度为观察增强，不用于导航。近期轨迹显示当前时间前后约半个平均公转周期，受星历窗截断；历史全窗显示 2024–2031 年全部路径，均不强行闭合。<a href="/assets/sky/source.json" target="_blank">星空处理与哈希</a></p>';
 if(asset){const extra=[...(asset.additionalSources??[]),...(asset.radarSource?[asset.radarSource]:[])];$('source-content').innerHTML+=extra.map(s=>`<p><strong>${s.title}</strong><br><a href="${s.sourceUrl}" target="_blank" rel="noreferrer">${s.provider} ↗</a><br>${s.observationEpoch}<br>${s.credit}<br>${s.rights}<br>${s.processing}</p>`).join('');}
 $<HTMLDialogElement>('source-dialog').showModal();
}
function jump(ms:number){try{clock.jump(ms,performance.now());states=provider.all(time.utcToTdb(clock.utcMs));$<HTMLInputElement>('date').value=new Date(ms).toISOString().slice(0,19);updateUI();notify('日期已更新 · 所有天体共用同一 TDB 时刻');}catch(e){notify((e as Error).message);}}
async function boot(){
 try{
  const buffers=new Map<string,Float64Array>();
  await Promise.all(manifest.objects.map(async meta=>{const response=await fetch(meta.file);if(!response.ok)throw new Error(`星历加载失败 ${meta.id}`);const bytes=await response.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==meta.sha256)throw new Error(`星历完整性检查失败 ${meta.id}`);buffers.set(meta.id,new Float64Array(bytes));}));
  provider=new EphemerisProvider(manifest,buffers);states=provider.all(time.utcToTdb(clock.utcMs));
  const orientation=new BodyOrientation();await orientation.load();
  scene=new SolarSystemScene($('scene'),$('labels'),provider,orientation);scene.onSelect=select;
  scene.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();clock.play(false,performance.now());notify('图形上下文已丢失，请刷新重新加载');});
  $('scene').addEventListener('asset-error',()=>notify('地球地图加载失败 · 当前为明确标注的程序占位'));
  for(const b of catalog){const el=document.createElement('button');el.className='catalog-item';el.dataset.id=b.id;el.innerHTML=`<span class="planet-icon" style="background-image:url('${scene.thumbnails.get(b.id)}')"></span><span><strong>${b.zh}</strong><small>${b.en}</small></span><span class="id">${b.id}</span>`;el.setAttribute('aria-label',`选择${b.zh}`);el.onclick=()=>select(b.id);el.ondblclick=()=>select(b.id,true);$('catalog').append(el);}
  $('search').addEventListener('input',()=>{const q=$<HTMLInputElement>('search').value.trim().toLowerCase();let count=0;document.querySelectorAll<HTMLElement>('.catalog-item').forEach(el=>{const b=catalog.find(b=>b.id===el.dataset.id)!;el.hidden=!`${b.id}${b.zh}${b.en.toLowerCase()}`.includes(q);if(!el.hidden)count++;});$('no-results').hidden=count>0;});
  for(const id of ['home','overview'])$(id).onclick=()=>{scene.overview();notify('返回太阳系总览');};
  $('inner').onclick=()=>{scene.inner();notify('纵深视角 · 真实位置不变，视野外天体不强行入镜');};
  $('sat-data').onclick=openSatelliteDiagnostics;
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
  window.addEventListener('resize',()=>{scene.resize();satelliteDiagnostic?.resize();});
  window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('satellite-diagnostics').hidden){closeSatelliteDiagnostics();return;}if((e.target as HTMLElement).matches('input,select,textarea')||$<HTMLDialogElement>('source-dialog').open)return;if(e.code==='Space'){e.preventDefault();clock.play(!clock.playing,performance.now());}else if(e.code==='KeyF')scene.focus(selected);else if(e.code==='Escape')scene.overview();});
  renderSelection();notify('9 个本体中心 · 本地星历 SHA-256 校验通过');requestAnimationFrame(frame);
  Object.assign(window,{solarisQA:{satellites:()=>satelliteEphemeris?{states:satelliteEphemeris.all(time.utcToTdb(clock.utcMs)),absolute:satelliteEphemeris.manifest.objects.map(o=>satelliteEphemeris!.absoluteState(o.id,time.utcToTdb(clock.utcMs))),diagnostic:satelliteDiagnostic?.snapshot()}:null,profile:()=>{scene.profiler.reset();satelliteDiagnostic?.profiler.reset();},performance:()=>({render:scene.profiler.snapshot(),loading:scene.visuals.loadingStats()}),restoreCamera:(camera:number[],target:number[])=>scene.restoreCamera(camera,target),observe:(view:string)=>scene.observe(view),snapshot:()=>({utcMs:clock.utcMs,tdb:time.utcToTdb(clock.utcMs),playing:clock.playing,rate:clock.rate,selected,mode,states:[...states].map(([id,s])=>({id,positionKm:s.positionKm,velocityKmPerSec:s.velocityKmPerSec})),scene:scene.snapshot(),frameTimes:frameTimes.slice(),renderer:scene.renderer.getContext().getParameter(scene.renderer.getContext().RENDERER)})}});
 }catch(e){notify(`初始化失败：${(e as Error).message}；未使用替代轨道`);document.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select').forEach(el=>el.disabled=true);}
}
function frame(now:number){
 if(lastFrame&&document.visibilityState==='visible'){frameTimes.push(now-lastFrame);if(frameTimes.length>600)frameTimes.shift();}lastFrame=now;
 clock.tick(now);states=provider.all(time.utcToTdb(clock.utcMs));scene.draw(states,mode,selected,now,pathsVisible);
 satelliteDiagnostic?.draw(time.utcToTdb(clock.utcMs),time.format(clock.utcMs));
 if(now-lastUI>100){updateUI();lastUI=now;const avg=frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length;$('fps').textContent=Number.isFinite(avg)?`${(1000/avg).toFixed(0)} FPS · ${avg.toFixed(1)} ms`:'';}
 requestAnimationFrame(frame);
}
boot();
