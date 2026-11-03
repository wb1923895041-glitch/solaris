"""Parallel HTTP-range download for slow per-connection mirrors (USGS → S3). Each segment resumes and retries; the
assembled file must match Content-Length, then the same .source.json provenance record as build-phase4-assets.py is written."""
import sys, json, hashlib, threading
from pathlib import Path
from datetime import datetime, timezone
import requests
url,dest,page=sys.argv[1],Path(sys.argv[2]),sys.argv[3];parts=int(sys.argv[4]) if len(sys.argv)>4 else 8
for attempt in range(6):
    try:r=requests.head(url,allow_redirects=True,timeout=90);r.raise_for_status();break
    except requests.RequestException as e:print('head retry',type(e).__name__,flush=True)
else:raise SystemExit('HEAD failed repeatedly')
size=int(r.headers['content-length']);final=r.url
step=-(-size//parts);segs=[(k,k*step,min(size,(k+1)*step)-1) for k in range(parts)]
def work(k,a,b):
    part=dest.with_name(dest.name+f'.seg{k}')
    while True:
        have=part.stat().st_size if part.exists() else 0
        if have>=b-a+1:return
        try:
            with requests.get(final,headers={'Range':f'bytes={a+have}-{b}'},stream=True,timeout=120) as s:
                s.raise_for_status();assert s.status_code==206
                with open(part,'ab') as f:
                    for chunk in s.iter_content(1<<20):f.write(chunk)
        except Exception as e:print('segment',k,'retry',type(e).__name__,flush=True)
threads=[threading.Thread(target=work,args=s) for s in segs];[t.start() for t in threads];[t.join() for t in threads]
with open(dest,'wb') as out:
    for k,_,_ in segs:
        p=dest.with_name(dest.name+f'.seg{k}');out.write(p.read_bytes());p.unlink()
assert dest.stat().st_size==size,'assembled size mismatch'
digest=hashlib.sha256(dest.read_bytes()).hexdigest()
dest.with_suffix('.source.json').write_text(json.dumps(dict(url=url,bytes=size,sha256=digest,retrievedAtUtc=datetime.now(timezone.utc).isoformat(),productPage=page,method=f'{parts} parallel HTTP range segments, reassembled and size-checked'),indent=2)+'\n',encoding='utf-8')
print('done',dest.name,size,digest[:16])
