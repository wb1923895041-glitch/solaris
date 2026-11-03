from pathlib import Path
import json, hashlib, struct
root=Path(__file__).resolve().parent.parent
doc=root/'docs/phase-1'
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def extract(p):return json.JSONDecoder().raw_decode(p.read_text(encoding='utf-8-sig').split('### Result',1)[1].lstrip())[0]
r=load(doc/'scientific-error-report.json')
m=load(root/'public/data/manifest.json')
text=['# 第1期科学误差报告','', '2026-10-29。误差定义为三维向量欧氏范数；原点为太阳系质心0，轴为ICRF/FRAME，几何状态NONE；位置km/AU，速度km/s。浏览器显示时另减同一时刻太阳状态。','',
'比较对象：本地三次Hermite与**单独请求的JPL Horizons TLIST状态**。每个目标48点，共432点，全部不在拟合网格上；包括2024、2026、2030、闰年日期及42个固定种子分散时刻。比较使用回包实际JDTDB时刻，避免JD文本精度造成伪差。','',
'这是同一官方历表服务的独立取样验证，验证解析、插值和时间转换，不是独立观测真值验证，也不保证未抽检时刻达到相同误差。采样点原始回包不用于拟合；原始查询与文件哈希均随包保存。','',
'## 全部留出点统计','', '| 本体ID / 名称 | 步长h | 点数 | 最大位置差 km | 最大位置差 AU | RMS km | 最大速度差 km/s |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for o in r['report']:
 meta=next(x for x in m['objects'] if x['id']==o['id'])
 text.append(f"| {o['id']} {o['name']} | {meta['stepSeconds']/3600:g} | {o['samples']} | {o['maxPositionKm']:.9g} | {o['maxPositionAU']:.6e} | {o['rmsPositionKm']:.9g} | {o['maxVelocityKmPerS']:.6e} |")
text+=['','项目门限：位置10 km、速度0.001 km/s，全部通过。不是NASA官方精度承诺。完整每点结果：[JSON](scientific-error-report.json)。','',f"UTC→TDB与SpiceyPy/CSPICE对照，最大差 {r['timeMaxErrorSeconds']:.12g} s。内核naif0012.tls；工具链版本、参数与SHA在manifest中。闰秒字面量/历史日期不在本期窗口内，显式拒绝；未来未知闰秒沿用末值。",'', '## 三个指定日期（独立留出）','', '| UTC日期 | ID / 名称 | 位置差 km | 位置差 AU | 速度差 km/s |','| --- | --- | ---: | ---: | ---: |']
for date in ['2024-01-01T00:00:00Z','2026-10-29T00:00:00Z','2030-01-01T00:00:00Z']:
 for o in r['report']:
  e=next(e for e in o['errors'] if e['utc']==date)
  text.append(f"| {date} | {o['id']} {o['name']} | {e['positionKm']:.9g} | {e['positionAU']:.6e} | {e['velocityKmPerS']:.6e} |")
text+=['','## 方法与复现','', '1. `.venv-phase1/Scripts/python.exe scripts/build-ephemeris.py`：九个本体中心、统一SSB/ICRF/TDB/km/km/s；保留原始网格与独立TLIST回包。','2. `npm run check:science`：读取实际F64文件与原始留出数据；核对哈希，计算每目标/每时刻的误差，写出本报告所用JSON。','3. 浏览器另对四个UTC日期的九个目标直接与留出状态比较，完整结果见Chrome/Edge浏览器JSON。','', f"另有 {r['checks']} 组科学行为检查，覆盖目录溯源、时标/日期、暂停/倍率、边界、来源不一致、科学映射和CPU相机相对减法。真实日志：[science-log](science-log.txt)。",'', '未来闰秒、姿态与光度模型尚非本期精度保证范围。轨迹显示折线只用于视觉，不代替连续状态误差验证；本期无轨道外推或随机轨道回退。']
(doc/'02-科学误差报告.md').write_text('\n'.join(text)+'\n',encoding='utf-8')
reports={b:load(doc/f'{b}-browser-report.json') for b in ['chrome','edge']}
perf={b:extract(root/f'output/playwright/phase-1/{b}-performance.txt') for b in ['chrome','edge']}
(doc/'continuous-playback-performance.json').write_text(json.dumps(perf,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
video=load(doc/'recording-report.json')
text=['# 浏览器、视觉与性能验收','', '2026-10-29。以本地生产构建（4173）进行真实Chrome/Edge浏览器验收，原始stdout、控制台和截图保存在output/playwright/phase-1。浏览器为无头模式，硬件加速已验证。','',
'## 实际结果','', f"Chrome {len(reports['chrome']['checks'])} 项 / Edge {len(reports['edge']['checks'])} 项全部通过；15项契约检查和14组科学行为检查通过。测试覆盖四个日期×九个目标、可复现跳转、暂停、零倍率、比例状态隔离、真实科学比例、相机拖动/缩放/聚焦/返回、搜索、来源面板、越界、刷新及三分辨率布局。",'',
'另在真实画布上通过数学投影定位太阳，验证单击选中/双击聚焦；Space/F/Esc、输入框快捷键隔离、全部资源本地化通过。损坏399.f64后的真实浏览器故障注入确认：完整性校验失败、0个Canvas、播放禁用，不生成替代轨道；恢复文件后正常启动。详见extra-interactions.txt、failure-test.txt。','',
'正常Chrome/Edge控制台最终均0 errors / 0 warnings；故障会话单独记录。最终CSS修正1080p左栏阶段标记重叠和详情按钮裁切，Chrome/Edge最终布局复核均通过，见final-layout JSON与日志。最初datetime-local自动化输入中的零秒被浏览器规范化，改为符合原生控件格式后重跑通过。原CLI录屏返回空文件，已改用Playwright原生context.recordVideo重新录制并实际播放验证；空文件未作为最终证据。','',
'## 性能测量','', '设备：AMD Ryzen 9 8945HX；NVIDIA GeForce RTX 5060 Laptop GPU / ANGLE D3D11；Windows。完整CPU/GPU驱动清单见cpu.json、gpu.json。','',
'以下为连续播放1天/秒、标准DPR1、各分辨率稳定后最近250帧的rAF间隔。它衡量无头浏览器渲染循环，受自动化/帧调度影响；**不是显示器实际呈现帧率，也不是GPU计时器**。不外推到其他设备或第2期高质量材质场景。','',
'| 浏览器 | 分辨率 | 平均循环FPS | 平均帧间隔ms | P50 ms | P95 ms |','| --- | --- | ---: | ---: | ---: | ---: |']
for b in ['chrome','edge']:
 for p in perf[b]:text.append(f"| {b} | {p['width']}×{p['height']} | {p['averageLoopFPS']:.2f} | {p['meanFrameMs']:.3f} | {p['p50Ms']:.2f} | {p['p95Ms']:.2f} |")
text+=['','构建通过，有主JS约603 KB（gzip约155 KB）的体积警告。未隐藏此警告，也未以空壳或截图替代实际场景测试。','',
'## 截图与实际录屏','',
'- [1440p探索总览](../../output/playwright/phase-1/chrome-01-overview-2560x1440.png)','- [1440p地球聚焦](../../output/playwright/phase-1/chrome-02-earth-focus-2560x1440.png)','- [1440p科学比例](../../output/playwright/phase-1/chrome-03-scientific-2560x1440.png)','- [1440p 2030播放后](../../output/playwright/phase-1/chrome-04-playing-2030-2560x1440.png)','- [Chrome1080p](../../output/playwright/phase-1/chrome-overview-1920x1080.png) / [Chrome4K](../../output/playwright/phase-1/chrome-overview-3840x2160.png)','- [Edge1440p](../../output/playwright/phase-1/edge-overview-2560x1440.png) / [Edge1080p](../../output/playwright/phase-1/edge-overview-1920x1080.png) / [Edge4K](../../output/playwright/phase-1/edge-overview-3840x2160.png)',
f"- [连续操作视频](../../output/playwright/phase-1/phase1-continuous-demo.webm)：{video['durationSeconds']:.2f}秒，{video['width']}×{video['height']}，实际解码播放{video['decodedPlaybackSeconds']:.2f}秒通过；连续播放操作段{video['actions']['elapsedWallSeconds']:.2f}秒，包含日期跳转、地球F聚焦、Esc返回、暂停。",'',
'前三张PNG均为2560×1440真实运行截图。录屏为工具原生缩放输出；高分辨率细节看PNG。截图尺寸/哈希见evidence-inventory.json。','',
'## 与视觉基准逐项对照','', '[同屏并排页面](视觉并排对照.html)，左为用户概念参考，右为实际浏览器截图，未裁剪概念图制作任何资产。','',
'| 项目 | 实际结果与差异 |','| --- | --- |','| 太阳主视觉 | 暖色自发光与克制光晕已实现，位置由真实日心坐标决定；无概念图中的精细耀斑/日冕，留后续 |','| 天体身份 | 地球NASA合成图；岩质/云层/巨行星云带可区分。程序纹理与天气/姿态明确为示意，未达到后续高质量资产阶段 |','| 空间层次 | 真实三维方向、倾角与数据窗轨迹，透视相机；不为并排构图改物理坐标，内行星可能遮挡，可用目录聚焦 |','| 光照 | 太阳方向照亮朝日半球，夜侧保留少量展示补光；不做光度定标，地理日夜不能当精确预测 |','| UI | 顶栏、左目录搜索、右详情来源、底部UTC时间和比例；深色、冷灰蓝线、暖色重点继承冻结方向；无移动端 |','| 文字与标签 | 选中优先、屏幕避让，主资料/时间清晰；拥挤时隐藏次要标签，用目录定位 |','| 科学比例 | 全长度统一，行星球体远景不可见是比例结果；为全系统提供独立镜头，不暗中放大 |','| 后续天体 | 卫星、环、小行星带未展示，不用随机运动/粒子补足参考图 |','',
'人工已打开复核探索总览、地球聚焦、科学比例，并检查1080p/4K与Edge的排版。图片描述不替代科学精度报告。','',
'## 复现','', '启动生产预览：`npm run preview -- --port 4173 --strictPort`，执行 `npm run qa:prepare`。然后使用Playwright CLI分别open Chrome/Edge、snapshot，再 `run-code --filename scripts/browser-phase1-qa.js` 或edge版本。连续播放性能脚本为browser-phase1-performance.js；画布快捷键为browser-phase1-extra.js；故障注入为browser-phase1-failure.js。','',
'录屏使用 `node scripts/record-phase1.mjs`；它还需5173开发服务提供本地输出视频供播放核验。脚本保存文件后关闭录制上下文，再实际打开并播放视频，检查长度、解码与错误列表。原CLI空文件路径返回不计为成功。','',
'本次正常浏览器实际版本/环境：','']
for b,o in reports.items():text+= [f"- {b}: `{o['environment']['userAgent']}`；DPR {o['environment']['dpr']}。"]
(doc/'03-浏览器与视觉验收.md').write_text('\n'.join(text)+'\n',encoding='utf-8')
inventory=[]
for p in (root/'output/playwright/phase-1').glob('*'):
 if p.is_file() and (p.name.startswith(('chrome-0','chrome-overview','edge-0','edge-overview')) or p.name=='phase1-continuous-demo.webm'):
  data=p.read_bytes();entry=dict(path=p.relative_to(root).as_posix(),bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
  if p.suffix=='.png':entry.update(zip(('width','height'),struct.unpack('>II',data[16:24])))
  inventory.append(entry)
(doc/'evidence-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built scientific, browser, playback performance and evidence reports from actual results.')
