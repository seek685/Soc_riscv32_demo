/* Educational models. Animation steps are events, not FPGA clock cycles. */
(function (root) {
  'use strict';
  const PLATE_A = '粤AD12345',
    PLATE_B = '京B54321';
  const topics = [
    {
      id: 'boundary',
      group: 'CPU 与应用',
      title: 'CPU 到底接管了哪里',
      subtitle: '沿着同一份识别结果，找到硬件与软件的边界。',
      before: '_11111：识别链 + 停车 CPU',
      after: '当前：识别链 + 更完整的结果应用',
      steps: [
        'HDMI 像素进入检测流水线',
        'RTL 生成检测框并裁剪 ROI',
        'LPRNet 与硬件 argmax / CTC 输出字符',
        'HDMI 硬件独立画框和叠字',
        '结果邮箱同时把整牌交给 CPU',
        'CPU 按帧号、轨迹号确认停车结果',
        'CPU 根据场景执行目标匹配或停车业务',
        'CPU 向淘晶驰发送绘图与交互命令',
      ],
      lesson:
        '_11111 已有 CPU 停车业务。当前没有把检测框后处理、CTC 或 HDMI 叠加移到 CPU；扩展发生在完整车牌结果之后。',
      scope: '架构对照。轨迹 ID 由硬件产生；CPU 使用它分组确认，不生成检测框。',
      source: [
        'hw/rtl/top/hdmi_loop.sv',
        'hw/rtl/core/cpu/cpu_cnn_control.sv',
        'versions/20261027_screening_v3/sw/app/main.c',
      ],
    },
    {
      id: 'frame',
      group: 'HDMI 与数据链',
      title: '框为什么追不上底图',
      subtitle: '检测结果晚到时，不能把“当前缓存”当成它的源图像。',
      before: '早期：缺少源帧号约束',
      after: '当前：视频、框包按源帧匹配',
      steps: [
        '输入帧 N：车在左侧',
        'YOLO 正在计算，车辆继续运动',
        '输入帧 N+1：车已向右移动',
        'N 的检测框完成，但当前写入银行已经变化',
        '旧路径把 N 的框放到较新的底图',
        '新路径按 read_frame_id 选择对应银行',
        '排队请求过期时丢弃，不把错误帧标成正确帧',
      ],
      lesson: '匹配的是源帧身份。过期就拒绝，不能靠给结果换一个“当前帧号”掩盖错帧。',
      scope: '按冻结 RTL 的帧号检查机制示意；像素位置与事件时长经过简化，不是实板录像。',
      source: [
        'hw/rtl/core/cnn/ddr/ddr_video_delay_sync.sv',
        'hw/rtl/core/cnn/overlay/box_overlay_sync.sv',
      ],
    },
    {
      id: 'text',
      group: 'HDMI 与数据链',
      title: '字符拖尾、晚到与旧字残留',
      subtitle: '从逐字缓存，变为按目标整牌发布。',
      before: '_11111：按字写入坐标缓存',
      after: '当前：整牌缓存 + 目标匹配 + VS 发布',
      steps: [
        'ROI 开始识别，记录源帧与目标 ID',
        '字符陆续从 CTC 输出',
        '目标已经移动，旧裁剪坐标开始落后',
        '整牌完成后跨域传输',
        '接收时检查源帧新鲜度',
        '下一次 VS：把整牌一起发布',
        '文字位置取当前匹配目标的位置',
        '目标消失或槽位复用：旧结果不再绘制',
        '没有新完成结果：下一个 VS 清除文字',
      ],
      lesson:
        '当前方案在接收时检查新鲜度，再于 VS 整包发布一次，避免合法晚到结果尚未显示就过期；目标身份仍必须匹配。',
      scope: '旧逻辑按字缓存与当前生命周期对照；不把“每个旧画面一定拖尾”当成结论。',
      source: [
        'hw/rtl/core/cnn/overlay/char_overlay.sv',
        'docs/verification/model_integration_20261026.md',
      ],
    },
    {
      id: 'crop',
      group: 'HDMI 与数据链',
      title: '裁剪漏字与两行偏差',
      subtitle: '八位牌的最后一位，可能在进入 LPRNet 前就被裁掉了。',
      before: '早期：固定水平余量 10 px',
      after: '当前：max(10, 原始框宽 ÷ 16)',
      steps: [
        '检测框覆盖了大部分车牌',
        '真实字符略微超出检测框边缘',
        '固定 10 px 对大框可能不足',
        '当前按原始框宽计算水平余量',
        '裁剪范围钳位到图像边界',
        '修正下一行配置时的两行采样偏差',
        '裁剪后仍要由 LPRNet 判断，不能补猜缺失字符',
      ],
      lesson:
        '裁剪完整度与识别准确率是两个问题。比例余量可改善部分漏边，但不能恢复检测器完全没有检出的车牌。',
      scope: '几何示意：调整框宽可观察余量公式。字符覆盖范围是教学构造，不代表所有八位牌已修复。',
      source: [
        'hw/rtl/core/cnn/overlay/box_overlay_sync.sv',
        'docs/verification/model_integration_20261026.md',
      ],
    },
    {
      id: 'tracks',
      group: 'CPU 与应用',
      title: '两辆车交替，为什么确认不了',
      subtitle: '按目标分别累计，重复源帧不能多算一票。',
      before: '_11111：共用一组候选状态',
      after: '当前停车：6 个轨迹槽独立确认',
      steps: [
        'A、B 两车分别产生结果',
        'A 的第 1 帧',
        'B 的第 1 帧',
        'A 的第 2 帧',
        'B 的第 2 帧',
        'A 的第 3 帧',
        'B 的第 3 帧',
        'A 的第 4 帧',
        'B 的第 4 帧',
        'A 第 5 票，跨度 600 ms',
        'B 第 5 票，跨度 600 ms',
        '重复 A 的同一源帧：不增加票数',
        '旧帧与非真实 ROI：忽略',
      ],
      lesson:
        '停车保留“五次一致且跨度至少 600 ms”的条件，只把确认状态按硬件轨迹 ID 分开。筛查模式的两次确认是另一套规则。',
      scope:
        '输入采用已有 tracked parking 回归中的交错顺序；轨迹槽复用、缺包与超时也会重置相应状态。',
      source: [
        'sw/app/parking.c:parking_receive_tracked',
        'sim/testcases/firmware/test_tracked_parking.c',
      ],
    },
    {
      id: 'mailbox',
      group: 'HDMI 与数据链',
      title: '车牌、帧号和轨迹怎样一起到 CPU',
      subtitle: '已有整包握手上增加元数据，不能拼出一份不存在的结果。',
      before: '_11111 已有：字符整包快照',
      after: '当前新增：同一快照携带元数据',
      steps: [
        '收集本次 CTC 字符',
        'result_done：冻结整包',
        'request toggle 跨入 CPU 时钟域',
        'CPU 看到 valid 后读取字段',
        '源端完成第二包，但邮箱仍忙',
        '第二包整包丢弃，dropped +1',
        'CPU 写 POP',
        'ack 跨回源时钟域',
        '解锁，允许发布下一包',
      ],
      lesson:
        '忙时整包丢弃并计数，CNN 不被邮箱反压暂停。字符、帧号、轨迹号与真实 ROI 标记属于同一份冻结快照。',
      scope: 'request / ack 两级同步按事件展开，动画步数不等于实际同步器周期；旧版也已有快照握手。',
      source: ['hw/rtl/core/cpu/lpr_result_mailbox.sv', 'hw/rtl/core/cpu/cpu_cnn_control.sv'],
    },
    {
      id: 'scenes',
      group: 'CPU 与应用',
      title: '一个 HDMI，两个应用场景',
      subtitle: '输入口共用，CPU 把识别结果交给当前场景。',
      before: '_11111：单一停车业务',
      after: '筛查 v3：场景分流 + 独立记录',
      steps: [
        '停车场景运行，停车时钟前进',
        '切换到刑侦：清除在途确认，丢弃一份结果',
        '初次进入筛查暂停，等待准备 HDMI 画面',
        '设置目标后，开始新筛查批次',
        '连续有效结果通过确认，登记普通车牌',
        '发现完整目标车牌，命中记录置顶',
        '切回停车，恢复停车场景时钟',
        '两个场景记录分别保留',
      ],
      lesson:
        '场景切换改变软件消费结果的方式。HDMI、检测和识别硬件持续运行；停车虚拟时钟在刑侦场景中冻结。',
      scope: '筛查为连续画面记录，尚无电脑文件夹批次与图片 ID 绑定，也不是严格逐图计数。',
      source: [
        'versions/20261027_screening_v3/sw/app/main.c',
        'versions/20261027_screening_v3/sw/app/screening.c',
      ],
    },
    {
      id: 'touch',
      group: 'CPU 与应用',
      title: '没有 HMI 热区，为什么还能点击',
      subtitle: '图片负责外观，坐标包与 C 程序共同实现交互。',
      before: '编辑器：page1 背景，无热区对象',
      after: '运行时：坐标上报 → C 判定 → 绘图',
      steps: [
        'page1 后初始化：sendxy=1，并发 PG1',
        '按下“设置目标”：坐标 (150,365)',
        '屏幕发送 0x67 坐标按下包',
        '松手：发送相同区域的释放包',
        'C 核对按下、释放页面及拖动距离',
        '坐标命中设置区域，CPU 发送 page 2',
        'CPU 用绘图命令生成输入键盘',
        '确认合法目标后，切回 page1 并开始筛查',
      ],
      lesson:
        'page1/page2 的交互由 C 的 screening_touch 判定。移动背景按钮时，必须同步修改 C 中的矩形范围。',
      scope:
        '设置目标范围 x=76..291、y=340..390；按下与释放成对处理，拖动超过 20 px 不触发。图中只展示部分键，完整键盘由实际固件绘制。',
      source: [
        'versions/20261027_screening_v3/sw/drivers/screen.c:screening_touch',
        'page1 后初始化事件：sendxy=1 / printh 50 47 31',
      ],
    },
    {
      id: 'delete',
      group: 'CPU 与应用',
      title: '刷新和排序时，怎样避免删错记录',
      subtitle: '点击的是用户看到的那条记录，不能直接使用刷新后的行号。',
      before: '风险示意：只使用当前第 1 行',
      after: '当前：核对已绘制槽位与记录编号',
      steps: [
        '屏幕第 1 行显示普通记录 A #12',
        '用户准备点击第 1 行删除',
        '新命中 B #13 被置顶，列表映射改变',
        '屏幕尚未把新第 1 行完整画完',
        '风险路径按当前映射删掉 B',
        '当前代码发现显示身份不一致，忽略这次点击',
        '四个字段绘制完成，提交行槽位及记录编号',
        '再次点击，删除此时已显示的 B #13',
      ],
      lesson:
        '删除要检查 ui_dirty、已绘制槽位和记录编号。旧点击、拖动以及未完成刷新的行不能直接触发删除。',
      scope:
        '左侧是被防护的风险模型，不声称 _11111 存在这个缺陷；_11111 已有停车列表删除保护。右侧展示筛查新增的身份保护。',
      source: [
        'versions/20261027_screening_v3/sw/drivers/screen.c',
        'versions/20261027_screening_v3/sw/app/screening.c:screening_delete',
      ],
    },
    {
      id: 'loader',
      group: '工具与版本',
      title: 'FPGA、CPU、屏幕分别下载什么',
      subtitle: '可写 IROM 是程序 RAM，C 固件加载不会重做神经网络。',
      before: '只更新屏幕：有背景，缺少新版业务',
      after: '配套 FPGA 位流 + C 固件 + 屏幕程序',
      steps: [
        '先让 FPGA 运行带 UART 加载器的 .sbit',
        '屏幕单独下载 .tft，显示 page1 背景',
        '电脑向 FPGA 加载口发 40 ms BREAK',
        'CPU 保持复位，回复 ready',
        '发送 RVLD + 长度 + CRC32 + .bin',
        '接收并写入 32 KiB 程序 RAM',
        'CRC 正确：提交，回复 committed，CPU 重启',
        '新版 C 开始处理设置目标和返回按钮',
        'FPGA 断电或重新配置：恢复位流内默认程序',
      ],
      lesson:
        '只修改 C 时编译 .bin 并串口加载即可。修改 RTL、权重或上电默认 ROM 时，才需要在完整硬件工程重新生成位流。',
      scope:
        '协议来自当前 upload_firmware.py，115200 8N1。CRC 错误不会释放 CPU；没有双镜像自动回滚。COM 号由本机设备决定。',
      source: [
        'scripts/upload_firmware.py',
        'hw/rtl/core/cpu/firmware_loader.sv',
        'hw/rtl/core/cpu/program_ram.sv',
      ],
    },
    {
      id: 'commands',
      group: '工具与版本',
      title: '烧录命令从哪里来',
      subtitle: '终端负责启动程序，参数由工程脚本定义。',
      before: 'CMD 输入 PowerShell 写法',
      after: '先认终端，再看 README 与 --help',
      steps: [
        '先确认窗口是 CMD 还是 PowerShell',
        '给可执行文件和带空格路径加引号',
        'CMD 直接启动；PowerShell 用 & 调用引号中的路径',
        'Python 运行工程提供的 upload_firmware.py',
        'image 是位置参数，--port 是该脚本定义的参数',
        '用 --help 查看格式，按实际设备选择 COM 号',
        '每次改 C：sw_build.py --port COM17，先编译再上传',
      ],
      lesson: '--port 不是统一烧录语法，它来自 argparse 参数定义。上传器必须与板上加载协议匹配。',
      scope: '示例沿用用户当前 COM17；实际端口以设备管理器为准。演示不会连接串口或执行烧录命令。',
      source: ['scripts/upload_firmware.py:main', 'scripts/sw_build.py:main'],
    },
    {
      id: 'container',
      group: '工具与版本',
      title: 'HMI 为什么曾经打不开',
      subtitle: '两份资源目录必须一致，校验也要同时正确。',
      before: '被拒绝的初版：目录不同步 / CRC 无效',
      after: '修正版 v2：追加资源，更新两份目录与 CRC',
      steps: [
        '原 HMI 有两份有效的原生资源目录',
        '初版只重排并更新一份目录',
        '另一份仍指向旧地址，外层 CRC 也无效',
        '编辑器读取到冲突，出现版本/溢出提示',
        '修正版保留原资源位置，追加修改后的资源',
        '两份目录指向同一组新资源，重新计算各自 CRC',
        '本地结构回归通过，仍需官方编辑器验证',
        '用户确认 v2 能打开并完成官方编译',
      ],
      lesson:
        '这次报错的已定位原因是容器目录和校验错误；不能把所有 version mismatch 都归因于这个原因。',
      scope:
        '两表位于 0 和 0x80000。结构验证不等于官方编译；本例包含用户手工编译确认，尚不等于真实屏幕功能验收。',
      source: [
        '20261027 HMI 修复记录：native_hmi_update.py / check_native_hmi.py',
        'parking_screening_fixed_v2.HMI 的修复清单与用户确认',
      ],
    },
    {
      id: 'latency',
      group: 'HDMI 与数据链',
      title: '网络算完了，为什么字还没上屏',
      subtitle: '计算、数据搬运、帧边界发布和屏幕通信有不同的计时终点。',
      before: '容易误读：把全部等待叫“推理时间”',
      after: '明确起止点，分别核算各段',
      steps: [
        '真实裁剪 reader 开始送入一张 ROI',
        'LPR 首字符约 2.419 ms',
        'LPR 整牌边界约 2.681 ms',
        '结果跨入 CPU 邮箱，随后轮询与业务处理',
        'HDMI 字符等待回放 VS 统一发布',
        '同位置字符可见估算约 20.8 ms，晚到可能约 37.5 ms',
        '串口屏还有命令传输与绘制时间，应另外测量',
      ],
      lesson:
        '此前约 4.12 ms 是 DDR 视频回放触发量级，约 20.8 ms 是特定假设下的字符可见估算；两者都不能当成 LPR 网络计算耗时。',
      scope:
        '2.419 / 2.681 ms 来自控制探针按生产 148.5 MHz 折算；20.8 / 37.5 ms 是历史核算，非本次板测或固定保证。',
      source: [
        'versions/20261027_latency_comparison/README.md',
        'versions/20261026_timing_analysis/README.md',
      ],
    },
  ];

  function margin(width) {
    return Math.max(10, Math.floor(width / 16));
  }
  function tapAction(down, up, page, requested) {
    if (
      requested ||
      page !== 1 ||
      !down ||
      !up ||
      down.page !== page ||
      up.page !== page ||
      Math.abs(down.x - up.x) > 20 ||
      Math.abs(down.y - up.y) > 20
    )
      return null;
    const { x, y } = up;
    if (x >= 205 && x < 349 && y >= 20 && y < 63) return 'parking';
    if (x >= 76 && x < 292 && y >= 340 && y < 391) return 'target';
    return null;
  }
  function safeDelete({ dirty, slot, drawnSlot, number, drawnNumber, valid = true }) {
    return !dirty && valid && slot === drawnSlot && number === drawnNumber;
  }
  function trackSimulation(count) {
    const events = [];
    for (let frame = 0; frame < 5; frame++) {
      events.push({ name: 'A', id: 8, frame, ms: frame * 150, real: true });
      events.push({ name: 'B', id: 9, frame, ms: frame * 150 + 1, real: true });
    }
    events.push(
      { name: 'A', id: 8, frame: 4, ms: 650, real: true },
      { name: 'A', id: 8, frame: 3, ms: 700, real: true },
      { name: 'B', id: 9, frame: 5, ms: 750, real: false },
    );
    let shared = { name: '', votes: 0, first: 0 },
      oldAccepted = 0,
      skipped = 0;
    const tracks = {};
    for (const event of events.slice(0, count)) {
      // The older interface cannot distinguish a syntactically valid flush
      // result from a real ROI; only the newer branch receives that flag.
      if (shared.name !== event.name) shared = { name: event.name, votes: 1, first: event.ms };
      else shared.votes++;
      if (shared.votes >= 5 && event.ms - shared.first >= 600) oldAccepted++;
      const t = tracks[event.name];
      if (!event.real || (t && event.frame <= t.frame)) {
        skipped++;
        continue;
      }
      const next = t || { votes: 0, first: event.ms, accepted: false };
      next.votes++;
      next.frame = event.frame;
      next.accepted = next.votes >= 5 && event.ms - next.first >= 600;
      tracks[event.name] = next;
    }
    return {
      events: events.slice(0, count),
      event: events[count - 1] || null,
      shared,
      tracks,
      oldAccepted,
      skipped,
      accepted: Object.values(tracks).filter((t) => t.accepted).length,
    };
  }
  function mailbox(step) {
    return {
      frozen: step >= 1 && step < 8,
      valid: step >= 3 && step < 6,
      popped: step >= 6,
      dropped: step >= 5 ? 1 : 0,
      seq: 42,
      frame: 100,
      track: 8,
      roi: true,
      plate: PLATE_A,
    };
  }
  function loader(step, badCrc = false) {
    const failed = badCrc && step >= 6 && step < 8;
    return {
      configured: step >= 0,
      bytes: step < 5 ? 0 : 24132,
      hold: step >= 3 && (step < 6 || failed),
      running: step >= 6 && !failed,
      newFirmware: step >= 6 && step < 8 && !failed,
      failed,
      message: failed
        ? 'CRC mismatch / CPU 保持复位'
        : step >= 8
          ? 'FPGA 重配：恢复默认固件'
          : step >= 6
            ? 'PASS 24132 bytes; CPU restarted'
            : step >= 5
              ? '接收 24132 字节'
              : '等待加载',
      defaultRestored: step >= 8,
    };
  }
  function scene(step) {
    return {
      page: step === 0 || step >= 6 ? 0 : step === 3 ? 2 : 1,
      parkingSeconds: step === 0 ? 1 : step >= 6 ? 2 : 1,
      screenCount: step >= 5 ? 2 : step >= 4 ? 1 : 0,
      hits: step >= 5 ? 1 : 0,
      running: step >= 3 && step < 6,
      discard: step === 1 || step === 6,
    };
  }
  function textState(step) {
    return {
      oldChars: step < 1 ? 0 : Math.min(8, step * 2),
      whole: step >= 5 && step < 7,
      fresh: step >= 4,
      targetMatched: step < 7,
      visible: step >= 5 && step < 7,
      oldX: 110,
      currentX: 110 + step * 16,
      cleared: step >= 7,
    };
  }
  function directories(step) {
    return {
      countA: step >= 1 ? 15 : 13,
      countB: step >= 5 ? 15 : 13,
      crcA: step === 0 || step >= 5,
      crcB: true,
      offsetsPreserved: step === 0 || step >= 4,
      officialCompile: step >= 7,
      structuralPass: step >= 6,
    };
  }
  const api = {
    topics,
    PLATE_A,
    PLATE_B,
    margin,
    tapAction,
    safeDelete,
    trackSimulation,
    mailbox,
    loader,
    scene,
    textState,
    directories,
  };
  root.SoCDemoModels = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
