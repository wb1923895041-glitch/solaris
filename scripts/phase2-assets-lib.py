from pathlib import Path
import hashlib,json,requests
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
RAW=ROOT/'data/phase-2/raw'
def fetch(name,url):
 p=RAW/name
 if not p.exists():
  q=requests.get(url,timeout=120);q.raise_for_status();p.write_bytes(q.content)
 return p
def lods(name,im,prefix='albedo'):
 out=ROOT/'public/assets/celestial'/name;out.mkdir(parents=True,exist_ok=True)
 result=[]
 for n in [1024,2048,4096]:
  p=out/f'{prefix}-{n}.jpg';im.resize((n,n//2),Image.Resampling.LANCZOS).save(p,quality=95,subsampling=0)
  result.append(dict(width=n,height=n//2,url='/'+p.relative_to(ROOT/'public').as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
 return result
def commit(name,body):
 out=ROOT/'public/assets/celestial'/name;out.mkdir(parents=True,exist_ok=True)
 (out/'source.json').write_text(json.dumps(body,indent=2)+'\n')
 p=ROOT/'public/assets/celestial/manifest.json';m=json.loads(p.read_text());m['bodies']=[x for x in m['bodies'] if x['bodyId']!=body['bodyId']]+[body]
 p.write_text(json.dumps(m,indent=2)+'\n');(ROOT/'data/phase-2/visual-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
def source(provider,title,url,epoch,credit,processing,raw,orientation='Absolute longitude not certified; IAU pole and rotation from NAIF PCK'):
 return dict(provider=provider,title=title,sourceUrl=url,observationEpoch=epoch,credit=credit,rights='NASA mission imagery; original credit retained',processing=processing,primeMeridianOrOrientationNotes=orientation,rawFile=raw.relative_to(ROOT).as_posix(),sha256=hashlib.sha256(raw.read_bytes()).hexdigest(),nativeSize=list(Image.open(raw).size))
