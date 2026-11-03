from pathlib import Path
from PIL import Image
from bs4 import BeautifulSoup
import json
raw=Path('data/phase-3b/raw');results={}
for p in raw.glob('*.tif*'):
 if p.name.endswith('.json'):continue
 try:
  im=Image.open(p);entry=dict(size=im.size,mode=im.mode,tags={str(k):im.tag_v2.get(k) for k in [33550,33922,34735,34737]});results[p.name]=entry;print(p.name,entry)
 except Exception as e:print(p.name,repr(e))
for n in ['io-usgs.html','europa-usgs.html','ganymede-verified.html','callisto-verified.html','triton-usgs.html']:
 p=raw/n
 if not p.exists():continue
 s=BeautifulSoup(p.read_text(),'html.parser');meta={dt.get_text(' ',strip=True):dt.find_next_sibling('dd').get_text(' ',strip=True) for dt in s.select('dt') if any(k in dt.get_text() for k in ['Longitude','Latitude','Column','Row','Projection','Bands'])};results[n]=meta;print(n,meta)
Path('docs/phase-3b/source-georeferencing.json').write_text(json.dumps(results,indent=2)+'\n')
