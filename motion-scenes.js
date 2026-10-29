/* Animated teaching scenes. Time t advances continuously; one unit is one story beat. */
(function (root) {
  'use strict';
  const clamp = (v, low = 0, high = 1) => Math.max(low, Math.min(high, v));
  const between = (t, start, end) => clamp((t - start) / (end - start));
  const ease = (v) => {
    const x = clamp(v);
    return x * x * (3 - 2 * x);
  };
  const mix = (a, b, p) => a + (b - a) * ease(p);

  function create(g) {
    const { ctx, C, rect, text, wrap, center, line, arrow, dot, plate, M } = g;
    const blue = '#286db5',
      amber = '#c07b2c',
      green = '#087e68',
      red = '#bd574d';
    const paper = '#fff',
      muted = '#60747a';

    function caption(s, x, y, max, color = muted) {
      wrap(s, x, y, max, 12, color, 18, 2);
    }
    function tag(s, x, y, color = blue, width = 74) {
      rect(x, y, width, 27, paper, color + '99', 7);
      center(s, x + width / 2, y + 6, 12, color, 700);
    }
    function road(w, y, height = 105) {
      rect(0, y, w, height, '#e5eef0', '#c7d8da', 10);
      line(12, y + height - 21, w - 12, y + height - 21, '#a7bec2', 2, true);
    }
    function vehicle(x, y, width = 76, color = blue, identity = 'A') {
      const height = 39;
      rect(x, y + 12, width, 27, color, color, 10);
      rect(x + width * 0.18, y, width * 0.56, 25, color, color, 9);
      rect(x + width * 0.23, y + 4, width * 0.46, 12, '#d7edf4', null, 5);
      dot(x + width * 0.2, y + height, '#283e49', 5);
      dot(x + width * 0.79, y + height, '#283e49', 5);
      if (identity) center(identity, x + width * 0.5, y + 17, 12, '#fff', 800);
    }
    function machine(x, y, w, h, label, t) {
      rect(x, y, w, h, '#dceff0', '#82b3b5', 13);
      center(label, x + w / 2, y + 12, 13, '#174f55', 700);
      const gx = x + w / 2,
        gy = y + h * 0.63;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(t * 1.05);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        rect(-3, -19, 6, 10, '#77a9aa', null, 2);
      }
      dot(0, 0, '#568f92', 12);
      dot(0, 0, '#dceff0', 5);
      ctx.restore();
    }
    function display(x, y, w, h, label) {
      rect(x, y, w, h, '#17384b', '#335f6a', 10);
      text(label, x + 9, y + 9, 11, '#c5e3e4', 650);
    }
    function ticket(s, x, y, w = 105, color = blue) {
      rect(x, y, w, 34, paper, color, 7);
      rect(x + 5, y + 7, 6, 20, color, null, 3);
      center(s, x + (w + 10) / 2, y + 9, 12, color, 700);
    }
    function ticketMove(s, ax, ay, bx, by, t, start, end, color = blue, width = 105) {
      if (t < start) return;
      const q = between(t, start, end);
      ticket(s, mix(ax, bx, q), mix(ay, by, q), width, color);
    }
    function bin(x, y, label = '丢弃') {
      rect(x, y + 8, 56, 45, '#f7dfd9', '#ce877b', 5);
      line(x - 3, y + 8, x + 59, y + 8, '#bd756b', 3);
      center(label, x + 28, y + 22, 11, red, 700);
    }
    function pointer(x, y, scale = 1, color = '#a75c2f') {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(4, 29);
      ctx.lineTo(11, 22);
      ctx.lineTo(18, 37);
      ctx.lineTo(24, 34);
      ctx.lineTo(17, 19);
      ctx.lineTo(28, 19);
      ctx.closePath();
      ctx.fillStyle = '#ffe9c6';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    function stamp(s, x, y, color = green, width = 90) {
      rect(x, y, width, 29, color + '16', color, 7);
      center(s, x + width / 2, y + 7, 12, color, 750);
    }
    function tickText(s, x, y, color = muted) {
      text(s, x, y, 11, color, 600);
    }
    function progressBar(x, y, w, count, color) {
      for (let i = 0; i < 5; i++) {
        rect(x + (i * w) / 5, y, w / 5 - 4, 18, i < count ? color : '#e3e9e6', null, 4);
      }
    }
    function meter(x, y, color, t, label) {
      dot(x, y, '#e6f2f1', 22);
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.stroke();
      const a = -Math.PI / 2 + t * 1.8;
      line(x, y, x + Math.cos(a) * 14, y + Math.sin(a) * 14, color, 2);
      text(label, x - 24, y + 30, 11, color, 650);
    }
    function beat(t) {
      return t - Math.floor(t);
    }
    function status(s, w, y, color = green) {
      rect(0, y, w, 38, color + '0c', color + '45', 8);
      caption(s, 10, y + 9, w - 20, color);
    }

    function boundary(w, h, newer, t) {
      road(w, 0, 89);
      const cx = mix(15, w - 95, between(t, 0, 7.9));
      vehicle(cx, 24, 78, blue, '车');
      if (t >= 1) {
        ctx.strokeStyle = green;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 5, 20, 88, 49);
      }
      machine(w * 0.28, 112, w * 0.44, 82, '识别机器', t);
      if (t < 1.2) ticketMove('画面', Math.max(0, cx - 2), 42, w * 0.4, 145, t, 0, 1.05, blue, 80);
      if (t < 3)
        ticketMove('车牌照片', Math.max(0, cx - 6), 45, w * 0.4, 145, t, 1.0, 2.6, blue, 90);
      display(0, 235, w * 0.46, 105, '画面自己画框、写字');
      const sx = Math.max(9, Math.min(w * 0.46 - 75, 12 + (w * 0.46 - 95) * between(t, 2.8, 7.9)));
      vehicle(sx, 278, 62, blue, '车');
      if (t >= 3) {
        ctx.strokeStyle = '#7bdc9d';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - 4, 275, 70, 50);
      }
      rect(w * 0.55, 235, w * 0.45, 105, '#fff7e8', '#d6bb88', 10);
      text('管理员', w * 0.55 + 9, 245, 12, '#88602e', 700);
      text(newer ? '停车 / 刑侦' : '停车记录', w * 0.55 + 9, 275, 12, '#88602e');
      if (t >= 4) ticketMove('车牌结果', w * 0.4, 183, w * 0.57, 296, t, 4, 5.3, amber, 87);
      if (t >= 6 && newer)
        stamp('分给当前业务', w * 0.55 + 8, 350, green, Math.min(125, w * 0.45 - 16));
      else if (t >= 5 && !newer)
        stamp('登记停车', w * 0.55 + 8, 350, green, Math.min(100, w * 0.45 - 16));
      if (t >= 3) caption('画面这条路始终由识别硬件完成', 0, 398, w, muted);
    }

    function frame(w, h, newer, t) {
      road(w, 0, 120);
      const x = mix(12, w - 98, between(t, 0, 3.6));
      vehicle(x, 37, 76, blue, '车');
      text('正在移动的车辆', 12, 8, 12, muted, 650);
      if (t >= 0.4 && t < 2.2) {
        ctx.strokeStyle = blue;
        ctx.lineWidth = 2;
        ctx.strokeRect(8, 29, 88, 56);
        tag('拍下第 1 张', w - 112, 8, blue, 100);
      }
      const cardY = mix(88, 155, between(t, 0.4, 1.4));
      if (t >= 0.4) ticket('第 1 张', 10, cardY, 90, blue);
      if (t >= 2) ticketMove('第 2 张', w - 100, 90, w - 100, 155, t, 2, 2.9, amber, 90);
      machine(w * 0.33, 150, w * 0.34, 70, '找框', t);
      if (t >= 3)
        ticketMove(
          '第 1 张的框',
          w * 0.34,
          195,
          w * 0.34,
          235,
          t,
          3,
          4.0,
          blue,
          Math.min(110, w * 0.38),
        );
      display(0, 260, w, 105, '要显示的画面');
      const displayedX = newer ? 18 : mix(18, w - 100, between(t, 0, 3.6));
      vehicle(displayedX, 308, 75, blue, '车');
      if (t >= 4) {
        const bx = newer ? displayedX : 18;
        ctx.strokeStyle = newer ? '#82e3a8' : '#f18f81';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx - 4, 304, 83, 50);
      }
      if (t >= 4)
        caption(
          newer ? '同一张照片，框正好套住车' : '车换了位置，旧框还停在左边',
          0,
          384,
          w,
          newer ? green : red,
        );
      if (newer && t >= 6) stamp('过期的照片丢弃', Math.max(0, w - 145), 185, red, 145);
    }

    function textLifecycle(w, h, newer, t) {
      road(w, 0, 127);
      const movingX = mix(8, w - 98, between(t, 0, 7.5));
      if (t < 7.3) vehicle(movingX, 55, 80, blue, 'A');
      if (t < 1.1) ticketMove('车牌照片', Math.max(0, movingX - 4), 70, 8, 165, t, 0, 1, blue, 90);
      if (t >= 7) vehicle(mix(w - 86, w * 0.55, between(t, 7, 8.6)), 55, 80, amber, 'B');
      const chars = Array.from('粤AD12345');
      const entered = Math.min(chars.length, Math.max(0, Math.floor((t - 0.8) * 2.8)));
      rect(0, 154, w, 73, '#fff', '#d5e3e1', 9);
      text(newer ? '先在这里收齐号码' : '一个字出来就写到旧位置', 10, 165, 12, muted, 650);
      chars.forEach((ch, i) => {
        if (i >= entered) return;
        const q = between(t, 0.8 + i * 0.36, 1.3 + i * 0.36);
        const tx = 12 + i * Math.min(29, (w - 35) / 8);
        const ty = mix(173, 193, q);
        rect(tx, ty, Math.min(25, (w - 36) / 8), 27, newer ? '#e5f4ed' : '#f9e9e4', null, 5);
        center(ch, tx + Math.min(25, (w - 36) / 8) / 2, ty + 6, 12, newer ? green : red, 700);
      });
      if (!newer && t >= 1.6) {
        const count = Math.min(entered, chars.length);
        if (count) plate(chars.slice(0, count).join(''), 9, 23, 120, red);
        if (t >= 3) caption('车走了，号码还在刚才的位置', 0, 244, w, red);
      }
      if (newer && t >= 3 && t < 7.3) {
        const q = between(t, 3.3, 5.2);
        const x = mix(8, Math.min(w - 126, movingX), q);
        const y = mix(192, 23, q);
        plate(M.PLATE_A, x, y, 120, green);
        if (t < 5.2) tickText('整串等画面换好再一起贴上', 0, 244, green);
        else tickText('号码跟随当前这辆车', 0, 244, green);
      }
      if (newer && t >= 7.3) {
        bin(w - 58, 245, '清旧字');
        ticketMove('旧号码', Math.max(0, movingX - 5), 35, w - 106, 255, t, 7.1, 8.1, red, 100);
        caption('旧车离开，不能把号码贴给新车', 0, 322, w - 5, green);
      }
      if (!newer && t >= 7.3) caption('旧位置附近出现另一辆车，可能看错归属', 0, 322, w - 5, red);
    }

    function crop(w, h, newer, t, options) {
      const rawWidth = options.width || 320;
      const margin = newer ? M.margin(rawWidth) : 10;
      const showPlate = '粤AD12345';
      text('原画面里的完整车牌', 0, 0, 13, muted, 650);
      rect(4, 30, w - 8, 100, '#e7edef', '#c9d9dc', 9);
      const plateX = 28,
        plateY = mix(30, 58, between(t, 0, 0.85)),
        plateW = w - 56;
      rect(plateX, plateY, plateW, 31, blue, blue, 5);
      Array.from(showPlate).forEach((ch, i) => {
        const x = plateX + 12 + (i * (plateW - 18)) / 7;
        center(ch, x, plateY + 7, 16, '#fff', 700);
      });
      const pxPerSource = plateW / (rawWidth + 36);
      const baseX = plateX + 18 * pxPerSource,
        baseW = rawWidth * pxPerSource;
      const extension = mix(0, margin * pxPerSource, between(t, 2, 3.8));
      if (t >= 1) {
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = newer ? green : red;
        ctx.lineWidth = 2;
        ctx.strokeRect(baseX - extension, 45, baseW + 2 * extension, 60);
        ctx.setLineDash([]);
      }
      if (t >= 2) {
        const cropLeft = baseX - extension,
          cropRight = baseX + baseW + extension;
        ctx.fillStyle = '#bd574d70';
        ctx.fillRect(plateX, plateY, Math.max(0, cropLeft - plateX), 31);
        ctx.fillRect(
          Math.min(plateX + plateW, cropRight),
          plateY,
          Math.max(0, plateX + plateW - cropRight),
          31,
        );
      }
      if (t >= 3 && t < 4)
        pointer(mix(baseX + baseW - 20, baseX + baseW + extension, between(t, 3, 3.8)), 38, 0.8);
      if (t >= 4 && t < 5.5) {
        const scanY = mix(45, 105, between(t, 4, 5.5));
        line(12, scanY, w - 12, scanY, newer ? green : red, 3);
      }
      if (t >= 1) tickText('框外还有一部分', Math.max(0, w - 112), 112, red);
      text('真正送给识别机器的小图片', 0, 164, 13, muted, 650);
      display(0, 188, w, 86, '逐行取图');
      const valid = newer && margin >= 18;
      const number = valid ? showPlate : showPlate.slice(0, -1);
      if (t >= 4) {
        const letters = Array.from(number);
        letters.forEach((ch, i) => {
          const q = between(t, 4 + i * 0.12, 5 + i * 0.12);
          if (!q) return;
          const col = Math.min(31, (w - 32) / 8),
            tx = 13 + i * col;
          const y = mix(198, 230, q);
          text(ch, tx, y, 17, '#e7f7f3', 750);
        });
      }
      if (t >= 5.2 && !valid) {
        ticketMove(
          '最后一字',
          Math.max(0, w - 108),
          59,
          Math.max(0, w - 108),
          300,
          t,
          5.2,
          6.5,
          red,
          98,
        );
        caption('这个字没有进小图片', 0, 318, w - 105, red);
      } else if (t >= 5.2) {
        stamp('末尾也被送入', 0, 304, green, 130);
      }
      if (t >= 3)
        caption(`框宽 ${rawWidth}，两边各多留 ${margin} 像素`, 0, 367, w, newer ? green : red);
    }

    function jar(x, y, w, name, votes, color) {
      rect(x, y, w, 111, '#fff', color + '99', 10);
      center(name, x + w / 2, y + 10, 12, color, 700);
      const inner = Math.max(12, w - 18);
      for (let i = 0; i < 5; i++) {
        rect(x + 9, y + 35 + i * 12, inner, 9, i < votes ? color + 'c0' : '#e7eeec', null, 3);
      }
    }
    function tracks(w, h, newer, t) {
      vehicle(mix(w * 0.3, 8, between(t, 0, 0.9)), 18, 73, blue, 'A');
      vehicle(mix(w * 0.7 - 73, w - 81, between(t, 0, 0.9)), 18, 73, amber, 'B');
      text('同一时间来了两辆车', Math.max(0, w / 2 - 58), 77, 11, muted);
      const step = Math.min(12, Math.floor(t));
      let count = step;
      let fraction = beat(t);
      if (step === 12) {
        count = fraction < 0.5 ? 12 : 13;
        fraction = (fraction % 0.5) * 2;
      }
      const previous = M.trackSimulation(Math.max(0, count - 1));
      const current = M.trackSimulation(count);
      const event = current.event;
      const shown = fraction > 0.82 ? current : previous;
      const jarY = 168,
        jarWidth = newer ? (w - 28) / 2 : Math.min(152, w - 105);
      const ax = newer ? 0 : (w - jarWidth) / 2,
        bx = newer ? w - jarWidth : ax;
      if (newer) {
        jar(ax, jarY, jarWidth, 'A 的票盒', (shown.tracks.A || {}).votes || 0, blue);
        jar(bx, jarY, jarWidth, 'B 的票盒', (shown.tracks.B || {}).votes || 0, amber);
      } else {
        jar(
          ax,
          jarY,
          jarWidth,
          shown.shared.name ? shown.shared.name + ' 的候选' : '共用票盒',
          Math.min(shown.shared.votes, 5),
          red,
        );
      }
      if (event && t >= 1) {
        const fromX = event.name === 'A' ? 6 : w - 98;
        const skip = current.skipped > previous.skipped;
        const tx = newer ? (skip ? w - 105 : event.name === 'A' ? ax + 8 : bx + 8) : ax + 8;
        const ty = newer && skip ? 332 : jarY + 42;
        const q = between(fraction, 0.05, 0.82);
        ticket(
          event.name + (skip && newer ? '：不加票' : '：看见一次'),
          mix(fromX, tx, q),
          mix(72, ty, q),
          96,
          event.name === 'A' ? blue : amber,
        );
        if (
          !newer &&
          previous.shared.name &&
          previous.shared.name !== event.name &&
          fraction > 0.3 &&
          fraction < 0.82
        ) {
          ticket(
            previous.shared.name + ' 的旧票',
            mix(ax + 12, w - 106, fraction),
            mix(jarY + 72, 330, fraction),
            93,
            red,
          );
        }
      }
      if (newer && shown.accepted) stamp('已确认 ' + shown.accepted + ' 辆', 0, 325, green, 116);
      if (!newer && count >= 4) caption('刚记住 A，又被 B 覆盖', 0, 333, w - 10, red);
    }

    function envelope(x, y, w, sealed, newer) {
      rect(x, y, w, 66, '#fff9e9', '#d1ae77', 8);
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 8);
      ctx.lineTo(x + w / 2, y + 34);
      ctx.lineTo(x + w - 4, y + 8);
      ctx.strokeStyle = '#d1ae77';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (sealed) stamp('封好', x + w / 2 - 27, y + 29, green, 54);
      if (newer) {
        tag('车 A', x + 6, y + 40, blue, 48);
        tag('第 1 张', x + w - 63, y + 40, amber, 57);
      }
    }
    function mailbox(w, h, newer, t) {
      machine(0, 0, 105, 72, '识别机器', t);
      rect(w - 104, 0, 104, 72, '#fff7e8', '#d6bb88', 12);
      center('管理员', w - 52, 15, 13, '#88602e', 700);
      line(55, 96, w - 52, 96, '#b2c9c8', 3, true);
      dot(w * 0.42, 96, '#a6c2c0', 5);
      dot(w * 0.58, 96, '#a6c2c0', 5);
      text('两边工作速度不同', Math.max(0, w / 2 - 58), 111, 11, muted);
      const ex = mix(15, w - 140, between(t, 2, 3.3));
      const ey = mix(151, 24, between(t, 2.1, 3.5));
      envelope(ex, ey, 133, t >= 1, newer);
      const letters = Array.from('粤AD12345');
      letters.forEach((value, i) => {
        const q = between(t, i * 0.1, 0.55 + i * 0.1);
        if (t < 1.4 && q > 0) {
          const x = mix(32, 24 + i * 13, q),
            y = mix(67, 166, q);
          text(value, x, y, 11, blue, 700);
        }
      });
      if (t >= 3.4) plate(M.PLATE_A, w - 122, 86, 118, green);
      if (t >= 4 && t < 6.8) {
        const x = mix(4, w * 0.35, between(t, 4, 4.9));
        const y = mix(72, 220, between(t, 4, 4.9));
        ticket('下一张', x, y, 88, amber);
        if (t >= 5) {
          bin(w - 57, 255);
          ticketMove('下一张', w * 0.35, 220, w - 98, 276, t, 5, 5.9, red, 92);
        }
      }
      if (t >= 5) caption('信箱还锁着，新结果整张丢弃', 0, 337, w, red);
      if (t >= 6 && t < 8.3) ticketMove('取走回执', w - 104, 100, 16, 100, t, 6, 7.7, green, 86);
      if (t >= 8) stamp('回执到达，解锁', 0, 377, green, 140);
      else if (t >= 1) tag('信箱锁着', 0, 261, amber, 88);
    }

    function scenes(w, h, newer, t) {
      road(w, 0, 92);
      const cx = 10 + ((t * 0.24) % 1) * Math.max(0, w - 105);
      vehicle(cx, 23, 76, blue, '车');
      text('一条 HDMI 画面', 10, 8, 11, muted, 650);
      machine(w * 0.33, 115, w * 0.34, 70, '识别', t);
      ticketMove('车牌结果', w * 0.34, 162, w * 0.35, 219, t, 0, 1, blue, Math.min(96, w * 0.3));
      const split = newer && t >= 1 && t < 6;
      const left = 0,
        right = w * 0.56,
        fw = w * 0.44;
      rect(left, 255, fw, 100, '#e8f0fa', '#9bb9dc', 10);
      rect(right, 255, fw, 100, newer ? '#e7f5ed' : '#f2f2ef', newer ? '#9acbb4' : '#d6deda', 10);
      center('停车记录', left + fw / 2, 267, 12, blue, 700);
      center(
        newer ? '刑侦记录' : '没有第二种业务',
        right + fw / 2,
        267,
        12,
        newer ? green : muted,
        700,
      );
      const gateX = mix(w * 0.22, w * 0.78, between(t, 0.9, 1.8));
      const targetX =
        newer && t >= 6 ? mix(w * 0.78, w * 0.22, between(t, 6, 6.8)) : split ? gateX : w * 0.22;
      ticketMove(
        '车牌结果',
        w * 0.36,
        190,
        Math.max(0, targetX - 40),
        289,
        t,
        1,
        2,
        split ? green : blue,
        84,
      );
      const clockTime = newer && t >= 1 && t < 6 ? 1 : t < 1 ? t : t - 5;
      meter(left + fw / 2, 325, blue, clockTime, split ? '计时暂停' : '停车计时');
      if (newer && t >= 4) {
        ticketMove('普通车', w * 0.36, 205, right + 7, 291, t, 4, 4.9, blue, Math.min(90, fw - 14));
      }
      if (newer && t >= 5) {
        const y = mix(318, 291, between(t, 5, 5.8));
        ticket('目标车', right + 7, y, Math.min(90, fw - 14), red);
        if (t >= 5.7) stamp('命中', right + fw - 61, 318, red, 53);
      }
      if (t >= 6 && newer) caption('停车从暂停处继续，筛查记录还在', 0, 405, w, green);
    }

    function miniScreen(w, t, newer, options) {
      const screenH = 180;
      display(0, 0, w, screenH, '刑侦筛查');
      if (newer && t >= 5.8 && t < 7.3) {
        const q = between(t, 5.8, 6.7);
        ctx.save();
        ctx.globalAlpha = q;
        text('输入目标车牌', 10, 35, 12, '#e0f5ed', 700);
        const typed = '粤AD12345'.slice(0, Math.floor(between(t, 6, 7) * 8));
        plate(typed || ' ', 10, 58, Math.min(150, w - 20), blue);
        const keys = ['粤', '京', 'A', 'B', 'D', '1', '2', '3', '4', '5', '退格', '确认'];
        const kw = (w - 35) / 6;
        keys.forEach((value, i) => {
          const x = 10 + (i % 6) * (kw + 3),
            y = 100 + Math.floor(i / 6) * 30;
          rect(x, y, kw, 24, '#dff3ee', '#78aaa5', 4);
          center(value, x + kw / 2, y + 5, 10, green, 700);
        });
        ctx.restore();
      } else {
        text('目标车牌', 13, 42, 11, '#a5d2d9');
        plate(newer && t >= 7.3 ? M.PLATE_A : '--', 13, 60, Math.min(150, w - 28), blue);
        rect(14, 119, 126, 39, '#e1f4f0', '#75c5bd', 7);
        center('设置目标', 77, 130, 13, green, 700);
        text(
          newer && t >= 7.3 ? '正在筛查' : '等待设置',
          Math.min(w - 88, 154),
          133,
          11,
          '#a5d2d9',
        );
        if (options.showBounds) {
          ctx.strokeStyle = '#f6c660';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(12, 117, 130, 43);
          ctx.setLineDash([]);
        }
      }
      return screenH;
    }
    function touch(w, h, newer, t, options) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, 180 * between(t, 0, 0.8));
      ctx.clip();
      miniScreen(w, t, newer, options);
      ctx.restore();
      const px = mix(w - 30, 70, between(t, 0.5, 1.8));
      const py = mix(28, 126, between(t, 0.5, 1.8));
      if (t < 4.5) pointer(px, py, 0.8);
      if (!newer) {
        if (t >= 1.7) {
          ctx.strokeStyle = '#dfa863';
          ctx.lineWidth = 3;
          ctx.strokeRect(0, 0, w, 180);
        }
        if (t >= 2) caption('选中的是整张背景图', 0, 202, w, red);
        if (t >= 4) ticketMove('图片', 10, 202, w - 108, 276, t, 4, 5.2, amber, 84);
        if (t >= 5) caption('编辑器里看不到独立的按钮对象', 0, 340, w, muted);
      } else {
        rect(0, 245, w, 82, '#eaf5ef', '#a6d1bf', 10);
        center('CPU 管理程序', w / 2, 260, 13, green, 700);
        center('判断手指点在哪里', w / 2, 286, 11, muted);
        if (t >= 2 && t < 5.8) ticketMove('手指位置', 40, 144, w * 0.36, 244, t, 2, 3.8, blue, 95);
        if (t >= 4 && t < 5.8) stamp('落在按钮范围', Math.max(0, w - 140), 208, green, 135);
        if (t >= 5 && t < 6.4)
          ticketMove('打开输入页', w * 0.36, 244, 35, 122, t, 5, 5.8, green, 105);
        if (t >= 6 && t < 7.3) {
          const q = between(t, 6, 7);
          pointer(mix(w - 30, w * 0.75, q), mix(220, 130, q), 0.65);
        }
        if (t >= 7.3) stamp('目标已设置', 0, 350, green, 120);
      }
    }

    function row(x, y, w, name, color, label) {
      rect(x, y, w, 36, '#fff', color + '88', 7);
      dot(x + 13, y + 18, color, 6);
      text(name, x + 25, y + 10, 12, C.ink, 700);
      if (label) text(label, x + Math.max(78, w - 90), y + 10, 11, color, 650);
    }
    function deleteScene(w, h, newer, t) {
      display(0, 0, w, 146, '屏幕上看到的列表');
      const switched = newer && t >= 6.6;
      const removed = newer && t >= 7.6;
      row(
        9,
        mix(20, 33, between(t, 0, 0.9)),
        w - 18,
        switched && !removed ? '车 B' : '车 A',
        switched && !removed ? amber : blue,
        switched && !removed ? '命中' : '普通',
      );
      row(
        9,
        77,
        w - 18,
        switched && !removed ? '车 A' : '车 C',
        switched && !removed ? blue : '#779397',
        '普通',
      );
      const px = mix(w - 36, w - 64, between(t, 0, 1.8));
      const py = mix(122, 50, between(t, 0, 1.8));
      if (t < 5.5 || (newer && t >= 7)) pointer(px, py, 0.9);
      text('系统里即将显示的顺序', 0, 175, 12, muted, 650);
      const arrival = between(t, 2, 3);
      const bx = mix(w - 98, 8, arrival),
        by = mix(151, 205, arrival);
      if (t >= 2 && !(newer && t >= 7.6) && !(!newer && t >= 4.7))
        ticket('车 B：命中', bx, by, 100, amber);
      if (t >= 2) ticket('车 A：普通', 8, 246, 100, blue);
      bin(w - 57, 300, '删掉');
      if (t >= 4 && !newer) {
        ticketMove('车 B', 8, 205, w - 100, 315, t, 4, 4.8, amber, 85);
        if (t >= 4.8) caption('点的是 A，删掉的却是 B', 0, 372, w, red);
      }
      if (newer && t >= 4 && t < 6) {
        const sx = mix(w - 82, w * 0.45, between(t, 4, 4.6));
        stamp('先等等', sx, 104, red, 80);
        caption('屏幕还没更新完，这次先不删', 0, 372, w, red);
      }
      if (newer && t >= 6 && t < 7.5) caption('B 已经完整显示，再看清楚要删谁', 0, 372, w, green);
      if (newer && t >= 7) {
        ticketMove('车 B', 10, 42, w - 99, 315, t, 7.05, 7.8, amber, 85);
        if (t >= 7.8) caption('删掉真正看到的 B，A 仍然保留', 0, 372, w, green);
      }
    }

    function board(x, y, w, h, newer, t, badCrc) {
      rect(x, y, w, h, '#e2f1e7', '#8bbca5', 12);
      text('FPGA 程序区', x + 10, y + 9, 12, green, 700);
      const gridX = x + 10,
        gridY = y + 38,
        cell = Math.max(11, Math.min(20, (w - 32) / 6));
      for (let i = 0; i < 12; i++) {
        const loaded = newer && t >= 5 + i * 0.07 && t < 8;
        rect(
          gridX + (i % 6) * (cell + 3),
          gridY + Math.floor(i / 6) * 24,
          cell,
          17,
          loaded ? (badCrc && i === 10 ? '#df8f7f' : '#66bca5') : '#d4dfd9',
          null,
          3,
        );
      }
      const stopped = newer && t >= 3 && t < 6.2;
      const failed = newer && badCrc && t >= 6 && t < 8;
      text(
        stopped || failed ? '管理员暂停' : newer && t >= 6 && t < 8 ? '新程序运行' : '内置程序',
        x + 10,
        y + h - 24,
        11,
        stopped || failed ? red : green,
        650,
      );
    }
    function loader(w, h, newer, t, options) {
      const px = 0,
        pw = Math.max(95, w * 0.35),
        sx = w * 0.52,
        sw = w - sx;
      rect(px, 6, pw, 92, '#e8f0fa', '#9bb9dc', 10);
      center('电脑', px + pw / 2, 19, 13, blue, 700);
      rect(px + 10, 48, pw - 20, 28, '#fff', '#a8c1dc', 5);
      center('准备文件', px + pw / 2, 55, 11, blue);
      display(sx, 0, sw, 115, '触摸屏');
      if (t >= 1.5) {
        rect(sx + 12, 51, Math.min(100, sw - 24), 28, '#dbf1e8', '#8ac7b1', 5);
        text('设置目标', sx + 19, 58, 11, green, 700);
      }
      board(sx, 221, sw, 128, newer, t, options.badCrc);
      if (t < 1) ticketMove('硬件电路', px, 44, sx + 8, 230, t, 0, 0.9, amber, 90);
      if (t >= 1 && t < 2.2) ticketMove('界面文件', px, 70, sx + 4, 56, t, 1, 1.9, blue, 92);
      if (!newer) {
        const tap = between(t, 6, 7.2);
        if (t >= 2) pointer(mix(sx + sw - 20, sx + 40, tap), mix(150, 67, tap), 0.7);
        if (t >= 7.1) {
          stamp('没有响应', 0, 370, red, 100);
          caption('管理员还在运行旧程序', 112, 378, Math.max(0, w - 112), red);
        }
        return;
      }
      if (t >= 2 && t < 4) ticketMove('准备接收', px, 84, sx + 8, 220, t, 2, 3.2, amber, 90);
      if (t >= 4 && t < 5.4) ticketMove('收件单', px, 84, sx + 8, 237, t, 4, 4.9, amber, 80);
      if (t >= 5 && t < 7) {
        for (let i = 0; i < 10; i++) {
          const q = between(t, 5 + i * 0.07, 5.65 + i * 0.07);
          const x = mix(px + 18, sx + 18 + (i % 5) * 15, q);
          const y = mix(87, 262 + Math.floor(i / 5) * 18, q);
          if (q > 0) rect(x, y, 12, 12, options.badCrc && i === 8 ? red : blue, null, 3);
        }
      }
      if (t >= 6 && t < 8) {
        if (options.badCrc) stamp('检查不一致', 0, 370, red, 115);
        else {
          stamp('检查通过', 0, 370, green, 100);
          pointer(
            mix(sx + sw - 20, sx + 40, between(t, 7, 7.7)),
            mix(155, 65, between(t, 7, 7.7)),
            0.7,
          );
        }
      }
      if (t >= 8) {
        const q = between(t, 8, 8.9);
        for (let i = 0; i < 4; i++)
          rect(sx + 12 + i * 20, 268 + q * 36, 13, 13, '#b7c5bf', null, 3);
        caption('断电后，内置程序重新出现', 0, 390, w, amber);
      }
    }

    function commands(w, h, newer, t, options) {
      const ps = options.shell === 'powershell',
        good = newer || ps;
      rect(0, 0, w, 116, '#183748', '#365b68', 10);
      text(ps ? 'PowerShell 窗口' : 'CMD 窗口', 12, 12, 13, '#d8f1ec', 700);
      line(12, 40, w - 12, 40, '#73949a', 1);
      const keyX = mix(w - 64, 20, between(t, 0.4, 1.9));
      const prefix = newer && !ps ? '直接运行' : '&';
      if (t < 3.2) ticket(prefix, keyX, 57, 90, good ? green : red);
      if (t >= 2 && !good) {
        const shake = Math.sin((t - 2) * 13) * (1 - between(t, 2.8, 3.5)) * 5;
        stamp('窗口不理解', Math.max(0, w - 135 + shake), 72, red, 125);
      } else if (t >= 2) stamp('可以启动', Math.max(0, w - 112), 72, green, 102);
      if (t >= 1 && t < 3) ticketMove('文件路径', 0, 136, 35, 63, t, 1, 2.2, blue, 90);
      rect(0, 153, w, 98, '#f2f5f3', '#ccdcd7', 10);
      text(good ? '上传工具' : '工具还没有启动', 12, 165, 12, muted, 700);
      if (t >= 3 && good) {
        const q = between(t, 3, 4);
        ticket('程序文件', mix(0, 12, q), mix(260, 194, q), Math.min(104, w * 0.43), blue);
        ticket('串口号', mix(w - 92, w - 112, q), mix(260, 194, q), Math.min(100, w * 0.43), amber);
      }
      if (t >= 4 && good) {
        const q = between(t, 4, 4.9);
        rect(w * 0.35, 275, mix(0, w * 0.42, q), 48, '#fff9e8', '#d1b77e', 6);
        if (q > 0.5) text('工具说明：要这两样', w * 0.35 + 8, 288, 11, '#88602e');
      }
      if (t >= 5 && good) {
        ticketMove('程序文件', 12, 194, w - 102, 347, t, 5, 6.4, blue, 96);
        if (t >= 6.2) stamp(good ? '送给 FPGA' : '还没发送', 0, 365, good ? green : red, 105);
      }
    }

    function book(x, y, w, label, changed, correct) {
      rect(x, y, w, 100, '#fff9e9', '#d5bf94', 8);
      text(label, x + 9, y + 9, 12, '#8f6a31', 700);
      line(x + 10, y + 37, x + w - 10, y + 37, '#d9c9a7', 2);
      text('停车页', x + 9, y + 47, 11, muted);
      text(changed ? '新背景' : '原背景', x + 9, y + 68, 11, changed ? green : muted);
      dot(x + w - 15, y + 73, correct ? green : red, 5);
    }
    function container(w, h, newer, t) {
      const bw = (w - 20) / 2;
      const leftChanged = !newer ? t >= 1.7 : t >= 5;
      const rightChanged = newer && t >= 5.5;
      book(0, 5, bw, '目录卡 ①', leftChanged, newer || t < 2);
      book(w - bw, 5, bw, '目录卡 ②', rightChanged, true);
      if (t < 1.3) {
        ticketMove('目录内容', w * 0.32, 150, 8, 60, t, 0, 0.8, blue, 83);
        ticketMove('目录内容', w * 0.32, 150, w - bw + 8, 60, t, 0, 0.8, blue, 83);
      }
      text('页面和图片放在这里', 0, 151, 12, muted, 650);
      const slotW = (w - 24) / 3;
      ['停车页', '原背景', '新背景'].forEach((value, i) => {
        const x = i * (slotW + 8),
          y = 182;
        rect(x, y, slotW, 70, '#eaf1ef', '#b5ccc5', 8);
        center(value, x + slotW / 2, y + 27, 11, i === 2 ? green : blue, 650);
      });
      if (t >= 1 && t < 3) ticketMove('新背景', w - 90, 115, w - slotW, 202, t, 1, 2, green, 82);
      if (t >= 2 && !newer) {
        arrow(w - bw / 2, 105, w * 0.45, 182, red);
        if (t >= 3) stamp('目录对不上', Math.max(0, w - 118), 269, red, 118);
      }
      if (t >= 4 && newer) {
        ticketMove('追加新背景', w * 0.34, 115, w - slotW, 203, t, 4, 5, green, 90);
        if (t >= 5.3) {
          arrow(bw / 2, 105, w - slotW / 2, 182, green);
          arrow(w - bw / 2, 105, w - slotW / 2, 182, green);
        }
      }
      if (t >= 6 && newer) stamp('两张都检查', 0, 280, green, 120);
      if (t >= 7) {
        ticketMove(
          '交给编辑器',
          w - slotW,
          202,
          w * 0.35,
          348,
          t,
          7,
          7.8,
          newer ? green : red,
          100,
        );
        if (t >= 7.8)
          caption(
            newer ? '打开并编译成功' : '目录冲突，无法正常打开',
            0,
            397,
            w,
            newer ? green : red,
          );
      }
    }

    function latency(w, h, newer, t) {
      road(w, 0, 88);
      const cx = 8 + ((t * 0.16) % 1) * Math.max(0, w - 100);
      vehicle(cx, 24, 72, blue, '车');
      machine(0, 118, Math.min(118, w * 0.4), 85, '识别机器', t);
      display(w - Math.min(125, w * 0.43), 118, Math.min(125, w * 0.43), 85, '画面');
      const targetX = w - Math.min(125, w * 0.43);
      if (t >= 0.2 && t < 2)
        ticketMove('车牌照片', Math.max(0, cx - 5), 60, 8, 146, t, 0.2, 1.8, blue, 92);
      if (t >= 2) {
        const atGate = mix(16, w * 0.46, between(t, 2, 3.2));
        const released = between(t, 5, 5.8);
        ticket('识别结果', mix(atGate, targetX + 6, released), mix(168, 153, released), 90, green);
      }
      if (t >= 3 && t < 5.8) {
        line(w * 0.57, 128, w * 0.57, mix(205, 130, between(t, 5, 5.8)), amber, 5);
        caption('等待画面换帧', Math.max(0, w * 0.35 - 20), 221, 150, amber);
      }
      const count = newer ? 2 : 1,
        gap = newer ? w * 0.45 : 0;
      for (let i = 0; i < count; i++) {
        const x = newer ? w * 0.26 + i * gap : w * 0.5;
        const running = i === 0 && newer ? Math.min(t, 2.8) : Math.min(t, 5.8);
        meter(
          x,
          300,
          i === 0 && newer ? green : blue,
          running,
          newer ? (i === 0 ? '认出来' : '画面看见') : '总等待',
        );
      }
      if (newer && t >= 2.8) text('约 2.7 ms', Math.max(0, w * 0.26 - 30), 367, 12, green, 700);
      if (newer && t >= 5.8) text('约 20.8 ms', Math.max(0, w * 0.71 - 35), 367, 12, blue, 700);
      if (!newer && t >= 5.8) caption('一只表看不出哪段时间花在哪里', 0, 379, w, red);
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
    return {
      renderers,
      g,
      helpers: {
        caption,
        tag,
        road,
        vehicle,
        machine,
        display,
        ticket,
        ticketMove,
        bin,
        pointer,
        stamp,
        tickText,
        progressBar,
        meter,
        beat,
        status,
        blue,
        amber,
        green,
        red,
        paper,
        muted,
        between,
        mix,
      },
    };
  }

  root.SoCMotion = { create, between, mix };
})(globalThis);
