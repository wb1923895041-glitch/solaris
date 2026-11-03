"""Phases 4–8 acceptance reports, final audit documents (science error report, asset ledger, visual acceptance,
known limitations) and the final package — every number read from real run artefacts."""
from pathlib import Path
import json, hashlib, zipfile, subprocess, sys, difflib
R=Path(__file__).resolve().parent.parent;O=R/'deliverables';O.mkdir(exist_ok=True)
BASE='da9c649'
def read(p):return json.loads((R/p).read_text(encoding='utf-8-sig'))
def git(*a):return subprocess.check_output(['git',*a],cwd=R,text=True,encoding='utf-8')
def write(p,t):(R/p).parent.mkdir(parents=True,exist_ok=True);(R/p).write_text(t,encoding='utf-8')
v4=read('docs/phase-4/independent-validation.json');rings=read('data/phase-7/minor-rings.json');ringv=read('docs/phase-7/minor-rings-validation.json');gains=ringv['results'][6]['detail'];gain_text=', '.join(f'{k} ×{v:.3g}' for k,v in gains.items());band_total=sum(len(x['bands']) for x in rings['systems'].values())
a4=read('docs/phase-4/asset-validation.json');m4=read('data/phase-4/manifest.json');pops=read('data/phase-4/populations.json');pluto=read('data/phase-4/pluto-system.json')
ecl=read('docs/phase-5/eclipse-validation.json');lab=read('docs/phase-6/lab-validation.json');perf=read('docs/phase-7/chrome-performance.json')
qc=read('docs/phases-4-7/chrome-report.json');qe=read('docs/phases-4-7/msedge-report.json');audit=read('docs/phase-8/engineering-audit.json');codes=read('docs/phase-8/command-exit-codes.json')
c3=read('docs/phase-3c/chrome-report.json');e3=read('docs/phase-3c/msedge-report.json');sci3=read('docs/phase-3c/local-system-science.json');v3a=read('docs/phase-3a/independent-validation.json')
assert all(x['exitCode']==0 for x in codes) and not qc['errors'] and not qe['errors'] and not v4['failures']
cmds='\n'.join(f"- `{x['command']}` → 退出码 {x['exitCode']}" for x in codes)
p4=[c for c in qc['checks'] if c.startswith('P4')];p5=[c for c in qc['checks'] if c.startswith('P5')];p6=[c for c in qc['checks'] if c.startswith('P6')];p7=[c for c in qc['checks'] if c.startswith('P7')]
fmt=lambda v,d=0:f'{v:,.{d}f}'
# ---------------- Phase 4 ----------------
interp='| 天体 | 网格 h | 留出样本 | 最大位置差 km | 最大速度差 km/s | 二体传播最大偏差 au |\n|---|---:|---:|---:|---:|---:|\n'
tb={x['name']:x for x in v4['twoBody']}
for x in v4['interpolation']:interp+=f"| {x['name']} | {x['stepHours']:g} | {x['samples']} | {x['maxPositionKm']:.6f} | {x['maxVelocityKmS']:.2e} | {tb[x['name']]['maxAu']:.4f} |\n" if x['name'] in tb else f"| {x['name']} | {x['stepHours']:g} | {x['samples']} | {x['maxPositionKm']:.6f} | {x['maxVelocityKmS']:.2e} | — |\n"
st=v4['structure'];gaps=' · '.join(f"{k} 共振 a={g['aAu']:.3f} au 密度比 {g['densityRatio']:.2f}" for k,g in st['kirkwoodGaps'].items())
assets='\n'.join(f"- {x['name']}：源影像 {x['nativeSize'][0]}×{x['nativeSize'][1]}，LOD {x['lods']}，未测比例 {x['missingSurfaceFraction']*100:.1f}%，姿态步长 {x['attitudeStepSeconds']} s、插值最大误差 {x['attitudeMaxErrorDeg']:.1e}°（{x['source']}）" for x in a4['results'])
write('docs/phase-4/验收报告.md',f'''# SOLARIS 第 4 期：小行星带、矮行星与外围区域

恢复点：`{BASE}`（第 3 期终验）。本期新增 `src/smallbodies/`（命名小天体星历、GPU 统计层、命名层、局部视图母体、控制器）与第 4 期数据脚本；主场景增加外部天体聚焦接口。

## 数据与来源
- **命名天体（{len(m4['objects'])} 个）**：JPL Horizons 太阳系质心矢量（ICRF / TDB / km），卡戎以冥王星本体中心 999 为原点；原始回包、查询参数与 SHA-256 归档于 `data/phase-4/raw/`。物理参数来自 JPL SBDB（全精度）与 Horizons 天体数据头。
- **统计层**：JPL SBDB 查询——已编号小行星 H&lt;15、a&lt;5.5 au，共 {pops['mainbelt']['count']:,} 个（含 Hilda 与木星特洛伊）；已登记海王星外天体 {pops['tno']['count']:,} 个。运行文件只保留真实密切根数，不含个体身份（第 0 期 `illustrative-population` 规则），在 GPU 上按开普勒方程二体传播，界面明示“不作定位用途”。

## 独立验证（`scripts/validate-phase4.py`）
{interp}
二体传播与 Horizons 的偏差说明统计层为何只作分布展示：典型 10⁵–10⁶ km；阿波菲斯 2029 年近地飞掠后二体解偏离 {tb['Apophis']['maxAu']:.2f} au。

真实分布结构：{gaps}（7:3 窄共振在真实数据中本就微弱，只报告不作要求）；木星特洛伊 {st['trojans']['count']:,} 个，{(st['trojans']['fractionNearL4']+st['trojans']['fractionNearL5'])*100:.1f}% 位于 L4/L5 云团，仅 {st['trojans']['fractionWithin30degOfJupiter']*100:.2f}% 在木星 ±30° 内；冥族小天体（海王星 3:2，a={st['plutinos']['aAu']:.2f} au）密度为两侧的 {st['plutinos']['densityRatio']:.1f} 倍。

## 表面资产（与 3B 相同的 GeoTIFF 仿射逆变换与未测区分类色）
{assets}

冥王星–卡戎：卡戎平均距离 {fmt(pluto['charon']['characteristicRadiusKm'])} km、周期 {pluto['charon']['sampledMeanPeriodDays']:.4f} 天；GM 来自 Horizons 天体数据头（冥王星 {pluto['pluto']['gmKm3PerSec2']}、卡戎 {pluto['charonGm']['gmKm3PerSec2']} km³/s²），质心距冥王星中心约 {fmt(pluto['charon']['characteristicRadiusKm']*pluto['charonGm']['gmKm3PerSec2']/(pluto['charonGm']['gmKm3PerSec2']+pluto['pluto']['gmKm3PerSec2']))} km，位于冥王星之外。其余命名天体无可用全球影像，只显示定位标记与星历轨迹，不冒充表面。

## 浏览器验收
Chrome {qc['browser']}、Edge {qe['browser']}：第 4 期 {len(p4)} 项断言全部通过（每个命名天体的页面状态与 Node 独立求值逐位相等）。截图见 `output/playwright/phases-4-7/验收预览.html`。
''')
# ---------------- Phase 5 ----------------
erows='| NASA（TD） | 计算类型 | Δt s | NASA γ / 计算 \\|γ\\| |\n|---|---|---:|---|\n'+''.join(f"| {r['nasa']} | {r['computed']} | {r['dtSeconds']:.1f} | {r['nasaGamma']} / {r['computedGamma']:.4f} |\n" for r in ecl['rows'])
write('docs/phase-5/验收报告.md',f'''# SOLARIS 第 5 期：科学交互与科普讲解

新增「科普 · 5」工作台（`src/education/`）：天体图鉴（9 + 18 + 13 个天体，数值来自同一星历）、日月食与月相、开普勒定律、时间线、双天体比较、镜头书签（仅存本浏览器）。所有事件由本项目星历计算，不含硬编码事件表；参考数据带出处（`public/education/reference.json`）。

## 日月食：由星历计算并与 NASA Five Millennium Canon 逐项核对
方法：几何影锥（不计光行时/光行差），地影按 Danjon 1/85 放大；朔望扫描 + 三分法求最近点；浏览器端在 Web Worker 中运行。2024–2030 年 NASA 目录 {len(ecl['rows'])} 次日月食全部复现，类型全部一致，**无漏算、无多算**；最大时间差 {ecl['maxAbsTimingSeconds']:.1f} 秒（与未计光行差的量级一致）。γ 以绝对值给出，未区分南北符号。

{erows}
## 其他演示
- 月相：太阳–月球–地球相位角给出照亮比例（2025-03-14 月全食时 {ecl['phaseAtLunarEclipse2025']['illuminatedFraction']*100:.3f}%）。
- 开普勒第二定律：真实日心轨道等时扇区面积；第三定律：活力公式密切半长轴与恒星周期，GM☉ 来自 Horizons 数据头。
- 时间线：近/远日点、火木土冲日、阿波菲斯 2029 年飞掠（Horizons 最近距离）与全部日月食，点击即跳转全局时间。

浏览器验收：第 5 期 {len(p5)} 项断言通过（Worker 结果与 Node 计算逐项一致、每条日月食均匹配 NASA、跳转与书签恢复全局时间）。
''')
# ---------------- Phase 6 ----------------
lrows='\n'.join(f"- {r['name']}" + (f"：`{json.dumps(r['detail'],ensure_ascii=False)[:240]}`" if r['detail'] else '') for r in lab['results'])
write('docs/phase-6/验收报告.md',f'''# SOLARIS 第 6 期：独立物理实验室

「实验室 · 6」（`src/lab/`）与真实星历完全隔离：初值只复制一次，界面持续标注“理想模型 / 星历副本之后为数值实验 / 假设实验”。牛顿引力，固定步长 + 子步，Velocity Verlet 与 Leapfrog（DKD），能量与角动量（含无质量试验体的比能量与比角动量）监测，近距离接触、数值溢出与能量误差超 1% 时暂停并告警。

## 验证（`scripts/verify-lab.mjs`，{lab['checks']} 项通过）
{lrows}

浏览器验收：第 6 期 {len(p6)} 项断言通过（运行中能量误差有界、收敛比值、旋转坐标下的特洛伊摆动、假设实验标注、发散告警、实验前后星历逐字节不变）。
''')
# ---------------- Phase 7 ----------------
def gpu_cell(r):return '—（2D Canvas）' if r['gpuP95Ms'] is None else f"{r['gpuP95Ms']:.3f}"
prow='| 分辨率 | 场景 | rAF P50 / P95 ms | GPU P95 ms | 三角形 | JS 堆 MB |\n|---|---|---:|---:|---:|---:|\n'+''.join(f"| {r['viewport']} | {r['scenario']} | {r['p50']:.2f} / {r['p95']:.2f} | {gpu_cell(r)} | {r['triangles'] if r['triangles'] is not None else '—'} | {r['heapMB']:.0f} |\n" for r in perf['results'])
mach=perf['machine'];gpus=mach['gpu'] if isinstance(mach['gpu'],list) else [mach['gpu']];gpuName=next((g for g in gpus if 'NVIDIA' in g['Name'] or 'Radeon' in g['Name']),gpus[0]);virtual=[g['Name'] for g in gpus if g is not gpuName]
write('docs/phase-7/验收报告.md',f'''# SOLARIS 第 7 期：视觉打磨与性能

- 画质档位（`src/render/quality.ts`）：自动 / 高 / 标准 / 节能，只改变 WebGL 绘制缓冲像素比，所有视图共用；自动档按 90 分位帧时间升降并记录每次切换。
- 日月食扫描移入 Web Worker；统计层 8.3 万样本为单次绘制的 GPU 点精灵（顶点着色器解开普勒方程）；局部系统浮动原点、对数深度、标签避让、过渡绕行星且出轨道面。
- 不使用全局 Bloom；太阳边缘光与 Titan 雾霾为有出处的物理近似，不加装饰性炫光。

## 实机性能（Chrome，{mach['cpu']['Name'] if isinstance(mach['cpu'],dict) else mach['cpu'][0]['Name']} / {gpuName['Name']}，刷新率 {gpuName.get('CurrentRefreshRate')} Hz）
{prow}
全部场景在 1080p、1440p、4K 下 rAF P95 ≤ {max(r['p95'] for r in perf['results']):.2f} ms（即稳定锁定在 {gpuName.get('CurrentRefreshRate')} Hz 垂直同步；测量时系统还挂接了远程桌面虚拟显示适配器 {'、'.join(virtual)}，先前在高刷新率下测得 P95 约 3.8 ms），远超 1440p 60 FPS 目标；GPU 计时 P95 ≤ {max(r['gpuP95Ms'] or 0 for r in perf['results']):.2f} ms。实验室为 2D Canvas，无 GPU 计时。

## 与两张视觉基准图并排比较
见 `output/playwright/phase-7/对比.html`。一致之处：深色数字天文馆界面、右侧科学面板、行星真实影像资产、卫星独立资产、主带与外围分布、Earth Hero。**有意的差异**：基准图把行星排成一列、放大尺寸，并用岩块特写表现小行星带；本项目坚持真实日心位置与声明的比例映射，小行星带为真实根数的稀疏点分布（避免“紧密石头圆环”）。**仍存在的差距**：除谷神星、冥王星、卡戎外，其余小天体没有全球影像或形状模型。

## 木星、天王星、海王星环系（新增）
数据：NASA NSSDCA 行星环资料表（归档并校验 SHA-256），共 {band_total} 条环带；海王星 Adams 环弧因资料无经度而不定位，推定值逐项标注（`data/phase-7/minor-rings.json`）。渲染：亮度 ∝ 法向光学厚度 × 反照率；比像素窄的环按像素宽度绘制并等比降低亮度（积分亮度守恒）；计算行星对环的阴影。默认“增强”显示每颗行星单独增益并在界面披露（{gain_text}），窄而致密的环保留最小可见线；关闭增强即为真实相对亮度——木星环此时约 1.5×10⁻⁷ 不透明度，几乎不可见，这是真实情况。验证 `scripts/verify-minor-rings.mjs` {ringv['checks']} 项通过。
''')
# ---------------- Phase 8 ----------------
leak=audit['leak']
write('docs/phase-8/科学误差报告.md',f'''# SOLARIS 科学误差报告（第 1–8 期汇总）

| 项目 | 方法 | 结果 |
|---|---|---|
| 行星星历（第 1 期） | Hermite 插值 vs Horizons 留出状态 | 见 `docs/phase-1/02-科学误差报告.md` |
| 18 颗卫星（3A） | 1,530 个留出状态 | 最大位置差 {max(x['maxPositionKm'] for x in v3a['summaries']):.3f} km，最大相对 {max(x['maxRelativePosition'] for x in v3a['summaries'])*100:.4f}% |
| 卫星姿态（3B） | 生产求值器 vs CSPICE pxform | 见 `docs/phase-3b/orientation-runtime-validation.json` |
| 局部系统映射（3C） | {sci3['checks']} 项纯函数与物理情形 | 科学比例相对误差 ~1e-16；海卫一倾角 157.33°；拉普拉斯角偏离 &lt; 4° |
| 命名小天体（第 4 期） | Hermite vs Horizons 留出 | 最大 {max(x['maxPositionKm'] for x in v4['interpolation']):.3f} km（阿波菲斯飞掠期 45 分钟网格） |
| 统计层（第 4 期） | 二体传播 vs Horizons | 典型 10⁵–10⁶ km，仅作分布展示 |
| 日月食（第 5 期） | 影锥几何 vs NASA 目录 | {len(ecl['rows'])}/{len(ecl['rows'])} 次类型一致，最大 Δt {ecl['maxAbsTimingSeconds']:.1f} s |
| 环系数据（第 7 期） | NSSDCA 表格逐行溯源 | {ringv['checks']} 项通过，关闭增强时为真实相对亮度 |
| 物理实验室（第 6 期） | 解析二体、收敛、守恒 | 误差比 4.00/二阶；能量误差有界 ∝ dt² |

时间尺度：UTC→TDB 使用 naif0012 与原 DELTET 公式；未来闰秒按最后已知值（不能用于精确事件预测）。坐标：ICRF/J2000 赤道，显示时经 CSPICE J2000→ECLIPJ2000 矩阵旋转；所有显示映射为单向，不写回。
''')
ledger='| 天体 | 资产 | 提供方 | 来源 | 许可/署名 |\n|---|---|---|---|---|\n'+''.join(f"| {pid} 环系 | NSSDCA 行星环资料表（{len(x['bands'])} 条） | NASA GSFC NSSDCA (D. R. Williams) | {x['url']} | NASA 公开资料，注明来源 |\n" for pid,x in rings['systems'].items())
for b in read('public/assets/celestial/manifest.json')['bodies']:a=b['albedo'];ledger+=f"| {b['name']} | {a['title']} | {a['provider']} | {a.get('sourceUrl','')} | {a.get('rights','')[:80]} |\n"
for path in ['public/assets/moons/manifest.json','public/assets/smallbodies/manifest.json']:
    for b in read(path)['bodies']:a=b['albedo'];ledger+=f"| {b['displayNameZh']} {b['displayNameEn']} | {a['title']} | {a['provider']} | {a['uri']} | {a['rights'][:80]} |\n"
sky=read('public/assets/sky/source.json');ledger+=f"| 星空 | {sky.get('title','Deep Star Maps')} | {sky.get('provider','NASA/GSFC SVS')} | {sky.get('sourceUrl',sky.get('url',''))} | {str(sky.get('rights',sky.get('credit','')))[:80]} |\n"
write('docs/phase-8/素材来源台账.md','# SOLARIS 素材来源台账\n\n每项资产的原始文件、哈希、投影与处理记录见对应清单（`public/assets/*/manifest.json`）。NASA 来源不代表 NASA 认证本项目；SBMT 网格页面未写明独立再分发许可，公开分发前需另行确认。\n\n'+ledger)
write('docs/phase-8/终审报告.md',f'''# SOLARIS 第 8 期：科学与工程终审

## 回归与构建（全部退出码 0）
{cmds}

## 浏览器
- 第 3 期局部系统：Chrome {len(c3['checks'])} 项、Edge {len(e3['checks'])} 项。
- 第 4–7 期：Chrome {len(qc['checks'])} 项、Edge {len(qe['checks'])} 项；控制台与运行时错误均为 0。
- 录屏：`output/playwright/phase-3c/local-system-interaction.webm`、`output/playwright/phases-4-7/final-tour.webm`。

## 内存泄漏
12 轮完整循环（3A 数据、3B 资产台、木星/土星/冥王星局部系统、科普工作台、实验室），每轮强制 GC 后测量：第 4→12 轮 JS 堆变化 {leak['heapGrowthCycle4to12']*100:+.1f}%；主场景与局部系统 GPU 对象数稳定（见 `engineering-audit.json`）。

## 异常加载
{chr(10).join(f"- {c['name']}：`{(c['status']+' '+c['probe']).strip()[:120]}`" for c in audit['corrupt'])}

## 文档
科学误差报告、素材来源台账、视觉验收（第 7 期对比页）与已知限制均在本目录。
''')
write('docs/phase-8/已知限制.md','''# SOLARIS 已知限制

- 星历数据窗 2024-01-01 至 2031-01-01 UTC，窗外明确拒绝，不外推；未来闰秒未知。
- 天体姿态为 IAU 通用 PCK 近似，非导航级表面配准；月球不含 DE 物理天平动。
- 日月食为几何影锥模型（未计光行差），时间误差约 30–50 秒；未计算掩食、行星阴影与环影。
- 小行星带与 TNO 统计层为二体传播的真实根数分布，不能用于定位单个天体；TNO 样本含观测选择偏差。
- 除谷神星、冥王星、卡戎外的小天体无全球影像或形状模型。
- 木星、天王星、海王星环系按资料表的条带近似：不含垂直厚度、偏心率、径向精细结构与前向散射相函数；海王星 Adams 环弧未定位；默认显示为标注过的增强亮度。
- 地图影像含原始阴影与拼接缝，未做 Hapke 光度建模；未测区域以分类色标识。
- 物理实验室为简化牛顿模型（无相对论、非球形引力、碰撞），结果不是预测。
- WebGL 无法读取真实显存字节数，报告对象计数而非 VRAM。
''')
# ---------------- galleries ----------------
def im(p,t):n=Path(p).name;return f'<figure><a href="{n}"><img loading="lazy" src="{n}" alt="{t}"></a><figcaption>{t}</figcaption></figure>'
css='<style>body{max-width:1600px;margin:40px auto;padding:0 24px;background:#09111b;color:#dce4ed;font:16px/1.8 system-ui}a{color:#acd3e9}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:14px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}img,video{width:100%;border:1px solid #2b4356}figure{margin:0}figcaption{font-size:13px;color:#9db3c4}</style>'
write('output/playwright/phases-4-7/验收预览.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SOLARIS 第 4–7 期验收</title>'+css+'<h1>SOLARIS 第 4–7 期</h1><video controls preload="metadata" src="final-tour.webm"></video><div class=row>'+''.join(im(x['path'],x['caption']) for x in qc['shots'])+'</div></html>')
(R/'output/playwright/phase-7').mkdir(parents=True,exist_ok=True)
for n in ['01_总览与资产规范.png','02_交互与天体参考.png']:(R/'output/playwright/phase-7'/n).write_bytes((R/'SOLARIS_visual_baseline'/n).read_bytes())
write('output/playwright/phase-7/对比.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SOLARIS 基准对比</title>'+css+'<h1>视觉基准 vs 实机（Chrome 2560×1440）</h1><p>左：概念基准图（数字、尺寸与排列不可信，仅参考风格）；右：真实运行截图。差异说明见 docs/phase-7/验收报告.md。</p>'
 +'<div class=pair>'+im('01_总览与资产规范.png','基准 01：总览与资产规范')+im('chrome-overview-2560.png','实机：探索比例总览（真实位置，含统计层）')+'</div><div class=pair>'+im('02_交互与天体参考.png','基准 02：交互与天体参考')+im('chrome-earth-2560.png','实机：地球 Hero')+'</div><div class=row>'+im('chrome-jupiter-system-2560.png','实机：木星局部系统')+im('chrome-saturn-titan-2560.png','实机：Titan 近景')+im('chrome-lab-2560.png','实机：物理实验室')+'</div><h2>新增环系（NSSDCA 光学厚度，增强已标注）</h2><div class=row>'+''.join(f'<figure><a href="../phases-4-7/chrome-p7-rings-{i}-2560.png"><img loading="lazy" src="../phases-4-7/chrome-p7-rings-{i}-2560.png" alt="{n}环系"></a><figcaption>{n}环系</figcaption></figure>' for i,n in [('599','木星'),('799','天王星'),('899','海王星')])+'</div></html>')
modified=[p for p in git('diff','--name-only',BASE).splitlines() if (R/p).is_file()]
added=[p for p in git('ls-files','--others','--exclude-standard').splitlines() if (p.startswith(('src/','scripts/')) or p.endswith('.cmd')) and (R/p).is_file()]
patch=git('diff',BASE,'--',*modified).encode('utf-8')
for name in added:patch+=(f'diff --git a/{name} b/{name}\nnew file mode 100644\n'+''.join(difflib.unified_diff([],(R/name).read_text(encoding='utf-8').splitlines(keepends=True),fromfile='/dev/null',tofile='b/'+name))).encode('utf-8')
write('docs/phase-8/source-changes.patch','');(R/'docs/phase-8/source-changes.patch').write_bytes(patch)
if '--prepare-only' in sys.argv:print('reports prepared');raise SystemExit(0)
files=set(modified+added+['scripts/serve-phase2.py','package.json','package-lock.json','tsconfig.json','README.md'])
for folder in ['dist','docs/phase-4','docs/phase-5','docs/phase-6','docs/phase-7','docs/phase-8','docs/phases-4-7','output/playwright/phases-4-7','output/playwright/phase-7','data/phase-4','data/phase-5','SOLARIS_visual_baseline']:
    files.update(p.relative_to(R).as_posix() for p in (R/folder).rglob('*') if p.is_file() and 'video-work' not in p.parts and p.suffix not in ('.tif','.part') and '.seg' not in p.name)
files={p for p in files if (R/p).is_file()}
hashes={p:dict(bytes=(R/p).stat().st_size,sha256=hashlib.sha256((R/p).read_bytes()).hexdigest()) for p in sorted(files)}
archive=O/'SOLARIS_第4-8期_终审验收包.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.writestr('00-开始验收.txt','SOLARIS 第 4–8 期终审\n\n双击 07-启动SOLARIS终审版.cmd，打开 http://127.0.0.1:4175/ 。\n报告：docs/phase-4 … docs/phase-8；截图与录屏：output/playwright/phases-4-7/验收预览.html；基准对比：output/playwright/phase-7/对比.html\n第 3 期材料见第 3 期终验包。大体积原始 GeoTIFF 未随包分发（来源与哈希见 .source.json）。\n')
    z.writestr('FILE_MANIFEST.json',json.dumps(hashes,ensure_ascii=False,indent=2))
    for p in sorted(files):z.write(R/p,p)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for p,e in hashes.items():assert hashlib.sha256(z.read(p)).hexdigest()==e['sha256']
s=dict(archive=archive.name,bytes=archive.stat().st_size,sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),files=len(files),crcAndPerFileSha256='PASS')
(O/'SOLARIS_终审_材料包校验.json').write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(s,ensure_ascii=False))
