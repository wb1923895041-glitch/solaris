from pathlib import Path
import json,hashlib
import spiceypy as sp
r=Path(__file__).resolve().parent.parent;pck=r/'data/phase-2/raw/pck00011.tpc';sp.furnsh(str(pck));radii=sp.bodvrd('SATURN','RADII',3)[1].tolist()
p=r/'public/assets/celestial/manifest.json';m=json.loads(p.read_text());b=next(x for x in m['bodies'] if x['bodyId']=='699')
b['shapeRatios']=[radii[0]/58232,radii[2]/58232,radii[1]/58232]
b['shapeSource']=dict(sourceUrl='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',sha256=hashlib.sha256(pck.read_bytes()).hexdigest(),iauRadiiKm=radii,physicalMeanRadiusKm=58232,processing='Visual-only planetocentric ellipsoid geometry; frozen mean radius and positions untouched; analytic ellipsoidal shadow intersection')
b['limitations']=[x for x in b['limitations'] if 'oblateness' not in x]
b['limitations'].append('Oblate ring shadows use analytic ellipsoid / infinitesimal plane; finite Sun penumbra is an approximate smoothing, not a full radiative-transfer model')
p.write_text(json.dumps(m,indent=2)+'\n');(r/'data/phase-2/visual-manifest.json').write_text(json.dumps(m,indent=2)+'\n');(r/'public/assets/celestial/saturn/config.json').write_text(json.dumps(b,indent=2)+'\n')
print('Visual PCK ellipsoid',radii,'mean radius frozen',58232)
