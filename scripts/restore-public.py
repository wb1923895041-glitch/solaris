"""Rebuild public/ from a built dist/ (the submission ships one copy to halve its size).
Vite's own outputs are only dist/index.html and the hashed bundles directly in dist/assets/; every other file in dist/
was copied verbatim from public/ at build time and is copied back here."""
from pathlib import Path
import re, shutil, sys
R=Path(__file__).resolve().parent.parent;dist=R/'dist';public=Path(sys.argv[1]) if len(sys.argv)>1 else R/'public'
bundle=re.compile(r'^[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.(js|css)$')
def is_vite_output(p:Path):rel=p.relative_to(dist);return rel.as_posix()=='index.html' or (rel.parent.as_posix()=='assets' and bundle.match(rel.name))
n=0
for p in dist.rglob('*'):
    if p.is_file() and not is_vite_output(p):
        out=public/p.relative_to(dist);out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out);n+=1
print('restored',n,'files into',public)
