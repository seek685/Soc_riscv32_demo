(function () {
  'use strict';
  const M = window.SoCDemoModels,
    $ = (id) => document.getElementById(id);
  const canvas = $('demo-canvas'),
    ctx = canvas.getContext('2d');
  const C = {
    ink: '#172d36',
    muted: '#647b82',
    teal: '#087e85',
    old: '#bc5449',
    good: '#107c65',
    line: '#cadad8',
    blue: '#3b6fbc',
    amber: '#a67119',
  };
  const font = '"Microsoft YaHei","PingFang SC",system-ui,sans-serif';
  let topic,
    step = 0,
    elapsed = 0,
    last = 0,
    raf = null,
    playing = false,
    speed = 1,
    options = {},
    cw = 0,
    ch = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rect(x, y, w, h, fill = '#fff', stroke = C.line, r = 9) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  function text(s, x, y, size = 13, color = C.ink, weight = 400) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textBaseline = 'top';
    ctx.fillText(String(s), x, y);
  }
  function wrap(s, x, y, max, size = 12, color = C.muted, lineHeight = 20, maxLines = 8) {
    ctx.font = `400 ${size}px ${font}`;
    let current = '';
    const lines = [];
    for (const c of String(s)) {
      if (c === '\n') {
        lines.push(current);
        current = '';
      } else if (ctx.measureText(current + c).width > max && current) {
        lines.push(current);
        current = c;
      } else current += c;
    }
    if (current) lines.push(current);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let tail = lines[maxLines - 1];
      while (tail && ctx.measureText(tail + '…').width > max) tail = tail.slice(0, -1);
      lines[maxLines - 1] = tail + '…';
    }
    lines.forEach((value, index) => text(value, x, y + index * lineHeight, size, color));
    return y + lines.length * lineHeight;
  }
  function center(s, x, y, size = 13, color = C.ink, weight = 600) {
    ctx.font = `${weight} ${size}px ${font}`;
    text(s, x - ctx.measureText(s).width / 2, y, size, color, weight);
  }
  function line(x1, y1, x2, y2, color = C.line, width = 2, dashed = false) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [5, 5] : []);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function arrow(x1, y1, x2, y2, color = C.line) {
    line(x1, y1, x2, y2, color);
    const a = Math.atan2(y2 - y1, x2 - x1);
    line(x2, y2, x2 - 7 * Math.cos(a - 0.5), y2 - 7 * Math.sin(a - 0.5), color);
    line(x2, y2, x2 - 7 * Math.cos(a + 0.5), y2 - 7 * Math.sin(a + 0.5), color);
  }
  function dot(x, y, color = C.teal, r = 5) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function pulse(x1, y1, x2, y2, phase, color = C.teal) {
    arrow(x1, y1, x2, y2, color);
    dot(x1 + (x2 - x1) * phase, y1 + (y2 - y1) * phase, color, 4);
  }
  function pill(s, x, y, color = C.teal) {
    ctx.font = `600 11px ${font}`;
    const w = ctx.measureText(s).width + 18;
    rect(x, y, w, 23, color + '13', color + '40', 6);
    text(s, x + 9, y + 5, 11, color, 600);
    return w;
  }
  function node(s, x, y, w, active = false, color = C.teal, sub = '') {
    rect(x, y, w, sub ? 53 : 36, active ? color + '12' : '#fff', active ? color : C.line);
    center(s, x + w / 2, y + 9, 12, active ? color : C.ink);
    if (sub) center(sub, x + w / 2, y + 31, 10, C.muted, 400);
  }
  function plate(s, x, y, w = 130, color = C.blue) {
    rect(x, y, w, 31, color, color, 5);
    center(s, x + w / 2, y + 7, 14, '#fff', 650);
  }
  function car(x, y, w = 65, color = C.blue) {
    rect(x, y + 15, w, 26, color + '20', color, 8);
    rect(x + w * 0.18, y, w * 0.58, 27, color + '15', color, 9);
    dot(x + w * 0.2, y + 40, color, 5);
    dot(x + w * 0.8, y + 40, color, 5);
  }
  function banner(s, w, y, color = C.teal) {
    rect(0, y, w, 45, color + '0d', color + '35', 8);
    wrap(s, 10, y + 10, w - 20, 11, color, 16, 2);
  }
  function emptyScreen(w, h = 190) {
    rect(0, 0, w, h, '#0d2538', '#123b54', 11);
    text('HDMI / 串口屏示意', 12, 12, 10, '#8bb4c8');
  }
  function drawPanels() {
    const stacked = cw < 740,
      pad = 16,
      gap = 16,
      ph = 428,
      pw = stacked ? cw - 32 : (cw - 48) / 2;
    ch = stacked ? ph * 2 + 48 : ph + 32;
    canvas.style.height = ch + 'px';
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    return [
      { x: pad, y: pad, w: pw, h: ph },
      { x: stacked ? pad : pad + pw + gap, y: stacked ? pad + ph + gap : pad, w: pw, h: ph },
    ];
  }
  function panel(p, label, newer, draw) {
    rect(p.x, p.y, p.w, p.h, newer ? '#f5fbf7' : '#fcf8f5', newer ? '#cce3d8' : '#e6d8d0', 12);
    pill(newer ? '当前机制' : '对照场景', p.x + 14, p.y + 13, newer ? C.good : C.old);
    wrap(label, p.x + 14, p.y + 44, p.w - 28, 12, C.ink, 18, 2);
    ctx.save();
    ctx.translate(p.x + 15, p.y + 85);
    draw(p.w - 30, p.h - 101, newer);
    ctx.restore();
  }
  function boundary(w, h, n, phase) {
    const labels = ['HDMI 输入 / YOLO 检测', '框后处理 / ROI 裁剪', 'LPRNet / argmax / CTC'];
    labels.forEach((s, i) => {
      node(s, 0, i * 47, w, step >= i);
      if (i < 2) pulse(w / 2, i * 47 + 37, w / 2, (i + 1) * 47, phase, step >= i ? C.teal : C.line);
    });
    const hy = 151;
    node('HDMI 画框、字符叠加', 0, hy, w * 0.52, step >= 3, C.blue, '始终由 RTL 执行');
    arrow(w * 0.25, hy - 14, w * 0.25, hy, C.blue);
    node('结果邮箱', w * 0.59, hy, w * 0.41, step >= 4);
    arrow(w * 0.78, hy - 14, w * 0.78, hy);
    pulse(w * 0.79, hy + 53, w * 0.79, hy + 74, phase);
    node(
      n ? 'CPU：按目标确认 / 刑侦分流' : 'CPU：格式、确认、停车业务',
      0,
      hy + 76,
      w,
      step >= 5,
      C.good,
    );
    if (step >= 6)
      banner(
        n
          ? '新增软件应用，没有通往 HDMI 的 CPU 回写箭头'
          : '_11111 已经有 CPU、邮箱、停车和屏幕控制',
        w,
        hy + 124,
        n ? C.good : C.old,
      );
  }
  function frame(w, h, n, phase) {
    emptyScreen(w, 205);
    const frameId = step < 3 ? 'N' : 'N+1';
    const x = 25 + (Math.min(step + (step < 4 ? phase : 0), 4) * (w - 115)) / 5;
    car(x, 95);
    const bx = n ? x - 6 : 25;
    ctx.strokeStyle = n ? C.good : C.old;
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, 89, 80, 65);
    text(n ? '源帧与框绑定' : '框仍来自较早位置', 12, 173, 11, n ? '#83dcb2' : '#f3b1a6');
    pill('底图 ' + (n && step >= 4 ? 'N（匹配）' : frameId), 10, 38, C.blue);
    pill('结果帧 N', w - 110, 38, C.teal);
    if (step >= 4) {
      banner(
        n
          ? step >= 6
            ? '过期请求 → 拒绝，不伪装成当前帧'
            : 'read_frame_id → 选择匹配的 DDR 银行'
          : '当前银行已变化 → 框与底图可能错位',
        w,
        222,
        n ? C.good : C.old,
      );
    }
    if (step < 4) pulse(10, 260, w - 10, 260, phase);
  }
  function textLifecycle(w, h, n, phase) {
    const st = M.textState(step);
    emptyScreen(w, 218);
    const x = Math.min(w - 90, (st.currentX + (step < 7 ? phase * 16 : 0)) / 2);
    if (step < 7) car(x, 116);
    if (n) {
      if (st.visible) plate(M.PLATE_A, Math.max(8, x - 10), 76, 139, C.good);
      else if (step >= 7) text('旧文字已清除', 14, 80, 12, '#8bb4c8');
      else text('等待完整结果与 VS 发布', 14, 80, 11, '#8bb4c8');
    } else {
      const s = M.PLATE_A.slice(0, st.oldChars);
      if (s) plate(s, 18, 76, Math.max(40, s.length * 16 + 16), C.old);
      if (step >= 3) line(50, 110, x + 30, 138, '#f3a89d', 1, true);
    }
    if (step >= 2) {
      const msg = n
        ? step >= 7
          ? '检查目标身份；不复用旧目标的字符'
          : step >= 5
            ? '整牌发布，位置取当前 tracked_x / tracked_y'
            : '完整字符包 → 新鲜度检查 → VS'
        : '逐字写入的裁剪坐标不随当前目标更新';
      banner(msg, w, 235, n ? C.good : C.old);
    }
    pulse(0, 306, w, 306, phase, n ? C.good : C.old);
  }
  function crop(w, h, n) {
    const raw = options.width || 320,
      m = n ? M.margin(raw) : 10;
    const scale = (w - 58) / (raw + 48),
      left = 29,
      right = w - 29;
    const start = left - m * scale,
      end = right + m * scale;
    rect(0, 20, w, 150, '#eef2f1', C.line);
    const fullLeft = left - 18 * scale,
      fullRight = right + 18 * scale;
    rect(fullLeft, 57, fullRight - fullLeft, 54, '#dce6e7', '#90aeb6', 5);
    center('粤 A D 1 2 3 4 5', w / 2, 73, Math.max(11, Math.min(17, w / 21)), C.ink);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 20, Math.max(0, start), 150);
    ctx.rect(end, 20, w - end, 150);
    ctx.clip();
    ctx.fillStyle = '#bc544950';
    ctx.fillRect(0, 20, w, 150);
    ctx.restore();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = C.blue;
    ctx.strokeRect(left, 44, right - left, 79);
    ctx.setLineDash([]);
    ctx.strokeStyle = n ? C.good : C.old;
    ctx.lineWidth = 2;
    ctx.strokeRect(start, 35, end - start, 98);
    text('检测框', left + 4, 139, 10, C.blue);
    text('裁剪范围', Math.max(6, start), 22, 10, n ? C.good : C.old);
    node(`原始框宽 ${raw} px`, 0, 188, w, false);
    node(`水平余量 ${m} px`, 0, 234, w, true, n ? C.good : C.old);
    if (step >= 5)
      banner(
        n ? '下一行采样坐标已修正；垂直余量仍为 5 px' : '另有两行采样偏差，需要独立修正',
        w,
        282,
        n ? C.good : C.old,
      );
  }
  function tracks(w, h, n) {
    const count = step >= 12 ? 13 : step,
      st = M.trackSimulation(count);
    const recent = st.events.slice(-6);
    recent.forEach((e, i) => {
      const x = (i % 3) * (w / 3),
        y = 16 + Math.floor(i / 3) * 44;
      pill(`${e.name} · F${e.frame}`, x, y, e.name === 'A' ? C.blue : C.amber);
    });
    if (n) {
      ['A', 'B'].forEach((name, i) => {
        const t = st.tracks[name] || { votes: 0, accepted: false };
        const y = 125 + i * 70;
        text(`目标 ${name} / ID ${name === 'A' ? 8 : 9}`, 0, y, 12, C.ink, 650);
        for (let k = 0; k < 5; k++)
          rect(k * (w / 5), y + 25, w / 5 - 6, 18, k < t.votes ? C.good : '#e0e8e4', null, 4);
        if (t.accepted) pill('已确认', w - 73, y - 2, C.good);
      });
      banner(`独立确认 ${st.accepted} 辆 · 忽略重复 / 旧帧 / flush：${st.skipped}`, w, 282, C.good);
    } else {
      node('当前候选 ' + (st.shared.name || '—'), 0, 126, w, true, C.old);
      text('共用的确认票数', 0, 185, 12, C.muted);
      for (let k = 0; k < 5; k++)
        rect(k * (w / 5), 214, w / 5 - 6, 21, k < st.shared.votes ? C.old : '#e7ded9', null, 4);
      banner('A / B 交替使候选反复切换，无法各自累计', w, 282, C.old);
    }
  }
  function mailbox(w, h, n, phase) {
    const st = M.mailbox(step);
    node('clk_pe：字符收集', 0, 0, w, step === 0);
    pulse(w / 2, 38, w / 2, 57, phase);
    rect(0, 58, w, 104, st.frozen ? '#e4f3ee' : '#fff', st.frozen ? C.good : C.line);
    text(st.frozen ? '快照冻结 🔒' : '收集 / 已解锁', 12, 69, 12, C.good, 650);
    text(M.PLATE_A + ' · len=8 · seq=42', 12, 98, 12, C.ink);
    if (n) text('frame=100 · track=8 · ROI=1', 12, 126, 11, C.teal);
    else text('已有字符、长度、溢出与序号', 12, 126, 11, C.muted);
    pulse(w / 2, 170, w / 2, 192, phase, step >= 6 ? C.amber : C.teal);
    node('CPU 读取 MMIO → 写 POP', 0, 194, w, st.valid, C.blue);
    if (step >= 4)
      banner(
        step >= 5 ? '邮箱忙 → 第二包整包丢弃，dropped=1' : '第二包正在完成；CNN 继续运行',
        w,
        248,
        C.amber,
      );
    if (step >= 7) text('ack 返回后才允许改写快照', 0, 307, 11, C.good);
  }
  function scenes(w, h, n, phase) {
    const st = M.scene(step);
    node('HDMI / CNN / CTC 持续运行', 0, 0, w, true, C.blue);
    pulse(w / 2, 38, w / 2, 56, phase, C.blue);
    node('结果邮箱', w * 0.2, 58, w * 0.6, step >= 0);
    if (n) {
      arrow(w / 2, 96, w * 0.23, 120, C.teal);
      arrow(w / 2, 96, w * 0.77, 120, C.teal);
      node('停车', 0, 122, w * 0.45, st.page === 0, C.blue);
      node('刑侦筛查', w * 0.55, 122, w * 0.45, st.page !== 0, C.good);
      text(`停车时钟：${st.parkingSeconds} s`, 0, 184, 12, C.blue, 650);
      text(`筛查记录：${st.screenCount} 条`, 0, 211, 12, C.good, 650);
      if (st.hits) pill('目标命中 · 置顶', 0, 242, C.good);
      if (st.discard) pill('清候选 / 丢弃一份在途结果', 0, 280, C.amber);
      else
        banner(
          st.page === 0 ? '恢复停车时钟；筛查记录保留' : '停车计时冻结；不同时消费两份业务结果',
          w,
          282,
          C.good,
        );
    } else {
      arrow(w / 2, 96, w / 2, 122);
      node('CPU 停车记录 / 计时计费', 0, 124, w, true, C.blue);
      banner('没有刑侦目标输入、命中列表与场景分流', w, 226, C.old);
    }
  }
  function miniHmi(w, n, phase) {
    const scale = w / 800;
    ctx.save();
    ctx.scale(scale, scale);
    rect(0, 0, 800, 480, '#092b43', '#174660', 10);
    text(step === 6 && n ? '目标车牌输入' : '刑侦筛查', 30, 25, 28, '#c7f1ee', 650);
    if (step === 6 && n) {
      plate(M.PLATE_A, 55, 110, 310, C.blue);
      const keys = ['京', '沪', '粤', 'A', 'B', 'D', '1', '2', '3', '4', '5', '确认'];
      keys.forEach((s, i) =>
        node(s, 42 + (i % 6) * 120, 210 + Math.floor(i / 6) * 70, 104, true, C.teal),
      );
    } else {
      rect(205, 20, 144, 43, '#123d52', '#49aebe', 8);
      center('切换场景', 277, 31, 20, '#b3e4e5');
      text('目标车牌', 76, 160, 21, '#86bccb');
      plate(n && step >= 7 ? M.PLATE_A : '--', 74, 190, 225, C.blue);
      text(n ? (step >= 7 ? '布控中' : '待设置') : '背景中的静态状态', 108, 302, 22, '#8ce1d1');
      rect(76, 340, 216, 51, '#154c60', '#6bc4c1', 8);
      center('设置目标', 184, 353, 24, '#c4f0e8');
      rect(375, 60, 400, 330, '#092a40', '#24516a');
      text('车牌        状态        时间', 390, 77, 18, '#9bcdd5');
      if (options.showBounds) {
        ctx.strokeStyle = '#ffcd64';
        ctx.lineWidth = 4;
        ctx.strokeRect(76, 340, 216, 51);
        ctx.strokeRect(205, 20, 144, 43);
      }
      if (n && step >= 1 && step <= 4) {
        const x = 150,
          y = 365;
        dot(x, y, '#ffcc62', step === 1 || step === 2 ? 12 : 8);
        ctx.strokeStyle = '#ffcc62';
        ctx.beginPath();
        ctx.arc(x, y, 18 + phase * 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    return 480 * scale;
  }
  function touch(w, h, n, phase) {
    const screenH = miniHmi(w, n, phase);
    if (n) {
      const y = screenH + 15;
      if (step >= 2)
        wrap('67 00 96 01 6D ' + (step >= 3 ? '00' : '01') + ' FF FF FF', 0, y, w, 11, C.teal, 17);
      if (step >= 4) banner('screening_touch：命中矩形 → 设置目标', w, y + 31, C.good);
      else wrap('整页坐标上报，无需每个按钮都建 HMI 热区', 0, y + 34, w, 11, C.muted, 18);
    } else banner('编辑器没有这些原生按钮 / 热区对象；键盘由 C 绘制', w, screenH + 25, C.old);
  }
  function deleteScene(w, h, n) {
    const changed = step >= 2,
      complete = step >= 6;
    const deleted = n ? step >= 7 : step >= 4;
    const rows =
      !changed || deleted
        ? ['A · 普通 · #12', 'C · 普通 · #11']
        : ['B · 命中 · #13', 'A · 普通 · #12'];
    text('屏幕上已显示', 0, 4, 11, C.muted);
    const screenRows = n && complete ? rows : ['A · 普通 · #12', 'C · 普通 · #11'];
    screenRows.forEach((s, i) => {
      rect(0, 30 + i * 45, w, 36, '#fff', C.line);
      text(s, 10, 40 + i * 45, 12);
      text('删除', w - 42, 40 + i * 45, 11, C.old);
    });
    text('软件最新列表映射', 0, 145, 11, C.muted);
    rows.forEach((s, i) => text(i + 1 + '. ' + s, 10, 171 + i * 25, 12, changed ? C.good : C.ink));
    if (step >= 4) {
      const message = n
        ? step < 6
          ? '显示 A，当前映射 B → 拒绝点击'
          : step === 6
            ? 'B 四字段完成绘制 → 提交行身份'
            : '再次点击 → 删除已显示的 B #13'
        : '只按当前第 1 行 → 误删用户尚未看到的 B';
      banner(message, w, 256, n ? C.good : C.old);
    }
    if (step >= 7 && n) pill('A #12 保留', 0, 311, C.good);
  }
  function loader(w, h, n, phase) {
    const st = M.loader(step, options.badCrc);
    const labels = ['.sbit → FPGA 配置', '.tft → 淘晶驰屏幕', '.bin → FPGA 内程序 RAM'];
    labels.forEach((s, i) => node(s, 0, i * 49, w, step >= i || !n, i === 2 ? C.good : C.blue));
    if (n) {
      if (step >= 2) pulse(0, 166, w, 166, phase, C.teal);
      text(
        step >= 4 ? 'RVLD | 长度 | CRC32 | 程序' : '115200 8N1 · 40 ms BREAK',
        0,
        181,
        12,
        C.teal,
        650,
      );
      node(
        st.hold ? 'CPU 保持复位' : st.newFirmware ? 'CPU 运行筛查 v3' : 'CPU 运行位流默认程序',
        0,
        213,
        w,
        st.running,
        st.failed ? C.old : C.good,
      );
      if (step >= 5) banner(st.message, w, 272, st.failed ? C.old : step >= 8 ? C.amber : C.good);
    } else {
      banner('只下载了新屏幕：page1 有背景，旧 C 不处理新按钮', w, 192, C.old);
      text('CPU 程序还需要单独加载', 0, 263, 12, C.old, 650);
    }
  }
  function commands(w, h, n, phase) {
    const ps = options.shell === 'powershell';
    const shell = ps ? 'PowerShell' : 'CMD';
    text(shell + ' 窗口', 0, 0, 13, C.muted, 650);
    rect(0, 30, w, 112, '#172d36', '#172d36', 9);
    const command = n
      ? ps
        ? '& "D:\\python\\python.exe"'
        : '"D:\\python\\python.exe"'
      : "& 'D:\\python\\python.exe'";
    wrap(command, 12, 48, w - 24, 11, '#cef4e8', 20);
    if (step >= 3)
      wrap(
        'scripts\\upload_firmware.py\nfirmware.bin --port COM17',
        12,
        85,
        w - 24,
        10,
        '#99c7d0',
        18,
      );
    if (!n && !ps) text('此时不应有 &。', 0, 157, 13, C.old, 650);
    else if (!n) text('PowerShell 支持这种调用方式', 0, 157, 12, C.muted);
    else
      text(
        step >= 4 ? '--port 由这个脚本的 argparse 定义' : '确认终端后选择对应调用语法',
        0,
        157,
        12,
        C.good,
        650,
      );
    if (step >= 4) node('python 上传脚本 --help', 0, 204, w, true, C.teal);
    if (step >= 5) banner('image = 固件路径；--port = 实际串口号', w, 257, n ? C.good : C.old);
    pulse(0, 321, w, 321, phase, n ? C.good : C.old);
  }
  function container(w, h, n, phase) {
    const st = M.directories(step);
    const conflict = !n && step >= 1;
    node(
      '目录 A · 0x000000',
      0,
      8,
      w,
      true,
      conflict ? C.old : C.teal,
      `资源数 ${conflict ? 15 : 13} · CRC ${conflict ? '无效' : '有效'}`,
    );
    node(
      '目录 B · 0x080000',
      0,
      89,
      w,
      true,
      C.teal,
      `资源数 ${n && step >= 5 ? 15 : 13} · CRC 有效`,
    );
    if (n && step >= 4) {
      ctx.clearRect(0, 8, w, 54);
      node('目录 A · 0x000000', 0, 8, w, true, C.good, `资源数 ${step >= 5 ? 15 : 13} · CRC 有效`);
    }
    pulse(w / 2, 64, w / 2, 87, phase, conflict ? C.old : C.good);
    rect(0, 171, w, 64, '#fff', C.line);
    text(
      n && step >= 4 ? '原资源地址保留 + 文件尾追加资源' : '页面 / 图片资源存储区',
      10,
      183,
      11,
      C.ink,
      650,
    );
    text(n && step >= 5 ? '两份目录指向同一份资源' : '原图片、停车页与字库', 10, 210, 10, C.muted);
    if (step >= 3)
      banner(
        n
          ? st.officialCompile
            ? '用户已确认：官方编辑器打开并编译'
            : st.structuralPass
              ? '结构回归通过；仍需官方编辑器验证'
              : '同步目录及 CRC，修复本次容器错误'
          : '目录冲突 / 校验无效 → 编辑器拒绝',
        w,
        258,
        n ? C.good : C.old,
      );
  }
  function latency(w, h, n, phase) {
    const rows = [
      ['LPR 首字符', '2.419 ms', 0.12, C.blue],
      ['LPR 整牌边界', '2.681 ms', 0.135, C.teal],
      ['DDR 触发量级', '约 4.12 ms', 0.206, C.amber],
      ['HDMI 同位置字可见', '估算约 20.8 ms', 0.92, C.good],
    ];
    if (!n) {
      node('一个笼统的“延迟”数字', 0, 25, w, true, C.old);
      rect(0, 105, w, 35, '#f2d7ce', null);
      const cursor = Math.min(1, (step + phase) / 6);
      rect(0, 105, w * cursor, 35, C.old, null);
      wrap('从不同起点、到不同终点的时间不能直接相加或统称推理时间。', 0, 173, w, 13, C.old, 23);
      banner('这里不把视频等待当成神经网络计算耗时', w, 270, C.old);
      return;
    }
    rows.forEach((r, i) => {
      const y = i * 68;
      text(r[0], 0, y, 11, C.ink, 650);
      text(r[1], w - 132, y, 11, r[3], 650);
      rect(0, y + 25, w, 12, '#e8edeb', null, 4);
      if (step >= i) rect(0, y + 25, w * r[2], 12, r[3], null, 4);
    });
    banner('不同测点示意，不是同一条可直接累加的甘特图', w, 282, C.amber);
  }
  const renderers = {
    boundary,
    frame,
    text: textLifecycle,
    crop,
    tracks,
    mailbox,
    scenes,
    touch,
    delete: deleteScene,
    loader,
    commands,
    container,
    latency,
  };
  function draw() {
    cw = Math.max(280, Math.round(canvas.parentElement.clientWidth));
    const panels = drawPanels();
    const phase = Math.min(0.98, elapsed / (2800 / speed));
    panels.forEach((p, i) =>
      panel(p, i ? topic.after : topic.before, !!i, (w, h, n) =>
        renderers[topic.id](w, h, n, phase),
      ),
    );
    canvas.setAttribute('aria-label', topic.title + '：' + topic.steps[step]);
  }
  function update() {
    const total = topic.steps.length;
    $('progress').max = total - 1;
    $('progress').value = step;
    $('progress-label').textContent = `${step + 1} / ${total}`;
    $('step-number').textContent = 'STEP ' + String(step + 1).padStart(2, '0');
    $('step-caption').textContent = topic.steps[step];
    $('previous-step').disabled = step === 0;
    $('next-step').disabled = step === total - 1;
    $('play').textContent = playing ? '暂停' : '播放';
    $('play').setAttribute('aria-pressed', String(playing));
    document.body.dataset.topic = topic.id;
    document.body.dataset.step = step;
  }
  function schedule() {
    if (raf === null) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = null;
    if (playing) {
      if (last) elapsed += Math.min(200, now - last);
      if (elapsed >= 2800 / speed) {
        if (step < topic.steps.length - 1) {
          step++;
          elapsed = 0;
          update();
        } else {
          playing = false;
          update();
        }
      }
    }
    last = now;
    draw();
    if (playing) schedule();
  }
  function setStep(value, pause = true) {
    step = Math.max(0, Math.min(topic.steps.length - 1, value));
    elapsed = 0;
    last = 0;
    if (pause) playing = false;
    update();
    schedule();
  }
  function experiments() {
    const box = $('experiments');
    box.replaceChildren();
    function label(s) {
      const el = document.createElement('label');
      el.append(document.createTextNode(s));
      box.append(el);
      return el;
    }
    if (topic.id === 'crop') {
      const l = label('原始检测框宽度');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = 80;
      input.max = 1000;
      input.step = 16;
      input.value = options.width;
      input.setAttribute('aria-label', '原始检测框宽度');
      const value = document.createElement('span');
      value.className = 'experiment-value';
      const sync = () => {
        options.width = Number(input.value);
        value.textContent = `${options.width} px → 新余量 ${M.margin(options.width)} px`;
        schedule();
      };
      input.addEventListener('input', sync);
      l.append(input);
      box.append(value);
      sync();
    }
    if (topic.id === 'loader') {
      const l = label('模拟 CRC 错误');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'bad-crc';
      input.addEventListener('change', () => {
        options.badCrc = input.checked;
        schedule();
      });
      l.prepend(input);
    }
    if (topic.id === 'touch') {
      const l = label('显示 C 中的坐标范围');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'show-bounds';
      input.addEventListener('change', () => {
        options.showBounds = input.checked;
        schedule();
      });
      l.prepend(input);
    }
    if (topic.id === 'commands') {
      const l = label('当前终端');
      const select = document.createElement('select');
      select.setAttribute('aria-label', '当前终端');
      for (const [value, name] of [
        ['cmd', 'CMD'],
        ['powershell', 'PowerShell'],
      ]) {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = name;
        select.append(o);
      }
      select.addEventListener('change', () => {
        options.shell = select.value;
        schedule();
      });
      l.append(select);
    }
  }
  function setTopic(id, history = true) {
    topic = M.topics.find((t) => t.id === id) || M.topics[0];
    step = 0;
    elapsed = 0;
    last = 0;
    playing = !reduced;
    options = { width: 320, badCrc: false, showBounds: false, shell: 'cmd' };
    const index = M.topics.indexOf(topic);
    $('topic-title').textContent = topic.title;
    $('topic-subtitle').textContent = topic.subtitle;
    $('topic-group').textContent = topic.group;
    $('topic-position').textContent = String(index + 1).padStart(2, '0') + ' / ' + M.topics.length;
    $('lesson').textContent = topic.lesson;
    $('scope').textContent = topic.scope;
    document.title = topic.title + ' · SoC 动画实验室';
    $('source-list').replaceChildren(
      ...topic.source.map((s) => {
        const li = document.createElement('li');
        li.textContent = s;
        return li;
      }),
    );
    document.querySelectorAll('.nav-topic').forEach((a) => {
      if (a.dataset.topic === topic.id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const previous = M.topics[(index - 1 + M.topics.length) % M.topics.length],
      next = M.topics[(index + 1) % M.topics.length];
    $('previous-topic').textContent = '← ' + previous.title;
    $('previous-topic').href = 'evolution.html?topic=' + previous.id;
    $('next-topic').textContent = next.title + ' →';
    $('next-topic').href = 'evolution.html?topic=' + next.id;
    if (history) {
      const url = new URL(location.href);
      url.searchParams.set('topic', topic.id);
      window.history.pushState({}, '', url);
    }
    experiments();
    update();
    schedule();
  }
  const nav = $('topic-nav');
  for (const [index, t] of M.topics.entries()) {
    const a = document.createElement('a');
    a.className = 'nav-topic';
    a.href = 'evolution.html?topic=' + t.id;
    a.dataset.topic = t.id;
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(index + 1).padStart(2, '0');
    a.append(num, document.createTextNode(t.title));
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setTopic(t.id);
    });
    nav.append(a);
  }
  $('play').addEventListener('click', () => {
    if (!playing && step === topic.steps.length - 1) setStep(0);
    playing = !playing;
    last = 0;
    update();
    schedule();
  });
  $('previous-step').addEventListener('click', () => setStep(step - 1));
  $('next-step').addEventListener('click', () => setStep(step + 1));
  $('restart').addEventListener('click', () => {
    setStep(0);
    playing = true;
    update();
    schedule();
  });
  $('progress').addEventListener('input', (e) => setStep(Number(e.target.value)));
  $('speed').addEventListener('change', (e) => {
    speed = Number(e.target.value);
    elapsed = 0;
    last = 0;
    schedule();
  });
  window.addEventListener('resize', schedule);
  window.addEventListener('popstate', () =>
    setTopic(new URLSearchParams(location.search).get('topic'), false),
  );
  document.addEventListener('visibilitychange', () => {
    last = 0;
  });
  document.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|BUTTON|TEXTAREA/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey)
      return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setStep(step + 1);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setStep(step - 1);
    }
    if (e.code === 'Space') {
      e.preventDefault();
      $('play').click();
    }
  });
  setTopic(new URLSearchParams(location.search).get('topic'), false);
})();
