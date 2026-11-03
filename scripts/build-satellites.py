"""3A: archived JPL parent-centred vectors, no fitted or decorative orbits.

Serial requests only. Reuses the original LSK and leaves all phase-1 files alone.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import csv, io, json, hashlib, re, time
import numpy as np
import requests
import spiceypy as spice
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent.parent
RAW=ROOT/'data/phase-3a/raw'; OUT=ROOT/'public/satellites'; DOC=ROOT/'data/phase-3a'
for p in [RAW,OUT,DOC]:p.mkdir(parents=True,exist_ok=True)
API='https://ssd.jpl.nasa.gov/api/horizons.api'
SESSION=requests.Session()
# ID, parent BODY CENTER (never the system barycenter), English, Chinese, grid minutes.
SATELLITES=[('301','399','Moon','月球',360),('401','499','Phobos','火卫一',20),('402','499','Deimos','火卫二',60),('501','599','Io','木卫一',60),('502','599','Europa','木卫二',120),('503','599','Ganymede','木卫三',180),('504','599','Callisto','木卫四',360),('601','699','Mimas','土卫一',30),('602','699','Enceladus','土卫二',60),('605','699','Rhea','土卫五',120),('606','699','Titan','土卫六',360),('608','699','Iapetus','土卫八',720),('705','799','Miranda','天卫五',60),('701','799','Ariel','天卫一',120),('702','799','Umbriel','天卫二',180),('703','799','Titania','天卫三',360),('704','799','Oberon','天卫四',360),('801','899','Triton','海卫一',180)]
PARENTS={'399':'Earth','499':'Mars','599':'Jupiter','699':'Saturn','799':'Uranus','899':'Neptune'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,o):p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def query(id,name,parent,suffix,extra):
    values=dict(COMMAND=id,EPHEM_TYPE='VECTORS',CENTER='500@'+parent,REF_SYSTEM='ICRF',REF_PLANE='FRAME',OUT_UNITS='KM-S',TIME_TYPE='TDB',VEC_TABLE=2,VEC_CORR='NONE',CSV_FORMAT='YES',VEC_LABELS='YES',OBJ_DATA='YES',CAL_TYPE='GREGORIAN',**extra)
    params={k:"'"+str(v)+"'" for k,v in values.items()};params['format']='json'
    path=RAW/f'{id}-{suffix}.json';req=RAW/f'{id}-{suffix}.request.json'
    if path.exists():
        assert json.loads(req.read_text(encoding='utf-8'))['params']==params,'Refuse changed cache query'
    else:
        print('FETCH',id,name,suffix,flush=True)
        for attempt in range(3):
            try:
                time.sleep(.3)
                response=SESSION.get(API,params=params,timeout=180);response.raise_for_status()
                payload=response.json();assert '$$SOE' in payload.get('result',''),str(payload)[:500]
                path.write_bytes(response.content);write(req,dict(url=response.url,params=params,retrievedAtUtc=datetime.now(timezone.utc).isoformat()));break
            except (requests.RequestException,AssertionError):
                if attempt==2:raise
                time.sleep(2)
    payload=json.loads(path.read_text(encoding='utf-8'));text=payload['result']
    assert re.search(r'Target body name:\s*'+re.escape(name)+r'\s*\('+id+r'\)',text)
    expected='Solar System Barycenter' if parent=='0' else PARENTS[parent]
    assert re.search(r'Center body name:\s*'+expected+r'\s*\('+parent+r'\)',text)
    for token in ['Reference frame : ICRF','Output units    : KM-S','GEOMETRIC cartesian states','JDTDB']:
        assert token in text,(path,token)
    a=np.array([[(float(row[0])-2451545)*86400]+[float(x) for x in row[2:8]] for row in csv.reader(io.StringIO(text.split('$$SOE')[1].split('$$EOE')[0].strip()))],dtype='<f8')
    assert np.isfinite(a).all() and a.shape[1]==7
    meta=dict(rawPath=path.relative_to(ROOT).as_posix(),rawSha256=sha(path),requestPath=req.relative_to(ROOT).as_posix(),solution=re.search(r'Target body name:.*?\{source: ([^}]+)\}',text)[1],centerSolution=re.search(r'Center body name:.*?\{source: ([^}]+)\}',text)[1],apiVersion=payload['signature']['version'],retrievedAtUtc=json.loads(req.read_text(encoding='utf-8'))['retrievedAtUtc'])
    return a,meta,text

def physical_table():
    page=RAW/'physical.html'
    if not page.exists():
        r=requests.get('https://ssd.jpl.nasa.gov/sats/phys_par/',timeout=60);r.raise_for_status();page.write_bytes(r.content)
    table={}
    for row in BeautifulSoup(page.read_text(encoding='utf-8'),'html.parser').select('tr'):
        cells=[e.get_text(' ',strip=True) for e in row.select('td')]
        if len(cells)>=9 and cells[2] in {s[0] for s in SATELLITES}:
            table[cells[2]]=dict(radiusKm=float(cells[6].split()[0]),radiusUncertaintyKm=float(cells[7].split()[0]),gmKm3PerSec2=float(cells[3].split()[0]),radiusReference=cells[8],gmReference=cells[5],source='https://ssd.jpl.nasa.gov/sats/phys_par/',sourceSha256=sha(page))
    assert len(table)==18
    return table

def main():
    base=json.loads((ROOT/'data/phase-1/manifest.json').read_text());spice.furnsh(str(ROOT/'data/phase-1/raw/naif0012.tls'));spice.furnsh(str(ROOT/'data/phase-2/raw/pck00011.tpc'))
    physical=physical_table();start=base['startTdb'];end=base['endTdb']
    manifest=dict(version='3a-v1',frame='ICRF',referencePlane='FRAME',correction='NONE',positionUnit='km',velocityUnit='km/s',timeScale='TDB',epochOrigin='J2000_TDB',centerPolicy='Per-body parent planet BODY CENTER; global SSB is parentSSB + relativeMoon',startTdb=start,endTdb=end,startUtc=base['startUtc'],endUtc=base['endUtc'],timeSource=dict(lsk=base['time']['lsk'],sha256=base['time']['sha256']),interpolation='Existing phase-1 EphemerisProvider.state cubic Hermite with stored velocities',objects=[])
    fixed=['2025-01-01T00:00:00','2026-08-01T00:00:00','2030-01-01T00:00:00'];ets=[float(spice.str2et(x)) for x in fixed]
    validation=dict(fixedUtc=[x+'Z' for x in fixed],fixedTdb=ets,objects=[])
    grid_start=datetime(2023,12,31);grid_end=datetime(2031,1,2);epoch=datetime(2000,1,1,12)
    for id,parent,name,zh,minutes in SATELLITES:
        step=minutes*60;total=int((grid_end-grid_start).total_seconds()//step)+1;parts=[];sources=[]
        # Shared boundary rows allow integrity checks; the final table deduplicates them.
        for index,first in enumerate(range(0,total-1,30000)):
            last=min(total-1,first+30000);a_time=grid_start+timedelta(seconds=first*step);b_time=grid_start+timedelta(seconds=last*step)
            suffix=f'grid-{minutes}m-{index:02d}'
            # Keep successful cached requests intact; new grids use smaller responses
            # to tolerate upstream/proxy truncation observed with multi-MB queries.
            pieces=[(first,last,suffix)] if (RAW/(id+'-'+suffix+'.json')).exists() else [(lo,min(last,lo+10000),suffix+f'-part-{pi:02d}') for pi,lo in enumerate(range(first,last,10000))]
            for lo,hi,part_suffix in pieces:
                a_time=grid_start+timedelta(seconds=lo*step);b_time=grid_start+timedelta(seconds=hi*step)
                a,source,header=query(id,name,parent,part_suffix,dict(START_TIME=a_time.isoformat(' '),STOP_TIME=b_time.isoformat(' '),STEP_SIZE=f'{minutes} m'))
                expected=(a_time-epoch).total_seconds()+np.arange(hi-lo+1)*step
                assert len(a)==len(expected) and np.max(np.abs(a[:,0]-expected))<.0001
                # JDTDB output rounds to 9 decimals; query grid is exactly minute-aligned.
                a[:,0]=expected
                if parts:assert np.array_equal(parts[-1][-1],a[0]),'Inconsistent chunk boundary'
                parts.append(a if not parts else a[1:]);sources.append(source)
        a=np.concatenate(parts);assert len(a)==total and np.all(np.diff(a[:,0])==step)
        file=OUT/f'{id}.f64';file.write_bytes(a.tobytes())
        # Statistics derived from actual states, not copied from the concept diagram.
        radius=np.linalg.norm(a[:,1:4],axis=1);h=np.cross(a[:,1:4],a[:,4:7]);normal=np.mean(h/np.linalg.norm(h,axis=1)[:,None],axis=0);normal/=np.linalg.norm(normal)
        e1=a[0,1:4]/np.linalg.norm(a[0,1:4]);e2=np.cross(normal,e1);e2/=np.linalg.norm(e2)
        angles=np.unwrap(np.arctan2(a[:,1:4]@e2,a[:,1:4]@e1));slope=np.polyfit((a[:,0]-a[0,0])/86400,angles,1)[0];period=2*np.pi/abs(slope)
        frame='IAU_'+name.upper()
        try:spice.pxform(frame,'J2000',ets[1]);orientation=dict(modelAvailable=True,frame=frame,source='NAIF pck00011.tpc',sha256=sha(ROOT/'data/phase-2/raw/pck00011.tpc'),status='METADATA_ONLY_NOT_RENDERED_3A',quality='generic IAU model; no lunar binary PCK or physical libration validation')
        except spice.utils.exceptions.SpiceyError:orientation=dict(modelAvailable=False,frame=frame,status='UNAVAILABLE_NOT_RENDERED_3A')
        meta=dict(id=id,parentPlanetId=parent,name=name,zh=zh,file='/satellites/'+file.name,sha256=sha(file),count=len(a),stepSeconds=step,coverageTdb=[float(a[0,0]),float(a[-1,0])],centerId=parent,centerKind='planetCenter',frame='ICRF',referencePlane='FRAME',correction='NONE',positionUnit='km',velocityUnit='km/s',timeScale='TDB',solution=sources[0]['solution'],rawSha256=sources[0]['rawSha256'],rawPath=sources[0]['rawPath'],sources=sources,physical=physical[id],orientation=orientation,characteristicRadiusKm=float(np.median(radius)),sampledMeanPeriodDays=float(period),periodMethod='Least-squares unwrapped longitude in sampled mean angular-momentum plane over cache',asset=dict(status='NOT_IMPLEMENTED_3B',shape='NO_SURFACE_MESH',rights='No satellite imagery distributed in 3A',colorProcessing='diagnostic point colors only, not surface albedo'))
        manifest['objects'].append(meta)
        rng=np.random.default_rng(int(id));random=list(rng.uniform(start,end,48));segments=rng.integers(1,len(a)-2,32);midpoints=list(a[segments,0]+step/2)
        # JPL prints JDTDB to 9 decimals (~43 microseconds). Exact UTC-window
        # endpoints may print just outside the runtime bounds. Query one second
        # inside instead; exact endpoints are exercised separately by runtime tests.
        requested=ets+random+midpoints+[start+1,end-1]
        held=[];vsources=[]
        for vi,offset in enumerate(range(0,len(requested),24)):
            epochs=requested[offset:offset+24]
            pieces=[(f'validation-{vi:02d}',epochs)] if vi!=3 else [(f'validation-{vi:02d}-interior-edges-{ci:02d}',epochs[k:k+7]) for ci,k in enumerate(range(0,len(epochs),7))]
            for validation_suffix,epoch_chunk in pieces:
                b,vsource,_=query(id,name,parent,validation_suffix,dict(TLIST=' '.join(f'{2451545+t/86400:.12f}' for t in epoch_chunk),TLIST_TYPE='JD'))
                held.append(b);vsources.append(vsource)
        b=np.concatenate(held);b=b[np.argsort(b[:,0])]
        c,gsource,_=query(id,name,'0','global-validation',dict(TLIST=' '.join(f'{2451545+t/86400:.12f}' for t in ets),TLIST_TYPE='JD'))
        validation['objects'].append(dict(id=id,parentPlanetId=parent,requestedTdb=requested,rows=b.tolist(),sources=vsources,globalRows=c.tolist(),globalSource=gsource))
        # Incremental durable output permits inspection while later bodies download.
        write(DOC/'manifest.partial.json',manifest);write(DOC/'validation.partial.json',validation)
        print('READY',name,len(a),'states',source['solution'],'mean period',round(period,6),'d',flush=True)
    # Independent geocentre vs Earth-Moon barycentre fixture, no EMB substituted for Earth.
    emb,source,_=query('3','Earth-Moon Barycenter','0','emb-validation',dict(TLIST=' '.join(f'{2451545+t/86400:.12f}' for t in ets),TLIST_TYPE='JD'))
    validation['earthMoonBarycenter']=dict(rows=emb.tolist(),source=source)
    write(DOC/'manifest.json',manifest);write(OUT/'manifest.json',manifest);write(DOC/'validation.json',validation)
    print('COMPLETE 18 satellites; runtime bytes',sum((OUT/f'{s[0]}.f64').stat().st_size for s in SATELLITES),flush=True)
if __name__=='__main__':main()
