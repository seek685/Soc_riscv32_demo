# 本轮演示验证

日期：2026-10-29。这里只记录教学演示页面检查，不替代主工程 RTL 或上板验收。

| 检查 | 当前结果 |
|---|---|
| 教学模型断言 | 本地通过，11 项，0 失败，0 跳过 |
| HTML 链接、内联及外部 JS 语法 | 本地通过，9 个 HTML 页面，19 个静态引用；动态路由另由浏览器检查 |
| 本地 Chromium | Windows 拒绝创建 Mojo 通信管道，未完成 |
| 全主题播放、逐步状态、移动布局、离线和旧页面 | 已配置 GitHub Actions，远程结果待确认 |

运行命令为 `npm test`、`npm run check`、`npm run test:browser`。浏览器检查会保存截图与 JSON 结果到 workflow artifact，检查所有新主题的步骤、真实计时播放、参数交互、390px 移动端、离线 file 模式及 7 个旧页面的加载。

源码与历史修复依据见 [evolution-evidence.md](evolution-evidence.md)。
