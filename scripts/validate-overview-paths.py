from pathlib import Path
import numpy as np,json,math
r=Path(__file__).resolve().parent.parent;m=json.loads((r/'data/phase-1/manifest.json').read_text());data={o['id']:np.fromfile(r/'public'/o['file'].lstrip('/'),dtype='<f8').reshape(-1,7) for o in m['objects']};rotation=np.array(m['displayFrame']['icrfToEclipJ2000']);axes=np.array([[1,0,0],[0,0,1],[0,-1,0]])@rotation
def state(id,t):
 a=data[id];i=min(len(a)-2,max(0,np.searchsorted(a[:,0],t,side='right')-1));x,y=a[i],a[i+1];dt=y[0]-x[0];u=(t-x[0])/dt
 return (2*u**3-3*u*u+1)*x[1:4]+(u**3-2*u*u+u)*dt*x[4:7]+(-2*u**3+3*u*u)*y[1:4]+(u**3-u*u)*dt*y[4:7]
rows=[]
for s in json.loads((r/'data/overview-repair/path-fixtures.json').read_text()):
 for path in s['scene']['trails']['paths']:
  assert path['positionBufferVersion']==0
  for sample in path['samples']:
   p=axes@(state(path['id'],sample['tdb'])-state('10',sample['tdb']));distance=np.linalg.norm(p)
   expected=p/(149597870.7/52) if s['mode']=='scientific' else p*(52*np.log1p(distance/(.35*149597870.7))/distance)
   error=np.linalg.norm(expected-np.array(sample['point']));assert error<1e-7,(path['id'],error)
   rows.append(dict(id=path['id'],mode=s['mode'],tdb=sample['tdb'],bufferReconstructionErrorSceneUnits=float(error)))
report=dict(cases=len(rows),maxBufferErrorSceneUnits=max(x['bufferReconstructionErrorSceneUnits'] for x in rows),staticBufferVersionsUnchanged=True,skyProjection=dict(RA0=[.5,.5],RA6h=[.25,.5],RA12h=[0,.5],RA18h=[.75,.5],northV=1,southV=0),method='Independent Python Hermite interpolation from frozen .f64 states, SSB Sun subtraction, display mapping; compared against actual browser high+low vertex buffers',rows=rows)
(r/'docs/overview-b/path-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS',len(rows),'actual browser-buffer cases; maximum scene-unit reconstruction error',report['maxBufferErrorSceneUnits'])
