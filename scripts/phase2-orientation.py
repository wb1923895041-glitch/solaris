"""Visual-only IAU orientation cache; never reads PCK radii into physical catalog."""
from pathlib import Path
import json,hashlib,requests
import numpy as np
import spiceypy as spice
from scipy.spatial.transform import Rotation,Slerp
root=Path(__file__).resolve().parent.parent
raw=root/'data/phase-2/raw';raw.mkdir(parents=True,exist_ok=True)
out=root/'public/assets/celestial/orientation';out.mkdir(parents=True,exist_ok=True)
url='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc'
pck=raw/'pck00011.tpc'
if not pck.exists():
 r=requests.get(url,timeout=90);r.raise_for_status();pck.write_bytes(r.content)
spice.furnsh(str(root/'data/phase-1/raw/naif0012.tls'));spice.furnsh(str(pck))
m=json.loads((root/'data/phase-1/manifest.json').read_text())
ids=[('10','SUN'),('199','MERCURY'),('299','VENUS'),('399','EARTH'),('499','MARS'),('599','JUPITER'),('699','SATURN'),('799','URANUS'),('899','NEPTUNE')]
meta=dict(sourceUrl=url,pckSha256=hashlib.sha256(pck.read_bytes()).hexdigest(),toolkit=spice.tkvrsn('TOOLKIT'),model='IAU body-fixed frames, generic PCK; Earth is approximate IAU_EARTH, not high precision EOP',startTdb=m['startTdb'],endTdb=m['endTdb'],stepSeconds=3600,format='little-endian Float32 XYZW quaternion from IAU to ICRF/J2000-aligned axes',objects=[])
times=m['startTdb']+np.arange(int(np.ceil((m['endTdb']-m['startTdb'])/3600))+1)*3600
errors=[]
for id,name in ids:
 matrices=np.array([spice.pxform('IAU_'+name,'J2000',float(t)) for t in times])
 q=Rotation.from_matrix(matrices).as_quat();sign=np.where(np.einsum('ij,ij->i',q[1:],q[:-1])<0,-1,1);q[1:]*=np.cumprod(sign)[:,None]
 q=q.astype('<f4');path=out/f'{id}.f32';path.write_bytes(q.tobytes())
 # Independent off-grid CSPICE orientation checks over same time coverage.
 rng=np.random.default_rng(int(id)+2042);tests=rng.uniform(times[0],m['endTdb'],50)
 estimate=Slerp(times,Rotation.from_quat(q.astype(float)))(tests)
 actual=Rotation.from_matrix(np.array([spice.pxform('IAU_'+name,'J2000',float(t)) for t in tests]))
 error=np.degrees((estimate.inv()*actual).magnitude())
 assert error.max()<.005,(id,error.max())
 meta['objects'].append(dict(bodyId=id,frame='IAU_'+name,file=f'/assets/celestial/orientation/{id}.f32',count=len(q),sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
 errors.append(dict(bodyId=id,offGridSamples=50,maxAngleDegrees=float(error.max())))
 print(name,len(q),'max deg',error.max(),flush=True)
(out/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
(root/'data/phase-2/orientation-manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
(root/'docs/phase-2/orientation-validation.json').write_text(json.dumps(errors,indent=2)+'\n')
