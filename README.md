# SOLARIS

## 从 GitHub 源码运行

仓库包含源码、运行时数据和贴图；不包含 `dist/`、依赖目录及大型原始影像下载缓存。需要 Node.js 22.20+（或支持 TypeScript 类型转换的更新版本）与 npm。

```powershell
npm ci
npm run build
npm run preview -- --port 4175 --strictPort
```

打开 http://127.0.0.1:4175/ 。安装 Python 3 后，也可在构建完成后双击 `启动SOLARIS.cmd`。源码仓库已有 `public/`，无需执行 `restore-public.py`。`提交说明.md` 的免构建运行方式适用于另行提供的作业 ZIP。

行星、卫星星历与环系核验所需的原始数值/网页数据随仓库提供。完整影像源文件审计（如 `verify-moon-assets.mjs`）及离线重建需要另外获取来源台账中的大型原始影像；运行程序不需要这些原始文件。

下文阶段记录用于追溯；当前能力以第 1–8 期说明为准。科学近似和数据范围见 [已知限制](docs/phase-8/已知限制.md)。

当前交付：**第 1–8 期终审版**。双击 **07-启动SOLARIS终审版.cmd**，打开 http://127.0.0.1:4175/ 。

- **第 4 期 · 小行星带与外围**：总览左下「小天体图层」——JPL SBDB 真实根数的 7.5 万主带 / Hilda / 特洛伊与 8.3 千 TNO 统计层（二体传播，仅作分布展示），13 个 Horizons 命名天体可搜索、聚焦；谷神星局部视图与冥王星–卡戎双天体系统（New Horizons / Dawn 全球影像）。
- **第 5 期 · 科普工作台**（顶部「科普 · 5」）：天体图鉴、由星历计算并与 NASA 目录逐项核对的 2024–2031 日月食、月相、开普勒定律、时间线、双天体比较、镜头书签。
- **第 6 期 · 物理实验室**（顶部「实验室 · 6」）：与星历隔离的 N 体实验，Velocity Verlet / Leapfrog，守恒量监测、收敛测试、发散告警，假设实验醒目标注。
- **第 7 期 · 性能与画质**：画质档位（自动/高/标准/节能），日月食扫描在 Web Worker；1080p/1440p/4K 实测。
- **第 8 期 · 终审**：[终审报告](docs/phase-8/终审报告.md) · [科学误差报告](docs/phase-8/科学误差报告.md) · [素材来源台账](docs/phase-8/素材来源台账.md) · [已知限制](docs/phase-8/已知限制.md) · [基准对比](output/playwright/phase-7/对比.html) · [第 4–7 期截图与录屏](output/playwright/phases-4-7/验收预览.html)

复查命令汇总见 [终审报告](docs/phase-8/终审报告.md)；重建终审包：`py -3 scripts/package-final.py`。

---

## 第 3 期终验（保留）

**第 3 期终验（3A 数据与轨道 + 3B 资产与姿态 + 3C 局部行星系统）**。双击 **06-启动SOLARIS第3期终验.cmd**，打开 http://127.0.0.1:4175/ ，在目录中选中地球 / 火星 / 木星 / 土星 / 天王星 / 海王星，点击「进入卫星系统」（或聚焦后再次双击），即可在统一时间轴下浏览局部系统、聚焦与跟随卫星、切换科学 / 探索 / 近景比例。

[3C 验收报告](docs/phase-3c/验收报告.md) · [3C 截图与录屏](output/playwright/phase-3c/验收预览.html) · [3B 报告](docs/phase-3b/验收报告.md) · [3A 报告](docs/phase-3a/验收报告.md)

- 卫星位置与轨道线只来自 3A 的同一 JPL 星历状态函数；表面与姿态来自 3B 资产与 IAU 近似姿态；行星直接复用第 2 期资产。
- 复查：`node --experimental-transform-types scripts/verify-local-system.mjs`；浏览器：`node --experimental-transform-types scripts/qa-local-system.mjs chrome|msedge`；重建包：`py -3 scripts/package-phase3c.py`。
- 未计算日月食、掩食与阴影；姿态为 IAU 通用近似。

---

## 3A 说明（保留）

**3A 天然卫星数据与轨道核验**。复用已有太阳与八大行星、地球 Hero 和太阳系总览；本轮没有制作卫星表面、姿态动画或局部探索功能。

双击 **04-启动SOLARIS卫星3A.cmd**，打开 http://127.0.0.1:4175/ 。点击顶部 **卫星数据 · 3A**，查看六套系统的真实轨迹、中心定位点和状态表；底部仍是原来的唯一 UTC 时间轴。预构建版只需 Python 3 和支持 WebGL2 的桌面 Chrome/Edge。运行中无需 NASA 网络或 API Key。

[3A 验收报告](docs/phase-3a/验收报告.md) · [浏览器截图与录屏](output/playwright/phase-3a/验收预览.html) · [54 个固定日期状态误差 CSV](docs/phase-3a/fixed-dates-errors.csv) · [独立科学核验](docs/phase-3a/independent-validation.json)

- 18 颗卫星来自有来源、历元和哈希的 JPL Horizons 行星本体中心矢量，缓存覆盖 2024–2031 UTC。
- 卫星适配器调用原有 Hermite 求值方法；没有改写行星星历、时间换算、单位、相机或视觉资产。
- 核验图使用线性距离，点只标记中心，不代表卫星大小或形状；没有把火卫一/二画成球体充作资产。
- `3B` 形状/材质/姿态与 `3C` 局部探索尚未实施；后续小行星、教学系统未启动。
- 太阳背面重建、静态影像、纹理经度配准和未来闰秒等既有局限仍存在，详见返修与 3A 报告；此前视觉成果仍待用户最终验收。

科学复查：`npm run check:science`、`npm run check:contracts`、`node --experimental-transform-types scripts/verify-satellites.mjs`、`.venv-phase1/Scripts/python.exe scripts/validate-satellites.py`。浏览器复查先构建并启动服务，再运行 `node scripts/satellite-browser-qa.mjs` 与 `node scripts/satellite-browser-science-qa.mjs`。

本轮开发前 Git 恢复点：`3da16f2`。当前代码变更是该恢复点上的增量；验收 ZIP 另附完整 `dist/` 运行版。

---

## 第 1 期历史说明

下文保留第 1 期原交付记录，用于重现历史版本；当前能力和边界以上述 3A 说明及本轮验收报告为准。

太阳与八大行星的 JPL Horizons 三维总览，PC Chrome/Edge。默认日期 **2026-10-29 00:00:00 UTC**，暂停、探索比例。开放数据窗 **2024-01-01 至 2031-01-01 UTC**。

[第1期验收总览](docs/phase-1/00-验收总览.md) · [科学误差报告](docs/phase-1/02-科学误差报告.md) · [截图/录屏/浏览器/性能](docs/phase-1/03-浏览器与视觉验收.md)

## 直接预览

验收ZIP包含已构建 `dist/`，无需API Key或npm依赖。安装Python 3后双击 **02-启动SOLARIS.cmd**，打开 `http://127.0.0.1:4175`。也可执行：

```powershell
py -3 -m http.server 4175 --bind 127.0.0.1 --directory dist
```

使用本地HTTP服务；不直接双击index.html。关闭终端停止服务。浏览器必须支持WebGL2。

## 开发与测试

本机验证 Node 22.20.0、npm 10.9.3；依赖已锁定。

```powershell
npm ci
npm run check:contracts
npm run check:science
npm run build
npm run dev
```

`check:science`使用Node实验性TypeScript转换，警告已记录；测试与浏览器使用同一科学模块。默认开发地址 `http://127.0.0.1:5173`。`npm run preview -- --port 4173 --strictPort` 可验收生产构建。

如需重建离线数据（通常不需要，缓存已随包交付）：

```powershell
py -3.12 -m venv .venv-phase1
./.venv-phase1/Scripts/python.exe -m pip install -r scripts/requirements-phase1.txt
./.venv-phase1/Scripts/python.exe scripts/build-ephemeris.py
./.venv-phase1/Scripts/python.exe scripts/fetch-basic-assets.py
npm run check:science
npm run qa:prepare
npm run build
```

采集器串行请求JPL，复用原始缓存并核对查询参数，不自动覆盖不同版本。`data/phase-1/raw/` 保存完整JPL回包、查询和LSK；`public/data/` 是浏览器F64缓存和来源清单。浏览器不调用外部API，数据损坏或缺失就停止，禁止替代轨道。

## 操作

- 左侧搜索中文/英文/ID；单击选择，双击聚焦。画布左键选中、双击聚焦。
- 拖动旋转，滚轮缩放；F聚焦、Esc返回总览、Space播放/暂停。输入框不会触发快捷键。
- 底栏支持UTC日期跳转、时间轴、前后一天、暂停/播放、正/反/零倍率和重置。
- 科学比例：尺寸/距离统一；行星球体常不可见，可通过标签/目录聚焦。探索比例：常驻标注尺寸放大与距离非线性压缩。
- 聚焦视图暂隐其他天体和轨迹，返回总览恢复；不会改动科学状态。

## 本期边界

真实位置/速度来自本体中心、SSB/ICRF/TDB/km/km/s。外行星只显示数据窗内弧段。基础程序材质为示意，地球使用有出处的NASA历史合成地图；表面朝向尚无姿态星历，补光不做光度定标，未来UTC沿用已知闰秒表。无卫星、小行星带、正式环系、N-body或移动端。第1期交付后停止，不进入第2期。

浏览器QA复现命令、完整结果和限制见验收报告；`scripts/package-phase-one.py`可重新生成验收ZIP。第0期原验收包仍独立保留。
