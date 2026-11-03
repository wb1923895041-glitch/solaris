"""Package only this display repair; retain the previously delivered data/assets."""
from pathlib import Path
import json,difflib,hashlib,zipfile

root=Path(__file__).resolve().parent.parent;docs=root/'docs/planet-overlap';shots=root/'output/playwright/planet-overlap'
read=lambda p:json.loads((root/p).read_text(encoding='utf-8'))
geometry=read('docs/planet-overlap/geometry-validation.json');before=read('docs/planet-overlap/before.json')['snapshot']
browsers={name:read('docs/planet-overlap/'+name+'-report.json') for name in ['chrome','msedge']}
assert all(not r['errors'] and len(r['checks'])==22 for r in browsers.values())
after=browsers['chrome']['cases'][0]['snapshot'];gap=browsers['chrome']['cases'][0]['discGap']
assert before['states']==after['states'] and before['scene']['camera']==after['scene']['camera'] and before['scene']['target']==after['scene']['target']

report=f'''# 地球与金星模型穿插修复

交付整理：2026-11-01（Asia/Singapore）。复现、构建及浏览器测试采集于 2026-10-29。

问题已复现：默认 2026-10-29 00:00 UTC 的探索比例下，地球与金星显示中心相距 {geometry['defaultCase']['distance']:.6f} 场景单位，原两个球体半径之和 {geometry['defaultCase']['previousRadiusSum']:.6f}，导致实体互穿 {geometry['defaultCase']['previousIntersection']:.6f}。此前漏检的是渲染层中放大尺寸与压缩距离的组合。

本次只修改显示层：为相邻模型计算安全尺寸，统一缩放天体本体及其云层/大气，土星按环系外缘考虑包络。普通相邻模型的包络半径之和不超过中心距的 70%；太阳及活动近景保留原显示大小时，对邻居采用 94% 的距离预算。中心坐标和实际天体半径始终来自原科学模型。

默认场景下，地球和金星显示半径分别收敛为 {geometry['defaultCase']['earth']['radius']:.6f}、{geometry['defaultCase']['venus']['radius']:.6f}，含大气的空间包络间隙为 {geometry['defaultCase']['newEnvelopeGap']:.6f} 场景单位。默认相机的两颗天体视圆也已分开，1440p 间隙估计约 {gap['estimatedPixelGap']:.2f} px（截图保留原始分辨率）。

聚焦时恢复原近景显示尺寸，相机按恢复后的半径逼近；地球 Hero 仍为 4.5R，9 个天体与 8 条轨迹保留。科学比例直接使用原统一长度映射，不执行尺寸收缩。界面及来源弹窗已说明探索尺寸自适应，并显示当前实际的显示增益。

## 实测证据

- 2024–2031 数据窗逐日 {geometry['days']:,} 个日期，两种呈现上下文共 {geometry['pairChecks']:,} 次相邻包络检验通过；{geometry['heroChecks']:,} 个日期的地球近景显示半径保留。输入坐标未被修改，科学比例半径逐项不变。
- Chrome {browsers['chrome']['browser']}、Edge {browsers['msedge']['browser']}，各 22 项有窗口浏览器断言通过，运行与控制台异常为零。
- 1920×1080、2560×1440、3840×2160 默认相机的地球/金星视圆均分开；五个日期及实际倍速播放无模型包络穿插。
- 相同 UTC、相同相机、相同目标和相同物理状态的前后对照一致；另直接读取实际 mesh 中心确认没有偏移天体。
- 地球及金星近景、科学/探索切换、18 颗卫星可选核验层的回归通过。卫星加载检查等待异步面板实际就绪，避免把数据先到、视图稍后出现误判为失败。
- `npm run build`、`npm run check:science`（14 项 / 432 状态）、`npm run check:contracts`（15 项）、`node --experimental-transform-types scripts/verify-satellites.mjs`（16 项 / 1,530 状态）通过。
- `py -3 scripts/phase2-freeze.py --check`：59 个科学文件逐字节未变。构建原有大于 500KB chunk 提示仍存在；本次未改动纹理、姿态或时间规则。

自由相机中仍可能出现前后天体的正常投影遮挡；本次处理的是夸张显示尺寸导致的三维实体穿插，并单独验证了报告机位下的地球/金星视圆分离，没有移动实际位置以求同框。

## 文件与使用

源代码：`src/render/presentation-size.ts`、`src/render/scene.ts`、`src/main.ts`。修复前源码备份及差异补丁随本目录保存。`output/playwright/planet-overlap/前后对照.html` 提供局部放大和原始 PNG；源图片未被改写或用作材质。

当前工程已经重建，启动原 `04-启动SOLARIS卫星3A.cmd` 并刷新网页即可使用修复版。增量修复 ZIP 适用于此前的最新 3A 验收包：保持原有数据和资产，将同名源文件与 `dist/` 构建文件更新到原目录。ZIP 不包含整套星历和纹理，不能作为独立项目启动。

3A 原验收 ZIP 是历史构建，未悄然改写其冻结结论；本修复明确改动渲染代码，科学底座仍冻结。本轮未开展 3B/3C 或其他阶段。
'''
(docs/'修复说明.md').write_text(report,encoding='utf-8')

# Show the original runtime PNGs at the same magnification. No edited texture
# or synthetic astronomical image is introduced by this HTML comparison.
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>地球与金星 · 穿插修复对照</title><style>body{max-width:1100px;margin:30px auto;padding:0 24px;background:#09111b;color:#d7e3ed;font:16px/1.8 "Segoe UI","Microsoft YaHei",sans-serif}h1{font-size:25px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}.card{padding:16px;background:#101f2b;border:1px solid #31495c;border-radius:8px}.card h2{font-size:18px;margin:0 0 12px}.zoom{position:relative;width:440px;height:380px;overflow:hidden;background:#000;max-width:100%}.zoom img{position:absolute;width:5120px;height:2880px;max-width:none;left:-2340px;top:-1160px}a{color:#abd1e8}small{color:#8da6b8}details{margin:24px 0}details img{width:100%;height:auto}.success{color:#9dccb1}</style><h1>地球与金星：探索比例模型穿插修复</h1><p>同一 UTC、同一相机、相同中心坐标。以下为原始浏览器截图的 2 倍局部查看，保留原图链接。</p><div class="pair"><div class="card"><h2>修复前 · 放大模型发生互穿</h2><div class="zoom"><img src="before-2560.png" alt="实际修复前截图局部"></div><a href="before-2560.png">2560×1440 原图 ↗</a></div><div class="card"><h2 class="success">修复后 · 显示尺寸自适应</h2><div class="zoom"><img src="chrome-after-2560.png" alt="实际修复后截图局部"></div><a href="chrome-after-2560.png">2560×1440 原图 ↗</a></div></div><p>真实半径、JPL 坐标和科学比例保持不变。聚焦时恢复原近景尺寸，当前工程刷新即可查看。</p><p><a href="../../../docs/planet-overlap/修复说明.md">修复说明与测试结果</a> · <a href="../../../docs/planet-overlap/geometry-validation.json">逐日几何检查</a></p><details><summary>完整总览</summary><img src="chrome-after-2560.png" alt="修复后的完整总览"></details><details><summary>地球与金星近景回归</summary><img src="chrome-earth-hero.png" alt="地球 Hero"><img src="chrome-venus-focus.png" alt="金星聚焦"></details></html>'''
(shots/'前后对照.html').write_text(html,encoding='utf-8')

patch=''
for before_name,name in [('scene.before.ts','src/render/scene.ts'),('main.before.ts','src/main.ts')]:
 old=(docs/before_name).read_text(encoding='utf-8').splitlines(keepends=True);new=(root/name).read_text(encoding='utf-8').splitlines(keepends=True)
 patch+=f'diff --git a/{name} b/{name}\n'+''.join(difflib.unified_diff(old,new,fromfile='a/'+name,tofile='b/'+name))
name='src/render/presentation-size.ts';patch+=f'diff --git a/{name} b/{name}\nnew file mode 100644\n'+''.join(difflib.unified_diff([],(root/name).read_text(encoding='utf-8').splitlines(keepends=True),fromfile='/dev/null',tofile='b/'+name))
(docs/'source-changes.patch').write_text(patch,encoding='utf-8')
files={'src/main.ts','src/render/scene.ts','src/render/presentation-size.ts','dist/index.html','scripts/check-presentation-overlap.mjs','scripts/planet-overlap-browser-qa.mjs','scripts/package-planet-overlap-fix.py'}
files.update(p.relative_to(root).as_posix() for p in (root/'dist/assets').glob('*') if p.is_file() and p.suffix in ['.js','.css'])
for folder in [docs,shots]:files.update(p.relative_to(root).as_posix() for p in folder.rglob('*') if p.is_file())
hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in sorted(files)}
archive=root/'deliverables/SOLARIS_地球金星模型穿插_增量修复包.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.writestr('00-修复包说明.txt','此包仅适用于最新 SOLARIS 3A 工程/验收包，是源代码与预构建文件的增量修复。\n保留原数据/纹理，将同名文件更新至原目录，刷新浏览器。\n不是独立项目，不应覆盖不相关的旧版本。\n实际前后截图、差异补丁和测试日志均随包。\n')
 z.writestr('FILE_MANIFEST.json',json.dumps(hashes,ensure_ascii=False,indent=2))
 for p in sorted(files):z.write(root/p,p)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for p,h in hashes.items():assert hashlib.sha256(z.read(p)).hexdigest()==h
print(json.dumps(dict(file=archive.name,bytes=archive.stat().st_size,sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),files=len(files),crcAndSha256='PASS'),ensure_ascii=False))
