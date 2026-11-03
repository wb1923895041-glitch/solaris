from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parent.parent
target=root/'docs/phase-2/frozen-science.json'
files=[]
for folder in ['src/science','data/phase-1','public/data','schemas']:
 files += [p for p in (root/folder).rglob('*') if p.is_file() and p.name!='probe.json']
current={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
if '--check' in sys.argv:
 previous=json.loads(target.read_text(encoding='utf-8'));assert current==previous,'Frozen phase-1 science files changed'
 print(f'PASS {len(current)} science files unchanged byte-for-byte')
else:
 target.write_text(json.dumps(current,indent=2)+'\n',encoding='utf-8');print(f'Frozen {len(current)} science files')
