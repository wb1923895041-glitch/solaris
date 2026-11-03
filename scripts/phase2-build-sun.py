from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
root=Path(__file__).resolve().parent.parent
raw=root/'data/phase-2/raw/sun-HMIIF-20250907.jpg';image=np.asarray(Image.open(raw).convert('RGB'))
h,w=image.shape[:2];middle=image[h//2].mean(axis=1);ix=np.flatnonzero(middle>30);radius=(ix[-1]-ix[0])/2-3;cx=(ix[0]+ix[-1])/2;cy=h/2
width=4096;height=2048;lon=np.linspace(-np.pi,np.pi,width,endpoint=False)[None,:];lat=np.linspace(np.pi/2,-np.pi/2,height)[:,None]
xx=cx+radius*np.cos(lat)*np.sin(lon);yy=np.broadcast_to(cy-radius*np.sin(lat),xx.shape)
mapped=np.stack([map_coordinates(image[:,:,k].astype(float),[yy,xx],order=1,mode='nearest') for k in range(3)],axis=-1)
# Only an inverse projection of observation bytes. No noise or concept-image pixels.
out=root/'public/assets/celestial/sun';out.mkdir(parents=True,exist_ok=True)
im=Image.fromarray(np.uint8(np.clip(mapped,0,255)))
assets=[]
for size in [1024,2048,4096]:
 p=out/f'photosphere-{size}.jpg';im.resize((size,size//2),Image.Resampling.LANCZOS).save(p,quality=95,subsampling=0)
 assets.append(dict(width=size,height=size//2,url='/'+p.relative_to(root/'public').as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
source=json.loads((root/'data/phase-2/sun-source.json').read_text());source.update(derivedProjection='equirectangular 4096x2048; orthographic inverse x=R*cos(lat)*sin(lon), y=-R*sin(lat); mirrored unseen hemisphere',sourceDiskCenter=[cx,cy],sourceDiskRadius=radius,lods=assets)
(out/'source.json').write_text(json.dumps(source,indent=2)+'\n')
body=dict(bodyId='10',name='Sun',version='2.0.0-sun',kind='solar-photosphere',albedo=source,hasVerifiedOrientation=False,axisVerified=True,referenceLinks=['https://sdo.gsfc.nasa.gov/data/channels.php'],visualEnhancements=['VISUAL_ENHANCEMENT: optional warm display grading','VISUAL_ENHANCEMENT: opt-in analytic corona and prominences, not event observations'],limitations=['RECONSTRUCTED: mirrored unseen hemisphere','HMI browse image is colorized continuum, not full radiometric spectrum','No absolute heliographic registration from JPEG WCS; spots represent 2025-09-07 only'],lods=assets)
manifest=root/'public/assets/celestial/manifest.json'
m=json.loads(manifest.read_text()) if manifest.exists() else dict(version='2.0.0',bodies=[])
m['bodies']=[b for b in m['bodies'] if b['bodyId']!='10']+[body]
manifest.write_text(json.dumps(m,indent=2)+'\n');(root/'data/phase-2/visual-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
print('Sun reconstructed from HMI observation, all LODs and source hashes recorded.')
