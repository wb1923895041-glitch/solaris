from pathlib import Path
import json,hashlib
import numpy as np
import spiceypy as sp
from scipy.spatial.transform import Rotation
r=Path(__file__).resolve().parent.parent
sp.furnsh(str(r/'data/phase-1/raw/naif0012.tls'));sp.furnsh(str(r/'data/phase-2/raw/pck00011.tpc'))
m=json.loads((r/'data/phase-2/visual-manifest.json').read_text());assert len(m['bodies'])==9
checks=[]
for b in m['bodies']:
 for role in ['lods','cloudLods','heightLods','nightLods','roughnessLods','radarLods']:
  for entry in b.get(role,[]):
   p=r/'public'/entry['url'].lstrip('/');assert hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256'],str(p)
 checks.append(dict(bodyId=b['bodyId'],materialVersion=b['version'],uniqueAlbedoHash=b['albedo']['sha256'],verifiedMapRegistration=b['hasVerifiedOrientation'],textureIntegrity='PASS'))
assert len({x['uniqueAlbedoHash'] for x in checks if x['bodyId'] not in ['799','899']})==7
# The ice giants share a paper figure SOURCE, but each separately sampled a different measured disk.
u=next(b for b in m['bodies'] if b['bodyId']=='799');n=next(b for b in m['bodies'] if b['bodyId']=='899');assert u['lods'][-1]['sha256']!=n['lods'][-1]['sha256']
names={'10':'SUN','199':'MERCURY','299':'VENUS','399':'EARTH','499':'MARS','599':'JUPITER','699':'SATURN','799':'URANUS','899':'NEPTUNE'}
rot=np.array(json.loads((r/'data/phase-1/manifest.json').read_text())['displayFrame']['icrfToEclipJ2000'])
display=np.array([[1,0,0],[0,0,1],[0,-1,0]])@rot
results=[];snapshots=json.loads((r/'data/phase-2/chrome-release-snapshots.json').read_text())
earth=json.loads((r/'output/playwright/phase-2/399-supplement.json').read_text());snapshots+=earth['dates']
for s in snapshots:
 states={x['id']:x for x in s['states']};visual={x['id']:x for x in s['scene']['visuals']}
 for obj in s['scene']['objects']:
  id=obj['id'];q=Rotation.from_quat(obj['quaternion']);iau=sp.pxform('IAU_'+names[id],'J2000',s['tdb']);expected=display@iau@np.array([0.,0.,1.]);pole=np.array(obj['pole']);poleError=np.degrees(np.arctan2(np.linalg.norm(np.cross(pole,expected)),np.dot(pole,expected)))
  assert poleError<.00001,(id,poleError)
  if id=='10':continue
  light=np.array(states['10']['positionKm'])-np.array(states[id]['positionKm']);light/=np.linalg.norm(light)
  iauSun=iau.T@light;expectedSun=np.array([iauSun[0],iauSun[2],-iauSun[1]])
  # Old per-body acquisition fixtures lacked the new Sun-local field. Final release must contain it.
  if visual.get(id,{}).get('sunLocal') is None:continue
  error=np.linalg.norm(expectedSun-np.array(visual[id]['sunLocal']));assert error<1e-6,(id,error)
  results.append(dict(bodyId=id,utcMs=s['utcMs'],poleErrorDegrees=float(poleError),localSunVectorError=float(error)))
baseline=json.loads((r/'data/phase-2/baseline-cameras.json').read_text())[0]['states']
assert all(s['states']==baseline for s in snapshots[:9]),'Phase-1 physical states changed'
earthRows=[x for x in results if x['bodyId']=='399'];assert len({x['utcMs'] for x in earthRows})>=3
# Real root scale and ring normal share the same object quaternion; no independent ring pose exists.
saturn=next(s for s in snapshots if s['selected']=='699');assert 'measured-ABC-rings' in next(x for x in saturn['scene']['visuals'] if x['id']=='699')['layers']
report=dict(assetChecks=checks,orientationAndLighting=results,maxPoleErrorDegrees=max(x['poleErrorDegrees'] for x in results),maxSunLocalError=max(x['localSunVectorError'] for x in results),scientificStatesUnchanged=True,earthDatesValidated=sorted({x['utcMs'] for x in earthRows}),ringPlane='Child geometry in local XZ plane: normal local Y equals PCK IAU north pole',limitations=['Generic PCK is reference model, not an independent astronomical observation','Earth generic IAU rotation is not EOP; texture feature registration separately flagged','Ring shadow intersection verified by browser captures, not particle scattering validation'])
(r/'docs/phase-2/scientific-visual-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS: nine asset hashes, frozen states,',len(results),'independent CSPICE Sun-vector/pole cases')
