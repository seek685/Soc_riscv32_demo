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
  const PHASE_MS = 3200;
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
  function pill(s, x, y, color = C.teal) {
    ctx.font = `600 11px ${font}`;
    const w = ctx.measureText(s).width + 18;
    rect(x, y, w, 23, color + '13', color + '40', 6);
    text(s, x + 9, y + 5, 11, color, 600);
    return w;
  }
  function plate(s, x, y, w = 130, color = C.blue) {
    rect(x, y, w, 31, color, color, 5);
    center(s, x + w / 2, y + 7, 14, '#fff', 650);
  }
  function drawPanels() {
    const stacked = cw < 740,
      pad = 16,
      gap = 16,
      pw = stacked ? cw - 32 : (cw - 48) / 2;
    const ph = 550;
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
      {
        x: stacked ? pad : pad + pw + gap,
        y: stacked ? pad + ph + gap : pad,
        w: pw,
        h: ph,
      },
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
  const motion = window.SoCMotion.create({
    ctx,
    C,
    rect,
    text,
    wrap,
    center,
    line,
    arrow,
    dot,
    plate,
    M,
  });
  function draw() {
    cw = Math.max(280, Math.round(canvas.parentElement.clientWidth));
    const panels = drawPanels();
    const phase = Math.min(0.999, elapsed / PHASE_MS);
    panels.forEach((p, i) =>
      panel(p, i ? topic.after : topic.before, !!i, (w, h, n) =>
        motion.renderers[topic.id](w, h, n, step + phase, options),
      ),
    );
    canvas.setAttribute('aria-label', topic.title + '：' + topic.steps[step]);
  }
  function update() {
    const total = topic.steps.length;
    const within = Math.min(999, Math.floor((elapsed / PHASE_MS) * 1000));
    $('progress').max = total * 1000 - 1;
    $('progress').value = step * 1000 + within;
    $('progress').setAttribute(
      'aria-valuetext',
      `第 ${step + 1} 幕：${topic.steps[step]}，已播放 ${Math.floor(within / 10)}%`,
    );
    $('progress-label').textContent = `${step + 1} / ${total}`;
    $('step-number').textContent = '第 ' + (step + 1) + ' 幕';
    if ($('step-caption').textContent !== topic.steps[step])
      $('step-caption').textContent = topic.steps[step];
    $('previous-step').disabled = step === 0;
    $('next-step').disabled = step === total - 1;
    $('play').textContent = playing ? '暂停' : '播放';
    $('play').setAttribute('aria-pressed', String(playing));
    document.body.dataset.topic = topic.id;
    document.body.dataset.step = step;
    document.body.dataset.progress = within;
  }
  function schedule() {
    if (raf === null) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = null;
    if (playing) {
      if (last) elapsed += Math.min(200, now - last) * speed;
      if (elapsed >= PHASE_MS) {
        if (step < topic.steps.length - 1) {
          step++;
          elapsed -= PHASE_MS;
        } else if ($('loop').checked) {
          if (elapsed >= PHASE_MS + 1400) {
            step = 0;
            elapsed = 0;
          }
        } else {
          elapsed = PHASE_MS;
          playing = false;
        }
      }
      update();
    }
    last = now;
    draw();
    if (playing) schedule();
  }
  function setStep(value, pause = true) {
    step = Math.max(0, Math.min(topic.steps.length - 1, value));
    elapsed = PHASE_MS * 0.15;
    last = 0;
    if (pause) playing = false;
    update();
    schedule();
  }
  function setProgress(value) {
    const position = Math.max(0, Math.min(topic.steps.length * 1000 - 1, value));
    step = Math.floor(position / 1000);
    elapsed = ((position % 1000) * PHASE_MS) / 1000;
    playing = false;
    last = 0;
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
      const l = label('试试文件校验失败');
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
      const l = label('显示系统认得的点击范围');
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
    if (!playing && step === topic.steps.length - 1 && elapsed >= PHASE_MS) setProgress(0);
    playing = !playing;
    last = 0;
    update();
    schedule();
  });
  $('previous-step').addEventListener('click', () => setStep(step - 1));
  $('next-step').addEventListener('click', () => setStep(step + 1));
  $('restart').addEventListener('click', () => {
    setProgress(0);
    playing = true;
    update();
    schedule();
  });
  $('progress').addEventListener('input', (e) => setProgress(Number(e.target.value)));
  $('speed').addEventListener('change', (e) => {
    speed = Number(e.target.value);
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
