"""Visual attitude caches only; reuse the frozen LSK/PCK and 3A coverage."""
from pathlib import Path
import json,hashlib,sys
import numpy as np
import spiceypy as spice
from scipy.spatial.transform import Rotation,Slerp

r=Path(__file__).resolve().parent.parent;out=r/'public/assets/moons/orientation';out.mkdir(parents=True,exist_ok=True);docs=r/'docs/phase-3b';docs.mkdir(exist_ok=True)
m=json.loads((r/'data/phase-3a/manifest.json').read_text(encoding='utf-8'));pck=r/'data/phase-2/raw/pck00011.tpc';spice.furnsh(str(r/'data/phase-1/raw/naif0012.tls'));spice.furnsh(str(pck))
meta=dict(sourceUrl='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',pckSha256=hashlib.sha256(pck.read_bytes()).hexdigest(),toolkit=spice.tkvrsn('TOOLKIT'),model='IAU generic PCK: visual attitude approximation, not high precision lunar binary-PCK physical libration or surface registration',startTdb=m['startTdb'],endTdb=m['endTdb'],format='little-endian Float32 XYZW, body-fixed IAU XYZ to ICRF/J2000-aligned axes',objects=[])
results=[];fixtures=[]
for o in m['objects']:
 frame='IAU_'+o['name'].upper();rng=np.random.default_rng(31000+int(o['id']))
 for step in [3600,1800,900,450]:
  times=m['startTdb']+np.arange(int(np.ceil((m['endTdb']-m['startTdb'])/step))+1)*step
  matrices=np.array([spice.pxform(frame,'J2000',float(t)) for t in times]);quats=Rotation.from_matrix(matrices).as_quat();q=quats.astype('<f4');path=out/(o['id']+'.f32')
  tests=np.r_[rng.uniform(m['startTdb'],m['endTdb'],64),times[rng.integers(0,len(times)-2,64)]+step*.5]
  actual=np.array([spice.pxform(frame,'J2000',float(t)) for t in tests]);estimate=Slerp(times,Rotation.from_quat(q.astype(float)))(tests)
  error=np.degrees((estimate.inv()*Rotation.from_matrix(actual)).magnitude());maximum=float(error.max())
  if maximum<.005:break
 assert maximum<.005,(o['id'],maximum)
 path.write_bytes(q.tobytes());meta['objects'].append(dict(bodyId=o['id'],frame=frame,quality='IAU_GENERIC_APPROX',file='/assets/moons/orientation/'+path.name,stepSeconds=step,count=len(q),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),maxInterpolationAngleDegrees=maximum))
 results.append(dict(id=o['id'],name=o['name'],stepSeconds=step,samples=len(tests),maxAngleDegrees=maximum))
 fixtures.extend(dict(id=o['id'],tdb=float(t),bodyToIcrf=mat.tolist()) for t,mat in zip(tests,actual))
 print(o['name'],'step',step,'max deg',maximum,flush=True)
(out/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');(r/'data/phase-3b/orientation-manifest.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');(docs/'orientation-validation.json').write_text(json.dumps(dict(results=results,fixtures=fixtures),indent=2)+'\n',encoding='utf-8');print('PASS all 18 IAU attitude caches; no orbital data modified',flush=True)
