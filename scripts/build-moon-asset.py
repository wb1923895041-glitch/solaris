"""First independent 3B asset: source-derived LROC/LOLA Moon, no generated map."""
from pathlib import Path
from datetime import datetime,timezone
import requests,json,hashlib
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

r=Path(__file__).resolve().parent.parent;raw=r/'data/phase-3b/raw';dest=r/'public/assets/moons/301';dest.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def fetch(name,url):
 p=raw/name
 if not p.exists():
  print('FETCH',name,flush=True);resp=requests.get(url,timeout=180);resp.raise_for_status();p.write_bytes(resp.content);(raw/(name+'.source.json')).write_text(json.dumps(dict(url=url,sha256=sha(p),retrievedAtUtc=datetime.now(timezone.utc).isoformat()),indent=2)+'\n')
 return p
url='https://svs.gsfc.nasa.gov/4720/';color=fetch('moon-lroc-2025-4k.tif','https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif');height=fetch('moon-ldem16-uint.tif','https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif')
image=Image.open(color).convert('RGB');lods=[]
for width in [1024,2048,4096]:
 p=dest/f'albedo-{width}.jpg';image.resize((width,width//2),Image.Resampling.LANCZOS).save(p,quality=96,subsampling=0);lods.append(dict(width=width,height=width//2,url='/assets/moons/301/'+p.name,sha256=sha(p)))
h=np.array(Image.open(height),dtype=np.float32)*.0005-10
assert np.isfinite(h).all() and -12<float(h.min())<0 and 0<float(h.max())<13,(h.min(),h.max())
# Mesh vertices lie on longitudes/latitudes, while the source raster samples
# pixel centres. Sample those coordinates explicitly, including the wrap seam.
gx=np.arange(513,dtype=float)/512*h.shape[1]-.5
gy=np.clip(np.arange(257,dtype=float)/256*h.shape[0]-.5,0,h.shape[0]-1)
yy,xx=np.meshgrid(gy,gx,indexing='ij')
grid=map_coordinates(h,[yy,xx],order=1,mode='grid-wrap').astype('<f4')
grid[:,-1]=grid[:,0];grid[0,:]=np.mean(h[0]);grid[-1,:]=np.mean(h[-1])
p=dest/'height-grid.f32';p.write_bytes(grid.tobytes())
# High-frequency relief residual complements the displacement mesh rather than
# applying the same low-frequency terrain slope a second time.
full=Image.fromarray(h).resize((4096,2048),Image.Resampling.BILINEAR)
ry,rx=np.meshgrid((np.arange(2048)+.5)/2048*256,(np.arange(4096)+.5)/4096*512,indexing='ij')
low=map_coordinates(grid,[ry,rx],order=1,mode='nearest')
residual=np.asarray(full)-low;amplitude=float(np.max(np.abs(residual)));bump=dest/'relief-residual.png';Image.fromarray(np.uint8(np.clip((residual/amplitude*.5+.5)*255,0,255))).save(bump)
meta=dict(naifId='301',displayNameZh='月球',displayNameEn='Moon',parentPlanetId='399',version='3b-moon-v1',kind='lro-terrain',shapeType='displaced-sphere',meanRadiusKm=1737.4,geometrySource=dict(title='LRO LOLA gridded elevation, 2019 release',provider='NASA/GSFC LOLA / SVS',uri=url,rights='NASA media usage guidelines; retain credit NASA/GSFC/SVS, LROC and LOLA science teams'),albedo=dict(title='2025 CGI Moon Kit LROC Hapke-normalized WAC rendering adaptation',provider='NASA/GSFC SVS / LROC ASU',uri=url,downloadUrl=json.loads((raw/(color.name+'.source.json')).read_text())['url'],rawPath=color.relative_to(r).as_posix(),rawSha256=sha(color),observationEpoch='LRO historical composite; 2025 display adaptation',rights='NASA media usage guidelines; no endorsement; credit NASA/SVS/Ernie Wright and LROC/LOLA teams',licenseUrl='https://www.nasa.gov/nasa-brand-center/images-and-media/',colorProcessing='NASA 643/566/415 nm display composite, source white balance/inpainting retained; 16-bit sRGB TIFF decoded to RGB8, JPEG LOD only',projection='equirectangular, north up, zero longitude at centre, east-positive',processingCategory='OBSERVED_COMPOSITE_RENDER_ADAPTED'),lods=lods,geometry=dict(file='/assets/moons/301/height-grid.f32',sha256=sha(p),width=513,height=257,unit='km above 1737.4 km reference sphere',rawPath=height.relative_to(r).as_posix(),rawSha256=sha(height),minHeightKm=float(h.min()),maxHeightKm=float(h.max())),relief=dict(file='/assets/moons/301/'+bump.name,sha256=sha(bump),residualHalfRangeKm=amplitude),material=dict(roughness=1.0,metalness=0,tint='#ffffff'),meshFrame='sphere-y-up',orientationModel='IAU_GENERIC_APPROX',surfaceRegistration='VERIFIED_GRID_CONVENTION_NOT_NAVIGATION',reconstructionNotes='NASA source colour data beyond ±70 latitude is filled from monochrome LOLA albedo; high-latitude dropouts are source inpainting. Approximately 6% of surface uses polar substitute. No current terrain or weather claim.',visualEnhancements=['NASA source exposure/white-balance display processing','No relief exaggeration; geometric elevation in original km','Optional dim fill light must be labelled display enhancement'],limitations=['Generic IAU lunar orientation, not precision lunar binary PCK','Colour data is an aesthetic NASA rendering adaptation, not radiometric science data','Geometric mesh is downsampled from 16 pixels/degree LOLA; sub-grid relief shown as a residual bump'],verifiedAt=datetime.now(timezone.utc).isoformat())
meta['reconstructionNotes']='LROC 观测拼图与 LOLA 实测高程。NASA 源图将 ±70° 以外的部分颜色用单色反照率替代，约占表面 6%；保留并明确标注原始填补范围。'
meta['albedo']['colorProcessing']='643/566/415 nm 波段显示合成；保留 NASA 的白平衡、曝光和缺口填补；16 位 sRGB 转为 RGB8 与 JPEG LOD，不声称辐射定标数据。'
meta['visualEnhancements']=['保留 NASA 显示用曝光与白平衡','高程使用原始 km，不夸大地形','可选观察补光，默认关闭']
meta['limitations']=['通用 IAU 月球姿态；不是高精度月球二进制 PCK','NASA 显示适配影像，不用于辐射测量','网格下采样自 16 像素/度 LOLA；更细起伏使用高频残差凹凸映射']
(dest/'config.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');manifest=dest.parent/'manifest.json';items=json.loads(manifest.read_text(encoding='utf-8'))['bodies'] if manifest.exists() else [];items=[x for x in items if x['naifId']!='301']+[meta];manifest.write_text(json.dumps(dict(version='3b-v1',bodies=items),ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Moon asset built',image.size,'LOLA km',h.min(),h.max(),'residual',amplitude,flush=True)
