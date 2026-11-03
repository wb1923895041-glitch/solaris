"""Independent Python check of archived 3A vectors and dynamical diagnostics."""
from pathlib import Path
import csv,json,sys,hashlib
import numpy as np
import spiceypy as spice

R=Path(__file__).resolve().parent.parent;D=R/'docs/phase-3a';partial='--partial' in sys.argv;suffix='.partial' if partial else ''
manifest=json.loads((R/f'data/phase-3a/manifest{suffix}.json').read_text(encoding='utf-8'));validation=json.loads((R/f'data/phase-3a/validation{suffix}.json').read_text(encoding='utf-8'));planet=json.loads((R/'data/phase-1/manifest.json').read_text())
arrays={o['id']:np.fromfile(R/'public'/o['file'].lstrip('/'),dtype='<f8').reshape(-1,7) for o in manifest['objects']}
parents={o['id']:np.fromfile(R/'public'/o['file'].lstrip('/'),dtype='<f8').reshape(-1,7) for o in planet['objects']}
def state(a,t):
 i=min(len(a)-2,max(0,np.searchsorted(a[:,0],t,side='right')-1));x,y=a[i],a[i+1];h=y[0]-x[0];u=(t-x[0])/h
 p=(2*u**3-3*u*u+1)*x[1:4]+(u**3-2*u*u+u)*h*x[4:7]+(-2*u**3+3*u*u)*y[1:4]+(u**3-u*u)*h*y[4:7]
 v=(6*u*u-6*u)/h*x[1:4]+(3*u*u-4*u+1)*x[4:7]+(-6*u*u+6*u)/h*y[1:4]+(3*u*u-2*u)*y[4:7]
 return np.r_[p,v]
rows=[];summaries=[];failures=[]
for o in manifest['objects']:
 a=arrays[o['id']];assert hashlib.sha256((R/'public'/o['file'].lstrip('/')).read_bytes()).hexdigest()==o['sha256']
 val=next(v for v in validation['objects'] if v['id']==o['id']);errors=[];speeds=[];global_errors=[]
 for row in val['rows']:
  t=row[0];assert manifest['startTdb']<=t<=manifest['endTdb'];error=state(a,t)-np.array(row[1:]);p=float(np.linalg.norm(error[:3]));v=float(np.linalg.norm(error[3:]));errors.append(p);speeds.append(v)
  entry=dict(id=o['id'],name=o['name'],parent=o['parentPlanetId'],tdbSeconds=t,utc='',fixedDate=any(abs(t-epoch)<.001 for epoch in validation['fixedTdb']),positionErrorKm=p,velocityErrorKmPerSec=v,relativeToCharacteristicRadius=p/o['characteristicRadiusKm'],stepSeconds=o['stepSeconds'])
  actual=state(a,t)
  for k,label in enumerate(['xKm','yKm','zKm','vxKmPerSec','vyKmPerSec','vzKmPerSec']):entry['JPL_'+label]=row[k+1];entry['interpolated_'+label]=float(actual[k])
  rows.append(entry)
 for row in val['globalRows']:
  t=row[0];err=state(a,t)+state(parents[o['parentPlanetId']],t)-np.array(row[1:]);global_errors.append(float(np.linalg.norm(err[:3])))
 summary=dict(id=o['id'],name=o['name'],kernel=o['solution'],samples=len(errors),stepSeconds=o['stepSeconds'],meanPositionKm=float(np.mean(errors)),maxPositionKm=max(errors),meanVelocityKmPerSec=float(np.mean(speeds)),maxVelocityKmPerSec=max(speeds),maxRelativePosition=max(errors)/o['characteristicRadiusKm'],positionBudgetKm=o['characteristicRadiusKm']*1e-4,maxGlobalPositionKm=max(global_errors),passed=max(errors)<o['characteristicRadiusKm']*1e-4)
 summaries.append(summary)
 if not summary['passed']:failures.append(o['id'])
 print(o['name'],len(errors),'max km',summary['maxPositionKm'],'max km/s',summary['maxVelocityKmPerSec'],'PASS' if summary['passed'] else 'FAIL',flush=True)

if partial:raise SystemExit(0 if not failures else 1)
assert len(summaries)==18
spice.furnsh(str(R/'data/phase-1/raw/naif0012.tls'));spice.furnsh(str(R/'data/phase-2/raw/pck00011.tpc'))
for row in rows:row['utc']=spice.et2utc(row['tdbSeconds'],'ISOC',6)+'Z'

# Independent geometric diagnostics; these are measured, not imposed constraints.
t0=float(spice.str2et('2026-01-01'));ts=np.arange(t0,t0+365*86400,7200)
states={id:np.array([state(arrays[id],float(t)) for t in ts]) for id in ['501','502','503','504']}
normal=np.mean(np.cross(states['501'][:,:3],states['501'][:,3:]),axis=0);normal/=np.linalg.norm(normal)
e1=np.array([1.,0,0]);e1-=normal*np.dot(normal,e1);e1/=np.linalg.norm(e1);e2=np.cross(normal,e1)
longitude={id:np.unwrap(np.arctan2(s[:,:3]@e2,s[:,:3]@e1)) for id,s in states.items()}
motion={id:float(np.polyfit((ts-t0)/86400,l,1)[0]) for id,l in longitude.items()}
laplace=longitude['501']-3*longitude['502']+2*longitude['503'];center=np.angle(np.mean(np.exp(1j*laplace)));offset=np.angle(np.exp(1j*(laplace-center)))
resonance=dict(intervalUtc=['2026-01-01','2027-01-01'],samples=len(ts),meanAngularRatesRadPerDay=motion,ioEuropaRatio=motion['501']/motion['502'],europaGanymedeRatio=motion['502']/motion['503'],ioGanymedeRatio=motion['501']/motion['503'],callistoIncluded=False,projectedTrueLongitudeCombination=dict(centerDegrees=float(np.degrees(center)),maxDeviationDegrees=float(np.max(np.abs(np.degrees(offset))))),limitation='Projected true-longitude combination, not filtered osculating mean elements or a long-term stability proof')
assert 1.98<resonance['ioEuropaRatio']<2.04 and 1.98<resonance['europaGanymedeRatio']<2.04 and resonance['projectedTrueLongitudeCombination']['maxDeviationDegrees']<15

def spin_axis(frame,t):
 a=spice.pxform(frame,'J2000',t);b=spice.pxform(frame,'J2000',t+1);w=b@a.T
 axial=np.array([w[2,1]-w[1,2],w[0,2]-w[2,0],w[1,0]-w[0,1]]);return axial/np.linalg.norm(axial)
ecliptic=np.array(planet['displayFrame']['icrfToEclipJ2000']);dynamics=[]
for id in ['301','401','402','705','701','702','703','704','801']:
 a=arrays[id];normals=np.cross(a[::max(1,len(a)//500),1:4],a[::max(1,len(a)//500),4:7]);normals/=np.linalg.norm(normals,axis=1)[:,None];ecliptic_cos=(normals@ecliptic.T)[:,2]
 meta=next(o for o in manifest['objects'] if o['id']==id);frame='IAU_'+{'399':'EARTH','499':'MARS','799':'URANUS','899':'NEPTUNE'}[meta['parentPlanetId']]
 index=np.arange(0,len(a),max(1,len(a)//500));dots=np.array([float(n@spin_axis(frame,float(a[i,0]))) for i,n in zip(index,normals)])
 item=dict(id=id,name=meta['name'],samples=len(index),inclinationToEclipticNorthDegrees=[float(np.min(np.degrees(np.arccos(np.clip(ecliptic_cos,-1,1))))),float(np.max(np.degrees(np.arccos(np.clip(ecliptic_cos,-1,1)))))],angularMomentumDotParentSpin=[float(min(dots)),float(max(dots))]);dynamics.append(item)
 if id=='801':assert max(dots)<0,'Triton must be retrograde relative to Neptune rotation'
 if meta['parentPlanetId']=='799':assert np.max(np.abs(ecliptic_cos))<.35,'Uranian moons must not flatten onto ecliptic'
 if id in ['401','402']:assert min(dots)>0

# Geocentric Moon differs radically from EMB-to-SSB; compare same epoch offsets.
emb=[]
moon=next(v for v in validation['objects'] if v['id']=='301')
for row in validation['earthMoonBarycenter']['rows']:
 t=row[0];earth=state(parents['399'],t);delta=np.array(row[1:4])-earth[:3];local=state(arrays['301'],t)[:3];fraction=float(delta@local/(local@local));perpendicular=float(np.linalg.norm(delta-fraction*local))
 assert .011<fraction<.014 and perpendicular<1,'EMB must be near Earth, not replace geocentre'
 emb.append(dict(tdb=t,earthToEmbKm=float(np.linalg.norm(delta)),fractionAlongEarthToMoon=fraction,perpendicularResidualKm=perpendicular))
report=dict(satellites=18,samples=len(rows),allPositionBudgetsPassed=not failures,failures=failures,summaries=summaries,resonance=resonance,orbitalNormals=dynamics,earthMoonBarycenter=emb,limitations=['Same-source JPL held-out cross-validation, not independent astrometric observations','Cache coverage only 2024–2031 UTC; inherited future-leap-second assumption','Orientation metadata only, no satellite surface or attitude rendering in 3A'])
with (D/'errors.csv').open('w',newline='',encoding='utf-8-sig') as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
with (D/'fixed-dates-errors.csv').open('w',newline='',encoding='utf-8-sig') as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(row for row in rows if row['fixedDate'])
(D/'independent-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if failures:raise SystemExit('FAILED satellites: '+','.join(failures))
print('PASS 18 satellites;',len(rows),'held-out local states; mean-motion resonance, Uranus planes, Triton retrograde, EMB/geocentre distinction')
