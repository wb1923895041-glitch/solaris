"""Create the reviewable B-stage evidence bundle; never modify science inputs."""
from pathlib import Path
import json, hashlib, subprocess, difflib, shutil, zipfile, sys, html

root = Path(__file__).resolve().parent.parent
docs = root / 'docs/overview-b'
shots = root / 'output/playwright/overview-b'
out = root / 'deliverables'
out.mkdir(exist_ok=True)

def image(name, title):
    return f'<figure><a href="{name}"><img loading="lazy" src="{name}" alt="{html.escape(title)}"></a><figcaption>{html.escape(title)} · 点击查看原始 PNG</figcaption></figure>'

before = root / 'output/playwright/phase-2/regression/chrome-01-overview-2560x1440.png'
shutil.copy2(before, shots / 'before-overview-2560.png')
sections = image('chrome-final-overview-2560.png', '最新总览 · 2560×1440') + image('chrome-final-depth.png', '最新纵深视角 · 2560×1440') + image('chrome-final-sun.png', '最新太阳聚焦 · 2560×1440')
groups = {
    '太阳材质和边缘（完整测试轮）': [('chrome-sun-detail.png','太阳近景'),('chrome-sun-limb.png','太阳边缘'),('chrome-sun-no-enhancement.png','关闭观察增强')],
    '轨迹模式（完整测试轮）': [('chrome-trails-recent.png','近期轨迹'),('chrome-trails-history.png','历史全窗'),('chrome-trails-off.png','关闭轨迹')],
    '地球 Hero 与比例回归（完整测试轮）': [('chrome-earth-regression.png','地球 Hero 回归'),('chrome-scientific.png','科学比例')],
    '最新总览分辨率': [('chrome-final-overview-1920.png','1920×1080'),('chrome-final-overview-3840.png','3840×2160')],
    'Edge 最新画面': [('msedge-final-overview-2560.png','Edge 总览'),('msedge-final-depth.png','Edge 纵深'),('msedge-final-sun.png','Edge 太阳')],
}
for title, files in groups.items():
    sections += f'<details><summary>{title}</summary>' + ''.join(image(n,t) for n,t in files) + '</details>'
sections += '<details><summary>改造前后构图对照：镜头不同</summary><p>前图为第 2 期已有截图，后图为本轮新总览。同为 2026-10-29 UTC 初始日期；相机、标签和构图不同，不能用于逐像素材质误差比较。</p>' + image('before-overview-2560.png','改造前总览') + image('chrome-final-overview-2560.png','改造后总览') + '</details>'
gallery = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SOLARIS B 阶段验收</title><style>body{max-width:1400px;margin:40px auto;padding:0 24px;background:#09111b;color:#dce4ed;font:16px/1.8 system-ui}a{color:#a7d5ef}h1{font-size:30px}figure{margin:24px 0}img,video{width:100%;height:auto;background:#03070d;border:1px solid #263a4b;border-radius:8px}figcaption{color:#a6b6c6}summary{cursor:pointer;padding:18px;background:#142230;margin-top:20px}p{max-width:1100px}code{color:#d4be86}</style><h1>SOLARIS · 太阳与总览 B 阶段</h1><p>2026-10-29｜真实浏览器证据。已完成本轮返修并停止，视觉效果待用户验收。科学冻结 59 文件保持不变；Chrome/Edge 共 47 项完整浏览器断言通过；192 个实际轨迹缓冲样本独立核验通过。</p><p><a href="../../../docs/overview-b/验收报告.md">验收报告</a> · <a href="../../../docs/overview-b/chrome-report.json">Chrome 测试原始数据</a> · <a href="../../../docs/overview-b/msedge-report.json">Edge 测试原始数据</a> · <a href="../../../docs/overview-b/path-validation.json">轨迹误差报告</a></p><p>录屏 41.56 秒，1920×1080 编码，源视口 2560×1440。包含实际浏览器操作；性能为本机回调与 GPU 计时，不等同于屏幕物理呈现率。</p><video controls preload="metadata" poster="chrome-final-overview-2560.png" src="overview-sun-interaction.webm"></video>''' + sections + '<p>来源：NASA/JPL 星历、NASA/SDO HMI 光球、NASA SVS Deep Star Maps 2020。静态太阳影像、背面重建、星空显示压缩及分析式日冕的限制详见报告。没有使用概念图裁剪纹理。</p></html>'
(shots / '验收预览.html').write_text(gallery, encoding='utf-8')
for src, name in [(root/'public/assets/sky/source.json','sky-source.json'),(root/'public/assets/celestial/sun/config.json','sun-source.json')]:
    shutil.copy2(src, docs/name)
for path in (root/'docs/phase-2').glob('hardware-*.json'):
    shutil.copy2(path,docs/path.name)
shutil.copy2(root/'docs/overview-b-run.log',docs/'browser-run.log')

# Preserve exact checked-in-file changes and explicit added-file patches.
modified = subprocess.check_output(['git','diff','--name-only','a046fa5'],cwd=root,text=True,encoding='utf-8').splitlines()
new = ['src/render/sky.ts','src/render/orbit-trails.ts','scripts/fetch-overview-sky.py','scripts/build-overview-sky.py','scripts/requirements-overview-sky.txt','scripts/overview-b-qa.mjs','scripts/overview-b-final-smoke.mjs','scripts/overview-b-gallery-qa.mjs','scripts/overview-b-path-check.mjs','scripts/validate-overview-paths.py','scripts/package-overview-b.py']
patch = subprocess.check_output(['git','diff','a046fa5','--',*modified],cwd=root)
for name in new:
    content=(root/name).read_text(encoding='utf-8').splitlines(keepends=True)
    patch += (f'diff --git a/{name} b/{name}\nnew file mode 100644\n' + ''.join(difflib.unified_diff([],content,fromfile='/dev/null',tofile='b/'+name))).encode('utf-8')
(docs/'source-changes.patch').write_bytes(patch)
(docs/'change-list.json').write_text(json.dumps(dict(base='a046fa5',modified=modified,addedCode=new,addedAssets=['public/assets/sky/nasa-stars-4k.jpg','public/assets/sky/source.json'],note='Binary assets, provenance and evidence are supplied as files, not encoded in the patch.'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if '--prepare-only' in sys.argv:
    print('Gallery, sources and source patch prepared')
    raise SystemExit(0)

required = ['docs/overview-b/final-smoke.json','docs/overview-b/gallery-smoke.json','output/playwright/overview-b/overview-sun-interaction.webm']
assert all((root/p).exists() for p in required)
files = set(modified+new+['03-启动SOLARIS第2期.cmd','scripts/serve-phase2.py','package.json','package-lock.json','tsconfig.json','vite.config.ts'])
for folder in ['dist','docs/overview-b','public/assets/sky','data/overview-repair','output/playwright/overview-b']:
    files.update(p.relative_to(root).as_posix() for p in (root/folder).rglob('*') if p.is_file() and 'video-work' not in p.parts)
files={p for p in files if (root/p).is_file()}
readme='''SOLARIS B 阶段返修与验收材料（2026-10-29）

1. 双击 03-启动SOLARIS第2期.cmd 运行预构建版（需 Python 3，浏览器访问 127.0.0.1:4175）。
2. 打开 output/playwright/overview-b/验收预览.html 查看原始截图和真实录屏。
3. 审阅 docs/overview-b/验收报告.md、测试 JSON、误差、日志及 source-changes.patch。
4. 这是 a046fa5 恢复点上的返修增量。源码复建应使用原仓库；本包不是全量 Git 仓库。
5. dist 为当前完整预构建运行版，源码增量与新增资产另外提供。不要直接覆盖未备份的工程。

到 B 阶段停止，待视觉验收；未开发卫星、小行星带或教学系统。
'''
archive=out/'SOLARIS_太阳与总览_B阶段_返修材料包.zip'
manifest={p:dict(bytes=(root/p).stat().st_size,sha256=hashlib.sha256((root/p).read_bytes()).hexdigest()) for p in sorted(files)}
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.writestr('00-验收说明.txt',readme)
    z.writestr('FILE_MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    for p in sorted(files):z.write(root/p,p)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for p,item in manifest.items():assert hashlib.sha256(z.read(p)).hexdigest()==item['sha256']
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
report=dict(archive=archive.name,bytes=archive.stat().st_size,sha256=checksum,files=len(files),crcAndPerFileSha256='PASS',scienceRecoveryPoint='a046fa5')
(out/'SOLARIS_B阶段_材料包校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
