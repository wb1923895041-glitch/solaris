# SOLARIS｜第 3 期：真实天然卫星系统与局部行星探索

> **执行对象：Codex。** 本文是实施指令，不是让阅读者重新规划一个新项目。只完成第 3 期，完成后停止并提交验收。目标：Windows Chrome / Edge、1920×1080 / 2560×1440（主标准）/ 4K 高画质。**完全不做移动端适配。**

## 0｜最终目标与边界

在已经完成并通过验收的第 1 期真实星历/时间/比例/相机系统，以及第 2 期太阳和八大行星高精度资产基础上，为 SOLARIS 增加**能够在真实时间下运行、可聚焦探索、有权威数据来源的主要天然卫星及行星局部系统**。

不要重建 Vite/React/Three.js 工程；不得推翻既有产品结构、全局历表、材质、UI 或科学比例设定。开始前**审查当前仓库**：列出现有可复用模块和真实完成状态；保存 Git restore checkpoint；运行既有测试并保存 2560×1440 基线截图。对未完工的第 1/2 期问题记录为依赖风险，不允许用虚构参数补齐后宣布合格。

### 本期做什么

- 至少 18 颗重点天然卫星：地球 1、火星 2、木星 4、土星 5、天王星 5、海王星 1。
- 卫星位置、速度与轨道：基于 JPL Horizons/SPICE 正式星历或经逐项验证的离线预计算产品。
- 卫星形状与表面：逐颗独立资产清单、真实影像或有标记的科学重建；特别是 Phobos/Deimos 不能用标准球体冒充。
- 自转、轴向、昼夜面、潮汐锁定、特殊逆行与轨道共振的合理呈现。
- 与全球唯一时间轴同步的行星局部系统、卫星选中/聚焦/跟随、轨道显示、知识面板。
- 数据精度、性能、可交互性与视觉逐颗验收。

### 本期禁止

- 不开发完整主小行星带、柯伊伯带、彗星、大规模小卫星目录（属于后期）。
- 不重写 N 体引力实验室（属于第 6 期）。
- 不增加小说剧情、任务系统或游戏化资源。
- 不做表面登陆/飞船驾驶等与本期核心无关的新系统。
- 不依赖每帧网络请求取得星历；不得随机匀速公转冒充历表。
- 不得将生成概念图直接裁成球面贴图，概念图不是科学证据。

## 1｜卫星名单与独立美术标准

默认这 18 颗必须在 UI 可搜索、可点击、可聚焦，有真实身份、数据及来源。

| 行星 | 卫星 | 本期必须具备的识别特征 | 关键科学问题 |
|---|---|---|---|
| 地球 | Moon / 月球 | 月海、高反照率高地、撞击坑、昼夜线 | 同步自转、天平动；地月质心与地心区分 |
| 火星 | Phobos / 火卫一 | 不规则小天体、Stickney 撞击坑及沟槽（依据真实模型） | 距火星很近、快速顺行，不当成球体 |
| 火星 | Deimos / 火卫二 | 较小、较平滑但非完美球体的形状 | 与 Phobos 不同的轨道周期与大小 |
| 木星 | Io / 木卫一 | 黄硫色、深浅斑驳、真实火山地貌 | 潮汐加热、与 Europa/Ganymede 共振 |
| 木星 | Europa / 木卫二 | 明亮冰壳、赤褐裂纹、少量大撞击坑 | 同步自转、冰壳与地下海洋科普 |
| 木星 | Ganymede / 木卫三 | 大尺度明暗地形、沟槽与撞击坑 | 太阳系最大卫星、共振 |
| 木星 | Callisto / 木卫四 | 深色、密集撞击坑 | 与内三卫星不同的共振关系 |
| 土星 | Mimas / 土卫一 | 巨型 Herschel 撞击坑 | 小卫星、尺度真实 |
| 土星 | Enceladus / 土卫二 | 高反照率冰表面、南极虎纹 | 羽流只作为标注的可选科学演示 |
| 土星 | Rhea / 土卫五 | 多撞击坑、灰色冰岩表面 | 正确轨道和尺度 |
| 土星 | Titan / 土卫六 | 橙色浓厚大气层，默认不能直接看清表面 | 地表只能在雷达/近红外/说明模式下展示 |
| 土星 | Iapetus / 土卫八 | 显著两色反照率差异 | 复杂明暗表面、倾斜轨道 |
| 天王星 | Miranda / 天卫五 | 陡崖、拼贴式地形 | 高倾斜系统下的坐标变换 |
| 天王星 | Ariel / 天卫一 | 冰面断裂与沟谷 | 局部比例、姿态 |
| 天王星 | Umbriel / 天卫二 | 暗色、有撞击坑 | 合理反照率 |
| 天王星 | Titania / 天卫三 | 沟谷、撞击坑 | 真实局部轨道 |
| 天王星 | Oberon / 天卫四 | 暗色撞击坑 | 真实局部轨道 |
| 海王星 | Triton / 海卫一 | 淡粉灰/浅色氮冰地貌、区域差异 | **逆行且轨道倾斜；不能顺行圆轨道** |

补充说明：卫星的相对尺寸与表面全球资料并不总是完整，未知区域必须记录 `RECONSTRUCTED`，禁止生成伪真实全球贴图。不要把概念图出现的局部特写当成 NASA 真实观测。

## 2｜科学坐标与位置：继承第 1 期，禁止产生两套真值

### 2.1 单一时钟与统一历表

`SolarisTimeController`（或现有等价对象）是唯一日期来源。所有 18 颗卫星必须接受同一 `TDB epoch` 或工程统一的、经验证的等价历表时间表示。UI 可显示 UTC，但必须转换为计算所需时间尺度。暂停、倒放、倍率和跳转均不得各算各的时间。

### 2.2 正确区分参考中心

- `planetarySystemBarycenter`（行星系统质心）
- `planetCenter`（行星实体中心）
- `moonCenter`（卫星中心）
- 太阳系质心、太阳中心与局部行星中心

以上不能混淆。推荐对同一全局时间从同一 SPICE/Horizons 数据体系获取 `planet SSB state` 与 `moon SSB state`，严格计算 `moonRelative = moonSSB - planetSSB`；或用已标明相同参考系的局部星历结果再正确叠加。不要因为前端 scene graph parent-child 方便就重复加上中心位置。

全局绝对真值优先双精度保存，渲染再通过 Floating Origin 或 Camera-relative 转为 Float32 局部坐标。局部空间在数百万公里尺度仍须无明显抖动。

### 2.3 历表来源

权威文档：
- 卫星轨道与 Horizons：https://ssd.jpl.nasa.gov/sats/orbits.html
- JPL 卫星 SPK 数据：https://ssd.jpl.nasa.gov/sats/ephem/files.html
- JPL Horizons 手册：https://ssd.jpl.nasa.gov/horizons/manual.html
- NAIF SPICE SPK：https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/spk.html

注意不同星历内核**覆盖范围可能不同**。为每颗卫星分别记录覆盖起止、内核名称/版本、历元、参考系、中心、位置单位、速度单位、采样间隔与插值方法。不得宣称 1600–2600 年所有卫星同精度可用。时间超限要显式禁用或降级并标注。

### 2.4 插值与时间倍率

- 倍速播放只改变读取/求值的目标时间；不得直接累加 `angle += dt * speed` 伪造星历。
- 优先由 SPICE 在目标时间求值，或使用误差经过量化验证的离线插值段。
- 对快速卫星（Phobos、Io、Mimas 等）允许更密采样/自适应插值；不得一律每月取样然后线性插值。
- 拒绝由于时间跳跃造成的错误围绕轨道绕长弧插值；日期跳转时直接求目标历元状态。
- 每一颗卫星的轨道显示须来自同一个状态函数的采样，而不是独立的美术椭圆。
- 天体世界坐标真值不受探索比例、聚焦镜头、后期特效改变。

## 3｜天体姿态：轨道位置与表面朝向是两个系统

使用 NAIF PCK/IAU 姿态模型（若可用）计算北极方向、参考经线/自转和 body-fixed → 惯性系的旋转；再乘 3D 渲染坐标系变换。参见：https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/pck.html

**绝对禁止**对所有卫星使用 `moon.lookAt(planet)` 直接冒充真实自转。潮汐锁定不是简单朝向指定点而不考虑旋转轴、参考经线、天平动。对于缺少可用高精度姿态数据的卫星，可选择科学上合理的 `APPROX_ORIENTATION` 模式，但必须在 UI 和数据元信息中标注模型近似，不得宣称高精度朝向。

要求：
- 月球面向地球的主半球总体正确，区分天平动/姿态模型支持程度；
- 木星四大卫星同步自转的总体姿态正确；
- Triton 的逆行轨道在正确参考系下真实呈现；
- 天王星卫星局部轨道不强行放在地球黄道平面；
- 太阳始终是光照方向来源，昼夜交界线与太阳方向一致；
- 除特殊可视化模式，不让卫星自己像灯泡一样发亮。

## 4｜材质、几何与美术资产

每颗卫星建立独立 `MoonVisualManifest`，至少包含：

```ts
type MoonVisualManifest = {
  naifId: number; displayNameZh: string; displayNameEn: string;
  parentPlanetId: number;
  shapeType: 'sphere'|'ellipsoid'|'irregular-mesh';
  dimensionsKm?: [number, number, number];
  geometrySource?: {title:string; provider:string; uri:string; rights:string};
  albedo?: {title:string; provider:string; uri:string; rights:string; colorProcessing:string; projection?:string};
  normal?: {title:string; provider:string; uri:string; rights:string};
  orientationModel: 'SPICE_PCK'|'IAU_APPROX'|'APPROX_ORIENTATION';
  reconstructionNotes?: string;
  visualEnhancements: string[];
  verifiedAt: string;
};
```

要求：
1. 表面优先 NASA/JPL/USGS、Cassini、Galileo、Voyager、LRO、Juno 等公开数据（需核实具体使用许可和署名）。
2. Phobos/Deimos 优先使用真实不规则形状模型，不可用均匀噪声球替代。
3. 木卫一不是普通熔岩球，不要毫无依据地到处绘制喷火动画。
4. Europa 冰壳裂纹必须与真实影像风格一致，不做夸张蓝色霓虹裂缝。
5. Titan 可见光默认由橙色雾霾包覆；若有“剥离大气/雷达表面”模式必须显著标记为科学仪器或解析可视化。
6. Iapetus 的两色明暗反差必须保留，不要均匀灰球。
7. Triton 不得画成纯蓝色天王星缩小版。
8. Enceladus 南极羽流、Europa 地下海洋剖面等：必须是可开关、明确标明示意的教学层，不声称任意时刻有真实影像观测。
9. 卫星默认材质遵循太阳照射、真实反照率方向、HDR tone mapping；不使用普遍外发光轮廓。

不要求本期所有卫星均有 16K 贴图；以**来源可核验、地貌可信、全局稳定流畅**优先。细节分级：远景体积与位置，中景真实质感，近景可辨认主要地貌；使用 LOD 和渐进纹理。

### 概念图边界

随包图像只用于“层次、布局、材质、构图、暗色数字天文馆风格”。生成图中的具体地貌、卫星形状、轨道相位和文字可能不准确；**不允许裁剪为生产贴图、不允许抄录其数值、不允许据此推导轨道**。

## 5｜局部行星系统与摄像机交互

### 5.1 新增局部系统，不打断总览

点击一颗有卫星的行星 → 平滑镜头过渡 → 进入其局部系统。此时可见：
- 主行星（直接复用第 2 期渲染资产）
- 所属重点卫星（正确星历位置）
- 轨道曲线（可隐藏）
- 时间控制、科学/探索比例切换、卫星列表
- 被选中卫星的真实参数/科普简介/数据来源与精度标签

用户可在行星局部系统中：卫星搜索、悬停、点击、聚焦、跟随、返回行星、返回太阳系总览；转换中相机不得穿越行星和卫星，也不得出现突然翻转或焦距跳变。

### 5.2 比例模式

- `SCIENTIFIC_SCALE`：局部距离和半径使用同一线性比例；如果小卫星难看清，使用局部摄像机和独立 UI 标签，不暗中放大。
- `EXPLORATION_SCALE`：展示用非线性距离或最小可见球尺寸，明确标注“探索比例/非真实比例”，并保证真正的时间与轨道位置来源不变。
- `SURFACE_CLOSEUP`：近景聚焦，显示数据来源和观测/重建范围。不能悄悄把局部放大过的尺寸拿来做引力实验。

局部星系使用 camera-relative or floating-origin，避免全局太阳系坐标的精度传播到近距离卫星观察。

### 5.3 轨道与事件可视化

轨道轨迹按真实 3D 运动采样绘制，倾角和扰动不能被平滑成一套同心圆。可提供明确标注的简化平均轨道示意层（与真实轨道分开）。

可以展示日食/月食、木卫掩食、木星阴影中的卫星、土星环阴影等，但**只有几何关系正确并有真实计算结果时**才允许称为“当日实时现象”。没实现的现象不要假装已有。

## 6｜科普内容与 UI 规范

主设计 2560×1440：
- 顶部：SOLARIS + 所在系统面包屑，例如 `太阳系 / 木星 / Europa`。
- 左侧：卫星列表，悬停微型真实缩略图及名称，按真实轨道距离排序；支持检索。
- 中央：80% 以上重点区域用于 3D 天体演示，局部系统及空间纵深明显。
- 右侧：玻璃质感极弱、深灰半透明科学信息面板，卡片区区分 `参数 / 轨道 / 表面 / 探索记录 / 数据来源`。
- 底部：统一时间轴、速率、日期、比例模式、轨迹显示按钮。

每颗卫星科普至少：所属行星、近似尺寸、典型轨道距离、公转周期、轨道方向/倾角、表面特征、自转/锁定说明、主要探索任务、数据来源、颜色处理/示意标识（如适用）。

一律用简洁中文为主、标准英文名辅助，不堆满 HUD 伪科技字符。不增加与场景无关的炫光。NASA 来源不等于 NASA 认证本项目。

## 7｜模块建议与真实数据 API

请根据仓库具体情况适配命名，不得强行新建一套与第 1 期重叠的星历系统。

```text
src/celestial/satellites/
  satelliteCatalog.ts
  satelliteEphemerisAdapter.ts
  satelliteOrientation.ts
  satelliteShapeAssets.ts
  satelliteOrbitTrack.ts
  moonVisualManifest.ts
  types.ts
src/features/planetary-systems/
  PlanetarySystemView.tsx
  MoonExplorerPanel.tsx
  MoonFocusCamera.ts
src/tests/science/
  moonEphemeris.test.ts
  moonCoordinateFrame.test.ts
  moonOrientation.test.ts
  moonScaleMode.test.ts
src/tests/e2e/
  planetarySystems.spec.ts
```

建议关键 API（或适配已有同等 API）：

```ts
type EpochTdbSeconds = number;
type Vector3Km = readonly [number, number, number];
type StateKm = { posKm: Vector3Km; velKmS: Vector3Km; frame: string; centerId: number; };
interface SatelliteEphemeris {
  getState(bodyNaifId: number, epochTdb: EpochTdbSeconds): StateKm;
  getRelativeState(moonId: number, planetId: number, epochTdb: EpochTdbSeconds): StateKm;
  getCoverage(bodyNaifId: number): { from: number; to: number; kernel: string; };
}
interface SatelliteOrientation {
  getBodyToInertialRotation(bodyNaifId: number, epochTdb: EpochTdbSeconds): {
    quaternion: readonly [number,number,number,number];
    quality: 'verified'|'approximate'|'unavailable';
    modelName: string;
  };
}
```

严格保证返回对象的参考系、中心、时间尺度、单位经类型层/运行时断言验证。工程实际如采用 JS 大数毫秒日期需注意可表示范围与转换精度，不允许跨 UTC/TDB 偷偷复用数字。

## 8｜科学验收（硬性）

### 8.1 18 颗卫星逐一数据验收

对每颗卫星输出：数据源与版本、历表内核、可用时间区间、参考系、中心、观测/重建来源、尺寸、姿态模型状态（精确/近似/不可用）。缺关键字段不得显示为“科学精确”。

### 8.2 定期星历对照

至少选择 `2025-01-01 00:00 UTC`、`2026-08-01 00:00 UTC`、`2030-01-01 00:00 UTC`，仅在该天体的有效覆盖区间内执行。每个日期验证 18 颗卫星的 `position km` 和 `velocity km/s`（如数据可用）；另在轨道不同相位随机抽查。对比统一来源/统一坐标系下的 JPL Horizons 或 SPICE 基准，逐颗统计位置误差、速度误差、最大值、平均值、插值间隔和误差原因。

验收精度目标：主要卫星局部位置相对误差优先控制到 **轨道特征半径的 0.01% 以内**，但这只是产品工程目标而不是 JPL 历表保证值；必须给出绝对误差（km）和具体样本，无法达成则标记失败或降低精度声明并说明原因。禁止舍弃失败样本或用独立的美术轨迹通过验收。

### 8.3 必须单独通过的物理情形

- 月球在地月局部系统中围绕正确地球/地月质心关系运动；表面朝向基本符合锁定与天平动说明。
- Phobos 与 Deimos 在轨道半径、周期、形状、不同速度上能明显区分。
- Io / Europa / Ganymede 的近 4:2:1 平均运动共振能通过历表数据统计展示；不要强行将任意时刻角位置锁死成整齐直线。
- Callisto 不被误标为上述三体共振成员。
- Titan 默认被浓厚大气遮住地表。
- Enceladus 的羽流只在明确教学演示下出现。
- Uranus 的主要卫星轨道平面随其系统方向，不能错误锁定太阳系黄道。
- Triton 的逆行方向和倾角经局部轨道角动量、海王星自转方向及参考系变换确认。
- 暂停后所有卫星停在相同历元；日期跳转后同步到新历元。
- 轨道显示开关与比例切换不改变任何轨道真值。

### 8.4 可视化和浏览器端验收

每套局部系统必须有：总景截图、主卫星单独特写、最大比例缩放、从总览进入/返回的动图或短视频、性能指标、控制器无冲突记录。18 颗卫星各至少一张有名称的独立近景截图，重点 8 颗（Moon、Phobos、Io、Europa、Ganymede、Titan、Enceladus、Triton）各增加一张材质细节图。

测试使用真实浏览器运行，不能凭编译通过声称视觉合格。输出针对目标机器的 FPS、CPU/GPU、内存与纹理峰值；目标为合适桌面硬件上的 1440p 稳定 60FPS，未达到则报告环境与瓶颈，不作虚假承诺。

## 9｜分三次小批次交付，只在本期内部推进

**3A / 数据与轨道**：18 颗卫星身份、星历、坐标系、参考中心、时间与单位、科学测试；完成后提供中期证据。

**3B / 资产与姿态**：18 颗卫星独立来源清单、不规则形状、贴图、昼夜、姿态；逐个基准特写。

**3C / 局部系统与体验**：摄像机、轨迹、面板、比例、筛选、时间控制、整体验收。

要求每一小批次通过既有 lint/typecheck/test/build 及科学回归测试，不覆盖已完成第 1/2 期。以上三次是**同一期内部拆分**，不是允许 Codex 跳到第 4 期。

## 10｜最终交付格式

必须提供：
1. 改动清单（文件路径、用途、涉及既有功能及回归情况）。
2. 18 颗卫星的数据/来源/姿态/资产 manifest。
3. 至少 3 个日期的天体状态误差对照 CSV + 总结。
4. 真实运行的浏览器截图、局部系统切换短视频、重点月球资产近景。
5. 2560×1440 画质和性能报告。
6. 完整测试命令、退出码、测试数目、失败项。
7. Git checkpoint 信息与恢复命令。
8. 未解决缺陷及限制（含科学精度）。

验收失败不得写“全面完成”；未找到 NASA 素材时如实记录，只能标为科学重建或占位，不得假报来源。**本期验收通过后立即停止，不实现第 4 期小行星带。**
