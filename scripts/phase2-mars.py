exec((__import__('pathlib').Path(__file__).parent/'phase2-assets-lib.py').read_text())
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
sources={
'mars-viking.jpg':'https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg',
'mars-height.img':'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img'}
with ThreadPoolExecutor(max_workers=2) as ex:paths=list(ex.map(lambda kv:fetch(*kv),sources.items()))
Image.MAX_IMAGE_PIXELS=None
p=paths[0];im=Image.open(p);native=im.size;im.draft('RGB',(8192,4096));im=im.convert('RGB');ls=lods('mars',im)
h=np.frombuffer(paths[1].read_bytes(),dtype='>i2').reshape(2880,5760).astype(float);h=np.roll(h,2880,axis=1)
# Actual DEM, 3.705km spatial sampling; no albedo-to-height inference.
height=(h+8177)/(21171+8177);out=ROOT/'public/assets/celestial/mars';hs=[]
for n in [1024,2048,4096]:
 fp=out/f'mola-height-{n}.png';Image.fromarray(np.uint8(np.clip(height*255,0,255))).resize((n,n//2),Image.Resampling.BILINEAR).save(fp)
 hs.append(dict(width=n,height=n//2,url='/'+fp.relative_to(ROOT/'public').as_posix(),sha256=hashlib.sha256(fp.read_bytes()).hexdigest()))
s=source('NASA Viking / USGS Astrogeology','Viking MDIM 2.1 colorized global mosaic','https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m','Viking era; colorized product 2009-02-02','NASA Ames / USGS Astrogeology','1km JPEG downsampled to 4K; preserved low-saturation scientific colorization, no noise detail',p,'USGS planetocentric east-positive -180..180, north up; MOLA 0..360 shifted by 180 deg')
s['nativeSize']=native
dem=dict(provider='NASA / MGS MOLA / PDS Geosciences',title='MOLA MEGDR median topography 16 pixels/degree',sourceUrl=sources['mars-height.img'],observationEpoch='1999-02 through 2001-06; polar observations from 1998',credit='MGS MOLA Team / David E. Smith, GSFC',rights='NASA PDS science data',processing='MSB int16 meters, 5760x2880, east-positive 0..360; 180deg wrap; 8-bit display height maps -8177..21171m; physical bump range / 3389.5km',sha256=hashlib.sha256(paths[1].read_bytes()).hexdigest(),label='data/phase-2/raw/mars-height.lbl')
commit('mars',dict(bodyId='499',name='Mars',version='2.0.0-mars',kind='viking-mola-rock',roughness=.98,albedo=s,lods=ls,heightLods=hs,bumpScale=29348/3389500,additionalSources=[dem],atmosphere=dict(radius=1.007,tint='#af7856',strength=.23),hasVerifiedOrientation=True,axisVerified=True,visualEnhancements=['VISUAL_ENHANCEMENT: thin approximate dust scattering; not selected-date dust weather'],limitations=['Viking imagery is a colorized composite, not calibrated surface reflectance','MOLA bump mapping affects normals only; no mesh displacement or crater detail below 3.705km sampling','Height display quantization about 115m; reference IAU2000 grid attached to current generic IAU attitude','Fixed observed polar caps and atmosphere, no seasonal frost simulation']))
print('Mars built',native,'DEM range',h.min(),h.max())
