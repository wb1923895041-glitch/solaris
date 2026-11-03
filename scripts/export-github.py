"""Export a clean snapshot of the project for GitHub (no history, no large image downloads, no dist). Usage: py -3 scripts/export-github.py <target-dir>"""
from pathlib import Path
import shutil, sys, json
R=Path(__file__).resolve().parent.parent;T=Path(sys.argv[1]);T.mkdir(parents=True,exist_ok=True)
skip_names={'source-changes.patch'}
def copy(p:Path):
    out=T/p.relative_to(R);out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
def tree(folder,skip=lambda p:False):
    for p in (R/folder).rglob('*'):
        if p.is_file() and not skip(p) and '__pycache__' not in p.parts and p.suffix!='.pyc' and not p.name.endswith('.tmp.mjs'):copy(p)
for f in ['README.md','.gitignore','.gitattributes','启动SOLARIS.cmd','07-启动SOLARIS终审版.cmd','index.html','package.json','package-lock.json','tsconfig.json','提交说明.md','成果展示.html']:copy(R/f)
for p in R.glob('*.cmd'):copy(p)
for f in ['src','scripts','schemas','public']:tree(f)
tree('data',lambda p:p.suffix.lower() in {'.tif','.tiff','.zip','.part','.jpg','.png','.fits','.exr'} or p.stat().st_size>90_000_000)
tree('docs',lambda p:p.name in skip_names or p.stat().st_size>8_000_000)
for ref in ['SOLARIS_phase1_reference','SOLARIS_phase2_reference','SOLARIS_phase3_reference','SOLARIS_repair_reference','SOLARIS_visual_baseline']:tree(ref)
# The same curated screenshots and recordings as the homework package (referenced by 成果展示.html).
show=(R/'成果展示.html').read_text(encoding='utf-8')
import re
# Preserve linked acceptance galleries as well as the curated submission showcase.
tree('output/playwright',lambda p:'video-work' in p.parts or p.suffix.lower() not in {'.html','.png','.webm'} or p.name.startswith('page@'))
for rel in sorted(set(re.findall(r'(?:src|href)="(output/[^"]+)"',show)))+['output/playwright/phase-7/对比.html']:
    if (R/rel).is_file():copy(R/rel)
for rel in re.findall(r'(?:src|href)="(\.\./phases-4-7/[^"]+|[^"/]+\.png)"',(R/'output/playwright/phase-7/对比.html').read_text(encoding='utf-8')):
    p=(R/'output/playwright/phase-7'/rel).resolve()
    if p.is_file():copy(p)
files=[p for p in T.rglob('*') if p.is_file() and not {'.git','node_modules','dist'}.intersection(p.relative_to(T).parts)]
n=len(files);size=sum(p.stat().st_size for p in files)
print('exported',n,'files',round(size/1048576),'MB to',T)
