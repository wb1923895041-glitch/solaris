"""Build 3B review docs, gallery and an offline runtime + incremental source bundle."""
from pathlib import Path
import json,hashlib,zipfile,subprocess,sys,difflib
R=Path(__file__).resolve().parent.parent;D=R/'docs/phase-3b';S=R/'output/playwright/phase-3b/final';O=R/'deliverables';O.mkdir(exist_ok=True)
BASE='99fd0fe'
def read(p):return json.loads((R/p).read_text(encoding='utf-8-sig'))
def git(*a):return subprocess.check_output(['git',*a],cwd=R,text=True,encoding='utf-8')
m=read('public/assets/moons/manifest.json');c=read('docs/phase-3b/chrome-final-report.json');e=read('docs/phase-3b/msedge-final-report.json')
orient={x['id']:x for x in read('docs/phase-3b/orientation-runtime-validation.json')['results']};lock={x['id']:x for x in read('docs/phase-3b/tidal-locking-validation.json')['results']}
mesh={i:read(f'docs/phase-3b/{i}-mesh-validation.json') for i in ['401','402']};codes=read('docs/phase-3b/command-exit-codes.json')
assert all(x['exitCode']==0 for x in codes) and not c['errors'] and not e['errors'] and len(c['bodies'])==len(e['bodies'])==18
order=['301','401','402','501','502','503','504','601','602','605','606','608','705','701','702','703','704','801']
body={b['naifId']:b for b in m['bodies']};cb={b['id']:b for b in c['bodies']};eb={b['id']:b for b in e['bodies']}
shape={'irregular-mesh':'实测不规则网格','displaced-sphere':'LRO 实测高程','pck-ellipsoid':'PCK 三轴椭球','opaque-haze-reconstruction':'不透明大气重建'}
table='| 卫星 / ID | 形状 | 表面来源 | 处理类别 | 最高纹理 | 姿态插值误差 ° | 两周期子行星点经度摆幅 ° |\n|---|---|---|---|---:|---:|---:|\n'
for i in order:
    a=body[i];lod=max([l['width'] for l in a['lods']],default=0)
    table+=f"| {a['displayNameZh']} {a['displayNameEn']} / {i} | {shape.get(a['shapeType'],a['shapeType'])} | {a['albedo']['provider']} | `{a['albedo']['processingCategory']}` | {str(lod)+' px' if lod else '无（网格/重建）'} | {orient[i]['maxAngleDegrees']:.2e} | ±{lock[i]['maxAbsSubplanetLongitudeDegrees']:.2f} |\n"
perf='| 卫星 | Chrome rAF P50 / P95 ms | Chrome GPU P95 ms | Edge rAF P50 / P95 ms | Edge GPU P95 ms | 三角形 | 截图 |\n|---|---:|---:|---:|---:|---:|---:|\n'
for i in order:
    x,y=cb[i]['performance'],eb[i]['performance']
    perf+=f"| {body[i]['displayNameZh']} / {i} | {x['rafP50Ms']:.2f} / {x['rafP95Ms']:.2f} | {x['render']['gpuRender']['p95Ms']:.3f} | {y['rafP50Ms']:.2f} / {y['rafP95Ms']:.2f} | {y['render']['gpuRender']['p95Ms']:.3f} | {x['render']['triangles']:,} | {len(cb[i]['captures'])} |\n"
retries=sum(len(b['performance'].get('rejectedAttempts',[])) for b in c['bodies']+e['bodies'])
gpu=c['bodies'][0]['performance']['render']['gpuRenderer'];maxgpu=max(b['performance']['render']['gpuRender']['p95Ms'] for b in c['bodies']+e['bodies']);maxraf=max(b['performance']['rafP95Ms'] for b in c['bodies']+e['bodies'])
cmds='\n'.join(f"- `{x['command']}` → 退出码 {x['exitCode']}（`{x['log']}`）" for x in codes)
report=f'''# SOLARIS 3B：天然卫星独立资产、形状与姿态验收材料

本轮完成第 3 期的 **3B 资产与姿态**，到此停止；**3C 局部行星系统（进入/退出、卫星跟随、三种比例、局部轨道面板）未实施**，小行星等后续期次未启动。所有数字均来自本目录中的真实运行日志；视觉与产品验收仍需用户确认。

## 恢复点与改动范围

开发基线为 Git commit `{BASE}`（3A 与行星重叠修复检查点）。可无损建立恢复副本：`git worktree add ../SOLARIS-before-3B {BASE}`。

- 新增 `src/satellites/` 下资产契约、资产台、卫星可视、Titan 雾霾、Enceladus 羽流教学层；`src/main.ts` 与 `index.html` 仅增加「卫星资产 · 3B」懒加载入口、共享时钟驱动和 QA 钩子。
- 科学冻结检查：59 个第 1 期科学文件逐字节未变；`src/science`、`src/render`、既有行星资产、`data/phase-1/2/3a`、`public/satellites` 相对基线无改动。卫星位置仍只来自 3A 星历适配器。
- 资产台打开时暂停主场景绘制（不改变其状态），关闭后主场景相机、选中天体、比例模式与九天体状态逐字节恢复（浏览器断言）。

## 18 颗卫星资产与姿态清单

每颗卫星有独立 `public/assets/moons/<ID>/config.json`（即 MoonVisualManifest），与总清单逐项一致并绑定 3A 的父体 ID 与平均半径；全部纹理、网格、高程和姿态缓存在浏览器端做 SHA-256 校验，失败即拒绝显示。概念图未被裁切或用于任何贴图。

{table}
- 姿态：18 颗统一使用 NAIF `pck00011.tpc` 的 IAU 通用模型，经 CSPICE `pxform` 预计算为单位四元数并在运行时插值；标记为 `IAU_GENERIC_APPROX`，**不是导航级表面配准**，月球不含高精度天平动 PCK。上表误差为生产求值器相对 CSPICE 的离网格独立抽样（每颗 128 个）。
- 潮汐锁定：在两个实测轨道周期内，由 3A 星历与 IAU 姿态独立求子行星点；均为有界摆动、无累积漂移（`verify-moon-locking` 通过），幅度最大为土卫一 ±{lock['601']['maxAbsSubplanetLongitudeDegrees']:.2f}°、月球 ±{lock['301']['maxAbsSubplanetLongitudeDegrees']:.2f}°；该数值是 IAU 通用模型与实际轨道组合的统计结果，不是实测天平动。表面从不使用 `lookAt(planet)`。
- Phobos / Deimos：JHUAPL SBMT SPC 实测网格（Ernst et al. 2023），各 {mesh['401']['triangles']:,} 个三角面，闭合流形；体积等效半径 {mesh['401']['volumeEquivalentRadiusKm']:.3f} / {mesh['402']['volumeEquivalentRadiusKm']:.3f} km，逐面实测反照率，无球体冒充。
- Titan：默认为可见光不透明橙色雾霾重建，地表不可见；未借用近红外/雷达地图冒充自然色。
- Enceladus：南极虎纹来自 Cassini 拼图。**新增羽流示意教学层**：默认关闭，勾选后才显示，界面同步标注「羽流为示意教学层，非任一时刻观测」；位置固定于本体南极虎纹区，静态、不随时间伪造喷发，不改变姿态（浏览器断言）。
- Iapetus 保留两色反照率；Triton 为 Voyager 增强色，未画成蓝色冰巨星缩小版；天王星五卫只有 Voyager 2 南半球影像，未测区以蓝灰色分类标识，提供明确标记的「测绘区（补光）」视角。
- 光照：唯一光源方向由同一 TDB 下太阳与卫星的真实位置求得；补光默认关闭，开启时在界面标注「观察补光已启用」；所有材质自发光为 0（浏览器逐颗断言）。

## 本轮优化

1. **纹理离线程解码**：LOD 纹理改用 `createImageBitmap` 在后台线程解码，并在替换前 `initTexture` 预上传，避免 2048/4096 px 纹理升级时主线程长帧；释放纹理时关闭 ImageBitmap。
2. **资产台布局**：打开时隐藏与当前卫星无关的「地球」详情面板和行星目录，3D 区域扩至全宽（2560×1440 下2101×981 px 画布），信息栏加宽至 360 px。
3. **Enceladus 羽流教学层**（见上），对应验收矩阵「南极虎纹/羽流示意切换」。
4. **性能采样修正**：原脚本每颗仅 30 帧且未等纹理升级完成，Edge 曾记录 Rhea/Iapetus P95 ≈ 1016 ms。复查确认这是 Windows 遮挡测试窗口时 rAF 降为 1 fps 的节流，而非渲染耗时。现等待 LOD 稳定后每颗采样 120（重点三颗 240）帧，同时记录页面可见性与焦点；若采样中窗口被隐藏，重新激活窗口重采，**被弃用的每次采样都保留在报告 JSON 的 `rejectedAttempts` 中**。最终两浏览器重试次数合计 {retries}。

## 实机浏览器验收（2560×1440，DPR 1）

GPU：{gpu}。Chrome {c['browser']}：{len(c['checks'])} 项断言通过；Edge {e['browser']}：{len(e['checks'])} 项断言通过；控制台与运行时错误均为 0。断言涵盖：18 个独立来源配置、仅太阳照明、共享 TDB 与单位四元数、每颗正面/侧光视角（重点 8 颗另有细节视角）、测绘区补光可逆、主场景状态不被改动、模型缓存 ≤2、真实鼠标拖动不改科学姿态、三个日期跳转与播放时姿态随原时钟推进、24 次快速切换无陈旧资产、Esc 恢复主场景、3A 数据层保留、羽流教学层默认关闭/可开关/有标注，以及每颗稳态帧间隔 P95 < 25 ms 且无隐藏样本。

{perf}
rAF 为浏览器回调间隔：本机显示器为高刷新率，最大 P95 {maxraf:.2f} ms，即远高于 60 FPS 目标；GPU P95 最大 {maxgpu:.3f} ms（WebGL timer query）。WebGL 无法读取真实显存字节数，报告保留对象计数，不将其称为实测 VRAM。

截图：`output/playwright/phase-3b/final/`，打开 `验收预览.html` 浏览全部 18 颗的正面、侧光、细节（重点 8 颗）、测绘区和羽流教学层截图。

## 测试命令与退出码

{cmds}
- `py -3 scripts/phase2-freeze.py --check` → 退出码 0（`final-freeze.log`）

## 未解决的限制

- 姿态为 IAU 通用 PCK 近似，历史影像与当前参考经线之间存在控制网误差，非导航级配准；月球未使用 DE 天平动 PCK。
- 天王星五卫北半球、Europa 南纬 83° 以南等无影像区以分类色标识，不是地貌；多数贴图含原始入射光阴影与拼接缝，未做 Hapke 光度建模。
- SBMT 网格页面未写明独立再分发许可，公开分发前需另行确认；NASA 来源不代表 NASA 认证本项目。
- Titan 雾霾外形与透明度为基于观测的静态显示参数，不是反演的气溶胶场；Enceladus 羽流为示意，非观测。
- 3C 局部行星系统、卫星跟随、比例模式与局部轨道面板尚未实施；主 JS 包 681 kB 的体积告警沿用既有状态。
'''
(D/'验收报告.md').write_text(report,encoding='utf-8')

def im(p,title):n=Path(p).name;return f'<figure><a href="{n}"><img loading="lazy" src="{n}" alt="{title}"></a><figcaption>{title}</figcaption></figure>'
view={'standard':'正面','side':'侧光','detail':'细节','survey':'测绘区（补光）','plume-teaching':'羽流示意教学层'}
g='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SOLARIS 3B 验收</title><style>body{max-width:1500px;margin:40px auto;padding:0 24px;background:#09111b;color:#dce4ed;font:16px/1.8 system-ui}a{color:#acd3e9}h2{font-weight:400;margin-top:40px}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}img{width:100%;border:1px solid #2b4356}figure{margin:0}figcaption{font-size:13px;color:#9db3c4}</style><h1>SOLARIS 3B · 18 颗卫星独立资产</h1><p>Chrome 2560×1440 真实运行截图，点击查看原图。<a href="../../../docs/phase-3b/验收报告.md">验收报告</a></p>'
for i in order:
    g+=f"<h2>{body[i]['displayNameZh']} {body[i]['displayNameEn']} · {i}</h2><div class=row>"+''.join(im(x['path'],view.get(x['view'],x['view'])) for x in cb[i]['captures'])+'</div>'
g+='<h2>主场景</h2><div class=row>'+im('chrome-overview-2560.png','进入资产台前的原总览')+'</div></html>'
(S/'验收预览.html').write_text(g,encoding='utf-8')

modified=[p for p in git('diff','--name-only',BASE).splitlines() if (R/p).is_file()]
untracked=git('ls-files','--others','--exclude-standard').splitlines()
added=[p for p in untracked if (p.startswith(('src/','scripts/')) or p.endswith('.cmd')) and (R/p).is_file()]
patch=git('diff',BASE,'--',*modified).encode('utf-8')
for name in added:
    content=(R/name).read_text(encoding='utf-8').splitlines(keepends=True)
    patch+=(f'diff --git a/{name} b/{name}\nnew file mode 100644\n'+''.join(difflib.unified_diff([],content,fromfile='/dev/null',tofile='b/'+name))).encode('utf-8')
(D/'source-changes.patch').write_bytes(patch)
(D/'change-list.json').write_text(json.dumps(dict(base=git('rev-parse',BASE).strip(),modified=modified,addedCode=added,addedData=['public/assets/moons','data/phase-3b (raw rasters excluded by .gitignore)'],frozenScienceFiles=59),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if '--prepare-only' in sys.argv:print('3B report, gallery and patch prepared');raise SystemExit(0)
files=set(modified+added+['scripts/serve-phase2.py','package.json','package-lock.json','tsconfig.json'])
files.update(p for p in untracked if p.startswith('data/phase-3b/'))
for folder in ['dist','public/assets/moons','docs/phase-3b','output/playwright/phase-3b/final','SOLARIS_phase3_reference']:
    files.update(p.relative_to(R).as_posix() for p in (R/folder).rglob('*') if p.is_file())
files={p for p in files if (R/p).is_file()}
hashes={p:dict(bytes=(R/p).stat().st_size,sha256=hashlib.sha256((R/p).read_bytes()).hexdigest()) for p in sorted(files)}
archive=O/'SOLARIS_第3期_3B_天然卫星资产与姿态_验收包.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.writestr('00-开始验收.txt',f'SOLARIS 3B\n\n双击 05-启动SOLARIS卫星资产3B.cmd，打开 http://127.0.0.1:4175/ ，点击顶部「卫星资产 · 3B」。\n截图总览：output/playwright/phase-3b/final/验收预览.html\n报告：docs/phase-3b/验收报告.md\n源码为 {BASE} 之上的增量，差异见 docs/phase-3b/source-changes.patch。\n3C 局部行星系统尚未实施。\n')
    z.writestr('FILE_MANIFEST.json',json.dumps(hashes,ensure_ascii=False,indent=2))
    for p in sorted(files):z.write(R/p,p)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for p,entry in hashes.items():assert hashlib.sha256(z.read(p)).hexdigest()==entry['sha256']
summary=dict(archive=archive.name,bytes=archive.stat().st_size,sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),files=len(files),crcAndPerFileSha256='PASS')
(O/'SOLARIS_3B_材料包校验.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,ensure_ascii=False))
