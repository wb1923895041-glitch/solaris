import json
from pathlib import Path
import numpy as np
from PIL import Image
r=Path(__file__).resolve().parent.parent
f=json.loads((r/'data/phase-2/night-gate-fixture.json').read_text());s=f['initial'];b=f['bbox'];a=np.asarray(Image.open(r/'output/playwright/phase-2/night-gate-on.png').convert('RGB')).astype(float);off=np.asarray(Image.open(r/'output/playwright/phase-2/night-gate-off.png').convert('RGB')).astype(float)
obj=next(x for x in s['scene']['objects'] if x['id']=='399');cam=np.array(s['scene']['camera']);center=np.array(obj['position']);target=np.array(s['scene']['target']);radius=obj['radius']
forward=target-cam;forward/=np.linalg.norm(forward);right=np.cross(forward,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,forward)
y,x=np.indices(a.shape[:2]);nx=(x+.5-b['x'])/b['width']*2-1;ny=1-(y+.5-b['y'])/b['height']*2
ray=forward+nx[:,:,None]*np.tan(np.pi/9)*b['width']/b['height']*right+ny[:,:,None]*np.tan(np.pi/9)*up;ray/=np.linalg.norm(ray,axis=2)[:,:,None]
oc=cam-center;bb=np.einsum('ijk,k->ij',ray,oc);cc=np.dot(oc,oc)-radius**2;disc=bb**2-cc;distance=-bb-np.sqrt(np.maximum(disc,0));norm=(oc+distance[:,:,None]*ray)/radius
sun=-center/np.linalg.norm(center);day=np.einsum('ijk,k->ij',norm,sun);changed=np.max(np.abs(a-off),axis=2)>3;inside=(disc>0)&(distance>0)&(x>b['x'])&(x<b['x']+b['width'])&(y>b['y'])&(y<b['y']+b['height'])
litChanged=int((changed&inside&(day>.03)).sum());nightChanged=int((changed&inside&(day<0)).sum());assert litChanged==0,litChanged;assert nightChanged>100,nightChanged
report=dict(utcMs=s['utcMs'],changedPixelsOnDayBeyondTolerance=litChanged,changedPixelsOnNight=nightChanged,dayToleranceNormalDotSun=.03,rgbDifferenceThreshold=3,physicsUnchanged=s['states']==f['after']['states'],sameCamera=s['scene']['camera']==f['after']['scene']['camera'],method='Independent ray-sphere intersections on screenshot pixel grid; world Sun direction from frozen body positions, not shader uniforms',errors=f['errors'])
(r/'docs/phase-2/night-gating-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
