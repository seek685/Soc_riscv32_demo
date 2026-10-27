# Soc_riscv32_demo

CNN 层间流水动画演示页（配套主仓库 `Soc_riscv32` 停车识别 SoC 的架构可视化）。

**在线播放**：开启 GitHub Pages 后访问 <https://seek685.github.io/Soc_riscv32_demo/>

动画内容：行流式 CNN 加速器三层并行 —— 行缓存 3×3 滑窗、9-PE 脉动阵列、权重 ROM 逐拍广播（time_idx）、跨拍累加 + ReLU 输出、层间行波前时序图。

直接下载 `index.html` 用浏览器打开也可离线播放（纯单文件，无外部依赖）。
