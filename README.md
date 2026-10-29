# Soc_riscv32_demo

车牌识别 SoC 的交互式教学动画：**7 个基础数据流动画 + 13 个问题与改动对照动画**。

入口：[GitHub Pages](https://seek685.github.io/Soc_riscv32_demo/) · [问题与改动播放器](https://seek685.github.io/Soc_riscv32_demo/evolution.html?topic=boundary)

播放器支持暂停、重播、单步、进度拖动、0.5×/1×/2×、方向键与空格，移动端上下对照。“减少动态效果”系统偏好下默认暂停。裁剪页可调框宽，加载页可模拟 CRC 错误，触摸页可显示 C 坐标区域，命令页可切换终端。

| 对照主题 | 入口 |
|---|---|
| CPU 职责边界、已有能力与新增应用 | [播放](evolution.html?topic=boundary) |
| HDMI 框与底图错帧 | [播放](evolution.html?topic=frame) |
| 整牌发布、晚到结果与旧字符清理 | [播放](evolution.html?topic=text) |
| 比例裁剪余量与两行偏差 | [播放](evolution.html?topic=crop) |
| 多目标独立确认、重复/旧帧过滤 | [播放](evolution.html?topic=tracks) |
| 完整结果邮箱与元数据 | [播放](evolution.html?topic=mailbox) |
| 双场景、独立时钟与记录 | [播放](evolution.html?topic=scenes) |
| 无 HMI 热区的坐标交互 | [播放](evolution.html?topic=touch) |
| 刷新/排序时的删除保护 | [播放](evolution.html?topic=delete) |
| FPGA / C / 屏幕下载、CRC 与断电 | [播放](evolution.html?topic=loader) |
| CMD / PowerShell、--help 与参数 | [播放](evolution.html?topic=commands) |
| HMI 原生目录及 CRC 修复 | [播放](evolution.html?topic=container) |
| 网络计算与显示等待的时间口径 | [播放](evolution.html?topic=latency) |

动画按本地 `_11111`、`_reconsitution` 冻结构建及筛查 v3 核对。CPU 尚未接管 YOLO 框后处理、CTC 或 HDMI 画框/叠字。筛查连续结果确认不等于逐图片计数。原有基础动画保留早期配置并明确说明版本范围。

这些动画不会连接串口或执行烧录。教学模型、历史验证和板测是不同证据，详见[依据说明](docs/evolution-evidence.md)。

## 离线使用

下载完整仓库，双击 `index.html`。新增播放器使用同目录 HTML/CSS/JavaScript，无 CDN 或运行时依赖；需要保留目录结构。原有 7 个动画仍为单文件 HTML。

## 本地验证

需要 Node.js：

```sh
npm test
npm run check
```

真实浏览器检查：

```sh
npm install
npm run test:browser
```

优先使用本机 Chrome / Edge，也可通过 `BROWSER_PATH` 指定路径。若使用 Playwright 自带 Chromium，先执行 `npx playwright install chromium`。截图与结果在忽略提交的 `test-artifacts/`。浏览器测试覆盖全部新主题及步骤、交互、390px 移动端、离线 file 模式和 7 个旧页面加载。

静态 GitHub Pages，无构建步骤。
