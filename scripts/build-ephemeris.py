"""Download serially from JPL, archive complete responses, export Float64 states.
Run with the isolated Python 3.12 environment. Existing raw responses are reused.
No fabricated fallback. Independent TLIST queries never enter the fitting grid.
"""
from pathlib import Path
import csv, io, json, hashlib, re, sys
from datetime import datetime, timezone
import numpy as np
import requests
import spiceypy as spice

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'data/phase-1/raw'
OUT = ROOT / 'public/data'
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
IDS = [(10,'Sun',24),(199,'Mercury',6),(299,'Venus',12),(399,'Earth',12),(499,'Mars',12),(599,'Jupiter',6),(699,'Saturn',6),(799,'Uranus',6),(899,'Neptune',6)]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path, obj): path.write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def get(url, path):
    if not path.exists():
        r=requests.get(url,timeout=120);r.raise_for_status();path.write_bytes(r.content)
    return path
def query(id, name, suffix, extra):
    params={k: "'"+str(v)+"'" for k,v in dict(COMMAND=id,EPHEM_TYPE='VECTORS',CENTER='500@0',REF_SYSTEM='ICRF',REF_PLANE='FRAME',OUT_UNITS='KM-S',TIME_TYPE='TDB',VEC_TABLE=2,VEC_CORR='NONE',CSV_FORMAT='YES',VEC_LABELS='YES',OBJ_DATA='YES',CAL_TYPE='GREGORIAN',**extra).items()}
    params['format']='json'
    path=RAW/f'{id}-{suffix}.json'
    if path.exists():
        saved=json.loads((RAW/f'{id}-{suffix}.request.json').read_text())
        if saved['params']!=params: raise ValueError(f'Cache query mismatch for {path}; preserve old cache and use a new versioned directory.')
    if not path.exists():
        print(f'Fetching {name} {suffix}',flush=True)
        r=requests.get(API,params=params,timeout=180);r.raise_for_status();path.write_bytes(r.content)
        write(RAW/f'{id}-{suffix}.request.json',dict(url=r.url,params=params,retrievedAtUtc=datetime.now(timezone.utc).isoformat()))
    payload=json.loads(path.read_text(encoding='utf-8'))
    result=payload.get('result','')
    if 'error' in payload or '$$SOE' not in result: raise ValueError(f'{path}: {payload}')
    assert re.search(r'Target body name:\s*'+name+r'\s*\('+str(id)+r'\)',result),f'Identity mismatch: {name}'
    for expected in ['Solar System Barycenter (0)','Reference frame : ICRF','Output units    : KM-S','GEOMETRIC cartesian states','JDTDB']:
        assert expected in result,(path,expected)
    rows=[]
    for row in csv.reader(io.StringIO(result.split('$$SOE')[1].split('$$EOE')[0].strip())):
        rows.append([(float(row[0])-2451545.0)*86400]+[float(v) for v in row[2:8]])
    a=np.array(rows,dtype='<f8');assert np.isfinite(a).all() and a.shape[1]==7
    requestPath=RAW/f'{id}-{suffix}.request.json'
    return a,dict(id=str(id),name=name,url=API,query=params,rawPath=path.relative_to(ROOT).as_posix(),rawSha256=sha(path),requestPath=requestPath.relative_to(ROOT).as_posix(),retrievedAtUtc=json.loads(requestPath.read_text())['retrievedAtUtc'],apiVersion=payload['signature']['version'],solution=re.findall(r'Target body name:.*?\{source: ([^}]+)\}',result)[0])

def main():
    lsk=get('https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls',RAW/'naif0012.tls')
    spice.furnsh(str(lsk))
    # Browser uses the same published LSK DELTET formulation. Export parameters, not a guessed offset.
    keys=['DELTA_T_A','K','EB','M','DELTA_AT']
    timeParams={k:spice.gdpool('DELTET/'+k,0,1000).tolist() for k in keys}
    start=spice.str2et('2024-01-01T00:00:00')
    end=spice.str2et('2031-01-01T00:00:00')
    manifest=dict(version='phase1-v1',centerId='0',frame='ICRF',referencePlane='FRAME',correction='NONE',positionUnit='km',velocityUnit='km/s',timeScale='TDB',epochOrigin='J2000_TDB',startUtc='2024-01-01T00:00:00Z',endUtc='2031-01-01T00:00:00Z',startTdb=start,endTdb=end,auKm=149597870.7,auSource='https://iauarchive.eso.org/public/themes/measuring/',time=dict(lsk='naif0012.tls',sha256=sha(lsk),source='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls',spiceypy=spice.__version__,toolkit=spice.tkvrsn('TOOLKIT'),parameters=timeParams,futureLeapSeconds='Unknown; LSK last TAI-UTC value continued. Not a UTC prediction.'),objects=[])
    manifest['byteOrder']='little-endian'
    manifest['displayFrame']=dict(source='CSPICE pxform J2000 -> ECLIPJ2000, then [x,z,-y] for Three.js Y-up',icrfToEclipJ2000=spice.pxform('J2000','ECLIPJ2000',0).tolist())
    dates=['2024-01-01T00:00:00','2024-02-29T12:34:56','2026-10-29T00:00:00','2026-10-29T12:34:56','2030-01-01T00:00:00','2030-08-17T21:43:17']
    # Deterministic extra off-grid dates spanning the full window.
    rng=np.random.default_rng(5701)
    dates += [spice.et2utc(float(t),'ISOC',3) for t in rng.uniform(start,end,42)]
    ets=[float(spice.str2et(d)) for d in dates]
    jd=[f'{2451545+t/86400:.12f}' for t in ets]
    validation=dict(utc=dates,requestedTdb=ets,objects=[],timeFixtures=[])
    for id,name,hours in IDS:
        a,meta=query(id,name,'grid',dict(START_TIME='2023-12-31',STOP_TIME='2031-01-02',STEP_SIZE=f'{hours} h'))
        assert np.all(np.diff(a[:,0])==hours*3600)
        assert a[0,0]<start<end<a[-1,0]
        file=OUT/f'{id}.f64';file.write_bytes(a.tobytes())
        meta.update(file=f'/data/{id}.f64',sha256=sha(file),count=len(a),columns=['tdbSeconds','xKm','yKm','zKm','vxKmPerS','vyKmPerS','vzKmPerS'],stepSeconds=hours*3600,coverageTdb=[float(a[0,0]),float(a[-1,0])])
        manifest['objects'].append(meta)
        b,vmeta=query(id,name,'validation',dict(TLIST=' '.join(jd),TLIST_TYPE='JD'))
        # TLIST response is chronologically sorted; use actual returned epochs for comparisons.
        validation['objects'].append(dict(**vmeta,rows=b.tolist()))
        print(f'{name}: {len(a)} grid states, {len(b)} held-out states; {meta["solution"]}',flush=True)
    for utc in ['2024-01-01T00:00:00','2024-02-29T12:34:56','2026-10-29T00:00:00','2030-01-01T00:00:00','2031-01-01T00:00:00']+dates[6:]:
        validation['timeFixtures'].append(dict(utc=utc+'Z',tdbSeconds=float(spice.str2et(utc))))
    write(OUT/'manifest.json',manifest)
    write(ROOT/'data/phase-1/manifest.json',manifest)
    write(ROOT/'data/phase-1/validation.json',validation)
    # Archive the physical parameter page for independently auditable manual extraction.
    get('https://ssd.jpl.nasa.gov/planets/phys_par.html',RAW/'planetary-physical-parameters.html')
    write(ROOT/'docs/phase-1/data-build-summary.json',dict(objects=9,gridStates=sum(o['count'] for o in manifest['objects']),runtimeBytes=sum((OUT/f'{id}.f64').stat().st_size for id,_,_ in IDS),manifestSha256=sha(OUT/'manifest.json')))
    print('Complete: no network requests needed during playback.',flush=True)
if __name__=='__main__': main()
