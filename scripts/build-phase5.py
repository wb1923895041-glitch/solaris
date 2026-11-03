"""Phase 5 reference data: NASA Five Millennium Canon eclipse catalogues (archived, hashed) and planetary GM values
from the archived JPL physical-parameter page. Used only to validate our own computed events, never as event input."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, re, html
import requests
R=Path(__file__).resolve().parent.parent;RAW=R/'data/phase-5/raw';RAW.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
PAGES={'solar':'https://eclipse.gsfc.nasa.gov/SEcat5/SE2001-2100.html','lunar':'https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html'}
MON={m:i for i,m in enumerate(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],1)}
out=dict(source='NASA GSFC Five Millennium Canon of Solar/Lunar Eclipses (Espenak & Meeus); times are Terrestrial Dynamical Time (TD)',pages={},solar=[],lunar=[])
for kind,url in PAGES.items():
    p=RAW/f'{kind}-2001-2100.html'
    if not p.exists():
        r=requests.get(url,timeout=120);r.raise_for_status();p.write_bytes(r.content)
        (RAW/f'{kind}-2001-2100.request.json').write_text(json.dumps(dict(url=url,retrievedAtUtc=datetime.now(timezone.utc).isoformat()),indent=2),encoding='utf-8')
    out['pages'][kind]=dict(url=url,rawPath=p.relative_to(R).as_posix(),sha256=sha(p))
    text=html.unescape(re.sub(r'<[^>]+>','',p.read_text(encoding='latin-1')))
    for line in text.splitlines():
        m=re.match(r'\s*(\d{4,5})\s+(\d{4})\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+([A-Z][a-z0-9+\-]*)\s+(.*)',line)
        if not m or not 2024<=int(m[2])<=2030:continue
        rest=m[12].split()
        row=dict(catalog=int(m[1]),date=f'{m[2]}-{MON[m[3]]:02d}-{int(m[4]):02d}',tdGreatest=f'{m[5]}:{m[6]}:{m[7]}',deltaT=int(m[8]),type=m[11],raw=line.strip())
        # Gamma is the first signed decimal with 4 places after the saros/type columns in both catalogues.
        nums=[x for x in rest if re.fullmatch(r'-?\d+\.\d{4}',x)]
        if nums:row['gamma']=float(nums[0])
        out[kind].append(row)
    print(kind,len(out[kind]),'rows 2024–2030')
assert len(out['solar'])>=14 and len(out['lunar'])>=14,'catalogue parse failed'
(R/'data/phase-5').mkdir(exist_ok=True);(R/'data/phase-5/nasa-eclipses.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
# Planet GM: each body's own archived Horizons object-data header. Mass, mean radius, density: archived JPL table.
page=R/'data/phase-1/raw/planetary-physical-parameters.html';text=page.read_text(encoding='utf-8')
rows={}
for block in re.split(r'<tr>',text):
    name=re.search(r'<td><b>([A-Za-z]+)</b></td>',block)
    if not name:continue
    cells=re.findall(r'value-sigma-cell">\s*([-0-9.]+)(.*?)</td>',block,re.S)
    vals=[float(v) for v,_ in cells];sig=[(re.search(r'&plusmn;\s*([0-9.]+)',rest) or [None,None])[1] for _,rest in cells]
    if name[1] not in rows and len(vals)>=4:rows[name[1]]=dict(eqRadiusKm=vals[0],meanRadiusKm=vals[1],massE24Kg=vals[2],densityGcm3=vals[3],densitySigma=sig[3])
ids={'Mercury':'199','Venus':'299','Earth':'399','Mars':'499','Jupiter':'599','Saturn':'699','Uranus':'799','Neptune':'899'}
planets={}
for name,id in [('Sun','10')]+list(ids.items()):
    raw=R/f'data/phase-1/raw/{id}-grid.json';header=json.loads(raw.read_text(encoding='utf-8'))['result']
    gm=re.search(r'GM[^=\n]*?\(?km\^3/s\^2\)?\s*=\s*([0-9.]+)(?:\+-\s*([0-9.]+))?',header)
    entry=dict(gm=float(gm[1]) if gm else None,gmSigma=float(gm[2]) if gm and gm[2] else None,source=f'JPL Horizons object data ({raw.relative_to(R).as_posix()}, sha256 {sha(raw)[:12]}…)')
    if name in rows:entry.update(meanRadiusKm=rows[name]['meanRadiusKm'],densityGcm3=rows[name]['densityGcm3'],massE24Kg=rows[name]['massE24Kg'],tableSource=f'JPL planetary physical parameters ({page.relative_to(R).as_posix()}, sha256 {sha(page)[:12]}…)')
    else:entry.update(meanRadiusKm=695700.0,densityGcm3=None)
    planets[id]=entry;print(name,entry['gm'],entry.get('densityGcm3'))
assert all(p['gm'] for p in planets.values()),'GM missing from a Horizons header'
reference=dict(planets=planets,pluto=rows.get('Pluto'),nasaEclipses=dict(source=out['source'],pages=out['pages'],solar=[{k:r[k] for k in ('date','tdGreatest','type','gamma') if k in r} for r in out['solar']],lunar=[{k:r[k] for k in ('date','tdGreatest','type','gamma') if k in r} for r in out['lunar']]))
(R/'public/education').mkdir(parents=True,exist_ok=True);(R/'public/education/reference.json').write_text(json.dumps(reference,ensure_ascii=False,indent=1),encoding='utf-8');print('reference.json written')
