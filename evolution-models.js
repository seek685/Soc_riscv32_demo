/* Educational models. Animation steps are events, not FPGA clock cycles. */
(function (root) {
  'use strict';
  const PLATE_A = '粤AD12345',
    PLATE_B = '京B54321';
  const topics = [
    {
      id: 'boundary',
      group: 'CPU 与应用',
      title: '谁负责识别，谁负责管理',
      subtitle: '看同一张车牌结果怎样分成“画面”和“业务”两条路。',
      before: '以前：识别 + 停车管理',
      after: '现在：识别 + 两种业务管理',
      steps: [
        '汽车画面进入识别机器',
        '识别机器找到车牌位置',
        '截下的车牌被逐个读出',
        '画面自己画框、写字',
        '同一张车牌结果送给管理员',
        '管理员检查结果并登记停车',
        '现在还能把结果交给刑侦规则',
        '两种业务各自管理，识别画面仍继续',
      ],
      lesson:
        '识别和画框一直由硬件完成。CPU 像管理员，拿到完整车牌后负责确认和业务；现在多了一套刑侦规则。',
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
      title: '车已经走了，框为什么还在原地',
      subtitle: '一张旧照片上的检测框，可能被贴到较新的画面上。',
      before: '以前：把旧框贴到新画面',
      after: '现在：框只贴回它的照片',
      steps: [
        '车辆移动，机器先拍下一张照片',
        '识别需要一点时间，车辆继续向右',
        '第二张照片里，车辆已经换了位置',
        '第一张照片的检测框终于算出来',
        '旧方法取了最新画面，框和车分开',
        '新方法找到框对应的第一张照片',
        '照片已经过期时，宁可丢弃也不乱贴',
      ],
      lesson: '让框和它所属的照片一起走，就能避免把旧位置贴到另一张画面上。画面过期后会被丢弃。',
      scope: '按冻结 RTL 的帧号检查机制示意；像素位置与事件时长经过简化，不是实板录像。',
      source: [
        'hw/rtl/core/cnn/ddr/ddr_video_delay_sync.sv',
        'hw/rtl/core/cnn/overlay/box_overlay_sync.sv',
      ],
    },
    {
      id: 'text',
      group: 'HDMI 与数据链',
      title: '字为什么跟错车、又突然消失',
      subtitle: '看识别结果怎样从一张小纸条变成车旁边的文字。',
      before: '以前：文字留在旧位置',
      after: '现在：整牌跟着同一辆车',
      steps: [
        '机器开始读取第一辆车的号码',
        '字一个一个地出来，车还在向前走',
        '旧方法把字写在刚才的位置',
        '新方法先把这一串字收齐',
        '结果来了，先检查是不是刚才那辆车',
        '画面换帧时，整串号码一起出现',
        '车往前走，文字跟着这辆车',
        '旧车离开，新车占用位置',
        '新车没有自己的结果时，旧字清掉',
      ],
      lesson:
        '先把整串号码和车辆身份绑在一起，再在画面换帧时显示。车离开后，旧号码不能借给下一辆车。',
      scope: '旧逻辑按字缓存与当前生命周期对照；不把“每个旧画面一定拖尾”当成结论。',
      source: [
        'hw/rtl/core/cnn/overlay/char_overlay.sv',
        'docs/verification/model_integration_20261026.md',
      ],
    },
    {
      id: 'crop',
      group: 'HDMI 与数据链',
      title: '最后一个字，是怎么被裁掉的',
      subtitle: '先看原车牌，再看真正送给识别机器的小图片。',
      before: '以前：两边只多留固定一点',
      after: '现在：车牌框越大，留得越宽',
      steps: [
        '一张八位车牌进入画面',
        '检测框差一点，框外还有最后一个字',
        '旧方法只向两边各多留一点',
        '新方法根据车牌框大小决定留多少',
        '扫描线逐行读取裁剪范围',
        '把范围里的字搬进一张小图片',
        '比较两张小图片，识别机器只能看见送进去的内容',
      ],
      lesson: '裁掉的字在进入识别机器之前就已经丢失。多留余量有助于部分漏边，最终仍要看识别结果。',
      scope: '几何示意：调整框宽可观察余量公式。字符覆盖范围是教学构造，不代表所有八位牌已修复。',
      source: [
        'hw/rtl/core/cnn/overlay/box_overlay_sync.sv',
        'docs/verification/model_integration_20261026.md',
      ],
    },
    {
      id: 'tracks',
      group: 'CPU 与应用',
      title: '两辆车为什么互相打断确认',
      subtitle: '看 A、B 两辆车交替出现，确认票怎样积累。',
      before: '以前：两辆车共用一个票盒',
      after: '现在：每辆车有自己的票盒',
      steps: [
        '两辆车同时进入画面',
        '第一次看到 A：给 A 一票',
        '第一次看到 B：给 B 一票',
        '第二次看到 A',
        '第二次看到 B',
        '第三次看到 A',
        '第三次看到 B',
        '第四次看到 A',
        '第四次看到 B',
        '第五次看到 A，时间也足够了',
        '第五次看到 B，时间也足够了',
        '同一张旧照片再次到来',
        '过期照片和排空用的空图不应加票',
      ],
      lesson:
        '以前 A、B 交替会把共同票盒里的候选换来换去。现在按车辆分开，停车确认仍要求五次一致且跨越至少 600 毫秒。',
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
      title: '怎样把一整张识别结果交出去',
      subtitle: '看号码被装进信封、封好、送达，再放行下一封。',
      before: '以前：信封里有完整号码',
      after: '现在：信封里还带照片和车辆身份',
      steps: [
        '识别机器把一个个字放进信封',
        '最后一个字放好，把信封封住',
        '信封穿过两边工作速度不同的桥',
        '管理员收到后取出整张结果',
        '下一张结果到了，前一封还没取走',
        '信箱满了：新结果整张丢弃并记一次',
        '管理员取走结果并发回回执',
        '回执还在过桥，信箱继续上锁',
        '回执到达，信箱解锁',
      ],
      lesson:
        '以前就有“封好再交”的整包保护。新版在同一个信封里加入照片和车辆身份，让管理员知道号码属于谁。',
      scope: 'request / ack 两级同步按事件展开，动画步数不等于实际同步器周期；旧版也已有快照握手。',
      source: ['hw/rtl/core/cpu/lpr_result_mailbox.sv', 'hw/rtl/core/cpu/cpu_cnn_control.sv'],
    },
    {
      id: 'scenes',
      group: 'CPU 与应用',
      title: '一套识别，怎样切换两种用途',
      subtitle: '同一个车牌结果，跟着开关走向停车或刑侦。',
      before: '以前：只有停车规则',
      after: '现在：同一份结果分给当前场景',
      steps: [
        '停车场景接收识别结果，计时开始',
        '切到刑侦，先清掉未确认的半份结果',
        '刑侦先暂停，等待画面准备好',
        '输入目标车牌，开始新的筛查',
        '普通车牌进入筛查记录',
        '目标车牌出现，命中记录移到最上面',
        '切回停车，停车计时从暂停处继续',
        '两边的记录分别保留',
      ],
      lesson: '识别机器一直运行。切换时改变的是管理员把结果送往哪里；刑侦期间停车计时暂停。',
      scope: '筛查为连续画面记录，尚无电脑文件夹批次与图片 ID 绑定，也不是严格逐图计数。',
      source: [
        'versions/20261027_screening_v3/sw/app/main.c',
        'versions/20261027_screening_v3/sw/app/screening.c',
      ],
    },
    {
      id: 'touch',
      group: 'CPU 与应用',
      title: '图上没有按钮，为什么点得动',
      subtitle: '看手指点的位置，怎样被管理员理解为一次操作。',
      before: '编辑器里：只有一张背景图',
      after: '真实运行时：手指的位置交给管理员',
      steps: [
        '编辑器看到的是一整张刑侦背景',
        '手指按下“设置目标”的位置',
        '屏幕把按下的位置送出去',
        '手指松开，再送一次位置',
        '管理员核对两次位置在同一范围',
        '管理员让屏幕打开输入页',
        '键盘出现，逐个输入目标车牌',
        '按确认，带着目标返回刑侦页',
      ],
      lesson:
        '屏幕把触摸位置交给 CPU；CPU 判断它落在哪个区域，再让屏幕切页或画键盘。移动背景按钮时，相应范围也要调整。',
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
      title: '点的是第一行，为什么可能删错车',
      subtitle: '一条新命中突然排到最上面，屏幕还没来得及画完。',
      before: '危险做法：只认“第一行”',
      after: '现在：确认屏幕上显示的那条',
      steps: [
        '屏幕第一行显示普通车 A',
        '手指准备删除屏幕上的 A',
        '命中车 B 到来，系统把 B 放到前面',
        '屏幕仍在更新，用户看到的还是 A',
        '如果只按新行号，可能误删 B',
        '新方法先阻止这次不一致的点击',
        '新第一行完整显示 B，再核对身份',
        '再次点击，删除现在真正看到的 B',
      ],
      lesson:
        '列表变化时，眼睛看到的行和系统最新顺序可能暂时不同。要确认屏幕上的记录身份，再执行删除。',
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
      title: '为什么换了界面，按钮还是没反应',
      subtitle: '三份文件各有目的地，先看它们分别装进哪里。',
      before: '只更新屏幕：背景变了',
      after: '配套更新：程序也能处理点击',
      steps: [
        '先让 FPGA 运行识别与加载电路',
        '把新的界面文件下载到屏幕',
        '电脑向 FPGA 发出“准备接收”的信号',
        '管理员暂时停下，等待新程序',
        '先递上文件大小与校验信息',
        '程序分成小块，逐块装进程序区',
        '检查通过：管理员重新开始工作',
        '点击按钮，新的业务程序处理操作',
        '断电后，临时程序消失，恢复内置程序',
      ],
      lesson:
        '屏幕文件负责界面；C 程序负责管理规则。程序加载到可写 RAM，断电或重新配置 FPGA 后需要再次加载。',
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
      title: '为什么同一句命令换个窗口就报错',
      subtitle: '窗口先听懂启动方式，上传工具再接收文件和串口。',
      before: '错误：在 CMD 使用了另一种开头',
      after: '正确：先看窗口和工具的用法',
      steps: [
        '电脑上打开了一个命令窗口',
        '文件路径需要作为一个完整地址交给窗口',
        '不同窗口对“启动程序”的开头要求不同',
        '窗口启动 Python，Python 再启动上传工具',
        '工具提示：需要程序文件和串口号',
        '选择设备管理器中实际连接的串口',
        '语法正确后，工具才把程序送给 FPGA',
      ],
      lesson:
        '先认清当前是 CMD 还是 PowerShell，再查看工具的帮助。串口和程序文件是上传工具要求的两个输入。',
      scope: '示例沿用用户当前 COM17；实际端口以设备管理器为准。演示不会连接串口或执行烧录命令。',
      source: ['scripts/upload_firmware.py:main', 'scripts/sw_build.py:main'],
    },
    {
      id: 'container',
      group: '工具与版本',
      title: '工程文件为什么打不开，修复了哪里',
      subtitle: '看两张目录卡怎样找到同一批页面和图片。',
      before: '初版：两张目录卡对不上',
      after: '修正版：两张卡和资源重新对齐',
      steps: [
        '原工程有两张相同的资源目录',
        '新增页面和图片，需要更新目录',
        '初版只更新了一张，另一张还指旧位置',
        '编辑器按目录寻找时发现对不上',
        '修正版先把新资源追加到后面',
        '两张目录都指向同一批资源，再分别校验',
        '先用结构检查确认目录和校验',
        '再交给官方编辑器打开并编译',
      ],
      lesson:
        '这次错误是两份目录与校验不同步。修复后两份目录一起更新，结构检查和官方编译分别验证。',
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
      title: '已经认出来了，为什么屏幕还没字',
      subtitle: '看车牌结果在识别后，还要等画面换帧。',
      before: '容易混淆：用一只表计全部等待',
      after: '正确理解：识别和上屏各有终点',
      steps: [
        '车牌图片进入识别机器',
        '机器开始读取字符',
        '识别结束，一整串号码已经得到',
        '号码到达显示流程，等待画面换帧',
        '上一张画面还没显示完',
        '新画面开始，号码贴到车旁边',
        '对照两只表：认出来和看见不是同一时刻',
      ],
      lesson: '识别完成后，文字还可能等待下一次画面更新。网络计算时间与看到文字的时间要分别测量。',
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
