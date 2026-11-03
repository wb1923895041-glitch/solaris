import * as THREE from 'three';
import {catalog} from '../science/catalog';
import {axes} from '../science/coordinates';
import {RenderProfiler} from '../render/celestial/profiling';
import type {SatelliteEphemeris,SatelliteMeta} from './ephemeris';
import './diagnostic.css';

/** Read-only 3A verification plot: data markers and ephemeris polylines only.
 * No satellite surface geometry, attitude, focus camera, local exploration or second clock.
 */
export class SatelliteDiagnostic{
 readonly scene=new THREE.Scene();readonly renderer:THREE.WebGLRenderer;readonly profiler:RenderProfiler;
 private camera=new THREE.OrthographicCamera(-150,150,100,-100,.1,2000);
 private parent='599';private layer=new THREE.Group();private pointRows:{meta:SatelliteMeta;point:THREE.Points;label:HTMLElement;leader:SVGLineElement;row:HTMLElement}[]=[];
 private unitKm=1;private centerEpoch=NaN;private lastText=0;private lastTdb=NaN;private epochs:number[][]=[];
 private plot:HTMLElement;private nameHost:HTMLElement;private body:HTMLElement;
 constructor(readonly host:HTMLElement,readonly provider:SatelliteEphemeris){
  host.innerHTML='<div class="sat-head"><div><p class="kicker">SATELLITE EPHEMERIS · 3A</p><h2>天然卫星 · 轨道核验</h2></div><select id="sat-parent" aria-label="卫星轨道核验系统"></select><button id="sat-close" aria-label="关闭卫星核验">×</button></div><p class="sat-disclosure">距离线性映射 · 点仅标记中心，不代表形状或半径 · 共用底部 UTC 时间轴</p><div class="sat-chart"><div class="sat-canvas"></div><div class="sat-names"></div><span class="sat-axis-note">XZ：J2000 黄道面 · Y：黄道北向</span></div><div class="sat-caption"></div><div class="sat-table-wrap"><table><thead><tr><th>卫星 / NAIF</th><th>距行星 km</th><th>相对速度 km/s</th><th>平均半径 km</th><th>星历内核</th></tr></thead><tbody></tbody></table></div><p class="sat-footer">ICRF · TDB · 行星本体中心 · 2024–2031 已核验窗<br>18 颗卫星数据已校验；形状、材质、自转姿态与局部探索尚未实施。<a href="/satellites/manifest.json" target="_blank" rel="noreferrer">来源与处理清单 ↗</a></p>';
  this.plot=host.querySelector('.sat-canvas')!;this.nameHost=host.querySelector('.sat-names')!;this.body=host.querySelector('tbody')!;
  const select=host.querySelector('select')!;for(const id of ['399','499','599','699','799','899']){const b=catalog.find(o=>o.id===id)!;select.add(new Option(b.zh+'系统',id));}select.value=this.parent;select.onchange=()=>{this.parent=select.value;this.centerEpoch=NaN;};
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor('#070e17');this.plot.append(this.renderer.domElement);this.profiler=new RenderProfiler(this.renderer);this.scene.add(this.layer);
 }
 private build(tdb:number){
  this.layer.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)m.dispose();}});this.layer.clear();this.nameHost.replaceChildren();this.body.replaceChildren();this.pointRows=[];this.epochs=[];
  const leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');leaders.classList.add('sat-label-leaders');this.nameHost.append(leaders);
  const bodies=this.provider.manifest.objects.filter(o=>o.parentPlanetId===this.parent).sort((a,b)=>a.characteristicRadiusKm-b.characteristicRadiusKm),tracks=bodies.map(o=>this.provider.track(o.id,tdb));
  const maximum=Math.max(...tracks.flatMap(track=>track.map(s=>Math.hypot(...s.positionKm))));this.unitKm=maximum/95;
  const grid=new THREE.GridHelper(220,10,'#233646','#15232f');this.layer.add(grid);
  const north=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),95,'#637c92',6,3);this.layer.add(north);
  const parent=catalog.find(o=>o.id===this.parent)!;
  this.layer.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(parent.radiusKm/this.unitKm,24,16)),new THREE.LineBasicMaterial({color:'#59778d',transparent:true,opacity:.3})));
  const center=document.createElement('span');center.className='sat-parent-label';center.textContent=parent.zh+' · 本体中心';center.dataset.center='true';this.nameHost.append(center);
  const colors=['#dec38d','#a9cbd9','#9bb5a4','#b3a5c5','#b0b8c3'];
  bodies.forEach((meta,i)=>{
   const coords=tracks[i].flatMap(s=>axes(s.positionKm).map(v=>v/this.unitKm)),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));this.layer.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:colors[i],transparent:true,opacity:.55})));
   this.epochs.push(tracks[i].map(s=>s.timeTdb));
   const point=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3)),new THREE.PointsMaterial({color:colors[i],size:7,sizeAttenuation:false,depthTest:false}));this.layer.add(point);
   const label=document.createElement('span');label.textContent=meta.zh+' / '+meta.name;label.style.color=colors[i];this.nameHost.append(label);
   const leader=document.createElementNS('http://www.w3.org/2000/svg','line');leader.setAttribute('stroke',colors[i]);leaders.append(leader);
   const row=document.createElement('tr');for(let j=0;j<5;j++)row.append(document.createElement('td'));row.children[0].textContent=meta.zh+' / '+meta.id;row.children[3].textContent=meta.physical.radiusKm.toLocaleString('en-US');row.children[4].textContent=meta.solution;this.body.append(row);this.pointRows.push({meta,point,label,leader,row});
  });
  this.centerEpoch=tdb;this.resize();
 }
 resize(){const w=this.plot.clientWidth,h=this.plot.clientHeight;if(w<=0||h<=0)return;this.renderer.setSize(w,h);const aspect=w/h;this.camera.left=-125*aspect;this.camera.right=125*aspect;this.camera.top=125;this.camera.bottom=-125;this.camera.position.set(130,165,200);this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();}
 draw(tdb:number,utc:string){
  if(this.host.hidden)return;
  const minimum=Math.min(...this.provider.manifest.objects.filter(o=>o.parentPlanetId===this.parent).map(o=>o.sampledMeanPeriodDays*86400));
  if(!Number.isFinite(this.centerEpoch)||Math.abs(tdb-this.centerEpoch)>minimum/4)this.build(tdb);
  this.lastTdb=tdb;const width=this.plot.clientWidth,height=this.plot.clientHeight;
  const center=new THREE.Vector3().project(this.camera),parentLabel=this.nameHost.querySelector<HTMLElement>('[data-center]')!,cx=(center.x*.5+.5)*width+8,cy=(-center.y*.5+.5)*height+10;parentLabel.style.transform=`translate(${cx}px,${cy}px)`;
  const occupied=[{x:cx,y:cy,w:parentLabel.offsetWidth,h:parentLabel.offsetHeight}];
  for(const {meta,point,label,leader,row} of this.pointRows){const state=this.provider.relativeState(meta.id,tdb),p=new THREE.Vector3(...axes(state.positionKm)).divideScalar(this.unitKm);point.position.copy(p);const projected=p.project(this.camera),px=(projected.x*.5+.5)*width,py=(-projected.y*.5+.5)*height,lw=label.offsetWidth,lh=label.offsetHeight;
   const options=[0,-32,32,-64,64,-96,96,-128,128,-160,160].map(dy=>({x:px+12,y:py-12+dy,w:lw,h:lh}));
   const box=options.find(a=>a.x>=0&&a.x+a.w<width&&a.y>=0&&a.y+a.h<height&&!occupied.some(b=>a.x<b.x+b.w+5&&a.x+a.w+5>b.x&&a.y<b.y+b.h+4&&a.y+a.h+4>b.y))??options[0];occupied.push(box);label.style.transform=`translate(${box.x}px,${box.y}px)`;leader.setAttribute('x1',String(px));leader.setAttribute('y1',String(py));leader.setAttribute('x2',String(box.x));leader.setAttribute('y2',String(box.y+lh/2));
   if(performance.now()-this.lastText>100){row.children[1].textContent=Math.hypot(...state.positionKm).toFixed(2);row.children[2].textContent=Math.hypot(...state.velocityKmPerSec).toFixed(5);}
  }
  if(performance.now()-this.lastText>100){this.host.querySelector('.sat-caption')!.textContent=`${utc} · 每场景单位 ${this.unitKm.toFixed(2)} km · 轨迹为本历表单周期邻域采样，受覆盖边界截断`;this.lastText=performance.now();}
  this.profiler.begin();this.renderer.render(this.scene,this.camera);this.profiler.end();
 }
 snapshot(){return {parent:this.parent,visible:!this.host.hidden,tdb:this.lastTdb,unitKm:this.unitKm,trackEpochs:this.epochs,markers:this.pointRows.map(r=>({id:r.meta.id,point:r.point.position.toArray(),state:this.provider.relativeState(r.meta.id,this.lastTdb)})),performance:this.profiler.snapshot(),geometryCount:this.renderer.info.memory.geometries,textureCount:this.renderer.info.memory.textures};}
}
