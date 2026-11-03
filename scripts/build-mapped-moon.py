"""One audited observational mosaic per invocation; no generated terrain."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,sys
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
import spiceypy as spice
Image.MAX_IMAGE_PIXELS=250_000_000
r=Path(__file__).resolve().parent.parent;raw=r/'data/phase-3b/raw';base=r/'public/assets/moons';id=sys.argv[1]
catalog=json.loads((r/'data/phase-3a/manifest.json').read_text(encoding='utf8'));b=next(b for b in catalog['objects'] if b['id']==id);dest=base/id;dest.mkdir(parents=True,exist_ok=True)
specs={
 '501':('io-color-1km.tif','io-usgs.html','NASA Voyager / Galileo / USGS','https://astrogeology.usgs.gov/search/map/io_galileo_ssi_voyager_color_merged_global_mosaic_1km','Galileo SSI / Voyager 1 km colour merge','红外/绿/紫波段颜色比与黑白影像合成；保留源增强色，不声称自然色或实时火山活动。','火山地貌来自历史拼图；两次任务跨越二十余年，部分区域不同时。极区 ±85° 外标记为未测。'),
 '502':('europa-mosaic-500m.tif','europa-usgs.html','NASA Voyager / Galileo / USGS','https://astrogeology.usgs.gov/search/map/Europa/Voyager-Galileo/Europa_Voyager_GalileoSSI_global_mosaic_500m','Voyager / Galileo SSI 500 m monochrome mosaic','保留观测灰度；没有加入虚构的棕红裂纹或全球彩色重建。','南纬 83° 以南没有影像覆盖；两极分辨率较低。裂纹是影像纹理，不是高程测量。'),
 '503':('ganymede-global.tif','ganymede-verified.html','NASA Voyager / Galileo / USGS','https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km','Voyager / Galileo SSI 1435 m colour mosaic','保留 USGS 拼图颜色；只进行投影重采样和显示 LOD 转码。','明暗地质单元、沟槽和撞击坑取自观测拼图；区域分辨率约 400 m 至 20 km，不补造缺失地形。'),
 '504':('callisto-global.tif','callisto-verified.html','NASA Voyager / Galileo / USGS','https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km','Voyager / Galileo SSI 1 km monochrome mosaic','保留观测灰度，不把灰度亮度解释为高程。','多环撞击盆地和密集陨石坑来自历史影像；局部分辨率约 400 m 至 60 km。'),
 '601':('mimas-global.jpg','mimas-product.html','NASA/JPL-Caltech/SSI / Paul Schenk, LPI','https://science.nasa.gov/photojournal/color-maps-of-mimas-2014/','Cassini ISS 2014 global mosaic / PIA18437','保留源 IR-Green-UV 增强色；超出人眼波段，不声称自然色。','Herschel 撞击坑来自 Cassini 拼图；采用 PCK 三轴外形，没有虚构陨石坑高程。'),
 '602':('enceladus-global.jpg','enceladus-product.html','NASA/JPL-Caltech/SSI / Paul Schenk, LPI','https://science.nasa.gov/photojournal/color-maps-of-enceladus-2014/','Cassini ISS 2014 global mosaic / PIA18435','保留源 IR-Green-UV 增强色；蓝色冰纹是波段增强，不是人眼颜色。','南极虎纹来自观测拼图；羽流仅为可开关的示意教学层（默认关闭，位置取南极虎纹区），不代表任一时刻的喷发观测。'),
 '605':('rhea-global.jpg','rhea-product.html','NASA/JPL-Caltech/SSI / Paul Schenk, LPI','https://science.nasa.gov/photojournal/color-maps-of-rhea-2014/','Cassini ISS 2014 global mosaic / PIA18438','保留源 IR-Green-UV 增强色；超出人眼波段。','古老撞击坑、高地及明亮射纹来自 Cassini 拼图；无实测全球 DEM，采用 PCK 外形。'),
 '608':('iapetus-global.jpg','iapetus-product.html','NASA/JPL-Caltech/SSI / Paul Schenk, LPI','https://science.nasa.gov/photojournal/color-maps-of-iapetus-2014/','Cassini ISS 2014 global mosaic / PIA18436','保留源 IR-Green-UV 增强色及明暗反照率差异；不是人眼自然色。','Cassini Regio 两色区和赤道山脊来自影像；没有用程序山脉冒充实测高程。'),
 '801':('triton-global.tif','triton-usgs.html','NASA/JPL-Caltech / Paul Schenk, LPI / USGS','https://astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m','Voyager 2 1989 colour mosaic / PIA18668 / USGS 600 m','保留源近自然色拼图；USGS 用邻近像素填补经纬网线的处理已保留并记录，非实时表面。','Voyager 2 仅测绘部分表面；未观测北部明确标记，不补造全球地貌。')
}
for n,name in enumerate(['Ariel','Umbriel','Titania','Oberon','Miranda'],1):
 bid=str(700+n);specs[bid]=(f'uranus-moon-{n}.tif','jpl-uranus.html','NASA Voyager 2 / Caltech-JPL-USGS','https://space.jpl.nasa.gov/tmaps/uranus.html',name+' Voyager 2 grayscale mosaic','保留 Voyager 灰度；未测区使用独立蓝灰标识，不填充虚构坑纹。','源图仅 1440×720，主要覆盖南半球；不放大文件冒充高分辨率。已保留原图缺测掩膜。')
source,page,provider,uri,title,color,notes=specs[id];p=raw/source;im=Image.open(p);sourceSize=im.size;sourceMode=im.mode;w=4096 if im.width>=4096 else im.width;h=w//2
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
lon=-180+(np.arange(w)+.5)*360/w;lat=90-(np.arange(h)+.5)*180/h
tag=im.tag_v2 if hasattr(im,'tag_v2') else {}
if tag.get(33550):
 scale=tag[33550];tie=tag[33922];keys=tag[34735];params=tag[34736];geo={keys[i]:params[keys[i+3]] for i in range(4,len(keys),4) if keys[i+1]==34736}
 radius=geo[2057];central=geo[3088];delta=(lon-central+180)%360-180
 sx=(radius*np.deg2rad(delta)-tie[3])/scale[0]-.5;sy=(tie[4]-radius*np.deg2rad(lat))/scale[1]-.5
 georef=dict(method='GeoTIFF SimpleCylindrical affine inverse at output pixel centres',centralLongitudeEast=central,radiusMeters=radius,pixelScale=scale,tiePoint=tie,sourceMetadataPage=page)
else:
 # Cassini maps: labelled companion sheet reads 360 W on left, 0 W on right.
 # JPL Uranian sheets: zero longitude in centre; verified with Miranda's
 # Elsinore / Arden / Inverness Coronae and Umbriel's Wunda (IAU Gazetteer).
 central=180 if id in ['601','602','605','608'] else 0
 delta=(lon-central+180)%360-180;sx=(delta+180)/360*im.width-.5;sy=(90-lat)/180*im.height-.5
 georef=dict(method='audited equirectangular image grid',centralLongitudeEast=central,sourceMetadataPage=page,longitudeConvention='east positive; zero centred on derived map',verification='Cassini annotated map 360W to 0W' if central==180 else 'NASA PIA18668 / USGS equirectangular' if id=='801' else 'IAU Miranda coronae and Umbriel Wunda landmark comparison')
sy=np.clip(sy,0,im.height-1);yy,xx=np.meshgrid(sy,sx,indexing='ij');a=np.asarray(im)
if a.ndim==2:a=np.repeat(a[:,:,None],3,axis=2)
assert a.shape[2]>=3
image=np.stack([map_coordinates(a[:,:,c],[yy,xx],order=1,mode='grid-wrap') for c in range(3)],axis=-1)
valid=(image.max(axis=2)>0)
if id=='501':valid[np.abs(lat)>85,:]=False
if id=='502':valid[lat<-83,:]=False
if id=='801':valid[lat>45,:]=False # Conservative: northern cap not imaged by Voyager 2.
# Missing coverage has its own visible, flat blue-grey classification. It is
# not interpolated into imaginary terrain or described as observed surface.
image[~valid]=[40,53,67]
derived=Image.fromarray(image);mask=dest/'coverage.png';Image.fromarray(valid.astype('uint8')*255).save(mask)
lods=[]
for size in sorted(set([min(1024,w),min(2048,w),w])):
 f=dest/f'albedo-{size}.jpg';derived.resize((size,size//2),Image.Resampling.LANCZOS).save(f,quality=96,subsampling=0);lods.append(dict(width=size,height=size//2,url='/assets/moons/'+id+'/'+f.name,sha256=sha(f)))
spice.furnsh(str(r/'data/phase-2/raw/pck00011.tpc'));axes=spice.bodvrd(id,'RADII',3)[1].tolist();spice.kclear();missing=float(np.sum((~valid)*np.cos(np.deg2rad(lat))[:,None])/np.sum(np.ones_like(valid)*np.cos(np.deg2rad(lat))[:,None]));limits=['通用 IAU PCK 姿态；历史地图与当前参考经线存在控制网误差，非导航级配准','拼图含原始入射光阴影及接缝；没有从灰度臆造凹凸','固定观察曝光，未模拟完整 Hapke 光度或真实相机辐射定标']
if id in ['701','702','703','704','705']:limits+=['仅 1440 像素源地图；近景细节受原始 Voyager 覆盖限制，北部未测']
asset=dict(naifId=id,displayNameZh=b['zh'],displayNameEn=b['name'],parentPlanetId=b['parentPlanetId'],version='3b-'+id+'-mosaic-v1',kind='cassini-ice' if id in ['601','602','605','608'] else 'voyager-partial' if id.startswith('7') else 'galileo-volcanic' if id=='501' else 'voyager-triton' if id=='801' else 'galileo-ice',shapeType='pck-ellipsoid',meanRadiusKm=b['physical']['radiusKm'],meshFrame='sphere-y-up',geometry=dict(axesKm=axes,source='NAIF pck00011.tpc BODY'+id+'_RADII; retained physical catalog radius'),geometrySource=dict(provider='NASA/NAIF',title='IAU generic PCK triaxial radii',uri='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc'),albedo=dict(title=title,provider=provider,uri=uri,downloadUrl=json.loads((raw/(source+'.source.json')).read_text())['url'],rawPath=p.relative_to(r).as_posix(),rawSha256=sha(p),observationEpoch='Cassini 2004–2014 composite' if id in ['601','602','605','608'] else 'Voyager 2 January 1986' if id.startswith('7') else 'Voyager 2 August 1989' if id=='801' else 'Voyager 1979 / Galileo 1995–2003 composite',rights='NASA/JPL-Caltech/SSI/LPI credit; retain Paul Schenk and mission credits. NASA media guidelines.' if id in ['601','602','605','608','801'] else 'Caltech/JPL/USGS source attribution; original mission and USGS credit. USGS public-domain product, where specified.',colorProcessing=color,projection='Equirectangular: +90 latitude at top; -180 to +180 east longitude; prime meridian in centre',processingCategory='OBSERVED_MONOCHROME' if sourceMode=='L' else 'OBSERVED_ENHANCED_COLOR_COMPOSITE',nativeDimensions=sourceSize),lods=lods,coverage=dict(file='/assets/moons/'+id+'/'+mask.name,sha256=sha(mask),missingSurfaceFraction=missing,display='蓝灰色平整区域 = 未测 / 缺失影像；白色掩膜 = 已有影像，非地形精度保证'),georeferencing=georef,material=dict(roughness=.95 if id=='502' else 1,metalness=0,tint='#ffffff'),orientationModel='IAU_GENERIC_APPROX',surfaceRegistration='GRID_CONVENTION_VERIFIED_NOT_NAVIGATION',reconstructionNotes=notes+' 蓝灰色区域为未测，未加入虚构地貌。',visualEnhancements=['未测区蓝灰色分类标识','固定观察曝光；可选补光默认关闭']+(['南极羽流示意教学层（默认关闭，静态示意）'] if id=='602' else []),limitations=limits,verifiedAt=datetime.now(timezone.utc).isoformat())
(dest/'config.json').write_text(json.dumps(asset,ensure_ascii=False,indent=2)+'\n',encoding='utf8');m=json.loads((base/'manifest.json').read_text(encoding='utf8'));m['bodies']=[a for a in m['bodies'] if a['naifId']!=id]+[asset];(base/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(id,b['name'],'source',sourceSize,'LODs',[x['width'] for x in lods],'missing',missing,'axes km',axes,flush=True)
