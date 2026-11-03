"""Build 3A review docs and an offline runtime + incremental source bundle."""
from pathlib import Path
import json,hashlib,zipfile,subprocess,sys,difflib
R=Path(__file__).resolve().parent.parent;D=R/'docs/phase-3a';S=R/'output/playwright/phase-3a';O=R/'deliverables';O.mkdir(exist_ok=True)
def read(p):return json.loads((R/p).read_text(encoding='utf-8-sig'))
m=read('data/phase-3a/manifest.json');v=read('docs/phase-3a/independent-validation.json');rt=read('docs/phase-3a/runtime-validation.json');c=read('docs/phase-3a/chrome-report.json');e=read('docs/phase-3a/msedge-report.json');bs=read('docs/phase-3a/browser-science.json')
assert v['allPositionBudgetsPassed'] and rt['samples']==1530 and len(bs['cases'])==54
assert all(x['exitCode']==0 for x in read('docs/phase-3a/command-exit-codes.json'))
table='| 卫星 / ID | 内核回包标识 | 平均半径 km | 步长 min | 最大 / 平均位置差 km | 最大速度差 km/s |\n|---|---|---:|---:|---:|---:|\n'
for o in m['objects']:
    a=next(x for x in v['summaries'] if x['id']==o['id']);table+=f"| {o['zh']} / {o['id']} | {o['solution']} | {o['physical']['radiusKm']} | {o['stepSeconds']/60:g} | {a['maxPositionKm']:.6f} / {a['meanPositionKm']:.6f} | {a['maxVelocityKmPerSec']:.9f} |\n"
perf='| 浏览器 / 系统 | rAF P50 / P95 ms | 原总览 GPU P95 ms | 核验图 GPU P95 ms | 核验几何数 |\n|---|---:|---:|---:|---:|\n'
for label,a in [('Chrome',c),('Edge',e)]:
    for s in a['systems']:
        name=next(o['name'] for o in [{'id':'399','name':'地球'},{'id':'499','name':'火星'},{'id':'599','name':'木星'},{'id':'699','name':'土星'},{'id':'799','name':'天王星'},{'id':'899','name':'海王星'}] if o['id']==s['id'])
        perf+=f"| {label} / {name} | {s['rafP50']:.2f} / {s['rafP95']:.2f} | {s['main']['gpuRender']['p95Ms']:.3f} | {s['diagnostic']['gpuRender']['p95Ms']:.3f} | {s['geometryCount']} |\n"
res=v['resonance'];soak=c['soak'];record=c['recording'];maxp=max(x['maxPositionKm'] for x in v['summaries']);maxv=max(x['maxVelocityKmPerSec'] for x in v['summaries']);maxrel=max(x['maxRelativePosition'] for x in v['summaries'])
report=f'''# SOLARIS 3A：天然卫星数据与真实轨道验收材料

2026-10-29（Asia/Shanghai）。本轮完成 **3A 数据与轨道**，到此停止；3B 形状/材质/姿态、3C 局部探索未实施。截图中的卫星均为中心定位点，不是已完成的天体表面或不规则形状模型。全部测试为真实运行结果，视觉和产品验收仍由用户确认。

## 工程审查、恢复点与复用

开发前已建立真实 Git commit：`3da16f2999bcb4c6d2449ccf119d225a8ded263b`。它保存太阳与总览 B 阶段返修，之前 A 阶段与第 1 期恢复点仍保留。可在当前仓库另建恢复副本：`git worktree add ../SOLARIS-before-3A 3da16f2`，无需回退当前工作区。

本地已存在太阳与八大行星资产、地球 Hero、真实位置与速度、UTC/TDB、比例与相机；此前视觉效果仍待用户最终验收。先前没有已完成的卫星、小行星或教学模块，本轮不将其计作可复用成果。

冻结检查确认原科学层 **59 文件逐字节未变**。`src/render`、既有 `public/assets` 及 `data/phase-2` 相对恢复点无 Git 内容改动。新增适配器绑定原 `EphemerisProvider.prototype.state` 求值方法：原构造器仍校验九天体，新适配器另校验十八卫星的本体中心契约，再复用同一 Hermite 算法；没有复制或替换行星求值器。时间仍只由原 `TimeController` 提供。

新增模块在 `src/satellites/`；`src/main.ts` 和 `index.html` 仅增加懒加载数据入口及共享时间更新，原总览、相机和资产照常工作。核验图用单独的局部线性坐标绘制真实历表轨迹，点尺寸为屏幕标记，主行星线框按同一 km 映射，仅供位置参照。没有新增卫星聚焦、跟随、表面或自转系统。

## 数据架构与来源

18 颗身份、父体本体中心 ID 由每份 [JPL Horizons 官方接口](https://ssd-api.jpl.nasa.gov/doc/horizons.html) 回包再次确认。查询 `VECTORS / ICRF / FRAME / NONE / KM-S / TDB`，中心分别是地球 399、火星 499、木星 599、土星 699、天王星 799、海王星 899，未用 3/4/5/6/7/8 系统质心代替本体中心。

各卫星保存父体中心相对位置和速度的 Float64 数据。全球状态通过同一历元的 `parentSSB + moonRelative` 合成，位置与速度各加一次；API 返回独立的参考中心字段和组合来源，避免重复叠加父体。54 个固定日期全球位置另与直接 SSB 查询交叉检查，最大差 {max(x['maxGlobalPositionKm'] for x in v['summaries']):.6f} km；不将这个三日期结果推广为全部时间误差。

公开运行覆盖区间统一为 **2024-01-01 00:00 UTC 至 2031-01-01 00:00 UTC**，原始网格多留边界以供插值。每颗对象另有自身缓存起止、步长、来源清单、内核回包标识、API 版本、请求参数、抓取时间与 SHA-256。不声称拥有服务器 SPK 二进制文件或其完整原生覆盖；`*_merged` 名称以实际回包为准，不由网页概览猜测。

运行 F64 共 **42,705,600 bytes**，格式为小端七列：TDB 秒、x/y/z km、vx/vy/vz km/s。卫星层按需加载并验证每个文件哈希；浏览器播放时不向 NASA 发请求。加载失败只禁用可选数据层，原九天体继续运行；注入一个损坏字节后的拒绝和恢复重试已在浏览器验证。

平均半径来自归档的 [JPL 卫星物理参数表](https://ssd.jpl.nasa.gov/sats/phys_par/)，包括误差与参考编号。十八份姿态记录均核查了 `pck00011.tpc` 中的 IAU frame 可求值，但质量标记为 **METADATA_ONLY_NOT_RENDERED_3A**：没有把 generic lunar PCK 当作高精度天平动结果。资产记录为 **NOT_IMPLEMENTED_3B / NO_SURFACE_MESH**，没有分发卫星贴图，颜色仅用于定位点。没有使用概念图数字或裁图作贴图。

LSK 继续使用原 `naif0012.tls`；未来 UTC 沿用最后已知闰秒，并非未来事件预测保证。超限明确拒绝外推。

## 十八卫星逐项位置与速度检验

每颗 85 个留出状态：3 个指定 UTC 日期（2025-01-01、2026-08-01、2030-01-01）、48 个固定随机种子抽样、32 个网格半步时刻、2 个距离覆盖边界内侧 1 秒的时刻，共 **1,530**。查询与网格分开保存，未把验证数据用于插值建模。每颗目标为局部位置差 / 采样特征半径 < 0.01%；另加速度工程门槛 0.001 km/s，均通过。

{table}

整体最大位置差 **{maxp:.6f} km**，最大相对位置差 **{maxrel*100:.6f}%**，最大速度差 **{maxv:.9f} km/s**。这衡量离线插值相对 JPL 留出回包的工程误差，不等于实际天文观测不确定度。独立 Python 重算与浏览器所用 TypeScript 求值器均通过。CSV 包含 JPL 与插值各自的三维位置、速度及误差；`fixed-dates-errors.csv` 为 54 行，`errors.csv` 为 1,530 行。

JPL 显示的 JDTDB 只有九位小数，约有 ±43 微秒显示量化。初版恰在 UTC 数据窗边缘的回包时间字符串略越界，原求值器正确拒绝。最终将两项边缘留出查询移至内侧 1 秒，并保留旧请求/原始数据和首轮失败日志；没有放宽求值器范围或舍弃数值超差结果。精确端点另由运行时及浏览器测试直接验证。

## 需要单独确认的轨道现象

- 木卫统计采用 2026 年全年、每两小时一个时刻，共 {res['samples']} 次；Io/Europa 角速率比 {res['ioEuropaRatio']:.6f}、Europa/Ganymede 比 {res['europaGanymedeRatio']:.6f}、Io/Ganymede 比 {res['ioGanymedeRatio']:.6f}，表现出近 4:2:1。共同轨道平面中的投影真实经度组合中心 {res['projectedTrueLongitudeCombination']['centerDegrees']:.3f}°、最大偏离 {res['projectedTrueLongitudeCombination']['maxDeviationDegrees']:.3f}°。这是近圆轨道的几何诊断，不冒充经过滤波的平均根数共振角或长期稳定性证明。Callisto 不在该三体成员中。
- 天王星五卫星以真实 `r×v` 求轨道极，黄道倾角约 93.34°–101.56°（含 Miranda），没有压到黄道面。
- Triton 的归一化轨道角动量与海王星真实自转方向点积约 **−0.92276**，确认逆行。行星自转方向由原 PCK 的相邻姿态矩阵变化独立求得，未简单假定 IAU +Z 就是自转方向。
- Phobos/Deimos 的采样平均周期约 0.319/1.262 天，半径与速度不同；3A 没有实现它们的形状。
- 地心至地月质心三日期距离约 4,429–4,767 km，沿地月方向比例约 0.01215058，横向残差 <0.002 km。未用地月质心作为地心。

## 实机浏览器、资源与画面

Windows 11 / Ryzen 9 8945HX / RTX 5060 Laptop GPU，环境重新保存在 `hardware-*.json`。Chrome {c['browser']}、Edge {e['browser']}，有实际窗口，DPR=1；测试只关闭 Windows 遮挡窗口节流，未关闭 vsync。1920×1080、2560×1440、3840×2160 均检查无页面溢出、核验面板不遮底部时间轴、表格字体 13px。六系统原始截图以 1440p 为主。

Chrome {len(c['checks'])} 项、Edge {len(e['checks'])} 项完整断言通过，控制台异常和失败资源均为零；包括十八实际定位点与独立矩阵投影核对、同一时钟、暂停、正/倒/零倍率、日期跳转、范围边界、比例切换、打开关闭预览不改原相机、地球 Hero 9 天体/8 轨迹回归。另有 {len(bs['checks'])} 项补充断言，包含 **54 个实际浏览器 / JPL 状态对照**与损坏缓存故障注入及恢复。

{perf}

rAF 表示浏览器回调间隔，不是屏幕物理呈现率；两个独立 WebGL context 的 GPU P95 不相加作总 P95。无法从 WebGL 获取真实显存字节数，保留各自对象计数与既有纹理解码预算，不将估算称为实测 VRAM。

Chrome 另运行 **{soak['elapsedSeconds']:.3f} 秒 / 30 次系统切换**，相同系统的 GPU 几何/纹理对象数保持一致，核验层纹理为 0。强制 GC 前后 JS used heap 为 {soak['heapBefore']['usedSize']:,} → {soak['heapAfter']['usedSize']:,} bytes；未见对象数量持续增长，这个约一分钟测试不证明无限时长无泄漏。

真实录屏 **{record['duration']:.2f} 秒**，源视口 2560×1440，编码 1920×1080，已实际解码播放 {record['decodedSeconds']:.2f} 秒；包含六系统、时间操作、切换和回归。PNG 原图另存。最终构建已重跑完整交互/性能测试与 54 组浏览器数值对照。

首轮 1080p 面板与 footer 重叠，已修正并完成三分辨率复测；失败日志保留。逐张复核还发现土星内卫星标签重叠，已增加避让引线及六系统无标签交叠检查；定位点和真实轨道未改变。图形只作为 3A 数据核验，不声称完成 3B 的十八颗近景材质验收。

一次长时复测因核验面板意外隐藏、选择器不可见而超时（`browser-soak-hidden-retry.log`）。随后加入键盘、点击与可见性失败诊断，同一完整用例重跑通过；该现象尚未重现，**未声称根因已定位或修复**，列为待观察问题。没有绕过可见性断言取得通过。

## 测试命令、变更和复现

`command-exit-codes.json` 保存六个最终命令及真实退出码（均 0）：原科学回归 14 项 / 432 留出状态、契约 15 项、新增运行时 16 项 / 1,530 状态、独立 Python 1,530 状态与动力学统计、科学文件冻结、原渲染/资产内容冻结。构建 TypeScript/Vite 通过；保留 >500KB chunk 和 Node experimental-transform-types 提示。仓库没有 lint 脚本，不声称 lint 通过。

原始回包与参数：`data/phase-3a/raw/`；运行与来源清单：`public/satellites/manifest.json`；独立统计：`independent-validation.json`；完整浏览器日志、JSON 与 CSV 均在本目录。科学模块和既有资产未改动，差异补丁与 `change-list.json` 随包提供。

运行：双击 `04-启动SOLARIS卫星3A.cmd`。重建源码依赖恢复点中的既有工程：`npm ci` → `npm run build`。启动服务后运行 `node scripts/satellite-browser-qa.mjs`、`node scripts/satellite-browser-science-qa.mjs`。数据复建使用固定依赖 `scripts/requirements-phase3a.txt`，执行 `scripts/build-satellites.py`；请求串行、缓存优先、查询不匹配即拒绝覆盖。网络采集曾遇 502/SSL EOF，最终采用小批次并全部完成；不会用虚构轨道补数据。

依赖风险仍保留：此前太阳纹理背面/经度、静态天气和材质增强的限制没有借 3A 更改；先前 A/B 视觉待用户最终验收。卫星数据只覆盖本缓存、同源 JPL 交叉抽样，未做独立观测检验。3B/3C、小行星与教学专题均保持未实施。**本轮停止在 3A，提交验收。**
'''
(D/'验收报告.md').write_text(report,encoding='utf-8')

def im(name,title):return f'<figure><a href="{name}"><img loading="lazy" src="{name}" alt="{title}"></a><figcaption>{title} · 点击原图</figcaption></figure>'
gallery='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SOLARIS 3A 验收</title><style>body{max-width:1400px;margin:40px auto;padding:0 24px;background:#09111b;color:#dce4ed;font:16px/1.8 system-ui}a{color:#acd3e9}img,video{width:100%;background:#070e17;border:1px solid #2b4356;border-radius:6px}figure{margin:24px 0}figcaption{color:#9ab0c3}summary{padding:18px;background:#142330;cursor:pointer;margin-top:20px}</style><h1>SOLARIS · 3A 天然卫星数据与真实轨道</h1><p>18 卫星 / 6 系统 / 1,530 留出状态。当前只做数据和轨迹，中心定位点不代表卫星半径或形状；尚未制作卫星材质和局部探索。</p><p><a href="../../../docs/phase-3a/验收报告.md">验收报告</a> · <a href="../../../docs/phase-3a/fixed-dates-errors.csv">三日期 54 行误差 CSV</a> · <a href="../../../docs/phase-3a/independent-validation.json">独立科学统计</a> · <a href="../../../docs/phase-3a/chrome-report.json">Chrome 实测</a> · <a href="../../../docs/phase-3a/msedge-report.json">Edge 实测</a></p>'''
gallery+=f'<p>真实浏览器录屏 {record["duration"]:.2f} 秒，1440p 源视口 / 1080p 编码；底部原时间轴驱动全部数据。</p><video controls preload="metadata" poster="chrome-system-799-2560.png" src="satellite-data-interaction.webm"></video>'
for id,title in [('399','地月系统'),('499','火星 · Phobos / Deimos'),('599','木星四大卫星'),('699','土星五颗重点卫星'),('799','天王星 · 真实空间倾斜'),('899','海王星 · Triton 真实轨迹')]:gallery+=im(f'chrome-system-{id}-2560.png',title+' · Chrome 2560×1440')
gallery+='<details><summary>Edge 六套系统</summary>'+''.join(im(f'msedge-system-{id}-2560.png',id+' 系统 · Edge') for id in ['399','499','599','699','799','899'])+'</details>'
gallery+='<details><summary>桌面分辨率与原场景回归</summary>'+''.join(im(name,title) for name,title in [('chrome-layout-1920.png','1920×1080'),('chrome-layout-3840.png','3840×2160'),('chrome-overview.png','原总览保留'),('chrome-earth-regression.png','原地球 Hero 保留'),('baseline-overview-2560.png','开发前基线')])+'</details>'
gallery+='<p>本轮到 3A 停止；3B 资产姿态、3C 局部探索、小行星与教学功能未展开。所有参考概念图只作为风格参考。</p></html>'
(S/'验收预览.html').write_text(gallery,encoding='utf-8')

modified=subprocess.check_output(['git','diff','--name-only','3da16f2'],cwd=R,text=True,encoding='utf-8').splitlines()
added=[p.relative_to(R).as_posix() for p in (R/'src/satellites').glob('*') if p.is_file()]+['04-启动SOLARIS卫星3A.cmd','scripts/build-satellites.py','scripts/requirements-phase3a.txt','scripts/verify-satellites.mjs','scripts/validate-satellites.py','scripts/satellite-browser-qa.mjs','scripts/satellite-browser-science-qa.mjs','scripts/finalize-phase3a-tests.py','scripts/package-phase3a.py','scripts/verify-phase3a-gallery.mjs']
added=[p for p in added if (R/p).is_file()]
patch=subprocess.check_output(['git','diff','3da16f2','--',*modified],cwd=R)
for name in added:
    content=(R/name).read_text(encoding='utf-8').splitlines(keepends=True)
    patch+=(f'diff --git a/{name} b/{name}\nnew file mode 100644\n'+''.join(difflib.unified_diff([],content,fromfile='/dev/null',tofile='b/'+name))).encode('utf-8')
(D/'source-changes.patch').write_bytes(patch)
(D/'change-list.json').write_text(json.dumps(dict(base='3da16f2999bcb4c6d2449ccf119d225a8ded263b',modified=modified,addedCode=added,addedData=['data/phase-3a','public/satellites'],frozenScienceFiles=59,oldRendererAndAssetsChanged=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if '--prepare-only' in sys.argv:print('3A report, gallery and patch prepared');raise SystemExit(0)
assert (D/'gallery-smoke.json').exists()
files=set(modified+added+['scripts/serve-phase2.py','package.json','package-lock.json','tsconfig.json'])
for folder in ['dist','public/satellites','data/phase-3a','docs/phase-3a','output/playwright/phase-3a','SOLARIS_phase3_reference']:
    files.update(p.relative_to(R).as_posix() for p in (R/folder).rglob('*') if p.is_file() and 'video-work' not in p.parts and '.partial.' not in p.name and not p.name.startswith('iteration-'))
files={p for p in files if (R/p).is_file()}
hashes={p:dict(bytes=(R/p).stat().st_size,sha256=hashlib.sha256((R/p).read_bytes()).hexdigest()) for p in sorted(files)}
archive=O/'SOLARIS_第3期_3A_天然卫星数据与轨道_验收包.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.writestr('00-开始验收.txt','SOLARIS 3A（2026-10-29）\n\n双击 04-启动SOLARIS卫星3A.cmd 运行完整预构建版。\n打开 output/playwright/phase-3a/验收预览.html 查看原始截图及录屏。\n报告、54/1530 行 CSV、来源及原始请求均随包。\n源码为 3da16f2 恢复点上的增量，重建需原仓库；dist 可独立运行。\n3A 到此停止；3B/3C 未实施。\n')
    z.writestr('FILE_MANIFEST.json',json.dumps(hashes,ensure_ascii=False,indent=2))
    for p in sorted(files):z.write(R/p,p)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for p,entry in hashes.items():assert hashlib.sha256(z.read(p)).hexdigest()==entry['sha256']
summary=dict(archive=archive.name,bytes=archive.stat().st_size,sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),files=len(files),crcAndPerFileSha256='PASS')
(O/'SOLARIS_3A_材料包校验.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,ensure_ascii=False))
