"""Phase 4: named small bodies (JPL Horizons vectors) and anonymous SBDB orbit populations.

Serial requests; every raw response archived with its exact query and SHA-256; cached queries are
never silently changed. Held-out TLIST samples never enter the interpolation grid. Populations are
osculating SBDB elements without identities (the phase-0 `illustrative-population` rule): their
positions use two-body propagation and are labelled as such, never as precise ephemerides.
"""
from pathlib import Path
from datetime import datetime, timezone
import csv, io, json, hashlib, re, time
import numpy as np
import requests
import spiceypy as spice

ROOT=Path(__file__).resolve().parent.parent
RAW=ROOT/'data/phase-4/raw';OUT=ROOT/'public/smallbodies';DOC=ROOT/'data/phase-4'
for p in [RAW,OUT,DOC]:p.mkdir(parents=True,exist_ok=True)
HORIZONS='https://ssd.jpl.nasa.gov/api/horizons.api';SBDB='https://ssd-api.jpl.nasa.gov/sbdb.api';QUERY='https://ssd-api.jpl.nasa.gov/sbdb_query.api'
SESSION=requests.Session()
# id, Horizons COMMAND, name token in the target header, zh, class, centre, grid hours, SBDB designation for physical data
BODIES=[('2000001','1;','Ceres','谷神星','dwarf-planet','0',24,'1'),('2000002','2;','Pallas','智神星','asteroid','0',24,'2'),('2000004','4;','Vesta','灶神星','asteroid','0',24,'4'),
 ('2000010','10;','Hygiea','健神星','asteroid','0',24,'10'),('2000016','16;','Psyche','灵神星','asteroid','0',24,'16'),('2000433','433;','Eros','爱神星','near-earth','0',6,'433'),
 ('2101955','101955;','Bennu','贝努','near-earth','0',6,'101955'),('2099942','99942;','Apophis','阿波菲斯','near-earth','0',.75,'99942'),
 ('999','999','Pluto','冥王星','dwarf-planet','0',6,'134340'),('2136199','136199;','Eris','阋神星','dwarf-planet','0',120,'136199'),('2136108','136108;','Haumea','妊神星','dwarf-planet','0',120,'136108'),
 ('2136472','136472;','Makemake','鸟神星','dwarf-planet','0',120,'136472'),('2486958','486958;','Arrokoth','阿罗科斯','kuiper-belt','0',120,'486958'),
 ('901','901','Charon','卡戎','satellite','999',2,None)]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,o):p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def fetch(url,params,path,check):
    req=path.with_suffix('.request.json')
    if path.exists():
        assert json.loads(req.read_text(encoding='utf-8'))['params']==params,f'Refuse changed cache query {path}'
        return json.loads(path.read_text(encoding='utf-8'))
    print('FETCH',path.name,flush=True)
    for attempt in range(4):
        try:
            time.sleep(.4);r=SESSION.get(url,params=params,timeout=300);r.raise_for_status();payload=r.json();check(payload)
            path.write_bytes(r.content);write(req,dict(url=r.url,params=params,retrievedAtUtc=datetime.now(timezone.utc).isoformat()));return payload
        except (requests.RequestException,AssertionError,ValueError) as e:
            if attempt==3:raise
            print('retry',e,flush=True);time.sleep(3)
def vectors(body,suffix,extra):
    id,command,name,zh,kind,center,hours,des=body
    values=dict(COMMAND=command,EPHEM_TYPE='VECTORS',CENTER='500@'+center,REF_SYSTEM='ICRF',REF_PLANE='FRAME',OUT_UNITS='KM-S',TIME_TYPE='TDB',VEC_TABLE=2,VEC_CORR='NONE',CSV_FORMAT='YES',VEC_LABELS='YES',OBJ_DATA='YES',CAL_TYPE='GREGORIAN',**extra)
    params={k:"'"+str(v)+"'" for k,v in values.items()};params['format']='json'
    payload=fetch(HORIZONS,params,RAW/f'{id}-{suffix}.json',lambda p:'$$SOE' in p.get('result','') or (_ for _ in ()).throw(AssertionError(str(p)[:400])))
    text=payload['result'];header=re.search(r'Target body name:\s*(.+)',text)[1]
    assert name in header,(id,header)
    assert re.search(r'Center body name:\s*'+('Solar System Barycenter \\(0\\)' if center=='0' else 'Pluto \\(999\\)'),text),(id,'center')
    for token in ['Reference frame : ICRF','Output units    : KM-S','GEOMETRIC cartesian states','JDTDB']:assert token in text,(id,token)
    a=np.array([[(float(r[0])-2451545)*86400]+[float(x) for x in r[2:8]] for r in csv.reader(io.StringIO(text.split('$$SOE')[1].split('$$EOE')[0].strip()))],dtype='<f8')
    assert np.isfinite(a).all() and a.shape[1]==7
    path=RAW/f'{id}-{suffix}.json';src=re.search(r'Target body name:.*?\{source: ([^}]+)\}',text)
    return a,dict(rawPath=path.relative_to(ROOT).as_posix(),rawSha256=sha(path),solution=src[1] if src else header.strip(),targetHeader=header.strip(),apiVersion=payload['signature']['version'],retrievedAtUtc=json.loads(path.with_suffix('.request.json').read_text(encoding='utf-8'))['retrievedAtUtc'])
def physical(des):
    if des is None:return None
    p=fetch(SBDB,{'sstr':des,'phys-par':'1'},RAW/f'sbdb-{des}.json',lambda p:'object' in p or (_ for _ in ()).throw(AssertionError(str(p)[:300])))
    out={'fullName':p['object']['fullname'],'orbitClass':p['object'].get('orbit_class',{}).get('name'),'source':'JPL SBDB API '+p['signature']['version']}
    for item in p.get('phys_par',[]):
        if item['name'] in ('diameter','GM','albedo','rot_per','H','extent'):out[item['name']]=dict(value=item['value'],sigma=item.get('sigma'),units=item.get('units'),reference=item.get('ref'))
    # Full-precision osculating elements (the default response rounds to 3 significant figures).
    orbit=fetch(SBDB,{'sstr':des,'full-prec':'1'},RAW/f'sbdb-orbit-{des}.json',lambda p:'orbit' in p or (_ for _ in ()).throw(AssertionError(str(p)[:300])))
    out['orbitRawPath']=f'data/phase-4/raw/sbdb-orbit-{des}.json';out['orbitEpochJd']=float(orbit['orbit']['epoch'])
    return out
POP_FIELDS='a,e,i,om,w,ma,epoch'
def population(name,cdata=None,cls=None):
    params={'fields':POP_FIELDS,'sb-kind':'a','full-prec':'1'}
    if cdata:params['sb-cdata']=json.dumps(cdata,separators=(',',':'))
    if cls:params['sb-class']=cls
    if name=='mainbelt':params['sb-ns']='n'
    p=fetch(QUERY,params,RAW/f'population-{name}.json',lambda p:p.get('count',0)>0 or (_ for _ in ()).throw(AssertionError(str(p)[:300])))
    assert p['fields']==POP_FIELDS.split(','),p['fields']
    rows=[r for r in p['data'] if all(v not in (None,'') for v in r)];dropped=len(p['data'])-len(rows)
    a=np.array([[float(v) for v in r] for r in rows],dtype='<f8');return a,p,dropped
def main():
    lsk=ROOT/'data/phase-1/raw/naif0012.tls';spice.furnsh(str(lsk))
    start=spice.str2et('2024-01-01T00:00:00');end=spice.str2et('2031-01-01T00:00:00')
    gm=float(re.search(r'GM, km\^3/s\^2\s*=\s*([0-9.]+)',json.loads((ROOT/'data/phase-1/raw/10-grid.json').read_text(encoding='utf-8'))['result'])[1])
    rng=np.random.default_rng(4401);fixed=['2025-01-01T00:00:00','2026-08-01T00:00:00','2030-01-01T00:00:00']
    utc=fixed+[spice.et2utc(float(t),'ISOC',3) for t in rng.uniform(start,end,45)]
    flyby=[spice.et2utc(float(spice.str2et('2029-04-13T21:46:00')+h*3600),'ISOC',3) for h in range(-12,13,2)]
    manifest=dict(version='phase4-v1',frame='ICRF',referencePlane='FRAME',correction='NONE',positionUnit='km',velocityUnit='km/s',timeScale='TDB',startTdb=start,endTdb=end,objects=[])
    validation=dict(objects=[])
    for body in BODIES:
        id,command,name,zh,kind,center,hours,des=body
        a,meta=vectors(body,'grid',dict(START_TIME='2023-12-31' if hours<=24 else '2023-12-25',STOP_TIME='2031-01-02' if hours<=24 else '2031-01-10',STEP_SIZE=f'{hours} h' if hours>=1 else f'{round(hours*60)} m'))
        assert np.allclose(np.diff(a[:,0]),hours*3600) and a[0,0]<start and a[-1,0]>end
        file=OUT/f'{id}.f64';file.write_bytes(a.tobytes())
        times=utc+(flyby if id=='2099942' else [])
        b,vmeta=vectors(body,'validation',dict(TLIST=' '.join(f'{2451545+spice.str2et(t)/86400:.9f}' for t in times),TLIST_TYPE='JD'))
        validation['objects'].append(dict(id=id,**vmeta,rows=b.tolist()))
        manifest['objects'].append(dict(id=id,name=name,zh=zh,kind=kind,centerId=center,file=f'/smallbodies/{id}.f64',sha256=sha(file),count=len(a),stepSeconds=hours*3600,coverageTdb=[float(a[0,0]),float(a[-1,0])],physical=physical(des),**meta))
        print(name,len(a),'grid',len(b),'held-out',meta['solution'],flush=True)
    write(OUT/'manifest.json',manifest);write(DOC/'manifest.json',manifest);write(DOC/'validation.json',validation)
    # Populations: anonymous osculating elements (heliocentric ecliptic J2000), Float32 runtime layout.
    pops={}
    for name,cdata,cls,label in [('mainbelt',{'AND':['H|LT|15','a|LT|5.5']},None,'已编号小行星 H<15、a<5.5 au（含主带、Hilda、木星特洛伊）'),('tno',None,'TNO','全部已登记海王星外天体（含观测选择偏差）')]:
        el,payload,dropped=population(name,cdata,cls)
        a,e,i,om,w,ma,epoch=el.T;deg=np.pi/180;n=np.sqrt(gm/(a*149597870.7)**3)*86400  # rad/day
        rows=np.stack([a,e,i*deg,om*deg,w*deg,ma*deg,n,epoch-2451545.0],axis=1).astype('<f4')
        file=OUT/f'{name}.f32';file.write_bytes(rows.tobytes())
        pops[name]=dict(file=f'/smallbodies/{name}.f32',sha256=sha(file),count=len(rows),droppedIncomplete=dropped,columns=['aAu','e','iRad','nodeRad','periRad','meanAnomalyRad','meanMotionRadPerDay','epochDaysFromJ2000TDB'],frame='heliocentric ecliptic J2000 (SBDB osculating)',label=label,query=payload['signature'],rawPath=f'data/phase-4/raw/population-{name}.json',rawSha256=sha(RAW/f'population-{name}.json'),
            epochRangeJd=[float(epoch.min()),float(epoch.max())],identities='omitted in runtime file (illustrative-population layer)',propagation='two-body Kepler from each epoch with GM_sun; not a precise ephemeris',gmSunKm3s2=gm)
        print(name,len(rows),'rows',dropped,'dropped',flush=True)
    write(OUT/'populations.json',pops);write(DOC/'populations.json',pops)
    print('phase-4 data complete')
if __name__=='__main__':main()
