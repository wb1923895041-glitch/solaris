"""Pluto–Charon record for the browser: Charon orbit statistics (from the Horizons cache, see build-phase4-assets.py)
plus radii and GM parsed from the archived Horizons object-data headers of 999 and 901. No hand-typed constants."""
from pathlib import Path
import json, re, hashlib
R=Path(__file__).resolve().parent.parent
rec=json.loads((R/'data/phase-4/pluto-system.partial.json').read_text(encoding='utf-8'))
def header(id):p=R/f'data/phase-4/raw/{id}-grid.json';return json.loads(p.read_text(encoding='utf-8'))['result'].split('$$SOE')[0],f'JPL Horizons object data ({p.relative_to(R).as_posix()}, sha256 {hashlib.sha256(p.read_bytes()).hexdigest()[:12]}…)'
c,csrc=header('901');p,psrc=header('999')
cgm=re.search(r'GM \(km\^3/s\^2\)\s*=\s*([0-9.]+)\s*\+-\s*([0-9.]+)',c);crad=re.search(r'Radius \(km, IAU2015\)\s*=\s*([0-9.]+)\s*\+-\s*([0-9.]+)',c)
pgm=re.search(r'GM \(planet\) km\^3/s\^2\s*=\s*([0-9.]+)',p);pgs=re.search(r'GM 1-sigma, km\^3/s\^2\s*=\s*([0-9.]+)',p);prad=re.search(r'Vol\. mean radius \(km\)\s*=\s*([0-9.]+)\+-([0-9.]+)',p)
assert cgm and crad and pgm and prad,'Horizons header fields not found'
rec['charon']['physical']=dict(radiusKm=float(crad[1]),radiusUncertaintyKm=float(crad[2]),gmKm3PerSec2=float(cgm[1]),source=csrc)
rec['pluto']=dict(radiusKm=float(prad[1]),radiusUncertaintyKm=float(prad[2]),gmKm3PerSec2=float(pgm[1]),gmSigma=float(pgs[1]) if pgs else None,source=psrc)
rec['charonGm']=dict(gmKm3PerSec2=float(cgm[1]),sigma=float(cgm[2]),source=csrc)
(R/'public/smallbodies/pluto-system.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(R/'data/phase-4/pluto-system.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
mu=rec['charonGm']['gmKm3PerSec2']/(rec['charonGm']['gmKm3PerSec2']+rec['pluto']['gmKm3PerSec2'])
print('Charon period',rec['charon']['sampledMeanPeriodDays'],'d; mean distance',rec['charon']['characteristicRadiusKm'],'km; barycentre',rec['charon']['characteristicRadiusKm']*mu,'km =',rec['charon']['characteristicRadiusKm']*mu/rec['pluto']['radiusKm'],'Pluto radii')
