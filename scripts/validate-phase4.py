"""Independent phase-4 validation (Python, separate from the browser TypeScript).

1. Named bodies: cubic Hermite interpolation of the runtime grid vs held-out Horizons TLIST states.
2. Population layer: two-body Kepler propagation of SBDB osculating elements vs Horizons for named bodies,
   quantifying how far the anonymous population positions may drift (it is labelled as illustrative).
3. Real distribution structure: Kirkwood gaps, Jupiter trojan clouds near L4/L5, Plutinos at Neptune 3:2.
"""
from pathlib import Path
import json, math
import numpy as np
ROOT=Path(__file__).resolve().parent.parent;D=ROOT/'data/phase-4'
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8'))
man=read(D/'manifest.json');val=read(D/'validation.json');pops=read(D/'populations.json');base=read(ROOT/'data/phase-1/manifest.json')
R=np.array(base['displayFrame']['icrfToEclipJ2000']);AU=149597870.7
def grid(path):return np.fromfile(ROOT/('public'+path),dtype='<f8').reshape(-1,7)
def hermite(a,t):
    i=min(len(a)-2,int((t-a[0,0])//(a[1,0]-a[0,0])));h=a[i+1,0]-a[i,0];u=(t-a[i,0])/h
    p0,p1,v0,v1=a[i,1:4],a[i+1,1:4],a[i,4:7]*h,a[i+1,4:7]*h
    h00,h10,h01,h11=2*u**3-3*u**2+1,u**3-2*u**2+u,-2*u**3+3*u**2,u**3-u**2
    d00,d10,d01,d11=(6*u**2-6*u)/h,(3*u**2-4*u+1)/h,(-6*u**2+6*u)/h,(3*u**2-2*u)/h
    return h00*p0+h10*v0+h01*p1+h11*v1,d00*p0+d10*v0+d01*p1+d11*v1
def kepler(el,jd):
    a,e,i,om,w,ma,n,ep=el;M=ma+n*(jd-2451545.0-ep);E=M
    for _ in range(30):E=E-(E-e*math.sin(E)-M)/(1-e*math.cos(E))
    x,y=a*(math.cos(E)-e),a*math.sqrt(1-e*e)*math.sin(E)
    co,so,ci,si,cw,sw=math.cos(om),math.sin(om),math.cos(i),math.sin(i),math.cos(w),math.sin(w)
    return np.array([(co*cw-so*sw*ci)*x+(-co*sw-so*cw*ci)*y,(so*cw+co*sw*ci)*x+(-so*sw+co*cw*ci)*y,(sw*si)*x+(cw*si)*y])*AU
out=dict(interpolation=[],twoBody=[],structure={})
sun=grid('/data/10.f64');gm=pops['mainbelt']['gmSunKm3s2']
for o,v in zip(man['objects'],val['objects']):
    assert o['id']==v['id'];a=grid(o['file']);rows=np.array(v['rows']);s=[]
    for r in rows:
        if not (a[0,0]<=r[0]<=a[-1,0]):continue
        p,vel=hermite(a,r[0]);s.append((np.linalg.norm(p-r[1:4]),np.linalg.norm(vel-r[4:7])))
    s=np.array(s);scale=np.linalg.norm(rows[:,1:4],axis=1).mean()
    out['interpolation'].append(dict(id=o['id'],name=o['name'],stepHours=o['stepSeconds']/3600,samples=len(s),maxPositionKm=float(s[:,0].max()),meanPositionKm=float(s[:,0].mean()),maxVelocityKmS=float(s[:,1].max()),maxRelative=float(s[:,0].max()/scale)))
    # Two-body check for heliocentric bodies with SBDB osculating elements in the archived SBDB response.
    raw=ROOT/o['physical']['orbitRawPath'] if o['physical'] else None
    if o['centerId']=='0' and raw and raw.exists():
        sb=read(raw)['orbit'];el={x['name']:float(x['value']) for x in sb['elements'] if x['value'] is not None};deg=math.pi/180
        ep=float(sb['epoch']);elements=(el['a'],el['e'],el['i']*deg,el['om']*deg,el['w']*deg,el['ma']*deg,math.sqrt(gm/(el['a']*AU)**3)*86400,ep-2451545.0)
        errs=[]
        for r in rows[3:]:
            sp,_=hermite(sun,r[0]);helio=R@(r[1:4]-sp);errs.append(np.linalg.norm(kepler(elements,2451545+r[0]/86400)-helio))
        out['twoBody'].append(dict(id=o['id'],name=o['name'],epochJd=ep,samples=len(errs),maxKm=float(max(errs)),medianKm=float(np.median(errs)),maxAu=float(max(errs)/AU)))
# Jupiter and Neptune osculating semi-major axes from the phase-1 states (vis-viva, same GM_sun).
def osc_a(id,t):
    g=grid(f'/data/{id}.f64');p,v=hermite(g,t);sp,sv=hermite(sun,t);r=np.linalg.norm(p-sp);vv=np.linalg.norm(v-sv);return 1/(2/r-vv*vv/gm)/AU
t0=(2461000.5-2451545)*86400;aJ=osc_a('599',t0);aN=osc_a('899',t0)
mb=np.fromfile(ROOT/'public/smallbodies/mainbelt.f32',dtype='<f4').reshape(-1,8).astype(float);tno=np.fromfile(ROOT/'public/smallbodies/tno.f32',dtype='<f4').reshape(-1,8).astype(float)
def depletion(a,center,half=.012,flank=(.03,.07)):
    inside=((a>center-half)&(a<center+half)).sum()/(2*half);fl=(((a>center-flank[1])&(a<center-flank[0]))|((a>center+flank[0])&(a<center+flank[1]))).sum()/(2*(flank[1]-flank[0]));return float(inside/fl)
gaps={k:dict(aAu=aJ*r**(2/3),densityRatio=depletion(mb[:,0],aJ*r**(2/3))) for k,r in {'3:1':1/3,'5:2':2/5,'7:3':3/7,'2:1':1/2}.items()}
# Trojans: mean longitude relative to Jupiter at a common epoch.
tro=mb[(mb[:,0]>5.05)&(mb[:,0]<5.35)];jdc=2461000.5
lam=np.mod(tro[:,3]+tro[:,4]+tro[:,5]+tro[:,6]*(jdc-2451545-tro[:,7]),2*np.pi)
g=grid('/data/599.f64');p,_=hermite(g,t0);sp,_=hermite(sun,t0);hj=R@(p-sp);lamJ=math.atan2(hj[1],hj[0])
d=np.degrees(np.angle(np.exp(1j*(lam-lamJ))))
plut=depletion(tno[:,0],aN*1.5**(2/3),half=.25,flank=(.8,1.6))
out['structure']=dict(jupiterOsculatingAAu=aJ,neptuneOsculatingAAu=aN,kirkwoodGaps=gaps,trojans=dict(count=int(len(tro)),fractionNearL4=float(((d>30)&(d<90)).mean()),fractionNearL5=float(((d<-30)&(d>-90)).mean()),fractionWithin30degOfJupiter=float((np.abs(d)<30).mean())),plutinos=dict(aAu=aN*1.5**(2/3),densityRatio=plut),counts=dict(mainbelt=int(len(mb)),tno=int(len(tno))))
# Budgets: interpolation relative error < 1e-7 of the distance scale and < 1 km absolute for heliocentric bodies; gaps depleted; trojans clustered.
fails=[x['name'] for x in out['interpolation'] if not (x['maxRelative']<1e-7 or x['maxPositionKm']<1.0)]
fails+=[k for k,v in gaps.items() if k!='7:3' and v['densityRatio']>.5]  # 7:3 is narrow and weak in real data: reported, not required
if out['structure']['trojans']['fractionWithin30degOfJupiter']>.02 or out['structure']['trojans']['fractionNearL4']+out['structure']['trojans']['fractionNearL5']<.8:fails.append('trojans')
if plut<1.5:fails.append('plutinos')
out['failures']=fails
(ROOT/'docs/phase-4').mkdir(parents=True,exist_ok=True);(ROOT/'docs/phase-4/independent-validation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
for x in out['interpolation']:print(f"{x['name']:9s} step {x['stepHours']:5.0f} h  max {x['maxPositionKm']:.6f} km  rel {x['maxRelative']:.2e}  v {x['maxVelocityKmS']:.2e}")
for x in out['twoBody']:print(f"two-body {x['name']:9s} max {x['maxKm']:.0f} km ({x['maxAu']:.2e} au) median {x['medianKm']:.0f} km")
print(json.dumps(out['structure'],indent=1));print('FAILURES',fails);assert not fails
