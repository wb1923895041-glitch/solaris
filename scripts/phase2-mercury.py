from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
r=Path(__file__).resolve().parent.parent
raw=r/'data/phase-2/raw/mercury-mono-nasa.jpg'
# Observed enhanced-color MDIS mosaic luminance; not a DEM or natural-color measurement.
a=np.asarray(Image.open(raw).convert('RGB')).astype(float)
gray=a@np.array([.2126,.7152,.0722]); gray=np.roll(gray,2048,axis=1)
rgb=np.stack([gray*1.02,gray,gray*.96],axis=-1)
out=r/'public/assets/celestial/mercury';out.mkdir(parents=True,exist_ok=True)
lods=[]
for n in [1024,2048,4096]:
 p=out/f'mdis-{n}.jpg';Image.fromarray(np.uint8(np.clip(rgb,0,255))).resize((n,n//2),Image.Resampling.LANCZOS).save(p,quality=95)
 lods.append(dict(width=n,height=n//2,url='/'+p.relative_to(r/'public').as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
s=dict(provider='NASA / MESSENGER MDIS',title='PIA17386 enhanced-color global map: luminance reconstruction',sourceUrl='https://science.nasa.gov/photojournal/enhanced-color-mercury-map/',downloadUrl='https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/p/i/a/1/PIA17386-1.jpg',observationEpoch='MESSENGER orbital mosaic, released 2013-07-18',credit='NASA / Johns Hopkins University Applied Physics Laboratory / Carnegie Institution of Washington',rights='NASA mission imagery; credit retained',processing='4096x2048 observed enhanced-color map converted to luminance; restrained gray-brown display tint; no fabricated elevation',primeMeridianOrOrientationNotes='180-degree wrap from 0..360 to -180..180. Cross-check with USGS MDIS reference has correlation 0.256; absolute feature longitude NOT certified.',sha256=hashlib.sha256(raw.read_bytes()).hexdigest(),lods=lods)
(out/'source.json').write_text(json.dumps(s,indent=2))
b=dict(bodyId='199',name='Mercury',version='2.0.0-mercury',kind='mdis-airless-regolith',roughness=.98,albedo=s,hasVerifiedOrientation=False,axisVerified=True,lods=lods,referenceLinks=['https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_mosaic_250m'],visualEnhancements=['VISUAL_ENHANCEMENT: restrained gray-brown tint, not calibrated natural RGB'],limitations=['RECONSTRUCTED: luminance of enhanced-color MDIS map, not a monochromatic photometric albedo map','Source mosaic contains baked illumination; no DEM/bump has been fabricated','Absolute longitude registration remains unverified; pole and rotation use IAU PCK'])
p=r/'public/assets/celestial/manifest.json';m=json.loads(p.read_text());m['bodies']=[x for x in m['bodies'] if x['bodyId']!='199']+[b];p.write_text(json.dumps(m,indent=2));(r/'data/phase-2/visual-manifest.json').write_text(json.dumps(m,indent=2))
print('Mercury: real MDIS feature map, three LODs; no atmosphere or fake height.')
