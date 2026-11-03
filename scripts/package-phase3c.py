"""3C acceptance report, gallery and phase-3 final package (3A + 3B + 3C) from real run artefacts only."""
from pathlib import Path
import json,hashlib,zipfile,subprocess,sys,difflib
R=Path(__file__).resolve().parent.parent;D=R/'docs/phase-3c';S=R/'output/playwright/phase-3c';O=R/'deliverables';O.mkdir(exist_ok=True)
BASE='965dfc4'
def read(p):return json.loads((R/p).read_text(encoding='utf-8-sig'))
def git(*a):return subprocess.check_output(['git',*a],cwd=R,text=True,encoding='utf-8')
c=read('docs/phase-3c/chrome-report.json');e=read('docs/phase-3c/msedge-report.json');sci=read('docs/phase-3c/local-system-science.json');codes=read('docs/phase-3c/command-exit-codes.json');rec=read('docs/phase-3c/recording.json')
assert not c['errors'] and not e['errors'] and all(x['exitCode']==0 for x in codes)
names={'399':'地球','499':'火星','599':'木星','699':'土星','799':'天王星','899':'海王星'}
perf='| 系统 | Chrome rAF P50 / P95 ms | Chrome GPU P95 ms | Edge rAF P50 / P95 ms | Edge GPU P95 ms | GPU 几何 / 纹理对象 | JS 堆 MB |\n|---|---:|---:|---:|---:|---:|---:|\n'
for x,y in zip(c['performance'],e['performance']):
    heap=f"{x['memory']['used']/1048576:.0f}" if x.get('memory') else '—'
    perf+=f"| {names[x['planet']]} | {x['rafP50Ms']:.2f} / {x['rafP95Ms']:.2f} | {x['render']['gpuRender']['p95Ms']:.3f} | {y['rafP50Ms']:.2f} / {y['rafP95Ms']:.2f} | {y['render']['gpuRender']['p95Ms']:.3f} | {x['gpuMemory']['geometries']} / {x['gpuMemory']['textures']} | {heap} |\n"
scirows='\n'.join(f"- {r['name']}" + (f"：`{json.dumps(r['detail'],ensure_ascii=False)[:220]}`" if r['detail'] else '') for r in sci['results'])
tr=c['transitions'];measured=[t for t in tr if t['maxFrameMs']<50 and not t.get('cancelled')]
gpu=c['performance'][0]['render']['gpuRenderer'];soak=c['soak'];lay=c['layouts']
cmds='\n'.join(f"- `{x['command']}` → 退出码 {x['exitCode']}" for x in codes)
report=f'''# SOLARIS 3C：局部行星系统、交互体验与第 3 期终验

本轮完成第 3 期最后一批 **3C**。第 3 期（3A 数据与轨道、3B 资产与姿态、3C 局部系统）至此全部完成。下列数字均来自本目录的真实运行记录；视觉与产品验收仍需用户确认。

## 恢复点与改动范围

开发基线：Git `{BASE}`（3B 检查点）。恢复副本：`git worktree add ../SOLARIS-before-3C {BASE}`。
- 新增 `src/satellites/planetary-system.ts`（局部系统视图）、`local-mapping.ts`（纯函数比例映射）、`moon-knowledge.ts`（科普文字）及样式；`src/main.ts`、`index.html` 增加入口、卫星搜索与键盘逻辑。
- 局部系统使用独立 WebGL 渲染器与浮动原点（先做双精度相减，再上传 Float32）；行星直接复用第 2 期资产与 `BodyOrientation`，卫星复用 3B 资产与 IAU 姿态缓存，位置只来自 3A 的同一个 `relativeState` 函数，轨道线是同一函数的采样。
- 3B 资产台改为共享资源加载器；纹理改为后台解码后预上传。科学冻结检查：59 个第 1 期科学文件逐字节未变。

## 功能

- 从总览选中有卫星的行星 →「进入卫星系统」（或在聚焦后再次双击）：主场景先平滑聚焦该行星，再把同一视线方向交给局部系统，避免镜头突变。
- 面包屑 `太阳系 / 行星 / 卫星`；左侧按典型距离排序的卫星列表，悬停显示真实影像缩略图，可跨系统搜索 18 颗卫星；主目录搜索也能找到卫星。
- 选中、聚焦、跟随（相机与目标相对运动卫星保持恒定偏移）、返回行星、返回总览；拖动/滚轮随时接管镜头，接管后跟随重新锚定，不会跳变。
- 三种比例：**科学比例**（距离与半径同一线性映射，1 单位 = 1 个行星半径，小卫星用定位圈标记而非放大）；**探索比例**（r′ = 1 + 2.2·ln r，方向不变，卫星最小显示半径 0.09 行星半径，界面明示“非真实比例”）；**近景**（线性比例，相机靠近，显示观测/重建范围）。
- 右侧面板分「参数 / 轨道 / 表面 / 自转与锁定 / 探索记录 / 数据来源」；轨道倾角、顺逆行由当前状态矢量 r×v 与行星真实自转矢量计算，子行星点经纬由 IAU 姿态计算。
- 地月系统显示地月质心标记（位于地球内部，原点仍为地心）；木星系统给出周期比和瞬时拉普拉斯角；天王星系统显示卫星相对黄道约 98° 的倾斜；海王星系统给出海卫一逆行倾角。
- 统一时间轴：暂停、倍率、倒放、跳转均来自原 `TimeController`；局部视图在下一帧使用同一 TDB。

## 科学验证（`scripts/verify-local-system.mjs`，{sci['checks']} 项全部通过）

{scirows}

## 实机浏览器验收（2560×1440，DPR 1）

GPU：{gpu}。Chrome {c['browser']}：{len(c['checks'])} 项断言通过；Edge {e['browser']}：{len(e['checks'])} 项断言通过；控制台与运行时错误均为 0。浏览器端的每一颗卫星状态都与 Node 侧独立求值的同一 3A 星历逐位相等，再验证显示坐标与声明的映射一致（相对误差 < 1e-12）。

{perf}
- 镜头过渡：共 {len(tr)} 次，其中 {len(measured)} 次在未被系统节流的窗口中测得，全部 ≥ 20 帧、单帧旋转 < 12°，所有过渡相机均未进入任何天体；被节流或被用户接管的过渡单独记录，不计为通过。
- 浸泡：{soak['switches']} 次系统切换（{soak['elapsedSeconds']:.0f} 秒），第 2、3 轮 GPU 几何/纹理对象数稳定，卫星模型缓存 ≤ 7（含第 4 期冥王星母体预留）。
- 分辨率：{', '.join(f"{l['w']}×{l['h']} 3D 区占宽 {l['stage']/l['w']*100:.0f}%" for l in lay)}，无页面溢出。
- 录屏：`output/playwright/phase-3c/local-system-interaction.webm`（约 {rec['approxSeconds']:.0f} 秒，源视口 2560×1440）。截图总览：`output/playwright/phase-3c/验收预览.html`。

rAF 为浏览器回调间隔（本机为高刷新率显示器）；WebGL 无法读取真实显存字节，保留对象计数而不冒称 VRAM。

## 测试命令与退出码

{cmds}

## 未解决的限制

- 姿态为 IAU 通用 PCK 近似，非导航级表面配准；月球不含 DE 物理天平动。
- 未计算日食、月食、卫星掩食、行星阴影或环影；界面明确说明，不以示意冒充当日现象。
- 探索比例为显示映射，不能用于量测；轨道倾角为瞬时（密切）值。
- 冥王星–卡戎局部系统在第 4 期加入（矮行星属第 4 期范围）。
'''
(D/'验收报告.md').write_text(report,encoding='utf-8')
def im(p,t):n=Path(p).name;return f'<figure><a href="{n}"><img loading="lazy" src="{n}" alt="{t}"></a><figcaption>{t}</figcaption></figure>'
g='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SOLARIS 3C 验收</title><style>body{max-width:1500px;margin:40px auto;padding:0 24px;background:#09111b;color:#dce4ed;font:16px/1.8 system-ui}a{color:#acd3e9}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px}img,video{width:100%;border:1px solid #2b4356}figure{margin:0}figcaption{font-size:13px;color:#9db3c4}</style><h1>SOLARIS 3C · 局部行星系统</h1><video controls preload="metadata" src="local-system-interaction.webm"></video><div class=row>'
g+=''.join(im(x['path'],x['caption']) for x in c['shots'])+'</div></html>'
(S/'验收预览.html').write_text(g,encoding='utf-8')
modified=[p for p in git('diff','--name-only',BASE).splitlines() if (R/p).is_file()]
added=[p for p in git('ls-files','--others','--exclude-standard').splitlines() if (p.startswith(('src/','scripts/')) or p.endswith('.cmd')) and (R/p).is_file()]
patch=git('diff',BASE,'--',*modified).encode('utf-8')
for name in added:
    content=(R/name).read_text(encoding='utf-8').splitlines(keepends=True)
    patch+=(f'diff --git a/{name} b/{name}\nnew file mode 100644\n'+''.join(difflib.unified_diff([],content,fromfile='/dev/null',tofile='b/'+name))).encode('utf-8')
(D/'source-changes.patch').write_bytes(patch);(D/'change-list.json').write_text(json.dumps(dict(base=git('rev-parse',BASE).strip(),modified=modified,addedCode=added),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if '--prepare-only' in sys.argv:print('3C report prepared');raise SystemExit(0)
files=set(modified+added+['scripts/serve-phase2.py','package.json','package-lock.json','tsconfig.json','README.md'])
for folder in ['dist','docs/phase-3a','docs/phase-3b','docs/phase-3c','output/playwright/phase-3c','output/playwright/phase-3b/final','output/playwright/phase-3a','SOLARIS_phase3_reference']:
    files.update(p.relative_to(R).as_posix() for p in (R/folder).rglob('*') if p.is_file() and 'video-work' not in p.parts)
files={p for p in files if (R/p).is_file()}
hashes={p:dict(bytes=(R/p).stat().st_size,sha256=hashlib.sha256((R/p).read_bytes()).hexdigest()) for p in sorted(files)}
archive=O/'SOLARIS_第3期_终验_天然卫星与局部行星系统_验收包.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.writestr('00-开始验收.txt',f'SOLARIS 第 3 期终验（3A + 3B + 3C）\n\n双击 06-启动SOLARIS第3期终验.cmd，打开 http://127.0.0.1:4175/ 。\n选中有卫星的行星 → 「进入卫星系统」。\n报告：docs/phase-3a、docs/phase-3b、docs/phase-3c 下的 验收报告.md\n截图与录屏：output/playwright/phase-3c/验收预览.html\n')
    z.writestr('FILE_MANIFEST.json',json.dumps(hashes,ensure_ascii=False,indent=2))
    for p in sorted(files):z.write(R/p,p)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for p,entry in hashes.items():assert hashlib.sha256(z.read(p)).hexdigest()==entry['sha256']
summary=dict(archive=archive.name,bytes=archive.stat().st_size,sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),files=len(files),crcAndPerFileSha256='PASS')
(O/'SOLARIS_第3期终验_材料包校验.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,ensure_ascii=False))
