# 问题与改动动画的依据与边界

本轮为 2026-10-29 教学页面更新，没有改主工程 RTL、C 固件、模型、位流或屏幕程序，没有执行烧录。

## 版本

| 对照对象 | 范围 |
|---|---|
| `_11111` | 旧版，已经有 CPU 停车、屏幕驱动、IRQ、可写 IROM 和整包邮箱。 |
| `20261026_cpu_model_retrained` | 当前选用的硬件候选；冻结构建 `model_integration_retrained_001`。 |
| `versions/20261027_screening_v3` | 当前筛查 C 工程，保留新版停车轨迹确认，增加刑侦场景和坐标交互。 |
| `parking_screening_fixed_v2.HMI` | 修复后的屏幕工程，用户确认官方编辑器可打开、编译。 |

位流 SHA256：`0e55e6617417954a3e367e891bc02dfe6f0bb1019a9c66e1890e0de07d9ba0ca`。
筛查 v3 为 24,132 字节、BSS 8,896 字节，CPU 100 MHz、程序 RAM 32 KiB；位流内默认固件是另一份程序。下一次 C 编译后的长度可能变化。

## 13 个主题的依据

1. **CPU 边界**：`hdmi_loop.sv` 的 LPR 字符同时进入硬件叠加与 CPU 邮箱。`cpu_cnn_control.sv` 旁路观察结果，没有从 C 返回 HDMI 框/字符决策的路径。CPU 使用硬件轨迹 ID 分组确认，不生成框。
2. **视频/框匹配**：`ddr_video_delay_sync.sv` 按 `read_frame_id` 检查缓存银行身份并拒绝过期请求；`box_overlay_sync.sv` 维护框包/视频帧关系。图中位移为示意，不宣称实板永不丢帧。
3. **字符生命周期**：`char_overlay.sv` 从逐字缓存改为按目标 pending/display 整牌缓存。接收时检查新鲜度，VS 发布，完整 ID 验证身份，位置取当前目标；消失、复用或没有新结果时清除。不声称每次旧版画面都会拖尾。
4. **裁剪**：水平余量由固定 10 改为 `max(10, 原始框宽 / 16)`（整数），垂直仍为 5，保留边界限制；修正下一行配置的两行偏差。演示的字符范围是教学构造。比例余量不保证检出所有近距离大牌，不会补猜第八位。
5. **停车轨迹确认**：`parking_receive_tracked` 有六个槽、完整轨迹 ID；五次一致且跨度至少 600 ms。重复/逆序帧不计票，1000 ms 超时、缺包、ID 复用有处理。动画取 `test_tracked_parking.c` 同类 A/B 交错场景，未演尽全部分支。
6. **邮箱**：旧版已有快照和 request/ack，新版添加同快照的帧号/轨迹/真实 ROI。忙时整包丢弃计数，不暂停 CNN。动画事件步不是同步器实际周期。
7. **双场景**：v3 在消费结果前处理页面事件；场景时钟和记录独立。切换清候选、丢弃一份在途结果，不等于严格逐 HDMI 图片归属。筛查是两次连续有效确认，没有文件夹批次、图片 ID 绑定或按轨迹独立确认。
8. **HMI 坐标**：page1/page2 开 `sendxy=1`，page1 发 `PG1`。0x67 坐标由 C 判断，按下/释放同页，位移不超 20 px。设置目标 x=76..291、y=340..390，切回停车 x=205..348、y=20..62。page0 沿用原事件热区。
9. **删除保护**：左侧为直接按最新行号删除的风险说明，不声称 `_11111` 停车页存在此漏洞。筛查检查 `ui_dirty`、已绘制槽位和记录编号。四字段交给发送端后才提交行身份，不是屏幕逐行绘制 ACK。
10. **加载**：`.sbit` 配置 FPGA，`.bin` 写易失程序 RAM，`.tft` 下载屏幕。当前上传器用 115200 8N1、40 ms BREAK、`RVLD + 长度 + CRC32 + 程序`，长度不超 32 KiB、四字节对齐。加载中 CPU 复位，错误 CRC 不提交；没有双镜像回滚，失败后需重传有效程序或重配 FPGA 恢复默认程序。
11. **命令**：CMD / PowerShell 启动语法不同。`image`、`--port` 来自脚本 argparse；`sw_build.py --port COM17` 先编译，成功后上传。COM17 是用户本次端口，不是固定硬件编号。
12. **HMI 修复**：本次被拒绝初版未同步 0 和 0x80000 两份目录，外层 CRC 无效。v2 保留原地址、追加资源、同步两表和各自 CRC。六项格式回归与用户手工官方编译是不同证据；不能据此诊断所有 version mismatch。
13. **延迟**：历史控制探针按 PE 148.5 MHz 折算，首字符约 2.419 ms、整牌边界约 2.681 ms；不是本轮重跑完整 CNN 数值或板测。DDR 触发约 4.12 ms、同位置字符可见约 20.8 / 37.5 ms 取不同起点/假设，不可直接累加，串口屏另外测量。条形图是量级比较，不是可累加的甘特图。

## 核对记录

本地核对候选 `candidate.json`、`inputs_sha256.json`、`docs/verification/model_integration_20261026.md`、冻结构建 RTL 和筛查 v3。`char_overlay.sv`、`box_overlay_sync.sv`、`ddr_video_delay_sync.sv` 的冻结文件匹配候选输入清单。

| 当前关键文件 | SHA256 |
|---|---|
| `char_overlay.sv` | `b6c557b44a194cb702f415a6a5c61ad28afe75fab170634856b0eed9a75da4ef` |
| `box_overlay_sync.sv` | `6c528629144b0191bde499fb75e18b4e0adeb7a582e344a6c6f70152d76cf3ba` |

历史来源：`versions/20261027_latency_comparison/README.md`、`versions/20261026_timing_analysis/README.md`、20261027 HMI 修复记录 `native_hmi_update.py` / `check_native_hmi.py`、v2 清单与用户确认。

本轮实际验证仅覆盖动画模型、链接/脚本语法、浏览器交互与布局。历史主工程验证和本轮演示测试分别记录，不代表本轮完成 RTL 整机或板测。实际结果见 [verification.md](verification.md)。

## 修改本演示后运行

```sh
npm test
npm run check
npm run test:browser
```

静态文件推送后由已配置的 GitHub Pages 发布；若尚未启用 Pages，需要仓库管理员配置。这里不需要执行主工程烧录命令。
