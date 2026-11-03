"""Homework submission package: runnable dist/, full front-end and back-end source, data manifests (no GB-scale raw
downloads), reports, curated screenshots and recordings, one top-level folder, per-file SHA-256 verified after writing."""
from pathlib import Path
import hashlib, json, zipfile, shutil
R=Path(__file__).resolve().parent.parent;O=R/'deliverables';O.mkdir(exist_ok=True);TOP='SOLARIS'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files={}
def add(path,arc=None):
    p=R/path if not isinstance(path,Path) else path
    if p.is_file():files[arc or p.relative_to(R).as_posix()]=p
def tree(folder,skip=lambda p:False):
    for p in (R/folder).rglob('*'):
        if p.is_file() and not skip(p):add(p)
for f in ['index.html','package.json','package-lock.json','tsconfig.json','README.md','提交说明.md','.gitignore']:add(f)
for f in ['src','scripts','schemas','dist']:tree(f,lambda p:'__pycache__' in p.parts or p.suffix=='.pyc' or p.name.endswith('.tmp.mjs'))
tree('data',lambda p:'raw' in p.parts or p.stat().st_size>20_000_000)
tree('docs',lambda p:p.name=='source-changes.patch' or p.stat().st_size>8_000_000)
for ref in ['SOLARIS_phase1_reference','SOLARIS_phase2_reference','SOLARIS_phase3_reference','SOLARIS_repair_reference','SOLARIS_visual_baseline']:tree(ref)
# Curated evidence: the Chrome screenshots of the final runs, both recordings, the baseline comparison.
shots=[]
def shot(rel,caption):
    p=R/rel
    if p.is_file():add(p);shots.append((rel,caption))
c3=json.loads((R/'docs/phase-3c/chrome-report.json').read_text(encoding='utf-8'));q47=json.loads((R/'docs/phases-4-7/chrome-report.json').read_text(encoding='utf-8'))
for x in c3['shots']:
    n=Path(x['path']).name
    if any(k in n for k in ['system-','closeup','overview']):shot(x['path'],x['caption'])
for x in q47['shots']:shot(x['path'],x['caption'])
for n,cap in [('chrome-overview-2560.png','总览（1440p 性能测试）'),('chrome-earth-2560.png','地球 Hero'),('chrome-saturn-titan-2560.png','Titan 近景'),('01_总览与资产规范.png','视觉基准 01'),('02_交互与天体参考.png','视觉基准 02')]:shot(f'output/playwright/phase-7/{n}',cap)
for d in sorted((R/'output/playwright/phase-3b/final').glob('chrome-*-standard-2560.png'))[:18]:shot(d.relative_to(R).as_posix(),'3B 卫星资产 · '+d.name.split('-')[1])
for v in ['output/playwright/phase-3c/local-system-interaction.webm','output/playwright/phases-4-7/final-tour.webm']:add(v)
add('output/playwright/phase-7/对比.html')
for rel in ['output/playwright/phases-4-7/chrome-p7-rings-599-2560.png','output/playwright/phases-4-7/chrome-p7-rings-799-2560.png','output/playwright/phases-4-7/chrome-p7-rings-899-2560.png']:add(rel)
fig=''.join(f'<figure><a href="{r}"><img loading="lazy" src="{r}" alt="{c}"></a><figcaption>{c}</figcaption></figure>' for r,c in shots)
show=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SOLARIS 成果展示</title><style>body{{max-width:1600px;margin:40px auto;padding:0 24px;background:#09111b;color:#dce4ed;font:16px/1.8 system-ui}}a{{color:#acd3e9}}.row{{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:14px}}img,video{{width:100%;border:1px solid #2b4356}}figure{{margin:0}}figcaption{{font-size:13px;color:#9db3c4}}</style>
<h1>SOLARIS · 真实太阳系数字天文馆</h1><p>以下均为真实浏览器（Chrome，2560×1440）运行截图与录屏。运行方法与项目说明见 <a href="提交说明.md">提交说明.md</a>；与视觉基准的并排对比见 <a href="output/playwright/phase-7/对比.html">对比页</a>。</p>
<h2>录屏</h2><div class=row><video controls preload="metadata" src="output/playwright/phase-3c/local-system-interaction.webm"></video><video controls preload="metadata" src="output/playwright/phases-4-7/final-tour.webm"></video></div>
<h2>截图（{len(shots)} 张）</h2><div class=row>{fig}</div></html>'''
(R/'成果展示.html').write_text(show,encoding='utf-8');add('成果展示.html')
launcher=(R/'07-启动SOLARIS终审版.cmd').read_bytes();(R/'启动SOLARIS.cmd').write_bytes(launcher);add('启动SOLARIS.cmd')
hashes={a:dict(bytes=p.stat().st_size,sha256=sha(p)) for a,p in sorted(files.items())}
archive=O/'SOLARIS_作业提交.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.writestr(f'{TOP}/FILE_MANIFEST.json',json.dumps(hashes,ensure_ascii=False,indent=1))
    for a,p in sorted(files.items()):z.write(p,f'{TOP}/{a}')
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for a,e in hashes.items():assert hashlib.sha256(z.read(f'{TOP}/{a}')).hexdigest()==e['sha256'],a
summary=dict(archive=archive.name,bytes=archive.stat().st_size,files=len(files),screenshots=len(shots),sha256=sha(archive),crcAndPerFileSha256='PASS')
(O/'SOLARIS_作业提交_校验.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,ensure_ascii=False))
