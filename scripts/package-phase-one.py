"""Reproducible-scope handoff; never includes venv, node_modules, Git, secrets, or other ZIPs."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parent.parent
out=root/'deliverables';out.mkdir(exist_ok=True)
archive=out/'SOLARIS_第1期_验收包.zip'
entries=['.gitignore','.gitattributes','README.md','package.json','package-lock.json','tsconfig.json','index.html',
 '00-启动空场景.cmd','01-预览已构建场景.cmd','02-启动SOLARIS.cmd','src','schemas','data','public','docs','scripts',
 'SOLARIS_visual_baseline','SOLARIS_phase1_reference','output','dist']
development_only={'initial-2560.png','iteration-overview.png','focus-first.png','release-overview-first.png','probe.json'}
files=[]
for entry in entries:
 path=root/entry
 for p in sorted(path.rglob('*')) if path.is_dir() else [path]:
  if p.is_file() and '__pycache__' not in p.parts and 'video-work' not in p.parts and p.name not in development_only:
   files.append(p)
inventory=[dict(path=p.relative_to(root).as_posix(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files]
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files:z.write(p,p.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert 'dist/index.html' in z.namelist()
 assert len([n for n in z.namelist() if n.startswith('public/data/') and n.endswith('.f64')])==9
 assert z.getinfo('output/playwright/phase-1/phase1-continuous-demo.webm').file_size>10000
 for item in inventory:
  assert hashlib.sha256(z.read(item['path'])).hexdigest()==item['sha256']
(out/'phase1-archive-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(out/'phase1-SHA256.txt').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n',encoding='utf-8')
print(f'ZIP integrity and every file hash verified: {len(files)} files, {archive.stat().st_size} bytes, {archive}')
