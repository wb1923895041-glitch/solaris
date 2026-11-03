exec((__import__('pathlib').Path(__file__).parent/'phase2-assets-lib.py').read_text())
from bs4 import BeautifulSoup
u='https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/'
q=requests.get(u,timeout=40);q.raise_for_status();(ROOT/'data/phase-2/discovery/earth-bmng.html').write_text(q.text,encoding='utf-8')
soup=BeautifulSoup(q.text,'html.parser');links=[a['href'] for a in soup.select('a[href]') if 'world.200407.3x5400x2700.jpg' in a['href']];assert links,'Official BMNG July link not found'
p=fetch('earth-bmng-july.jpg',links[0]);im=Image.open(p).convert('RGB')
base=np.asarray(im).astype(float);oceanMask=base.mean(2)<12
oceanPath=fetch('earth-ocean-2001.jpg','https://assets.science.nasa.gov/content/dam/science/esd/eo/content-feature/bluemarble/images/land_ocean_ice_2048.jpg')
ocean=np.asarray(Image.open(oceanPath).convert('RGB').resize(im.size,Image.Resampling.LANCZOS)).astype(float)
base[oceanMask]=ocean[oceanMask];im=Image.fromarray(np.uint8(base));ls=lods('earth',im)
cp=fetch('earth-clouds.jpg','https://assets.science.nasa.gov/content/dam/science/esd/eo/content-feature/bluemarble/images/cloud_combined_2048.jpg')
npth=fetch('earth-night.jpg','https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg')
cls=lods('earth',Image.open(cp).convert('RGB'),'clouds');nls=lods('earth',Image.open(npth).convert('RGB'),'night')
a=np.asarray(im).astype(float);water=((a[:,:,2]>a[:,:,0]*1.3)&(a[:,:,2]>a[:,:,1]*1.05))|(a.mean(2)<12)
rough=np.where(water|oceanMask,.5,.96);roughim=Image.fromarray(np.uint8(rough*255)).convert('RGB');rls=lods('earth',roughim,'roughness')
s=source('NASA / GSFC Blue Marble Next Generation','July cloud-free land and ocean color',u,'2004-07 monthly composite','NASA Earth Observatory / Reto Stöckli, NASA GSFC','5400x2700 to 4K/2K/1K; no invented detail; water roughness mask inferred from observed blue water colors, not a measured mask',p,'Equirectangular -180..180 east-positive; Greenwich at image center')
cs=source('NASA / GSFC Blue Marble','Independent cloud composite','https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/','2001-era composite: two visible-light days plus polar thermal third day','NASA/GSFC Reto Stöckli; Robert Simmon','Luminance to opacity on independent shell 1.0015 R; fixed snapshot, no invented drift',cp)
s['oceanSource']=source('NASA GSFC Blue Marble','2001 ocean composite',cs['sourceUrl'],'2001','NASA/GSFC Reto Stockli, Robert Simmon','Fills black water pixels of July BMNG with observed ocean color; native 2048px ocean image',oceanPath)
s['processing']+='; black water of BMNG filled with Blue Marble 2001 ocean color; derivative is a mixed-epoch visual composite'
ns=source('NASA / GSFC VIIRS Black Marble','2016 nighttime lights','https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/','2016 annual composite','NASA Earth Observatory; VIIRS / Miguel Román team','3600x1800 grayscale emissive mask, warm display tint, strictly gated to night',npth)
commit('earth',dict(bodyId='399',name='Earth',version='2.0.0-earth',kind='layered-earth-ocean-cloud-night',roughness=1,albedo=s,lods=ls,cloudLods=cls,nightLods=nls,roughnessLods=rls,additionalSources=[cs,ns],atmosphere=dict(radius=1.012,tint='#559ce8',strength=.65),axisVerified=True,hasVerifiedOrientation=True,visualEnhancements=['VISUAL_ENHANCEMENT: analytic thin atmospheric rim, approximate cloud shadows','RECONSTRUCTED: color-classified land/ocean roughness, warm non-radiometric city lights'],limitations=['Surface July 2004, clouds 2001 era, lights 2016: not selected-date weather or population','Cloud source 2048 and night source 3600; 4K derivatives do not add information','Generic IAU_EARTH rotation, no EOP/polar motion','No fabricated elevation or ocean wave normal; land relief baked into source only']))
print('Earth layers built',im.size)
