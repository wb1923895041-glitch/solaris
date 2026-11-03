# SOLARIS 第 3 期｜使用说明与视觉基准限制

## 使用顺序
1. 先确认第 1 期（真实太阳系）与第 2 期（太阳/八大行星资产）在你的本地仓库已完成，不能从本包臆断它们已经通过验收。
2. 将 `SOLARIS_第3期_天然卫星_完整Codex提示词.md` 与 `制作规范/18颗卫星验收矩阵.md` 交给 Codex。
3. 同时把 `视觉基准` 文件夹供 Codex 查看，告知它图像只用于空间设计、细节密度和美术风格，不用于定量科学。
4. 从 3A（科学数据）开始，按 3B（资产姿态）、3C（局部浏览）推进，三批都在第 3 期内。

## 图 01｜Moon/Phobos/Deimos 生成式概念图
用于：撞击坑、地貌细节、近景对比、数字天文馆 UI 语言参考。
**禁止：** 把图中火卫一/火卫二的实际形状和撞击坑图案当成航天器真实测绘；生成图中图案只是美术概念，不是形状模型。

## 图 02｜木星卫星距离科学示意
用于：木星四大卫星相对轨道尺度的设计判断。距离取自 NASA 的 Ganymede 科普材料（约 422k、671k、1070k、1883k km）。
**注意：** 画中的月球位置角度只是示意，与任何日期没有关系；圆仅代表平均轨道半径，不是实际离心率、轨道平面、扰动或真实相位。实际 3D 轨道必须依赖 JPL 历表。

## 为什么没有附 18 张「真实卫星球面贴图」？
NASA 观测覆盖范围和色彩处理各异，某些天体没有完整、真实、连续的全球天然色彩影像。直接用 AI 绘制 18 张 2:1 图片会给出伪科学地貌，不能满足你的物理与真实性要求。故正式贴图必须由 Codex 按逐颗来源清单检索、获取、校对并记录授权；缺测地区明确写科学重建。

## 权威资料
- https://ssd.jpl.nasa.gov/sats/orbits.html
- https://ssd.jpl.nasa.gov/sats/ephem/files.html
- https://ssd.jpl.nasa.gov/sats/phys_par/
- https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/pck.html
- https://science.nasa.gov/jupiter/jupiter-moons/
- https://science.nasa.gov/saturn/moons/
- https://science.nasa.gov/uranus/moons/
- https://science.nasa.gov/neptune/moons/triton/

主项目只面向 Windows 桌面 PC；主视觉验收 2560×1440。

## 实拍美术对照（线上参考，不在压缩包内）
- NASA/JPL Voyager 1 木星四大卫星组图：https://www.jpl.nasa.gov/images/pia00012-galilean-satellites/ （相对大小和外观对照，注意组合图不是同一时刻位置）
- NASA/JPL Galileo 木星四大卫星：https://science.nasa.gov/photojournal/the-galilean-satellites/ （图中北向和比例以页面说明为准）
- ESA Cassini 土星多卫星实拍拼图：https://www.esa.int/Science_Exploration/Space_Science/Cassini-Huygens_overview
- NASA 土星卫星列表：https://science.nasa.gov/saturn/moons/

这些线上图片须各自审查使用许可和署名；项目不自动拥有重发布权。本包不以非官方图库图充当 NASA 标准素材。
