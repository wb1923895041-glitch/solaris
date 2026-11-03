from pathlib import Path
import json,zipfile,hashlib,subprocess,html
from PIL import Image
r=Path(__file__).resolve().parent.parent;docs=r/'docs/earth-hero';out=r/'output/playwright/earth-hero'
q=json.loads((docs/'browser-report.json').read_text());source=json.loads((r/'public/assets/celestial/earth/config.json').read_text())
(docs/'earth-asset-sources.json').write_text(json.dumps(source,indent=2)+'\n',encoding='utf-8')
perf='\n'.join(f"| {p['viewport'][0]}×{p['viewport'][1]} | {p['frameP50Ms']:.2f} / {p['frameP95Ms']:.2f} | {p['render']['gpuRender']['p50Ms']:.3f} / {p['render']['gpuRender']['p95Ms']:.3f} | {p['render']['drawCalls']} |" for p in q['performance'])
text=f'''# SOLARIS 地球 Hero：定向返修 A 阶段

2026-10-29（Asia/Shanghai）。本轮仅按最新返修包执行地球场景，提交用户视觉验收后停止。没有实施 B 阶段全景重做，也没有开发卫星、小行星或知识专题。

## 恢复点与实际工程审查

改造前恢复点：`5ab7be6`（真实 Git commit，保留此前全部本地资产和测试证据）。第 1 期恢复点 `8d3cb15` 仍可用。当前工作区已有第 2 期材质成果；3A、4A、5A 尚未实装，不能当成已完成模块。

| 报告项 | 当前仓库核实与本轮处理 |
|---|---|
| V01 / V07 | 当前已存在 NASA 分层地球：地表、海洋粗糙度、独立云壳、薄大气、夜面灯光。复用 `src/render/celestial/system.ts` 的 Earth 工厂及独立资产配置，不回退成单层球体。 |
| V02 | 保留原数字天文馆方向；本轮仅改地球镜头和信息层级，整体太阳系电影化构图留在 B 阶段。 |
| V03 | 原 `mesh.visible=!focused...`、`pathsVisible&&!focused` 的地球分支已修复；聚焦后 9 个天体和 8 条真实数据轨迹仍在场景中。探索模式下，附近过大的背景天体按视角阈值淡化，防止遮挡地球；仅改透明度，不动位置或半径。 |
| V04 | 地球 Hero 正文 15px，数据 14px，来源说明 12px；收起重复的二维地球缩略图。仅作用于地球 Hero，未整体重排其他行星 UI。 |
| V05 | 聚焦地球时选中轨迹与其他轨迹分级透明度。全窗采样与每帧顶点更新机制未重构，保留为后续范围，不声称已解决。 |
| V06 | 地球逼近距离由 5.8R 调为 4.5R，视角增加侧向分量；沿用可中断转场、跟随与安全缩放。环绕、缩放、打断、日期跳转、Esc 返回有浏览器证据。未宣称实现完整摄影视角状态机。 |

## 真实数据、重建与观察增强

星历、UTC/TDB、单位、平均半径、真实位置均使用原科学模块，冻结的 59 个文件逐字节未变。NASA 地表为 2004 年月合成，海洋和云图包含 2001 年数据，夜光为 2016 年合成；不是当前天气。姿态使用通用 IAU_EARTH / NAIF PCK，不是高精度 EOP。

云漂移是可关闭的教学示意；大气边缘、云影、曝光、夜光暖色和背景淡化属于观察增强。没有用附件概念图做背景或球面纹理。来源及处理详见 `earth-asset-sources.json` 和工程 `public/assets/celestial/earth/config.json`。

## 实测结果

Windows 11、Ryzen 9 8945HX、RTX 5060 Laptop GPU；Chrome 实际窗口、DPR=1。GPU 使用 WebGL 计时查询；rAF 帧间隔不是显示器实际呈现计数，不能据此保证所有设备性能。显存真实字节数不可由 WebGL API 获取，报告保留纹理/几何对象计数和解码 mip 预算估算，不把估算冒充实测显存。

| 视口 | rAF P50 / P95 ms | GPU 渲染 P50 / P95 ms | Draw calls |
|---|---|---|---|
{perf}

浏览器错误数：{len(q['errors'])}。默认日期相同时间和状态对比一致；9 天体/8 轨迹保留；三分辨率无页面溢出；正文至少 13px；实际鼠标拖动、滚轮、日期跳转、播放、Esc 返回、转场中断及防穿球检查通过。

`npm run build`、`npm run check:science`（14 项行为检查、432 个留出状态）、`npm run check:contracts`（15 项）、`py -3 scripts/phase2-freeze.py --check` 均已运行，日志在本目录。构建存在 >500KB chunk 提示；仓库没有单独 lint 命令，不声称 lint 已通过。

视频 {q['video']['duration']:.1f} 秒，1920×1080，源视口 2560×1440，已实际解码播放 {q['video']['decodedSeconds']:.2f} 秒。内容包含总览→地球→环绕→放大→日期跳转→返回。1440p 原始 PNG 单独保留。

## 验收入口与复现

1. 当前工程启动 `03-启动SOLARIS第2期.cmd`，浏览器打开 http://127.0.0.1:4175/ 。该入口复用最新构建；未创建新项目。
2. 查看 `output/playwright/earth-hero/验收预览.html`：全貌、近景、旋转后、晨昏线、侧栏、同相机同时间前后对照和视频。
3. 重跑 `npm run build`，启动静态服务，再执行 `node scripts/earth-hero-qa.mjs`。科学复查命令见上文。

本材料包是现有工程的返修增量及证据包，依赖恢复点中的既有工程和资产，不是另一个独立项目。视觉效果待用户验收；原报告中太阳、整体总览、全窗轨迹策略等 B 阶段事项保持未处理。
'''
(docs/'验收报告.md').write_text(text,encoding='utf-8')
(docs/'changes.patch').write_bytes(subprocess.check_output(['git','diff','5ab7be6','--','src']))
for name in ['before-matched-camera.png','after-matched-camera.png']:
 assert Image.open(out/name).size==(2560,1440)
contact=Image.new('RGB',(2560,720))
for i,name in enumerate(['before-matched-camera.png','after-matched-camera.png']):contact.paste(Image.open(out/name).resize((1280,720)),(1280*i,0))
contact.save(out/'before-after.png')
imgs=['earth-full-2560.png','earth-close.png','earth-orbit.png','earth-terminator.png','data-sidebar.png','before-after.png','hero-1920.png','hero-3840.png','returned-overview.png']
page='''<!doctype html><meta charset="utf-8"><title>SOLARIS 地球 Hero A阶段验收</title><style>body{background:#050c15;color:#c8d9e6;font:16px/1.8 "Segoe UI","Microsoft YaHei",sans-serif;max-width:1500px;margin:40px auto;padding:0 24px}img,video{max-width:100%;height:auto;border:1px solid #294355}a{color:#9ed4ed}h1{font-weight:400}section{margin:40px 0}small{color:#9baebd}</style><h1>地球 Hero · A 阶段验收</h1><p>真实 Chrome 运行截图；视觉效果提交验收。前后对照：左为改造前，右为本轮结果；时间、相机、视口一致。</p><small>空间参照淡化和云漂移为观察增强，历史合成影像不是实时天气。</small>'''
for f in imgs:page+=f'<section><p>{html.escape(f)}</p><a href="{f}"><img loading="lazy" src="{f}"></a></section>'
page+='<h2>连续交互视频</h2><video controls src="earth-hero-interaction.webm"></video>'
(out/'验收预览.html').write_text(page,encoding='utf-8')
dest=r/'deliverables/SOLARIS_地球Hero_A阶段_返修材料包.zip'
files=list(docs.rglob('*'))+[r/'docs/earth-hero-run.log']+[p for p in out.iterdir() if p.is_file()]+[r/'src/main.ts',r/'src/style.css',r/'src/render/scene.ts',r/'src/render/celestial/system.ts',r/'scripts/earth-hero-qa.mjs',r/'scripts/package-earth-hero.py']
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:
  if p.is_file():z.write(p,p.relative_to(r))
with zipfile.ZipFile(dest) as z:assert z.testzip() is None
(r/'deliverables/earth-hero-SHA256.txt').write_text(hashlib.sha256(dest.read_bytes()).hexdigest()+'  '+dest.name+'\n')
print(dest,dest.stat().st_size,'bytes; ZIP integrity PASS')
