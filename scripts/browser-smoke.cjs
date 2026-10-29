'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { topics } = require('../evolution-models.js');
const root = path.resolve(__dirname, '..'),
  artifacts = path.join(root, 'test-artifacts');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};
async function seek(page, step, fraction) {
  await page.locator('#progress').evaluate(
    (el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    step * 1000 + Math.round(fraction * 1000),
  );
  await page.waitForFunction((value) => Number(document.body.dataset.step) === value, step);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function pixelChange(page, reset = false) {
  return page.evaluate((reset) => {
    const canvas = document.querySelector('#demo-canvas');
    const { width, height } = canvas;
    const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    const before = window.__animationPixels;
    window.__animationPixels = pixels;
    if (reset || !before) return null;
    const regions = [0, 1].map(() => ({
      changed: 0,
      minX: width,
      minY: height,
      maxX: 0,
      maxY: 0,
    }));
    for (let i = 0; i < pixels.length; i += 4) {
      if (
        Math.abs(pixels[i] - before[i]) +
          Math.abs(pixels[i + 1] - before[i + 1]) +
          Math.abs(pixels[i + 2] - before[i + 2]) <
        45
      )
        continue;
      const pixel = i / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const region = regions[x < width / 2 ? 0 : 1];
      region.changed++;
      region.minX = Math.min(region.minX, x);
      region.maxX = Math.max(region.maxX, x);
      region.minY = Math.min(region.minY, y);
      region.maxY = Math.max(region.maxY, y);
    }
    return regions.map((r) => ({
      changed: r.changed,
      width: r.changed ? r.maxX - r.minX + 1 : 0,
      height: r.changed ? r.maxY - r.minY + 1 : 0,
    }));
  }, reset);
}
const server = http.createServer((req, res) => {
  const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executable =
    process.env.BROWSER_PATH ||
    [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ].find(fs.existsSync);
  const browser = process.env.BROWSER_CDP_URL
    ? await chromium.connectOverCDP(process.env.BROWSER_CDP_URL)
    : await chromium.launch({
        headless: true,
        ...(executable ? { executablePath: executable } : {}),
        args: ['--disable-gpu', '--no-sandbox'],
      });
  const errors = [];
  let states = 0;
  const motion = {};
  let page;
  try {
    page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
      reducedMotion: 'reduce',
    });
    await page.addInitScript(() => {
      window.__canvasTextOverflow = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (value, x, y, ...args) {
        if (this.canvas.id === 'demo-canvas') {
          const transform = this.getTransform();
          const point = new DOMPoint(x, y).matrixTransform(transform);
          const width = this.measureText(String(value)).width * transform.a;
          const height = Number((this.font.match(/([\d.]+)px/) || [0, 0])[1]) * transform.d;
          if (
            point.x < -2 ||
            point.y < -2 ||
            point.x + width > this.canvas.width + 2 ||
            point.y + height > this.canvas.height + 2
          ) {
            if (window.__canvasTextOverflow.length < 10)
              window.__canvasTextOverflow.push({
                text: String(value),
                x: point.x,
                y: point.y,
              });
          }
        }
        return original.call(this, value, x, y, ...args);
      };
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => {
      if (r.status() >= 400 && !r.url().endsWith('/favicon.ico'))
        errors.push(r.status() + ' ' + r.url());
    });
    await page.goto(base);
    assert.equal(await page.locator('a[href^="evolution.html?topic="]').count(), 13);
    await page.screenshot({
      path: path.join(artifacts, 'index-desktop.png'),
      fullPage: true,
    });
    for (const topic of topics) {
      await page.goto(base + '/evolution.html?topic=' + topic.id);
      await page.waitForFunction((id) => document.body.dataset.topic === id, topic.id);
      assert.equal(await page.locator('#play').textContent(), '播放');
      for (let step = 0; step < topic.steps.length; step++) {
        await seek(page, step, 0.5);
        assert.equal(await page.locator('#step-caption').textContent(), topic.steps[step]);
        states++;
      }
      const samples = [];
      const motionSteps = topic.steps.map((_, step) => step);
      for (const step of motionSteps) {
        await seek(page, step, 0.2);
        const caption = await page.locator('#step-caption').textContent();
        await pixelChange(page, true);
        const changes = [];
        for (const fraction of [0.5, 0.8]) {
          await seek(page, step, fraction);
          assert.equal(await page.locator('#step-caption').textContent(), caption);
          changes.push(await pixelChange(page));
        }
        samples.push({ step, changes });
      }
      motion[topic.id] = samples;
      if (
        ['frame', 'crop', 'tracks', 'touch', 'delete', 'loader', 'container'].includes(topic.id)
      ) {
        const middle = Math.floor((topic.steps.length - 1) / 2);
        for (const fraction of [0.2, 0.5, 0.8]) {
          await seek(page, middle, fraction);
          await page.locator('#demo-canvas').screenshot({
            path: path.join(artifacts, `${topic.id}-motion-${Math.round(fraction * 10)}.png`),
          });
        }
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(overflow, false, topic.id + ' desktop overflow');
      assert.deepEqual(
        await page.evaluate(() => window.__canvasTextOverflow),
        [],
        topic.id + ' canvas text clipping',
      );
      await page.screenshot({
        path: path.join(artifacts, topic.id + '-desktop.png'),
        fullPage: true,
      });
      await page.locator('#restart').click();
      assert.equal(await page.locator('#play').textContent(), '暂停');
      await page.locator('#play').click();
      await page.locator('#next-step').click();
      assert.equal(await page.locator('body').getAttribute('data-step'), '1');
      await page.locator('#previous-step').click();
      assert.equal(await page.locator('body').getAttribute('data-step'), '0');
    }
    fs.writeFileSync(
      path.join(artifacts, 'motion-measurements.json'),
      JSON.stringify(motion, null, 2),
    );
    const weakMotion = Object.entries(motion)
      .filter(
        ([, samples]) =>
          samples.filter((sample) =>
            sample.changes.every((regions) =>
              regions.some((r) => r.changed >= 500 && r.width >= 55 && r.height >= 26),
            ),
          ).length < Math.max(2, Math.ceil(samples.length / 2)),
      )
      .map(([id]) => id);
    assert.deepEqual(weakMotion, [], 'at least half of each story must show substantial motion');
    await page.goto(base + '/evolution.html?topic=tracks');
    await seek(page, 1, 0.15);
    await page.locator('#play').click();
    await page.waitForFunction(
      () =>
        Number(document.body.dataset.step) === 1 && Number(document.body.dataset.progress) >= 300,
      null,
      { timeout: 4000 },
    );
    await page.locator('#play').click();
    const pausedAt = await page.locator('body').getAttribute('data-progress');
    await page.waitForTimeout(250);
    assert.equal(
      await page.locator('body').getAttribute('data-progress'),
      pausedAt,
      'pause freezes time',
    );
    await page.goto(base + '/evolution.html?topic=crop');
    await page.getByRole('slider', { name: '原始检测框宽度' }).evaluate((el) => {
      el.value = '480';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.match(await page.locator('.experiment-value').textContent(), /30 px/);
    await page.goto(base + '/evolution.html?topic=loader');
    await page.locator('#bad-crc').check();
    await page.goto(base + '/evolution.html?topic=touch');
    await page.locator('#show-bounds').check();
    await page.goto(base + '/evolution.html?topic=commands');
    await page.getByLabel('当前终端').selectOption('powershell');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const topic of topics) {
      await page.goto(base + '/evolution.html?topic=' + topic.id);
      await page.waitForFunction((id) => document.body.dataset.topic === id, topic.id);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        topic.id + ' mobile overflow',
      );
    }
    await page.screenshot({
      path: path.join(artifacts, 'latency-mobile.png'),
      fullPage: true,
    });
    await page.goto(base + '/evolution.html?topic=touch');
    await seek(page, 5, 0.5);
    await page.screenshot({
      path: path.join(artifacts, 'touch-mobile.png'),
      fullPage: true,
    });
    await page.goto(base);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
      'index mobile overflow',
    );
    await page.screenshot({
      path: path.join(artifacts, 'index-mobile.png'),
      fullPage: true,
    });
    await page.goto(pathToFileURL(path.join(root, 'evolution.html')).href + '?topic=mailbox');
    await page.waitForFunction(() => document.body.dataset.topic === 'mailbox');
    await page.locator('#next-step').click();
    assert.equal(await page.locator('body').getAttribute('data-step'), '1');
    for (const name of [
      'pipeline.html',
      'line_buffer.html',
      'anim3_yolo_postprocess.html',
      'anim4_crop_resize.html',
      'anim5_crop_fifo.html',
      'anim6_lprnet_ctc.html',
      'anim7_mailbox_cdc.html',
    ]) {
      await page.goto(base + '/' + name);
      await page.waitForSelector('canvas');
    }
    assert.deepEqual(errors, [], 'browser errors');
    const recording = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'reduce',
      recordVideo: { dir: artifacts, size: { width: 1280, height: 960 } },
    });
    const movie = await recording.newPage();
    const video = movie.video();
    for (const [id, step] of [
      ['frame', 1],
      ['crop', 3],
      ['tracks', 4],
      ['touch', 2],
      ['delete', 3],
    ]) {
      await movie.goto(base + '/evolution.html?topic=' + id);
      await seek(movie, step, 0.1);
      await movie.locator('#speed').selectOption('2');
      await movie.locator('#play').click();
      await movie.evaluate(() => window.scrollTo(0, 0));
      await movie.waitForTimeout(2000);
      await movie.locator('#play').click();
    }
    await recording.close();
    fs.renameSync(await video.path(), path.join(artifacts, 'motion-tour.webm'));
    const result = {
      result: 'PASS',
      topics: topics.length,
      states,
      motionTopics: Object.keys(motion).length,
      motionScenesPerTopic: 'at least half',
      motionVideo: 'motion-tour.webm',
      legacyPages: 7,
      mobileWidth: 390,
      offlineFileMode: true,
      errors,
    };
    fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } catch (error) {
    fs.writeFileSync(path.join(artifacts, 'browser-failure.txt'), String(error.stack || error));
    if (page)
      await page.screenshot({
        path: path.join(artifacts, 'failure.png'),
        fullPage: true,
      });
    throw error;
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
