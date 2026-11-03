from pathlib import Path
import json,datetime,hashlib
import spiceypy as sp
r=Path(__file__).resolve().parent.parent
lsk=next((r/'data').rglob('naif0012.tls'));sp.furnsh(str(lsk));epoch=sp.str2et('2026 OCT 29 00:00:00 UTC')
p=r/'public/assets/celestial/manifest.json';m=json.loads(p.read_text())
descriptions={
'10':'SDO/HMI 光球观测快照，保留暗斑和米粒组织。日冕、日珥为可关闭的观察增强。',
'199':'MESSENGER 实测全球拼接呈现撞击坑与喷射纹。默认灰褐色亮度重建，无可见厚大气。',
'299':'默认显示不透明的淡色酸云顶重建。雷达模式为独立的非可见光地表示意。',
'399':'NASA 地表、独立云壳、薄大气与夜面灯光。云漂移是可关闭的示意，不是天气预测。',
'499':'USGS Viking 全球影像与 MOLA 测绘地形法线，呈现低饱和地貌、极冠与薄雾。',
'599':'Cassini 2000 年云顶快照，云带与大红斑均有观测来源；不代表当前风暴位置。',
'699':'Cassini 云图与 Voyager 环光学厚度数据。主环与赤道同面，阴影随真实太阳方向变化。',
'799':'低对比青绿色甲烷大气重建，IAU 自转轴表达侧躺姿态。保持观测支持的克制细节。',
'899':'依据 2024 年光谱校正的近自然色重建。细微云纹是历史影像，不显示虚构永久暗斑。'}
for b in m['bodies']:
 b['description']=descriptions[b['bodyId']]
 b.setdefault('referenceLinks',[b['albedo']['sourceUrl'],'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc'])
 if b['bodyId']=='399':
  b['cloudEpochTdb']=epoch;b['cloudDriftDegreesPerDay']=3
  b['visualEnhancements']=[x for x in b['visualEnhancements'] if 'cloud advection' not in x]+['VISUAL_ENHANCEMENT: optional UTC/TDB-driven cloud advection +3 degrees/day relative to IAU surface, anchored 2026-10-29; illustrative only, not meteorological data']
  b['limitations']=[x for x in b['limitations'] if 'No fabricated' not in x]+['No fabricated elevation or ocean-wave normal; cloud advection is illustrative and can be frozen']
 records=[b['albedo']]+b.get('additionalSources',[])+([b['radarSource']] if 'radarSource' in b else [])
 for s in records:
  s.setdefault('acquisitionDate',datetime.datetime.now(datetime.timezone.utc).isoformat())
  s.setdefault('projection','equirectangular' if s is b['albedo'] else 'see processing notes')
  s.setdefault('longitudeConvention','east-positive after processing')
  s.setdefault('licenseNotes','https://www.nasa.gov/nasa-brand-center/images-and-media/' if 'CC BY' not in s.get('rights','') else 'https://creativecommons.org/licenses/by/4.0/')
  s.setdefault('processingCategory','reconstruction' if not b['hasVerifiedOrientation'] else 'approx-natural-color')
 if 'oceanSource' in b['albedo']:b['additionalSources']=b.get('additionalSources',[])+[b['albedo']['oceanSource']]
 name={'10':'sun','199':'mercury','299':'venus','399':'earth','499':'mars','599':'jupiter','699':'saturn','799':'uranus','899':'neptune'}[b['bodyId']]
 (r/f'public/assets/celestial/{name}/config.json').write_text(json.dumps(b,indent=2)+'\n')
m['rendering']=dict(colorSpace='albedo sRGB; height, optical depth, roughness, cloud opacity and night masks linear',toneMapping='ACES Filmic',exposure=1.15,bloom=False,lighting='True Sun direction; display irradiance not inverse-square calibrated',lodPixelThresholds=[120,400],lodWidths=[1024,2048,4096],scientificRestorePoint='8d3cb15c817d39796ebdb373f33417400cd76955')
p.write_text(json.dumps(m,indent=2)+'\n');(r/'data/phase-2/visual-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
print('9 independent body configs; provenance normalized; cloud demo anchored',epoch)
