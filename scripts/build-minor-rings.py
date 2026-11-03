"""Jupiter / Uranus / Neptune ring bands from the archived NASA NSSDCA ring fact sheets (Williams, 2015 revision).
Radii, widths, normal optical depths and albedos are parsed from the tables; '~', '<', '+/-' qualifiers are kept as
flags; ranges use their midpoint and the range is recorded. Nothing is tuned by eye."""
from pathlib import Path
import re, html, json, hashlib
R=Path(__file__).resolve().parent.parent;RAW=R/'data/phase-7/raw'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def cells(path):
    t=path.read_text(encoding='latin-1');rows=[]
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>',t,re.S|re.I):
        c=[html.unescape(re.sub(r'<[^>]+>','',x)).replace('\xa0',' ').strip() for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',tr,re.S|re.I)]
        if c:rows.append(c)
    return rows
def num(s):
    s=s.replace(',','').replace('x 10-','e-').replace('x10-','e-').strip();q=''.join(ch for ch in s if ch in '~<>+')
    m=re.findall(r'(\d+(?:\.\d+)?(?:e-\d+)?)',s.replace(' ',''))
    if not m:return None
    v=[float(x) for x in m];return dict(value=sum(v)/len(v),range=v if len(v)>1 else None,qualifier=q or None,text=s)
out=dict(source='NASA NSSDCA planetary ring fact sheets (D. R. Williams), last updated 14 October 2015',systems={})
spec={'599':('jupringfact.html',['name','radius','ratio','thickness','tau','albedo','sigma'],71492),'799':('uranringfact.html',['name','radius','ratio','tau','albedo1e3','width','e'],25559),'899':('nepringfact.html',['name','radius','ratio','tau','albedo1e3','width'],24766)}
for pid,(fname,cols,eq) in spec.items():
    p=RAW/fname;bands=[]
    for row in cells(p):
        if len(row)<3 or not re.search(r'\d',row[1]) or 'equator' in row[0].lower():continue
        d={k:row[i] if i<len(row) else '' for i,k in enumerate(cols)};r=num(d['radius'])
        if not r:continue
        filled=[x for x in row[3:] if x]
        if pid=='899' and len(filled)==1:d['width'],d['tau']=filled[0],''   # Arago: the only value is the width
        if pid=='899' and not filled:continue                               # 'Unnamed (indistinct)': no width or depth given
        if pid=='599':inner,outer=r['range'] if r['range'] else (r['value'],r['value']);width=outer-inner;center=(inner+outer)/2
        else:
            w=num(d.get('width','')) or dict(value=None);center=r['value'];width=w['value']
        tau=num(d.get('tau',''))
        if tau and tau['qualifier'] and '<' in tau['qualifier'] and '<<' in d.get('tau','').replace(' ',''):tau=dict(tau,value=tau['value']*.01,derived='much less than the upper bound: drawn at 1/100 of it')
        alb=num(d.get('albedo','')) if pid=='599' else num(d.get('albedo1e3',''))
        albedo=(alb['value'] if pid=='599' else alb['value']*1e-3) if alb else None
        arc=d['name'].startswith(('Courage','Libert','Egalit','Fratern'))
        bands.append(dict(name=re.sub(r'\s+',' ',d['name']),centerKm=center,widthKm=width,normalOpticalDepth=tau['value'] if tau else None,opticalDepthText=d.get('tau'),albedo=albedo,albedoText=d.get('albedo') or d.get('albedo1e3'),azimuthallyConfinedArc=arc,raw=row))
    out['systems'][pid]=dict(equatorialRadiusKm=eq,file=p.relative_to(R).as_posix(),sha256=sha(p),url=f'https://nssdc.gsfc.nasa.gov/planetary/factsheet/{fname}',bands=bands)
# Rendering rules (documented, not tuned per ring): unknown albedo → that system's typical value from the same sheet;
# arcs are not placed (no longitudes in the source); unknown width uses the sheet's upper bound where given.
for pid,s in out['systems'].items():
    known=[b['albedo'] for b in s['bands'] if b['albedo']];typical=sum(known)/len(known)
    for b in s['bands']:
        if b['albedo'] is None:b['albedo']=typical;b['albedoAssumed']='system typical value from the same fact sheet'
        if b['widthKm'] is None:b['widthKm']=100.0 if pid=='899' else 2.0;b['widthAssumed']='upper bound / sheet note'
        if b['normalOpticalDepth'] is None:b['normalOpticalDepth']=1e-4;b['opticalDepthAssumed']='faint ring, upper bound class'
    s['bands']=[b for b in s['bands'] if not b['azimuthallyConfinedArc']]
    for b in s['bands']:
        # Lassell's tabulated radius is its inner edge (shared with LeVerrier); it extends 4,000 km out to Arago at 57,200 km
        # (both were first identified as one ring, 1989N4R), so its centre is the inner edge plus half its width.
        if b['name'].startswith('Lassell'):b['centerKm']+=b['widthKm']/2;b['centerNote']='tabulated radius is the inner edge; centre = edge + width/2 (extends to Arago)'
    s['notes']='Adams ring arcs (Courage, Liberté, Égalité, Fraternité) are not placed: the source gives no longitudes.' if pid=='899' else 'Ring eccentricities (≤0.008) and inclinations are neglected; rings are drawn circular in the IAU equatorial plane.' if pid=='799' else 'Gossamer and halo vertical thickness is not modelled; drawn as a thin sheet.'
(R/'data/phase-7').mkdir(exist_ok=True);(R/'data/phase-7/minor-rings.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for pid,s in out['systems'].items():print(pid,[(b['name'],round(b['centerKm']),round(b['widthKm'],1),b['normalOpticalDepth']) for b in s['bands']])
